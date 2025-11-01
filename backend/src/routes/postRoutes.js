import express from "express";
import { docClient, TABLE_NAME } from "../db/dynamoClient.js";
import { ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { requireLogin } from "../middleware/requireLogin.js";

const router = express.Router();

// --- GET all posts ---
router.get("/", async (req, res) => {
  try {
    const data = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const items = data.Items?.filter((i) => i.SK === "META") || [];
    res.json(items);
  } catch (err) {
    console.error("Error loading posts:", err);
    res.status(500).json({ error: "Failed to load posts", details: err.message });
  }
});

// --- POST create a new post (requires login) ---
router.post("/", requireLogin, async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "Title required" });

  const postId = `POST#${Date.now()}`;
  const newPost = {
    PK: postId,
    SK: "META",
    title,
    votes: 0,
    createdBy: req.user.username,
    createdAt: new Date().toISOString(),
  };

  try {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: newPost }));
    res.json(newPost);
  } catch (err) {
    console.error("Error creating post:", err);
    res.status(500).json({ error: "Failed to create post", details: err.message });
  }
});

export default router;
