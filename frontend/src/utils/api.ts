import axios from "axios";

const API_BASE = "http://localhost:3001";

export const getPosts = async () => {
  const res = await axios.get(`${API_BASE}/posts`);
  return res.data;
};

export const voteOnPost = async (id: string | number, direction: "up" | "down", userId?: string) => {
  const res = await axios.post(`${API_BASE}/posts/${id}/vote`, { direction, userId });
  return res.data;
};

// ✅ FIXED: send username to backend
export const createPost = async (content: string, authorId?: string) => {
  const res = await axios.post(`${API_BASE}/posts`, { content, authorId });
  return res.data;
};
