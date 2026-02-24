import type { Request, Response } from "express";
import Stripe from "stripe";
import {
  getDonationRecord,
  createDonationRecord,
  getLinkedUsername,
  updateDonorStatus,
} from "../lib/donationHelpers.ts";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2026-01-28.clover",
    });
  }
  return _stripe;
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // In development without webhook secret, parse directly
      console.warn("STRIPE_WEBHOOK_SECRET not set, skipping signature verification");
      event = JSON.parse(req.body.toString());
    }
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const transactionId = `stripe_${session.id}`;
    const customerEmail = session.customer_details?.email || session.customer_email || "unknown";
    const amountCents = session.amount_total || 0;
    const currency = (session.currency || "usd").toUpperCase();

    console.log(`Stripe payment: $${amountCents / 100} ${currency} from ${customerEmail}`);

    try {
      // Idempotency check
      const existing = await getDonationRecord(transactionId);
      if (existing) {
        console.log(`Transaction ${transactionId} already processed`);
        return res.json({ received: true });
      }

      // Look up linked username
      const linkedUsername = customerEmail !== "unknown"
        ? await getLinkedUsername(customerEmail)
        : null;

      // Create donation record
      await createDonationRecord({
        transactionId,
        paypalEmail: customerEmail,
        username: linkedUsername,
        amount: amountCents,
        currency,
        status: "completed",
      });

      console.log(`Donation recorded: ${transactionId}, linked to: ${linkedUsername || "unclaimed"}`);

      // If linked, update donor status
      if (linkedUsername && customerEmail !== "unknown") {
        await updateDonorStatus(linkedUsername, amountCents, customerEmail);
      }
    } catch (err) {
      console.error("Error processing Stripe webhook:", err);
    }
  }

  res.json({ received: true });
}
