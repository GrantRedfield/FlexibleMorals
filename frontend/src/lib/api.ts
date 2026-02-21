// src/lib/api.ts or src/api.ts
import axios from "axios";

// See utils/api.ts for explanation — fall back to relative URLs (Vite proxy)
// when accessed from a non-localhost host (mobile / LAN).
function resolveApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return "";
  try {
    const parsed = new URL(envUrl);
    if (
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      return "";
    }
  } catch {
    // Not a valid URL, use as-is
  }
  return envUrl;
}

const API_BASE = resolveApiBase();

// Create the axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Optional: attach tokens automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Optional: auto-refresh tokens if expired
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/refresh`, { token: refreshToken });
          const newAccessToken = res.data.accessToken;
          localStorage.setItem("accessToken", newAccessToken);
          error.config.headers.Authorization = `Bearer ${newAccessToken}`;
          return axios(error.config);
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.reload();
        }
      }
    }
    return Promise.reject(error);
  }
);

// ✅ Exported API functions
export const getPosts = async () => {
  const res = await api.get("/posts");
  return res.data;
};

export const createPost = async (content: string) => {
  const res = await api.post("/posts", { content });
  return res.data;
};

export const voteOnPost = async (id: number, type: "up" | "down") => {
  const res = await api.post(`/votes/${id}`, { type });
  return res.data;
};

export const login = async (username: string, password: string) => {
  const res = await api.post("/login", { username, password });
  const { accessToken, refreshToken } = res.data;
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
  return res.data;
};
