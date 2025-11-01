import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPosts } from "../utils/api";
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
  const [showMerchPopup, setShowMerchPopup] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const data = await getPosts();
        setPosts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("❌ Error fetching posts:", err);
        setError("Failed to load commandments.");
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const midpoint = Math.ceil(posts.length / 2);
  const leftPosts = posts.slice(0, midpoint);
  const rightPosts = posts.slice(midpoint);

  return (
    <div className="home-root">
      {/* ✅ Background */}
      <img
        src="/FlexibleMoralsPicture.png"
        alt="Flexible Morals Background"
        className="home-background-balanced"
      />

      {/* ✅ Vote button near candle */}
      <div className="vote-button-container">
        <button onClick={() => navigate("/vote")} className="vote-button">
          Vote
        </button>
      </div>

      {/* ✅ Offering button near bowl */}
      <div className="offering-link-container">
        <a
          href="https://www.paypal.com/donate/?business=E9ZG5U75GEYBQ&no_recurring=0&item_name=Thank+you+for+keeping+the+vision+alive%21&currency_code=USD"
          target="_blank"
          rel="noopener noreferrer"
          className="offering-link"
        >
          Offering
        </a>
      </div>

      {/* ✅ Merch button (independent position) */}
      <div className="merch-link-container">
        <button onClick={() => setShowMerchPopup(true)} className="merch-link">
          Merch
        </button>
      </div>

      {/* ✅ Merch Popup */}
      {showMerchPopup && (
        <div className="popup-overlay" onClick={() => setShowMerchPopup(false)}>
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <h2>🛍️ Coming Soon!</h2>
            <p>Our merch collection is in the works.</p>
            <button
              onClick={() => setShowMerchPopup(false)}
              className="popup-close"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ✅ Commandments */}
      <div className="overlay-stones">
        {[leftPosts, rightPosts].map((col, i) => (
          <div key={i} className="stone-column">
            {loading && <div className="commandment-border">Loading...</div>}
            {error && <div className="commandment-border">{error}</div>}
            {!loading &&
              !error &&
              col.map((post) => (
                <div key={post.id} className="commandment-border">
                  {post.title || post.content}
                  {post.votes !== undefined && (
                    <span className="vote-count"> ({post.votes} votes)</span>
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
