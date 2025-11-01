import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

// token lifetimes
const ACCESS_TOKEN_EXPIRY = "2h";
const REFRESH_TOKEN_EXPIRY = "7d";

// secrets (must match frontend & middleware)
const JWT_SECRET = process.env.JWT_SECRET || "flexible_secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "flexible_refresh_secret";

// simple in-memory store (use DynamoDB or Redis in production)
const refreshTokens = new Set();

// --- Login: returns access + refresh tokens ---
router.post("/login", (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });

  const accessToken = jwt.sign({ username }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ username }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  refreshTokens.add(refreshToken);

  console.log("User logged in:", username);
  res.json({ accessToken, refreshToken, username });
});

// --- Refresh endpoint: issue new access token ---
router.post("/refresh", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: "Missing refresh token" });
  if (!refreshTokens.has(token)) {
    console.log("❌ Invalid refresh token");
    return res.status(403).json({ error: "Invalid refresh token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    const newAccessToken = jwt.sign(
      { username: decoded.username },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
    console.log("✅ Refresh successful for:", decoded.username);
    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("❌ Refresh token invalid or expired:", err.message);
    refreshTokens.delete(token);
    return res.status(403).json({ error: "Invalid or expired refresh token" });
  }
});

// --- Logout: remove refresh token ---
router.post("/logout", (req, res) => {
  const { token } = req.body;
  if (token) {
    refreshTokens.delete(token);
    console.log("User logged out, token removed.");
  }
  res.json({ message: "Logged out successfully" });
});

export default router;
