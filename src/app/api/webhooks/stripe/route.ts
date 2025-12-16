import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { registerDomain, setNameservers } from "@/lib/dynadot";
import { addZone, createPagesProject, addCustomDomain } from "@/lib/cloudflare";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata;

    if (metadata?.type === "domain_registration") {
      await handleDomainRegistration(metadata.domain, metadata.tld, session.id);
    } else if (metadata?.type === "domain_renewal") {
      await handleDomainRenewal(metadata.domain, metadata.tld);
    }
  }

  return NextResponse.json({ received: true });
}

async function handleDomainRegistration(
  domain: string,
  tld: string,
  sessionId: string
) {
  const fullDomain = `${domain}.${tld}`;
  console.log(`Processing domain registration: ${fullDomain}`);

  try {
    // 1. Register domain with Dynadot
    const registration = await registerDomain(fullDomain, 1);

    if (!registration.success) {
      console.error(`Dynadot registration failed: ${registration.error}`);
      await updateDomainStatus(domain, tld, "failed");
      return;
    }

    // 2. Add zone to Cloudflare
    const zone = await addZone(fullDomain);

    if (!zone.success) {
      console.error(`Cloudflare zone creation failed: ${zone.error}`);
      // Domain is registered but CF failed - mark as registered
      await updateDomainStatus(domain, tld, "registered", {
        expires_at: registration.expiration,
      });
      return;
    }

    // 3. Set nameservers at Dynadot to point to Cloudflare
    if (zone.nameservers) {
      await setNameservers(fullDomain, zone.nameservers);
    }

    // 4. Create Cloudflare Pages project
    const projectName = `ch-${domain}-${tld}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const pagesProject = await createPagesProject(projectName);

    // 5. Add custom domain to Pages project
    if (pagesProject.success) {
      await addCustomDomain(projectName, fullDomain);
    }

    // 6. Update database
    await supabaseAdmin
      .from("domains")
      .update({
        status: "active",
        cloudflare_zone_id: zone.zoneId,
        cloudflare_nameservers: zone.nameservers,
        pages_project_name: pagesProject.projectName,
        expires_at: registration.expiration,
      })
      .eq("domain", domain)
      .eq("tld", tld);

    // 7. Create order record
    const { data: domainRecord } = await supabaseAdmin
      .from("domains")
      .select("id, user_id")
      .eq("domain", domain)
      .eq("tld", tld)
      .single();

    if (domainRecord) {
      await supabaseAdmin.from("orders").insert({
        user_id: domainRecord.user_id,
        domain_id: domainRecord.id,
        stripe_session_id: sessionId,
        type: "registration",
        amount_cents: 999, // TODO: Get actual amount from session
        status: "paid",
      });
    }

    console.log(`Domain ${fullDomain} successfully registered and configured`);
  } catch (error) {
    console.error(`Error processing domain registration:`, error);
    await updateDomainStatus(domain, tld, "failed");
  }
}

async function handleDomainRenewal(domain: string, tld: string) {
  const fullDomain = `${domain}.${tld}`;
  console.log(`Processing domain renewal: ${fullDomain}`);

  try {
    const { renewDomain } = await import("@/lib/dynadot");
    const renewal = await renewDomain(fullDomain, 1);

    if (renewal.success) {
      await supabaseAdmin
        .from("domains")
        .update({
          status: "active",
          expires_at: renewal.expiration,
        })
        .eq("domain", domain)
        .eq("tld", tld);

      console.log(`Domain ${fullDomain} renewed successfully`);
    } else {
      console.error(`Domain renewal failed: ${renewal.error}`);
    }
  } catch (error) {
    console.error(`Error processing domain renewal:`, error);
  }
}

async function updateDomainStatus(
  domain: string,
  tld: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  await supabaseAdmin
    .from("domains")
    .update({ status, ...extra })
    .eq("domain", domain)
    .eq("tld", tld);
}
