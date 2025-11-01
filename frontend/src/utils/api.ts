// src/api.ts
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// 🔒 Attach token if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 🔁 Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/refresh`, {
            token: refreshToken,
          });
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

// ===== API WRAPPERS =====
export const getPosts = async () => {
  const res = await api.get("/posts");
  return res.data;
};

export const createPost = async (content: string) => {
  const res = await api.post("/posts", { content });
  return res.data;
};

// ✅ FIX THIS PART ONLY in src/api.ts
export const voteOnPost = async (id: string | number, direction: "up" | "down") => {
  // Matches backend route: POST /posts/:id/vote
  const res = await api.post(`/posts/${id}/vote`, { direction });
  return res.data;
};

export const login = async (username: string, password: string) => {
  const res = await api.post("/login", { username, password });
  const { accessToken, refreshToken } = res.data;
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
  return res.data;
};
