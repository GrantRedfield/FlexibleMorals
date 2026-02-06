import express from "express";
import type { Request, Response } from "express";
const { Router } = express;
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { nanoid } from "nanoid";

const router = Router();

const client = new DynamoDBClient({
  region: "local",
  endpoint: "http://localhost:8000",
});

const TABLE_NAME = "FlexibleTable";

// Simple in-memory rate limiter: 1 comment per 3 seconds per user
const lastCommentTime: Record<string, number> = {};

// GET /api/comments/:postId
router.get("/:postId", async (req: Request, res: Response) => {
  const { postId } = req.params;

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: marshall({
          ":pk": `COMMENTS#${postId}`,
          ":prefix": "COMMENT#",
        }),
        ScanIndexForward: true,
      })
    );

    const comments = (result.Items || []).map((item) => {
      const record = unmarshall(item);
      return {
        id: record.commentId,
        username: record.username,
        text: record.text,
        votes: record.votes ?? 0,
        userVotes: record.userVotes ?? {},
        parentId: record.parentId || null,
        createdAt: record.createdAt,
      };
    });

    return res.json({ comments });
  } catch (err) {
    console.error("Failed to fetch comments:", err);
    return res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/comments/:postId
router.post("/:postId", async (req: Request, res: Response) => {
  const { postId } = req.params;
  const { username, text, parentId } = req.body;

  if (!username || !username.trim()) {
    return res.status(400).json({ error: "Username is required" });
  }
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Comment text is required" });
  }
  if (text.length > 500) {
    return res.status(400).json({ error: "Comment too long (max 500 characters)" });
  }

  // Rate limiting
  const now = Date.now();
  if (lastCommentTime[username] && now - lastCommentTime[username] < 3000) {
    return res.status(429).json({ error: "Slow down! One comment per 3 seconds." });
  }
  lastCommentTime[username] = now;

  const createdAt = new Date().toISOString();
  const commentId = nanoid(8);

  try {
    const item: Record<string, any> = {
      PK: `COMMENTS#${postId}`,
      SK: `COMMENT#${createdAt}#${commentId}`,
      commentId,
      username: username.trim(),
      text: text.trim(),
      votes: 1,
      userVotes: { [username.trim()]: "up" },
      createdAt,
    };

    if (parentId) {
      item.parentId = parentId;
    }

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(item),
      })
    );

    return res.json({
      id: commentId,
      username: username.trim(),
      text: text.trim(),
      votes: 1,
      userVotes: { [username.trim()]: "up" },
      parentId: parentId || null,
      createdAt,
    });
  } catch (err) {
    console.error("Failed to create comment:", err);
    return res.status(500).json({ error: "Failed to create comment" });
  }
});

// POST /api/comments/:postId/:commentId/vote
router.post("/:postId/:commentId/vote", async (req: Request, res: Response) => {
  const { postId, commentId } = req.params;
  const { direction, userId = "guest" } = req.body;

  if (!direction || !["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "Invalid direction" });
  }

  try {
    // We need to find the comment by scanning for commentId
    // Since SK includes timestamp, we query and filter
    const queryResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        FilterExpression: "commentId = :cid",
        ExpressionAttributeValues: marshall({
          ":pk": `COMMENTS#${postId}`,
          ":prefix": "COMMENT#",
          ":cid": commentId,
        }),
      })
    );

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const rawItem = queryResult.Items[0];
    const comment = unmarshall(rawItem);
    let votes = Number(comment.votes ?? 0);
    let userVotes = comment.userVotes || {};

    const previousVote = userVotes[userId];

    if (previousVote === direction) {
      return res.json({ id: commentId, votes });
    }

    if (!previousVote) {
      votes += direction === "up" ? 1 : -1;
    } else if (previousVote === "up" && direction === "down") {
      votes -= 2;
    } else if (previousVote === "down" && direction === "up") {
      votes += 2;
    }

    userVotes[userId] = direction;

    // Use the original SK from the queried item
    const sk = rawItem.SK!.S!;

    await client.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: `COMMENTS#${postId}`, SK: sk }),
        UpdateExpression: "SET votes = :v, userVotes = :u",
        ExpressionAttributeValues: marshall({
          ":v": votes,
          ":u": userVotes,
        }),
      })
    );

    return res.json({ id: commentId, votes });
  } catch (err) {
    console.error("Vote on comment failed:", err);
    return res.status(500).json({ error: "Vote failed" });
  }
});

export default router;
