import {
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { client, TABLE_NAME } from "./dynamodb.ts";

// Tier thresholds in cents
export const TIER_THRESHOLDS = {
  benefactor: 10000, // $100+
  patron: 2500,      // $25+
  supporter: 100,    // $1+
};

export function calculateTier(totalCents: number): string {
  if (totalCents >= TIER_THRESHOLDS.benefactor) return "benefactor";
  if (totalCents >= TIER_THRESHOLDS.patron) return "patron";
  if (totalCents >= TIER_THRESHOLDS.supporter) return "supporter";
  return "none";
}

// Get linked username for a donation email (PayPal or Stripe)
export async function getLinkedUsername(paypalEmail: string): Promise<string | null> {
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
export async function getDonationRecord(transactionId: string): Promise<any | null> {
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
export async function createDonationRecord(data: {
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
export async function getDonorRecord(username: string): Promise<any | null> {
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
export async function updateDonorStatus(username: string, newAmount: number, paypalEmail: string) {
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

  console.log(`Updated donor status for ${username}: tier=${tier}, total=$${newTotal / 100}`);
}
