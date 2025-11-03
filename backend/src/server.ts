// backend/src/server.ts
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import {
  DynamoDBClient,
  ScanCommand,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(bodyParser.json());

const client = new DynamoDBClient({
  region: "local",
  endpoint: "http://localhost:8000",
});

const TABLE_NAME = "FlexibleTable";

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
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Error fetching posts:", err);
    res.status(500).json({ error: "Failed to fetch posts." });
  }
});

// === POST /posts ===
app.post("/posts", async (req, res) => {
  const { content, authorId = "anonymous" } = req.body;
  if (!content) return res.status(400).json({ error: "Missing content" });

  try {
    const newId = Date.now().toString();
    const item = {
      PK: { S: `POST#${newId}` },
      SK: { S: "META#POST" },
      title: { S: content },
      body: { S: content },
      votes: { N: "0" },
      authorId: { S: authorId },
      createdAt: { S: new Date().toISOString() },
    };

    await client.send(new PutItemCommand({ TableName: TABLE_NAME, Item: item }));

    res.json({
      id: newId,
      title: content,
      votes: 0,
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
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ FlexibleMorals backend running on http://localhost:${PORT}`);
});
