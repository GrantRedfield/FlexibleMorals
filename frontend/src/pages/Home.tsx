// frontend/src/pages/Home.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPosts } from "../utils/api"; // ✅ unified import
import "../App.css";

interface Post {
  id: number | string;
  title?: string;
  content?: string;
  votes?: number;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // ✅ Fetch posts on mount
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const data = await getPosts();
        console.log("🏠 Home fetched posts:", data);

        if (Array.isArray(data) && data.length > 0) {
          setPosts(data);
        } else {
          console.warn("⚠️ No posts returned from backend.");
          setPosts([]);
        }
      } catch (err) {
        console.error("❌ Error fetching posts:", err);
        setError("Failed to load commandments.");
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  // ✅ Split into left/right “stones”
  const midpoint = Math.ceil(posts.length / 2);
  const leftPosts = posts.slice(0, midpoint);
  const rightPosts = posts.slice(midpoint);

  const handleVoteClick = () => {
    navigate("/vote");
  };

  return (
    <div
      className="page"
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      {/* ✅ Background image (behind everything) */}
      <img
        src="/FlexibleMoralsPicture.png"
        alt="Flexible Morals Background"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      />

      {/* ✅ Vote Button (always clickable) */}
      <div
        style={{
          position: "absolute",
          top: "4%",
          right: "4%",
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={handleVoteClick}
          style={{
            backgroundColor: "#b79b3d",
            border: "none",
            borderRadius: "8px",
            padding: "6px 12px",
            cursor: "pointer",
            color: "white",
            fontWeight: 600,
          }}
        >
          Vote
        </button>
      </div>

      {/* ✅ Overlay content (commandments) */}
      <div
        className="overlay-stones"
        style={{
          position: "relative",
          zIndex: 10,
          color: "#222",
          textShadow: "1px 1px 2px #fff",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          paddingTop: "10%",
        }}
      >
        {/* Left Stone */}
        <div className="stone-column left-stone" style={{ marginRight: "2rem" }}>
          {loading && <div className="commandment-border">Loading...</div>}
          {error && <div className="commandment-border">{error}</div>}
          {!loading &&
            !error &&
            leftPosts.map((post) => (
              <div key={post.id} className="commandment-border">
                {post.title || post.content}
                {post.votes !== undefined && (
                  <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                    ({post.votes} votes)
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* Right Stone */}
        <div className="stone-column right-stone">
          {loading && <div className="commandment-border">Loading...</div>}
          {!loading &&
            !error &&
            rightPosts.map((post) => (
              <div key={post.id} className="commandment-border">
                {post.title || post.content}
                {post.votes !== undefined && (
                  <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                    ({post.votes} votes)
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
