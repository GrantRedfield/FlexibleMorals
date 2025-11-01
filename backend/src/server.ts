import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = 3001;

// --- MIDDLEWARE ---
app.use(bodyParser.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:8000"],
    credentials: true,
  })
);

// --- DEMO USERS ---
const users = [{ username: "testuser", password: "1234" }];

// --- IN-MEMORY DATA ---
interface Post {
  id: number;
  content: string;
  votes: number;
}
let posts: Post[] = [
  { id: 1, content: "Example post #1", votes: 3 },
  { id: 2, content: "Example post #2", votes: 5 },
];

// --- VERIFY TOKEN ---
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
}

// --- LOGIN ---
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const accessToken = jwt.sign(
    { username: user.username },
    process.env.ACCESS_TOKEN_SECRET!,
    { expiresIn: "60s" }
  );

  const refreshToken = jwt.sign(
    { username: user.username },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: "7d" }
  );

  res.json({ accessToken, refreshToken });
});

// --- REFRESH TOKEN ---
app.post("/refresh", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: "Missing token" });

  jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Invalid or expired refresh token" });

    const newAccessToken = jwt.sign(
      { username: user.username },
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: "60s" }
    );

    res.json({ accessToken: newAccessToken });
  });
});

// --- GET POSTS ---
app.get("/posts", (req, res) => {
  res.json(posts);
});

// --- CREATE POST ---
app.post("/posts", authenticateToken, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Content required" });

  const newPost: Post = {
    id: posts.length + 1,
    content,
    votes: 0,
  };
  posts.push(newPost);
  res.json(newPost);
});

// --- VOTE (UP/DOWN) ---
app.post("/votes/:id", authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const { type } = req.body; // "up" or "down"

  const post = posts.find((p) => p.id === id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  if (type === "up") post.votes++;
  else if (type === "down") post.votes--;
  else return res.status(400).json({ error: "Invalid vote type" });

  res.json(post);
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
