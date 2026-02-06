import express from "express";
import type { Request, Response } from "express";
const { Router } = express;
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  getDonorRecord,
  updateDonorStatus,
  getLinkedUsername,
  calculateTier,
  TIER_THRESHOLDS,
} from "../webhooks/paypal.ts";

const router = Router();

const client = new DynamoDBClient({
  region: "local",
  endpoint: "http://localhost:8000",
});

const TABLE_NAME = "FlexibleTable";

// Badge icons for each tier
const TIER_BADGES: Record<string, string> = {
  supporter: "star",
  patron: "halo",
  benefactor: "crown",
};

// GET /api/donor/status/:username - Get donor status for a user
router.get("/status/:username", async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const donor = await getDonorRecord(username);

    if (!donor || donor.tier === "none") {
      return res.json({
        isDonor: false,
        tier: null,
        totalDonated: 0,
        badge: null,
      });
    }

    res.json({
      isDonor: true,
      tier: donor.tier,
      totalDonated: donor.totalDonated,
      badge: TIER_BADGES[donor.tier] || null,
    });
  } catch (err) {
    console.error("Error getting donor status:", err);
    res.status(500).json({ error: "Failed to get donor status" });
  }
});

// GET /api/donor/bulk-status - Get donor status for multiple users
router.get("/bulk-status", async (req: Request, res: Response) => {
  try {
    const usernamesParam = req.query.usernames as string;
    if (!usernamesParam) {
      return res.json({ donors: {} });
    }

    const usernames = usernamesParam.split(",").map((u) => u.trim()).filter(Boolean);
    if (usernames.length === 0) {
      return res.json({ donors: {} });
    }

    // Fetch donor records for all usernames
    const donors: Record<string, { tier: string; badge: string }> = {};

    // Batch get would be more efficient, but for simplicity we'll do individual gets
    // In production, consider using BatchGetItem
    await Promise.all(
      usernames.map(async (username) => {
        const donor = await getDonorRecord(username);
        if (donor && donor.tier && donor.tier !== "none") {
          donors[username] = {
            tier: donor.tier,
            badge: TIER_BADGES[donor.tier] || "star",
          };
        }
      })
    );

    res.json({ donors });
  } catch (err) {
    console.error("Error getting bulk donor status:", err);
    res.status(500).json({ error: "Failed to get donor statuses" });
  }
});

// POST /api/donor/link-email - Link PayPal email to username
router.post("/link-email", async (req: Request, res: Response) => {
  try {
    const { paypalEmail, username } = req.body;

    if (!paypalEmail || !username) {
      return res.status(400).json({ error: "Missing paypalEmail or username" });
    }

    const normalizedEmail = paypalEmail.toLowerCase().trim();

    // Check if email is already linked to a different user
    const existingLink = await getLinkedUsername(normalizedEmail);
    if (existingLink && existingLink !== username) {
      return res.status(400).json({
        error: "This email is already linked to another account",
      });
    }

    // Create or update the link
    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall({
          PK: `PAYPAL#${normalizedEmail}`,
          SK: "LINK",
          paypalEmail: normalizedEmail,
          username,
          linkedAt: new Date().toISOString(),
        }),
      })
    );

    // Check for unclaimed donations from this email and credit them
    const unclaimedDonations = await findUnclaimedDonations(normalizedEmail);
    let totalCredited = 0;

    for (const donation of unclaimedDonations) {
      // Update donation record to mark as claimed
      await client.send(
        new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: marshall({ PK: `DONATION#${donation.transactionId}`, SK: "RECORD" }),
          UpdateExpression: "SET username = :u, processedAt = :p",
          ExpressionAttributeValues: marshall({
            ":u": username,
            ":p": new Date().toISOString(),
          }),
        })
      );

      totalCredited += donation.amount;
    }

    // If there were unclaimed donations, update donor status
    if (totalCredited > 0) {
      await updateDonorStatus(username, totalCredited, normalizedEmail);
    }

    const donor = await getDonorRecord(username);

    res.json({
      success: true,
      message: unclaimedDonations.length > 0
        ? `Email linked! Credited ${unclaimedDonations.length} previous donation(s) totaling $${(totalCredited / 100).toFixed(2)}`
        : "Email linked successfully. Future donations from this email will earn you flair!",
      donorStatus: donor
        ? {
            isDonor: true,
            tier: donor.tier,
            totalDonated: donor.totalDonated,
            badge: TIER_BADGES[donor.tier] || null,
          }
        : { isDonor: false, tier: null, totalDonated: 0, badge: null },
    });
  } catch (err) {
    console.error("Error linking email:", err);
    res.status(500).json({ error: "Failed to link email" });
  }
});

