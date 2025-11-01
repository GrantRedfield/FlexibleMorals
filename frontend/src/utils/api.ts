// frontend/src/utils/api.ts
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export const getPosts = async () => {
  const res = await api.get("/posts");
  return res.data;
};

export const voteOnPost = async (id: string | number, direction: "up" | "down") => {
  const res = await api.post(`/posts/${id}/vote`, { direction });
  return res.data;
};

export const createPost = async (content: string) => {
  const res = await api.post("/posts", { content });
  return res.data;
};
