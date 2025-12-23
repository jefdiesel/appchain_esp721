import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Check if Stripe is properly configured
function isStripeEnabled() {
  return (
    process.env.STRIPE_SECRET_KEY &&
    !process.env.STRIPE_SECRET_KEY.includes("xxx")
  );
}

// POST - create checkout session for $5 upgrade
export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeEnabled()) {
    // Dev mode - just upgrade directly
    const { supabaseAdmin } = await import("@/lib/supabase");

    await supabaseAdmin
      .from("users")
      .update({
        plan: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("clerk_id", userId);

    return NextResponse.json({
      success: true,
      message: "Upgraded (dev mode - Stripe not configured)",
    });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Chainhost Unlimited",
              description: "Unlimited inscriptions + custom templates",
            },
            unit_amount: 500, // $5.00
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=false`,
      customer_email: email,
      metadata: {
        clerk_user_id: userId,
      },
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
