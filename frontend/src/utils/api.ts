import axios from "axios";

// Vite exposes env vars prefixed with VITE_ at build time.
// Use ?? so that an explicit empty string (VITE_API_URL=) produces relative
// URLs that go through Vite's dev proxy, while an unset var falls back.
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

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

// === Vote Cooldown API (server-side, cross-device) ===

export const checkVoteCooldown = async (userId: string) => {
  const res = await axios.get(`${API_BASE}/api/vote-cooldown/${userId}`);
  return res.data;
};

export const setVoteCooldown = async (userId: string) => {
  const res = await axios.post(`${API_BASE}/api/vote-cooldown`, { userId });
  return res.data;
};

// === Donor API ===

export const getDonorStatus = async (username: string) => {
  const res = await axios.get(`${API_BASE}/api/donor/status/${username}`);
  return res.data;
};

export const getBulkDonorStatus = async (usernames: string[]) => {
  const res = await axios.get(`${API_BASE}/api/donor/bulk-status`, {
    params: { usernames: usernames.join(",") },
  });
  return res.data;
};

export const getMyDonorStatus = async (username: string) => {
  const res = await axios.get(`${API_BASE}/api/donor/my-status`, {
    params: { username },
  });
  return res.data;
};

export const linkPayPalEmail = async (paypalEmail: string, username: string) => {
  const res = await axios.post(`${API_BASE}/api/donor/link-email`, {
    paypalEmail,
    username,
  });
  return res.data;
};

export const getDonorTiers = async () => {
  const res = await axios.get(`${API_BASE}/api/donor/tiers`);
  return res.data;
};

// === Chat API ===

export const getChatMessages = async (since?: string) => {
  const params = since ? { params: { since } } : {};
  const res = await axios.get(`${API_BASE}/api/chat/messages`, params);
  return res.data;
};

export const sendChatMessage = async (username: string, message: string) => {
  const res = await axios.post(`${API_BASE}/api/chat/messages`, { username, message });
  return res.data;
};

export const reportChatMessage = async (messageId: string, reporterUsername: string) => {
  const res = await axios.post(`${API_BASE}/api/chat/report`, { messageId, reporterUsername });
  return res.data;
};

// === Comments API ===

export const getComments = async (postId: string) => {
  const res = await axios.get(`${API_BASE}/api/comments/${postId}`);
  return res.data;
};

export const createComment = async (
  postId: string,
  username: string,
  text: string,
  parentId?: string
) => {
  const res = await axios.post(`${API_BASE}/api/comments/${postId}`, {
    username,
    text,
    parentId,
  });
  return res.data;
};

export const voteOnComment = async (
  postId: string,
  commentId: string,
  direction: "up" | "down",
  userId?: string
) => {
  const res = await axios.post(
    `${API_BASE}/api/comments/${postId}/${commentId}/vote`,
    { direction, userId }
  );
  return res.data;
};

export const editComment = async (
  postId: string,
  commentId: string,
  username: string,
  text: string
) => {
  const res = await axios.put(
    `${API_BASE}/api/comments/${postId}/${commentId}`,
    { username, text }
  );
  return res.data;
};

export const deleteComment = async (
  postId: string,
  commentId: string,
  username: string
) => {
  const res = await axios.delete(
    `${API_BASE}/api/comments/${postId}/${commentId}`,
    { data: { username } }
  );
  return res.data;
};
