import express from "express";
import type { Request, Response } from "express";
import Stripe from "stripe";

const { Router } = express;
const router = Router();

// Lazy init so env vars are loaded by the time we make API calls
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2026-01-28.clover",
    });
  }
  return _stripe;
}

// POST /api/stripe/create-checkout-session
router.post("/create-checkout-session", async (req: Request, res: Response) => {
  const { amount } = req.body; // amount in cents

  if (!amount || typeof amount !== "number" || amount < 100) {
    return res.status(400).json({ error: "Amount must be at least $1.00 (100 cents)" });
  }

  try {
    // Determine success/cancel URLs from the request origin
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, "") || "http://localhost:1573";

    const session = await getStripe().checkout.sessions.create({
      // Omit payment_method_types to use dynamic payment methods —
      // Stripe automatically shows Apple Pay, Google Pay, Link, etc.
      // based on device support and your Dashboard settings.
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Flexible Morals Donation",
              description: "Thank you for supporting our congregation!",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/vote?donation=success`,
      cancel_url: `${origin}/vote?donation=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Error creating Stripe checkout session:", err.message || err);
    res.status(500).json({ error: err.message || "Failed to create checkout session" });
  }
});

export default router;
