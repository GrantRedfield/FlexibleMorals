import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPosts } from "../lib/api"; // make sure this path matches your api.ts location
import "../App.css";

interface Post {
  id: number | string;
  content: string;
  votes?: number;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // 🔄 Fetch posts from DynamoDB
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const data = await getPosts();
        console.log("Fetched posts:", data);
        setPosts(data);
      } catch (err) {
        console.error("Error fetching posts:", err);
        setError("Failed to load commandments.");
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // Split posts between left/right stones
  const midpoint = Math.ceil(posts.length / 2);
  const leftPosts = posts.slice(0, midpoint);
  const rightPosts = posts.slice(midpoint);

  return (
    <div
      className="page"
      style={{
        backgroundImage: "url('/FlexibleMoralsPicture.png')",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* ✅ Top-right Vote button */}
      <div
        style={{
          position: "absolute",
          top: "4%",
          right: "4%",
          zIndex: 10,
        }}
      >
        <button onClick={() => navigate("/vote")} className="vote-button">
          Vote
        </button>
      </div>

      {/* Background Image Layer */}
      <img
        src="/FlexibleMoralsPicture.png"
        alt="Flexible Morals Background"
        className="bg"
      />

      {/* Overlay for commandments */}
      <div className="overlay-stones">
        {/* Left Stone */}
        <div className="stone-column left-stone">
          {loading && <div className="commandment-border">Loading...</div>}
          {error && <div className="commandment-border">{error}</div>}
          {!loading &&
            !error &&
            leftPosts.map((post) => (
              <div key={post.id} className="commandment-border">
                {post.content}
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
                {post.content}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
