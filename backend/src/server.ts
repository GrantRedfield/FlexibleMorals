// backend/src/server.ts
import express from "express";
import cors from "cors";
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

// ✅ Initialize Express
const app = express();
const PORT = 3001;

// === Middleware ===
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

// === DynamoDB Local connection ===
const db = new DynamoDBClient({
  region: "us-west-2",
  endpoint: "http://localhost:8000", // DynamoDB local endpoint
});

const TABLE_NAME = "FlexibleTable";

/* ======================================================
   ✅ ROUTES
====================================================== */

// === GET /posts — Fetch all posts from DynamoDB
app.get("/posts", async (req, res) => {
  try {
    const command = new ScanCommand({ TableName: TABLE_NAME });
    const result = await db.send(command);
    const items = result.Items ? result.Items.map((i) => unmarshall(i)) : [];

    console.log("📦 Raw DynamoDB items:", JSON.stringify(items, null, 2));

    // Map DynamoDB schema → frontend-friendly schema
    const posts = items.map((item) => {
      const pk = item.PK || item.id || "";
      const id = pk.startsWith("POST#") ? pk.replace("POST#", "") : pk;

      return {
        id,
        title: item.title || "(Untitled)",
        content: item.content || "",
        votes: item.votes ?? 0,
      };
    });

    console.log("✅ Mapped posts:", posts);
    res.json(posts);
  } catch (err) {
    console.error("❌ Error fetching posts:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// === POST /posts/:id/vote — Update vote count for a post
app.post("/posts/:id/vote", async (req, res) => {
  const { direction } = req.body;
  const postId = req.params.id;

  if (!["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "Invalid vote direction" });
  }

  try {
    const delta = direction === "up" ? 1 : -1;

    const command = new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `POST#${postId}`, SK: "META" }),
      UpdateExpression: "SET votes = if_not_exists(votes, :zero) + :delta",
      ExpressionAttributeValues: marshall({
        ":delta": delta,
        ":zero": 0,
      }),
      ReturnValues: "ALL_NEW",
    });

    const result = await db.send(command);
    const updated = result.Attributes ? unmarshall(result.Attributes) : null;

    const response = {
      id: updated.PK.replace("POST#", ""),
      title: updated.title || "(Untitled)",
      votes: updated.votes || 0,
      content: updated.content || "",
    };

    console.log(`🗳️ Updated votes for post ${postId}:`, response);
    res.json(response);
  } catch (err) {
    console.error("❌ Error updating votes:", err);
    res.status(500).json({ error: "Failed to update vote count" });
  }
});

/* ======================================================
   ✅ START SERVER
====================================================== */
app.listen(PORT, () => {
  console.log(`✅ FlexibleMorals backend running on http://localhost:${PORT}`);
  console.log(`🪣 Connected to DynamoDB Local → Table: ${TABLE_NAME}`);
});
