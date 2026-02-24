import type { Request, Response } from "express";
import https from "https";
import crypto from "crypto";
import {
  TIER_THRESHOLDS,
  calculateTier,
  getDonationRecord,
  createDonationRecord,
  getDonorRecord,
  updateDonorStatus,
  getLinkedUsername,
} from "../lib/donationHelpers.ts";

// Fetch PayPal certificate for signature verification
async function fetchPayPalCert(certUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate the cert URL is from PayPal
    const url = new URL(certUrl);
    if (!url.hostname.endsWith(".paypal.com")) {
      reject(new Error("Invalid PayPal certificate URL"));
      return;
    }

    https.get(certUrl, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
  });
}

// Verify PayPal webhook signature
async function verifyWebhookSignature(
  headers: Record<string, string | undefined>,
  body: string,
  webhookId: string
): Promise<boolean> {
  try {
    const transmissionId = headers["paypal-transmission-id"];
    const transmissionTime = headers["paypal-transmission-time"];
    const transmissionSig = headers["paypal-transmission-sig"];
    const certUrl = headers["paypal-cert-url"];
    const authAlgo = headers["paypal-auth-algo"];

    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
      console.error("Missing PayPal headers for verification");
      return false;
    }

    // Fetch the certificate
    const cert = await fetchPayPalCert(certUrl);

    // Construct the expected signature string
    // Format: <transmissionId>|<transmissionTime>|<webhookId>|<crc32(body)>
    const crc = crypto.createHash("crc32c").update(body).digest("hex");
    const expectedSignatureString = `${transmissionId}|${transmissionTime}|${webhookId}|${crc}`;

    // Verify the signature
    const verifier = crypto.createVerify("SHA256");
    verifier.update(expectedSignatureString);

    const isValid = verifier.verify(cert, transmissionSig, "base64");
    return isValid;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    // In development, we might want to skip verification
    if (process.env.PAYPAL_MODE === "sandbox") {
      console.warn("Skipping signature verification in sandbox mode");
      return true;
    }
    return false;
  }
}

// Main webhook handler
export async function handlePayPalWebhook(req: Request, res: Response) {
  console.log("Received PayPal webhook");

  // Always respond 200 to acknowledge receipt
  // PayPal will retry if we don't respond quickly
  res.status(200).send("OK");

  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    // Verify signature (skip in development if no webhook ID)
    if (webhookId) {
      const isValid = await verifyWebhookSignature(
        req.headers as Record<string, string>,
        body,
        webhookId
      );
      if (!isValid) {
        console.error("Invalid webhook signature");
        return;
      }
    } else {
      console.warn("PAYPAL_WEBHOOK_ID not set, skipping signature verification");
    }

    const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log(`Event type: ${event.event_type}`);

    // Handle payment completed events
    if (
      event.event_type === "PAYMENT.SALE.COMPLETED" ||
      event.event_type === "CHECKOUT.ORDER.COMPLETED" ||
      event.event_type === "PAYMENT.CAPTURE.COMPLETED"
    ) {
      const resource = event.resource;
      const transactionId = resource.id;

      // Extract payer email - location varies by event type
      const payerEmail =
        resource.payer?.email_address ||
        resource.payer_info?.email ||
        resource.payer?.payer_info?.email ||
        event.resource?.payer?.email_address ||
        null;

      // Extract amount
      const amount = resource.amount?.total || resource.amount?.value;
      const amountCents = amount ? Math.round(parseFloat(amount) * 100) : 0;
      const currency = resource.amount?.currency || resource.amount?.currency_code || "USD";

      console.log(`Payment: $${amountCents / 100} ${currency} from ${payerEmail}`);

      // Check idempotency
      const existing = await getDonationRecord(transactionId);
      if (existing) {
        console.log(`Transaction ${transactionId} already processed`);
        return;
      }

      // Look up linked username
      const linkedUsername = payerEmail ? await getLinkedUsername(payerEmail) : null;

      // Create donation record
      await createDonationRecord({
        transactionId,
        paypalEmail: payerEmail || "unknown",
        username: linkedUsername,
        amount: amountCents,
        currency,
        status: "completed",
      });

      console.log(`Donation recorded: ${transactionId}, linked to: ${linkedUsername || "unclaimed"}`);

      // If linked, update donor status
      if (linkedUsername && payerEmail) {
        await updateDonorStatus(linkedUsername, amountCents, payerEmail);
      }
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
  }
}

// Re-export helper functions for backward compat (donorRoutes.ts imports from here)
export {
  getDonorRecord,
  updateDonorStatus,
  getLinkedUsername,
  calculateTier,
  TIER_THRESHOLDS,
};
