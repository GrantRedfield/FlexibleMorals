import axios from "axios";

// Resolve the API base URL for both desktop and mobile access.
// In development, relative URLs ("") let the Vite proxy forward requests to
// the backend, which works from any device on the local network.
// If VITE_API_URL is set to a localhost address but the page is loaded from a
// different host (e.g. a phone at 192.168.x.x), fall back to relative URLs so
// the Vite proxy handles forwarding instead of the browser hitting localhost
// (which on a phone would be the phone itself, not the dev machine).
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
      // Mobile/LAN access — use relative URLs through the Vite proxy
      return "";
    }
  } catch {
    // Not a valid URL, use as-is
  }
  return envUrl;
}

const API_BASE = resolveApiBase();

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
