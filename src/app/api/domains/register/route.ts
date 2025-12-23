import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// Check if Stripe is configured (checked at runtime)
function isStripeEnabled() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key && key.startsWith("sk_") && !key.includes("xxx");
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { domain, tld } = await req.json();

  if (!domain || !tld) {
    return NextResponse.json(
      { error: "Domain and TLD required" },
      { status: 400 }
    );
  }

  try {
    // Get or create user in our database
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          clerk_id: userId,
          email: user.emailAddresses[0]?.emailAddress || "",
        },
        { onConflict: "clerk_id" }
      )
      .select()
      .single();

    if (userError) {
      console.error("User upsert error:", userError);
      return NextResponse.json(
        { error: "Failed to create user record" },
        { status: 500 }
      );
    }

    // Create pending domain record
    const { data: domainRecord, error: domainError } = await supabaseAdmin
      .from("domains")
      .insert({
        user_id: dbUser.id,
        domain: domain.toLowerCase(),
        tld: tld.toLowerCase(),
        status: isStripeEnabled() ? "pending" : "active", // Skip to active if no Stripe
      })
      .select()
      .single();

    if (domainError) {
      console.error("Domain insert error:", domainError);
      return NextResponse.json(
        { error: "Failed to create domain record" },
        { status: 500 }
      );
    }

    // If Stripe is not configured, skip checkout and go to dashboard
    if (!isStripeEnabled()) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return NextResponse.json({
        checkoutUrl: `${appUrl}/dashboard?domain_registered=${domainRecord.id}`,
        domainId: domainRecord.id,
        skippedPayment: true
      });
    }

    // Get or create Stripe customer
    const { createCheckoutSession, getOrCreateCustomer } = await import("@/lib/stripe");

    const customerId = await getOrCreateCustomer(
      user.emailAddresses[0]?.emailAddress || "",
      userId,
      dbUser.stripe_customer_id
    );

    // Update user with Stripe customer ID if new
    if (!dbUser.stripe_customer_id) {
      await supabaseAdmin
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", dbUser.id);
    }

    // Create Stripe checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const checkoutUrl = await createCheckoutSession({
      customerId,
      domain: domain.toLowerCase(),
      tld: tld.toLowerCase(),
      successUrl: `${appUrl}/dashboard?domain_registered=${domainRecord.id}`,
      cancelUrl: `${appUrl}/builder?step=domain&canceled=true`,
    });

    return NextResponse.json({ checkoutUrl, domainId: domainRecord.id });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to start registration" },
      { status: 500 }
    );
  }
}
