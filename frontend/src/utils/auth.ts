// frontend/src/utils/auth.ts
// Authentication API — calls backend auth endpoints which handle Cognito / legacy
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
  username: string;
  authProvider: "cognito" | "legacy";
}

export interface SignUpResult {
  message: string;
  userSub?: string;
  confirmed?: boolean;
}

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: "fm_accessToken",
  REFRESH_TOKEN: "fm_refreshToken",
  ID_TOKEN: "fm_idToken",
  USERNAME: "fm_username",
  AUTH_PROVIDER: "fm_authProvider",
} as const;

/**
 * Sign up a new user (Cognito only).
 */
export async function signUp(
  username: string,
  password: string,
  email: string
): Promise<SignUpResult> {
  const res = await axios.post(`${API_BASE}/auth/signup`, {
    username,
    password,
    email,
  });
  return res.data;
}

/**
 * Confirm sign-up with verification code (Cognito only).
 */
export async function confirmSignUp(
  username: string,
  code: string
): Promise<{ message: string }> {
  const res = await axios.post(`${API_BASE}/auth/confirm`, { username, code });
  return res.data;
}

/**
 * Resend confirmation code (Cognito only).
 */
export async function resendCode(
  username: string
): Promise<{ message: string }> {
  const res = await axios.post(`${API_BASE}/auth/resend-code`, { username });
  return res.data;
}

/**
 * Log in with username and optional password.
 * If password is provided and Cognito is configured, uses Cognito auth.
 * Otherwise falls back to legacy username-only auth.
 */
export async function login(
  username: string,
  password: string
): Promise<AuthTokens> {
  const res = await axios.post(`${API_BASE}/auth/login`, {
    username,
    password,
  });
  const data: AuthTokens = res.data;

  // Persist tokens
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
  localStorage.setItem(STORAGE_KEYS.USERNAME, data.username);
  localStorage.setItem(STORAGE_KEYS.AUTH_PROVIDER, data.authProvider);
  if (data.refreshToken) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
  }
  if (data.idToken) {
    localStorage.setItem(STORAGE_KEYS.ID_TOKEN, data.idToken);
  }

  return data;
}

/**
 * Refresh the access token.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) return null;

  try {
    const res = await axios.post(`${API_BASE}/auth/refresh`, {
      token: refreshToken,
    });
    const { accessToken, idToken } = res.data;
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (idToken) {
      localStorage.setItem(STORAGE_KEYS.ID_TOKEN, idToken);
    }
    return accessToken;
  } catch {
    // Refresh failed — clear everything
    clearTokens();
    return null;
  }
}

/**
 * Log out (local + server-side).
 */
export async function logout(): Promise<void> {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

  try {
    await axios.post(`${API_BASE}/auth/logout`, {
      token: refreshToken,
      accessToken,
    });
  } catch {
    // Ignore server errors on logout
  }

  clearTokens();
}

/**
 * Get stored access token.
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Get stored username.
 */
export function getStoredUsername(): string | null {
  return localStorage.getItem(STORAGE_KEYS.USERNAME);
}

/**
 * Get auth provider type.
 */
export function getAuthProvider(): "cognito" | "legacy" | null {
  return localStorage.getItem(STORAGE_KEYS.AUTH_PROVIDER) as
    | "cognito"
    | "legacy"
    | null;
}

/**
 * Check if Cognito auth features are available on the backend.
 */
export function isCognitoAuth(): boolean {
  return getAuthProvider() === "cognito";
}

/**
 * Clear all auth tokens from storage.
 */
function clearTokens() {
  Object.values(STORAGE_KEYS).forEach((key) =>
    localStorage.removeItem(key)
  );
}
