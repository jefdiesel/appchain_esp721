import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { upgradeToPaid } from "@/lib/credits";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const clerkUserId = session.metadata?.clerk_user_id;
    const stripeCustomerId = session.customer as string;

    if (clerkUserId) {
      const success = await upgradeToPaid(clerkUserId, stripeCustomerId);
      if (success) {
        console.log(`User ${clerkUserId} upgraded to paid`);
      } else {
        console.error(`Failed to upgrade user ${clerkUserId}`);
      }
    }
  }

  return NextResponse.json({ received: true });
}
