import express from "express";
import type { Request, Response } from "express";
const { Router } = express;
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { nanoid } from "nanoid";

const router = Router();

const client = new DynamoDBClient({
  region: "local",
  endpoint: "http://localhost:8000",
});

const TABLE_NAME = "FlexibleTable";

// Simple in-memory rate limiter: 1 message per second per user
const lastMessageTime: Record<string, number> = {};

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

  // Rate limiting
  const now = Date.now();
  if (lastMessageTime[username] && now - lastMessageTime[username] < 1000) {
    return res.status(429).json({ error: "Slow down! One message per second." });
  }
  lastMessageTime[username] = now;

  const createdAt = new Date().toISOString();
  const messageId = nanoid(8);

  try {
    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall({
          PK: "CHAT#global",
          SK: `MSG#${createdAt}#${messageId}`,
          messageId,
          username: username.trim(),
          message: message.trim(),
          createdAt,
        }),
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
