// backend/src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import {
  ScanCommand,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import { client, TABLE_NAME } from "./lib/dynamodb.ts";
import { handlePayPalWebhook } from "./webhooks/paypal.ts";
import { handleStripeWebhook } from "./webhooks/stripe.ts";
import donorRoutes from "./routes/donorRoutes.ts";
import stripeRoutes from "./routes/stripeRoutes.ts";
import chatRoutes from "./routes/chatRoutes.ts";
import commentRoutes from "./routes/commentRoutes.ts";
import authRoutes from "./routes/authRoutes.js";

const app = express();

// CORS: allow frontend origin (supports comma-separated origins for multiple environments)
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
}));

// Webhooks need raw body for signature verification
// Must be registered before bodyParser.json()
app.post("/webhooks/paypal", express.raw({ type: "application/json" }), handlePayPalWebhook);
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);

app.use(bodyParser.json());

// Donor API routes
app.use("/api/donor", donorRoutes);

// Stripe API routes
app.use("/api/stripe", stripeRoutes);

// Chat API routes
app.use("/api/chat", chatRoutes);

// Comment API routes
app.use("/api/comments", commentRoutes);

// Auth API routes (Cognito + legacy fallback)
app.use("/auth", authRoutes);

// DynamoDB client and table name imported from shared module above

// === Helper: Fetch all posts ===
const getAllPosts = async () => {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    ConsistentRead: true,
  });
  const result = await client.send(command);

  const posts = (result.Items || [])
    // Support both "META" and "META#POST" structures
    .filter((i) =>
      i.SK?.S === "META" || i.SK?.S === "META#POST"
    )
    .map((i) => unmarshall(i));

  return posts;
};

// === GET /posts ===
app.get("/posts", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const posts = await getAllPosts();
    const formatted = posts.map((p) => ({
      id: p.PK?.replace("POST#", ""),
      title: p.title ?? "",
      content: p.body ?? "",
      votes: Number(p.votes ?? p.score ?? 0),
      username: p.authorId ?? "unknown",
      createdAt: p.createdAt ?? null,
      userVotes: p.userVotes ?? {},
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Error fetching posts:", err);
    res.status(500).json({ error: "Failed to fetch posts." });
  }
});

// === Vote cooldown — server-side enforcement (works across devices) ===
const VOTE_COOLDOWN_SECONDS = 5 * 60; // 5 minutes

const getVoteCooldown = async (userId: string): Promise<number | null> => {
  const result = await client.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `USER#${userId}`, SK: "VOTE_COOLDOWN" }),
    })
  );
  if (!result.Item) return null;
  const item = unmarshall(result.Item);
  const end = Number(item.cooldownEnd ?? 0);
  return end > Date.now() ? end : null;
};

const setVoteCooldown = async (userId: string) => {
  const end = Date.now() + VOTE_COOLDOWN_SECONDS * 1000;
  await client.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall({
        PK: `USER#${userId}`,
        SK: "VOTE_COOLDOWN",
        cooldownEnd: end,
        createdAt: new Date().toISOString(),
      }),
    })
  );
  return end;
};

// GET /api/vote-cooldown/:userId — check if a user has an active cooldown
app.get("/api/vote-cooldown/:userId", async (req, res) => {
  try {
    const end = await getVoteCooldown(req.params.userId);
    if (end) {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      return res.json({ cooldown: true, cooldownEnd: end, remaining });
    }
    res.json({ cooldown: false });
  } catch (err) {
    console.error("❌ Cooldown check failed:", err);
    res.status(500).json({ error: "Failed to check cooldown" });
  }
});

// POST /api/vote-cooldown — set a cooldown for a user (called when frontend detects exhaustion)
app.post("/api/vote-cooldown", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    // Only set if not already active
    const existing = await getVoteCooldown(userId);
    if (existing) {
      return res.json({ cooldownEnd: existing, remaining: Math.ceil((existing - Date.now()) / 1000) });
    }
    const end = await setVoteCooldown(userId);
    res.json({ cooldownEnd: end, remaining: VOTE_COOLDOWN_SECONDS });
  } catch (err) {
    console.error("❌ Cooldown set failed:", err);
    res.status(500).json({ error: "Failed to set cooldown" });
  }
});

const DAILY_SUBMISSION_LIMIT = 1;

// === Helper: Get how many commandments a user has submitted today ===
const getSubmissionCount = async (authorId: string): Promise<number> => {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const result = await client.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `USER#${authorId}`, SK: `SUBMISSION#${today}` }),
    })
  );
  if (!result.Item) return 0;
  const item = unmarshall(result.Item);
  return typeof item.count === "number" ? item.count : 1; // legacy items without count = 1
};

// === Helper: Increment submission count for today ===
const recordUserSubmission = async (authorId: string) => {
  const today = new Date().toISOString().split("T")[0];
  await client.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `USER#${authorId}`, SK: `SUBMISSION#${today}` }),
      UpdateExpression: "SET #cnt = if_not_exists(#cnt, :zero) + :one, submittedAt = :now",
      ExpressionAttributeNames: { "#cnt": "count" },
      ExpressionAttributeValues: marshall({ ":one": 1, ":zero": 0, ":now": new Date().toISOString() }),
    })
  );
};

