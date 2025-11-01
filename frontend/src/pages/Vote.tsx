// frontend/src/pages/Vote.tsx
import { useEffect, useState } from "react";
import { getPosts, voteOnPost } from "../utils/api";

interface Post {
  id: string | number;
  title?: string;
  content?: string;
  votes?: number;
}

export default function Vote() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getPosts();
        console.log("📊 Vote fetched posts:", data);
        setPosts(data);
      } catch (err: any) {
        console.error("Error fetching posts:", err);
        setError("Failed to load posts.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleVote = async (postId: string | number, direction: "up" | "down") => {
    try {
      const updated = await voteOnPost(postId, direction);
      console.log("✅ Vote updated:", updated);
      setPosts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
    } catch (err) {
      console.error("❌ Vote failed:", err);
    }
  };

  if (loading) return <p className="p-4 text-gray-500">Loading...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div
      className="p-4 space-y-4"
      style={{
        backgroundImage: "url('/Voting_Background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.9)",
          borderRadius: "12px",
          padding: "1rem 1.5rem",
          maxWidth: "700px",
          width: "100%",
          boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
        }}
      >
        <h1 className="text-2xl font-bold mb-4 text-center text-gray-900">
          Vote on Posts
        </h1>

        {posts.length === 0 && (
          <p className="text-center text-gray-600">No posts found.</p>
        )}

        {posts.map((post) => (
          <div
            key={post.id}
            className="border border-gray-300 p-3 rounded flex justify-between items-center mb-3 bg-white shadow"
          >
            <div>
              <h2 className="font-semibold text-gray-900">
                {post.title || post.content}
              </h2>
              <p className="text-sm text-gray-600">{post.votes ?? 0} votes</p>
            </div>
            <div className="flex space-x-2">
              <button
                className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition"
                onClick={() => handleVote(post.id, "up")}
              >
                👍
              </button>
              <button
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
                onClick={() => handleVote(post.id, "down")}
              >
                👎
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
