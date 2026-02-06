import type { Request, Response } from "express";
import https from "https";
import crypto from "crypto";
import {
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { client, TABLE_NAME } from "../lib/dynamodb.ts";

// Tier thresholds in cents
const TIER_THRESHOLDS = {
  benefactor: 10000, // $100+
  patron: 2500,      // $25+
  supporter: 100,    // $1+
};

function calculateTier(totalCents: number): string {
  if (totalCents >= TIER_THRESHOLDS.benefactor) return "benefactor";
  if (totalCents >= TIER_THRESHOLDS.patron) return "patron";
  if (totalCents >= TIER_THRESHOLDS.supporter) return "supporter";
  return "none";
}

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
      console.warn("⚠️ Skipping signature verification in sandbox mode");
      return true;
    }
    return false;
  }
}

// Get linked username for a PayPal email
async function getLinkedUsername(paypalEmail: string): Promise<string | null> {
  try {
    const result = await client.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: `PAYPAL#${paypalEmail.toLowerCase()}`, SK: "LINK" }),
      })
    );
    if (result.Item) {
      const data = unmarshall(result.Item);
      return data.username || null;
    }
    return null;
  } catch (err) {
    console.error("Error getting linked username:", err);
    return null;
  }
}

// Check if donation already processed (idempotency)
async function getDonationRecord(transactionId: string): Promise<any | null> {
  try {
    const result = await client.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: `DONATION#${transactionId}`, SK: "RECORD" }),
      })
    );
    return result.Item ? unmarshall(result.Item) : null;
  } catch (err) {
    console.error("Error getting donation record:", err);
    return null;
  }
}

// Create donation record
async function createDonationRecord(data: {
  transactionId: string;
  paypalEmail: string;
  username: string | null;
  amount: number;
  currency: string;
  status: string;
}) {
  await client.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall({
        PK: `DONATION#${data.transactionId}`,
        SK: "RECORD",
        ...data,
        webhookReceivedAt: new Date().toISOString(),
        processedAt: data.username ? new Date().toISOString() : null,
      }),
    })
  );
}

// Get current donor record
async function getDonorRecord(username: string): Promise<any | null> {
  try {
    const result = await client.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: `DONOR#${username}`, SK: "STATUS" }),
      })
    );
    return result.Item ? unmarshall(result.Item) : null;
  } catch (err) {
    console.error("Error getting donor record:", err);
    return null;
  }
}

// Update donor status after receiving donation
async function updateDonorStatus(username: string, newAmount: number, paypalEmail: string) {
  const current = await getDonorRecord(username);
  const newTotal = (current?.totalDonated || 0) + newAmount;
  const tier = calculateTier(newTotal);
  const now = new Date().toISOString();

  await client.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall({
        PK: `DONOR#${username}`,
        SK: "STATUS",
        username,
        totalDonated: newTotal,
        tier,
        firstDonationAt: current?.firstDonationAt || now,
        lastDonationAt: now,
        paypalEmail: paypalEmail.toLowerCase(),
      }),
    })
  );

  console.log(`✅ Updated donor status for ${username}: tier=${tier}, total=$${newTotal / 100}`);
}

// Main webhook handler
export async function handlePayPalWebhook(req: Request, res: Response) {
  console.log("📨 Received PayPal webhook");

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
        console.error("❌ Invalid webhook signature");
        return;
      }
    } else {
      console.warn("⚠️ PAYPAL_WEBHOOK_ID not set, skipping signature verification");
    }

    const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log(`📌 Event type: ${event.event_type}`);

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

      console.log(`💰 Payment: $${amountCents / 100} ${currency} from ${payerEmail}`);

      // Check idempotency
      const existing = await getDonationRecord(transactionId);
      if (existing) {
        console.log(`⏭️ Transaction ${transactionId} already processed`);
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

      console.log(`📝 Donation recorded: ${transactionId}, linked to: ${linkedUsername || "unclaimed"}`);

      // If linked, update donor status
      if (linkedUsername && payerEmail) {
        await updateDonorStatus(linkedUsername, amountCents, payerEmail);
      }
    }
  } catch (err) {
    console.error("❌ Error processing webhook:", err);
  }
}

// Export helper functions for use in donor routes
export {
  getDonorRecord,
  updateDonorStatus,
  getLinkedUsername,
  calculateTier,
  TIER_THRESHOLDS,
};
