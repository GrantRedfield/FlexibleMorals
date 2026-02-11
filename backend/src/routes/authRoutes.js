import express from "express";
import jwt from "jsonwebtoken";
import {
  signUp,
  confirmSignUp,
  resendConfirmationCode,
  signIn,
  refreshTokens,
  globalSignOut,
  getUser,
} from "../lib/cognito.ts";

const router = express.Router();

// Cognito is enabled when both env vars are set
const COGNITO_ENABLED =
  !!process.env.COGNITO_USER_POOL_ID && !!process.env.COGNITO_CLIENT_ID;

// Legacy JWT config (fallback when Cognito is not configured)
const ACCESS_TOKEN_EXPIRY = "2h";
const REFRESH_TOKEN_EXPIRY = "7d";
const JWT_SECRET = process.env.JWT_SECRET || "flexible_secret";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "flexible_refresh_secret";
const refreshTokenStore = new Set();

// ─── Cognito Routes ─────────────────────────────────────────

// --- Sign Up (Cognito) ---
router.post("/signup", async (req, res) => {
  if (!COGNITO_ENABLED) {
    return res.status(501).json({ error: "Cognito not configured" });
  }

  const { username, password, email } = req.body;
  if (!username || !password || !email) {
    return res
      .status(400)
      .json({ error: "Username, password, and email are required" });
  }

  try {
    const result = await signUp(username, password, email);
    res.json({
      message: "Sign-up successful. Check your email for a confirmation code.",
      userSub: result.UserSub,
      confirmed: result.UserConfirmed,
    });
  } catch (err) {
    console.error("Cognito sign-up error:", err.name, err.message);
    res.status(400).json({ error: err.message, code: err.name });
  }
});

// --- Confirm Sign Up (Cognito) ---
router.post("/confirm", async (req, res) => {
  if (!COGNITO_ENABLED) {
    return res.status(501).json({ error: "Cognito not configured" });
  }

  const { username, code } = req.body;
  if (!username || !code) {
    return res.status(400).json({ error: "Username and code are required" });
  }

  try {
    await confirmSignUp(username, code);
    res.json({ message: "Account confirmed successfully. You can now log in." });
  } catch (err) {
    console.error("Cognito confirm error:", err.name, err.message);
    res.status(400).json({ error: err.message, code: err.name });
  }
});

// --- Resend Confirmation Code (Cognito) ---
router.post("/resend-code", async (req, res) => {
  if (!COGNITO_ENABLED) {
    return res.status(501).json({ error: "Cognito not configured" });
  }

  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    await resendConfirmationCode(username);
    res.json({ message: "Confirmation code resent. Check your email." });
  } catch (err) {
    console.error("Cognito resend error:", err.name, err.message);
    res.status(400).json({ error: err.message, code: err.name });
  }
});

// ─── Login (supports both Cognito and legacy) ──────────────

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });

  // Password is required
  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  // Cognito path: real authentication with password
  if (COGNITO_ENABLED) {
    try {
      const result = await signIn(username, password);
      const auth = result.AuthenticationResult;
      if (!auth) {
        return res.status(401).json({ error: "Authentication failed" });
      }

      // Fetch the actual Cognito username (in case user logged in with email alias)
      let actualUsername = username;
      try {
        const userInfo = await getUser(auth.AccessToken);
        actualUsername = userInfo.Username || username;
      } catch (e) {
        console.log("Could not fetch user info, using provided username:", e.message);
      }

      console.log("Cognito login:", actualUsername);
      return res.json({
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken,
        expiresIn: auth.ExpiresIn,
        username: actualUsername,
        authProvider: "cognito",
      });
    } catch (err) {
      console.error("Cognito login error:", err.name, err.message);
      return res.status(401).json({ error: err.message, code: err.name });
    }
  }

  // Legacy path: username + password login (no Cognito configured)
  const accessToken = jwt.sign({ username }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ username }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  refreshTokenStore.add(refreshToken);

  console.log("Legacy login:", username);
  res.json({ accessToken, refreshToken, username, authProvider: "legacy" });
});

// ─── Refresh Token ──────────────────────────────────────────

router.post("/refresh", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: "Missing refresh token" });

  // Cognito path: try Cognito refresh first
  if (COGNITO_ENABLED) {
    try {
      const result = await refreshTokens(token);
      const auth = result.AuthenticationResult;
      if (auth) {
        return res.json({
          accessToken: auth.AccessToken,
          idToken: auth.IdToken,
          expiresIn: auth.ExpiresIn,
        });
      }
    } catch (err) {
      // Fall through to legacy if Cognito refresh fails
      console.log("Cognito refresh failed, trying legacy:", err.message);
    }
  }

  // Legacy path
  if (!refreshTokenStore.has(token)) {
    return res.status(403).json({ error: "Invalid refresh token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    const newAccessToken = jwt.sign(
      { username: decoded.username },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    refreshTokenStore.delete(token);
    return res
      .status(403)
      .json({ error: "Invalid or expired refresh token" });
  }
});

// ─── Logout ─────────────────────────────────────────────────

router.post("/logout", async (req, res) => {
  const { token, accessToken } = req.body;

  // Cognito global sign-out
  if (COGNITO_ENABLED && accessToken) {
    try {
      await globalSignOut(accessToken);
      console.log("Cognito global sign-out successful");
    } catch (err) {
      console.log("Cognito sign-out error (non-fatal):", err.message);
    }
  }

  // Legacy cleanup
  if (token) {
    refreshTokenStore.delete(token);
  }

  res.json({ message: "Logged out successfully" });
});

// ─── Get Current User (Cognito) ─────────────────────────────

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = authHeader.split(" ")[1];

  // Cognito path
  if (COGNITO_ENABLED) {
    try {
      const user = await getUser(token);
      const attrs = {};
      (user.UserAttributes || []).forEach((a) => {
        attrs[a.Name] = a.Value;
      });
      return res.json({
        username: user.Username,
        email: attrs.email,
        emailVerified: attrs.email_verified === "true",
        sub: attrs.sub,
      });
    } catch (err) {
      // Fall through to legacy
    }
  }

  // Legacy path
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ username: decoded.username });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;
