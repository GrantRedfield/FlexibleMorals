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
import donorRoutes from "./routes/donorRoutes.ts";
import chatRoutes from "./routes/chatRoutes.ts";
import commentRoutes from "./routes/commentRoutes.ts";

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

// PayPal webhook needs raw body for signature verification
// Must be registered before bodyParser.json()
app.post("/webhooks/paypal", express.raw({ type: "application/json" }), handlePayPalWebhook);

app.use(bodyParser.json());

// Donor API routes
app.use("/api/donor", donorRoutes);

// Chat API routes
app.use("/api/chat", chatRoutes);

// Comment API routes
app.use("/api/comments", commentRoutes);

// DynamoDB client and table name imported from shared module above

// === Helper: Fetch all posts ===
const getAllPosts = async () => {
  const command = new ScanCommand({ TableName: TABLE_NAME });
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

// === Helper: Check if user submitted today ===
const hasUserSubmittedToday = async (authorId: string): Promise<boolean> => {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const result = await client.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: `USER#${authorId}`, SK: `SUBMISSION#${today}` }),
    })
  );
  return !!result.Item;
};

// === Helper: Record user submission for today ===
const recordUserSubmission = async (authorId: string) => {
  const today = new Date().toISOString().split("T")[0];
  await client.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall({
        PK: `USER#${authorId}`,
        SK: `SUBMISSION#${today}`,
        submittedAt: new Date().toISOString(),
      }),
    })
  );
};

// === POST /posts ===
app.post("/posts", async (req, res) => {
  const { content, authorId = "anonymous" } = req.body;
  if (!content) return res.status(400).json({ error: "Missing content" });
  if (content.length > 80) return res.status(400).json({ error: "Commandment too long (max 80 characters)" });

  try {
    // Check if user already submitted today
    if (await hasUserSubmittedToday(authorId)) {
      return res.status(429).json({ error: "You can only submit one commandment per day" });
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
      votes: 1,
      username: authorId,
    });
  } catch (err) {
    console.error("❌ Failed to create post:", err);
    res.status(500).json({ error: "Failed to create post" });
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
    let newVoteState = direction;

    if (previousVote === direction) {
      console.log(`User ${userId} repeated same vote on post ${id}`);
      return res.json({ id, votes });
    }

    if (!previousVote) {
      votes += direction === "up" ? 1 : -1;
    } else if (previousVote === "up" && direction === "down") {
      votes -= 2;
    } else if (previousVote === "down" && direction === "up") {
      votes += 2;
    }

    userVotes[userId] = newVoteState;

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
    res.json({ id, votes });
  } catch (err) {
    console.error("❌ Vote update failed:", err);
    res.status(500).json({ error: "Vote update failed" });
  }
});

// === Start Server ===
const PORT = parseInt(process.env.PORT || "3001", 10);
app.listen(PORT, () => {
  console.log(`✅ FlexibleMorals backend running on port ${PORT} (${process.env.NODE_ENV || "development"})`);
});
