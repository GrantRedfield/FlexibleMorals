// src/Vote.tsx
import { useEffect, useState } from "react";
import { getPosts, voteOnPost } from "../utils/api";

interface Post {
  id: string;
  title: string;
  votes: number;
  createdBy?: { name: string };
}

export default function Vote() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const data = await getPosts();
      setPosts(data);
    } catch (err) {
      console.error("Error loading posts:", err);
      setError("Failed to load posts.");
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (postId: string, type: "up" | "down") => {
    try {
      const updated = await voteOnPost(postId, type);
      setPosts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
    } catch (err) {
      console.error("Vote failed:", err);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  if (loading) return <p className="p-4 text-gray-500">Loading...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Vote on Posts</h1>
      {posts.map((post) => (
        <div
          key={post.id}
          className="border border-gray-300 p-3 rounded flex justify-between"
        >
          <div>
            <h2 className="font-semibold">{post.title}</h2>
            <p className="text-sm text-gray-500">{post.votes} votes</p>
          </div>
          <div className="flex space-x-2">
            <button
              className="bg-green-500 text-white px-3 py-1 rounded"
              onClick={() => handleVote(post.id, "up")}
            >
              👍
            </button>
            <button
              className="bg-red-500 text-white px-3 py-1 rounded"
              onClick={() => handleVote(post.id, "down")}
            >
              👎
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