// Helper: Find unclaimed donations for an email
async function findUnclaimedDonations(paypalEmail: string): Promise<any[]> {
  try {
    // Scan for donations with this email that have no username
    // In production, use a GSI for better performance
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(PK, :prefix) AND paypalEmail = :email AND attribute_not_exists(username)",
        ExpressionAttributeValues: marshall({
          ":prefix": "DONATION#",
          ":email": paypalEmail,
        }),
      })
    );

    // Also check for donations where username is null
    const result2 = await client.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(PK, :prefix) AND paypalEmail = :email AND username = :null",
        ExpressionAttributeValues: marshall({
          ":prefix": "DONATION#",
          ":email": paypalEmail,
          ":null": null,
        }),
      })
    );

    const donations = [
      ...(result.Items || []).map((i) => unmarshall(i)),
      ...(result2.Items || []).map((i) => unmarshall(i)),
    ];

    return donations;
  } catch (err) {
    console.error("Error finding unclaimed donations:", err);
    return [];
  }
}

// GET /api/donor/my-status - Get current user's full donor profile
router.get("/my-status", async (req: Request, res: Response) => {
  try {
    const username = req.query.username as string;
    if (!username) {
      return res.status(400).json({ error: "Username required" });
    }

    const donor = await getDonorRecord(username);

    if (!donor) {
      return res.json({
        isDonor: false,
        tier: null,
        totalDonated: 0,
        linkedEmail: null,
        nextTier: "supporter",
        amountToNextTier: TIER_THRESHOLDS.supporter,
        badge: null,
      });
    }

    // Calculate next tier info
    let nextTier: string | null = null;
    let amountToNextTier = 0;

    if (donor.tier === "none" || !donor.tier) {
      nextTier = "supporter";
      amountToNextTier = TIER_THRESHOLDS.supporter - (donor.totalDonated || 0);
    } else if (donor.tier === "supporter") {
      nextTier = "patron";
      amountToNextTier = TIER_THRESHOLDS.patron - donor.totalDonated;
    } else if (donor.tier === "patron") {
      nextTier = "benefactor";
      amountToNextTier = TIER_THRESHOLDS.benefactor - donor.totalDonated;
    }

    res.json({
      isDonor: donor.tier !== "none",
      tier: donor.tier,
      totalDonated: donor.totalDonated,
      linkedEmail: donor.paypalEmail || null,
      firstDonationAt: donor.firstDonationAt,
      lastDonationAt: donor.lastDonationAt,
      nextTier,
      amountToNextTier: Math.max(0, amountToNextTier),
      badge: TIER_BADGES[donor.tier] || null,
    });
  } catch (err) {
    console.error("Error getting my donor status:", err);
    res.status(500).json({ error: "Failed to get donor status" });
  }
});

// GET /api/donor/tiers - Get tier information
router.get("/tiers", async (_req: Request, res: Response) => {
  res.json({
    tiers: [
      {
        name: "supporter",
        threshold: TIER_THRESHOLDS.supporter,
        badge: "star",
        icon: "⭐",
        color: "#cd7f32",
        label: "Supporter",
      },
      {
        name: "patron",
        threshold: TIER_THRESHOLDS.patron,
        badge: "halo",
        icon: "✦",
        color: "#c0c0c0",
        label: "Patron",
      },
      {
        name: "benefactor",
        threshold: TIER_THRESHOLDS.benefactor,
        badge: "crown",
        icon: "👑",
        color: "#d4af37",
        label: "Benefactor",
      },
    ],
  });
});

export default router;
