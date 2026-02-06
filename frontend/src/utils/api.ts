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
