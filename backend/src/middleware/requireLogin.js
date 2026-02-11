import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";

const COGNITO_ENABLED =
  !!process.env.COGNITO_USER_POOL_ID && !!process.env.COGNITO_CLIENT_ID;

// Build JWKS client for Cognito token verification
let jwksClient = null;
if (COGNITO_ENABLED) {
  const region = process.env.AWS_REGION || "us-east-1";
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  jwksClient = jwksRsa({
    jwksUri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 600000, // 10 minutes
    rateLimit: true,
  });
}

function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    jwksClient.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

/**
 * Verify a Cognito JWT (access or id token).
 * Returns the decoded payload if valid, or throws.
 */
async function verifyCognitoToken(token) {
  // Decode the header to get the kid
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error("Invalid token structure");
  }

  const publicKey = await getSigningKey(decoded.header.kid);
  const region = process.env.AWS_REGION || "us-east-1";
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

  return jwt.verify(token, publicKey, {
    issuer,
    algorithms: ["RS256"],
  });
}

/**
 * Express middleware: verifies Bearer token from Authorization header.
 * Supports both Cognito RS256 JWTs and legacy HS256 JWTs.
 * Attaches { username } to req.user on success.
 */
export function requireLogin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = authHeader.split(" ")[1];

  // Try Cognito verification first if enabled
  if (COGNITO_ENABLED && jwksClient) {
    verifyCognitoToken(token)
      .then((decoded) => {
        req.user = {
          username: decoded.username || decoded["cognito:username"],
          sub: decoded.sub,
          email: decoded.email,
        };
        next();
      })
      .catch(() => {
        // Fall back to legacy JWT verification
        verifyLegacy(token, req, res, next);
      });
    return;
  }

  // Legacy-only path
  verifyLegacy(token, req, res, next);
}

function verifyLegacy(token, req, res, next) {
  try {
    const secret = process.env.JWT_SECRET || "flexible_secret";
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
