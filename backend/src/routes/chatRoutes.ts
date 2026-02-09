import express from "express";
import type { Request, Response } from "express";
const { Router } = express;
import {
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { nanoid } from "nanoid";
import { client, TABLE_NAME } from "../lib/dynamodb.ts";

const router = Router();

// Progressive spam prevention system
// Tracks last message time, spam strike count, and last strike time per user
interface UserRateState {
  lastMessageTime: number;   // Timestamp of last sent message
  strikes: number;           // How many times they've hit the rate limit
  lastStrikeTime: number;    // When the last strike was recorded
  mutedUntil: number;        // Timestamp when current mute expires
}
const userRateState: Record<string, UserRateState> = {};

const BASE_COOLDOWN = 15000; // 15 seconds base cooldown
const MAX_COOLDOWN = 600000; // 10 minutes max mute
const STRIKE_RESET_MS = 24 * 60 * 60 * 1000; // 24 hours to reset strikes

// TTL for chat messages — auto-delete after this many days (default: 0 = keep forever)
// Set CHAT_TTL_DAYS env var to enable auto-cleanup (e.g. 7 for one week)
const CHAT_TTL_DAYS = parseInt(process.env.CHAT_TTL_DAYS || "0", 10);
const CHAT_TTL_SECONDS = CHAT_TTL_DAYS * 24 * 60 * 60;

function getUserCooldown(strikes: number): number {
  // Each strike doubles the cooldown: 15s, 30s, 60s, 120s, 240s, 480s, capped at 600s
  return Math.min(BASE_COOLDOWN * Math.pow(2, strikes), MAX_COOLDOWN);
}

// GET /api/chat/messages?since=<ISO>
router.get("/messages", async (req: Request, res: Response) => {
  const { since } = req.query;

  try {
    if (since) {
      // Fetch new messages since timestamp
      const result = await client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND SK > :since",
          ExpressionAttributeValues: marshall({
            ":pk": "CHAT#global",
            ":since": `MSG#${since}`,
          }),
          ScanIndexForward: true,
        })
      );

      const messages = (result.Items || []).map((item) => {
        const record = unmarshall(item);
        return {
          id: record.messageId,
          username: record.username,
          message: record.message,
          createdAt: record.createdAt,
        };
      });

      return res.json({ messages });
    } else {
      // Fetch latest 50 messages
      const result = await client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
          ExpressionAttributeValues: marshall({
            ":pk": "CHAT#global",
            ":prefix": "MSG#",
          }),
          ScanIndexForward: false,
          Limit: 50,
        })
      );

      const messages = (result.Items || [])
        .map((item) => {
          const record = unmarshall(item);
          return {
            id: record.messageId,
            username: record.username,
            message: record.message,
            createdAt: record.createdAt,
          };
        })
        .reverse(); // Chronological order

      return res.json({ messages });
    }
  } catch (err) {
    console.error("Failed to fetch chat messages:", err);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// POST /api/chat/messages
router.post("/messages", async (req: Request, res: Response) => {
  const { username, message } = req.body;

  if (!username || !username.trim()) {
    return res.status(400).json({ error: "Username is required" });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (message.length > 200) {
    return res.status(400).json({ error: "Message too long (max 200 characters)" });
  }

  // Block links
  const urlPattern = /https?:\/\/|www\.|\.com|\.org|\.net|\.io|\.gg|\.co|\.xyz|\.dev/i;
  if (urlPattern.test(message)) {
    return res.status(400).json({ error: "Links are not allowed in chat" });
  }

  // Progressive rate limiting with escalating mute for spammers
  const now = Date.now();
  const trimmedUser = username.trim();

  // Initialize state for new users
  if (!userRateState[trimmedUser]) {
    userRateState[trimmedUser] = { lastMessageTime: 0, strikes: 0, lastStrikeTime: 0, mutedUntil: 0 };
  }
  const state = userRateState[trimmedUser];

  // Reset strikes if 24 hours have passed since last strike
  if (state.strikes > 0 && now - state.lastStrikeTime > STRIKE_RESET_MS) {
    state.strikes = 0;
  }

  // Check if user is currently muted (from previous spam)
  if (state.mutedUntil > now) {
    const remaining = Math.ceil((state.mutedUntil - now) / 1000);
    return res.status(429).json({
      error: `You're muted for spamming. Wait ${remaining} more seconds.`,
      cooldown: remaining,
      muted: true,
    });
  }

  // Check normal cooldown since last message
  const currentCooldown = getUserCooldown(state.strikes);
  if (state.lastMessageTime && now - state.lastMessageTime < currentCooldown) {
    // User is trying to send too fast — this is a spam strike
    state.strikes += 1;
    state.lastStrikeTime = now;
    const newCooldown = getUserCooldown(state.strikes);
    state.mutedUntil = now + newCooldown;
    const remaining = Math.ceil(newCooldown / 1000);
    console.log(`[SPAM] User "${trimmedUser}" strike #${state.strikes} — muted for ${remaining}s`);
    return res.status(429).json({
      error: `Slow down! You've been muted for ${remaining} seconds. Repeated spam increases mute time.`,
      cooldown: remaining,
      muted: true,
      strikes: state.strikes,
    });
  }

  state.lastMessageTime = now;

  const createdAt = new Date().toISOString();
  const messageId = nanoid(8);

  try {
    const chatItem: Record<string, any> = {
      PK: "CHAT#global",
      SK: `MSG#${createdAt}#${messageId}`,
      messageId,
      username: username.trim(),
      message: message.trim(),
      createdAt,
    };

    // Add TTL for automatic cleanup in production (DynamoDB deletes expired items)
    if (CHAT_TTL_DAYS > 0) {
      chatItem.ttl = Math.floor(Date.now() / 1000) + CHAT_TTL_SECONDS;
    }

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(chatItem),
      })
    );

    return res.json({
      id: messageId,
      username: username.trim(),
      message: message.trim(),
      createdAt,
    });
  } catch (err) {
    console.error("Failed to send chat message:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