// === POST /posts ===
app.post("/posts", async (req, res) => {
  const { content, authorId = "anonymous" } = req.body;
  if (!content) return res.status(400).json({ error: "Missing content" });
  if (content.length > 80) return res.status(400).json({ error: "Commandment too long (max 80 characters)" });

  try {
    // Check daily submission limit
    const submissionCount = await getSubmissionCount(authorId);
    if (submissionCount >= DAILY_SUBMISSION_LIMIT) {
      return res.status(429).json({ error: "You can only submit 1 commandment per day" });
    }

    const newId = Date.now().toString();
    const item = {
      PK: { S: `POST#${newId}` },
      SK: { S: "META#POST" },
      title: { S: content },
      body: { S: content },
      votes: { N: "1" },
      authorId: { S: authorId },
      createdAt: { S: new Date().toISOString() },
      userVotes: { M: { [authorId]: { S: "up" } } },
    };

    await client.send(new PutItemCommand({ TableName: TABLE_NAME, Item: item }));

    // Record that user submitted today
    await recordUserSubmission(authorId);

    res.json({
      id: newId,
      title: content,
      content,
      votes: 1,
      username: authorId,
      createdAt: item.createdAt.S,
    });
  } catch (err) {
    console.error("❌ Failed to create post:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// === POST /posts/bulk-vote — efficient bulk vote for "Bless All" / "Banish All" ===
app.post("/posts/bulk-vote", async (req, res) => {
  const { postIds, direction, userId = "guest" } = req.body;

  if (!Array.isArray(postIds) || postIds.length === 0) {
    return res.status(400).json({ error: "Missing postIds array" });
  }
  if (!direction || !["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "Invalid direction" });
  }

  try {
    // Single cooldown check for the whole batch
    if (userId !== "guest") {
      const cooldownEnd = await getVoteCooldown(userId);
      if (cooldownEnd) {
        const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
        return res.status(429).json({ error: "Vote cooldown active", cooldownEnd, remaining });
      }
    }

    const inc = direction === "up" ? 1 : -1;
    let succeeded = 0;

    // Process votes sequentially to avoid DynamoDB throttling
    for (const id of postIds) {
      try {
        const getRes = await client.send(
          new GetItemCommand({
            TableName: TABLE_NAME,
            Key: marshall({ PK: `POST#${id}`, SK: "META#POST" }),
          })
        );
        if (!getRes.Item) continue;

        const post = unmarshall(getRes.Item);
        const userVotes = post.userVotes || {};
        const previousVote = userVotes[userId];

        // Skip if user already voted the same direction
        if (previousVote === direction) continue;

        // Calculate delta: undo previous vote if changing direction
        let delta = inc;
        if (previousVote) {
          delta = direction === "up" ? 2 : -2;
        }

        const votes = Number(post.votes ?? 0) + delta;
        userVotes[userId] = direction;

        await client.send(
          new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: marshall({ PK: `POST#${id}`, SK: "META#POST" }),
            UpdateExpression: "SET votes = :v, userVotes = :u",
            ExpressionAttributeValues: marshall({ ":v": votes, ":u": userVotes }),
          })
        );
        succeeded++;
      } catch (err) {
        console.error(`❌ Bulk vote failed for post ${id}:`, err);
      }
    }

    console.log(`✅ Bulk vote: ${succeeded}/${postIds.length} posts ${direction}voted by ${userId}`);
    res.json({ succeeded, total: postIds.length, direction });
  } catch (err) {
    console.error("❌ Bulk vote failed:", err);
    res.status(500).json({ error: "Bulk vote failed" });
  }
});

// === POST /posts/:id/vote ===
app.post("/posts/:id/vote", async (req, res) => {
  const { id } = req.params;
  const { direction, userId = "guest" } = req.body;

  if (!direction || !["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "Invalid direction" });
  }

  try {
    // Check server-side vote cooldown (cross-device enforcement)
    if (userId !== "guest") {
      const cooldownEnd = await getVoteCooldown(userId);
      if (cooldownEnd) {
        const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
        return res.status(429).json({ error: "Vote cooldown active", cooldownEnd, remaining });
      }
    }

    // Fetch current post
    const getRes = await client.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: `POST#${id}`, SK: "META#POST" }),
      })
    );

    if (!getRes.Item) return res.status(404).json({ error: "Post not found" });

    const post = unmarshall(getRes.Item);
    let votes = Number(post.votes ?? 0);
    let userVotes = post.userVotes || {};

    const previousVote = userVotes[userId];

    // Already voted the same direction — no-op
    if (previousVote === direction) {
      return res.json({ id, votes, userVotes });
    }

    // Undo previous vote if changing direction
    if (previousVote) {
      votes += previousVote === "up" ? -1 : 1;
    }

    votes += direction === "up" ? 1 : -1;
    userVotes[userId] = direction;

    await client.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: `POST#${id}`, SK: "META#POST" }),
        UpdateExpression: "SET votes = :v, userVotes = :u",
        ExpressionAttributeValues: marshall({
          ":v": votes,
          ":u": userVotes,
        }),
      })
    );

    console.log(`✅ Post ${id} new total votes: ${votes}`);
    res.json({ id, votes, userVotes });
  } catch (err) {
    console.error("❌ Vote update failed:", err);
    res.status(500).json({ error: "Vote update failed" });
  }
});

// === Start Server ===
const PORT = parseInt(process.env.PORT || "3001", 10);
app.listen(PORT, () => {
  const cognitoEnabled = !!process.env.COGNITO_USER_POOL_ID && !!process.env.COGNITO_CLIENT_ID;
  console.log(`✅ FlexibleMorals backend running on port ${PORT} (${process.env.NODE_ENV || "development"})`);
  console.log(`   Auth: ${cognitoEnabled ? "Amazon Cognito" : "Legacy JWT"}`);
});
