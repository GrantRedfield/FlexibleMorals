import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPosts } from "../utils/api";
import DonationPopup from "../components/DonationPopup";
import DonorBadge from "../components/DonorBadge";
import LoginButton from "../components/LoginButton";
import ChatBox from "../components/ChatBox";
import { useDonor } from "../context/DonorContext";
import "../App.css";

interface Post {
  id: number | string;
  title?: string;
  content?: string;
  votes?: number;
  username?: string;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMerchPopup, setShowMerchPopup] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [showDonationPopup, setShowDonationPopup] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [showPrayerHands, setShowPrayerHands] = useState(false);
  const [showCoins, setShowCoins] = useState(false);
  const navigate = useNavigate();
  const { donorStatuses, loadDonorStatuses } = useDonor();

  // ✅ Countdown logic
  useEffect(() => {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const diffTime = endOfMonth.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysLeft(diffDays);
  }, []);

  // ✅ Prayer hands animation every 30 seconds
  useEffect(() => {
    const showHands = () => {
      setShowPrayerHands(true);
      setTimeout(() => setShowPrayerHands(false), 3000);
    };

    // Show immediately on load
    showHands();

    // Then repeat every 30 seconds
    const interval = setInterval(showHands, 30000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Coins falling animation every 60 seconds
  useEffect(() => {
    const dropCoins = () => {
      setShowCoins(true);
      setTimeout(() => setShowCoins(false), 3000);
    };

    // Show after 2 seconds on load
    setTimeout(dropCoins, 2000);

    // Then repeat every 60 seconds
    const interval = setInterval(dropCoins, 60000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Fetch posts
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

  // Load donor statuses for displayed posts
  useEffect(() => {
    if (posts.length > 0) {
      const usernames = posts
        .map((p) => p.username)
        .filter((u): u is string => !!u && u !== "unknown");
      if (usernames.length > 0) {
        loadDonorStatuses(usernames);
      }
    }
  }, [posts, loadDonorStatuses]);

  // Sort by votes (highest first) and take top 10
  const sortedPosts = [...posts].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  const leftPosts = sortedPosts.slice(0, 5);
  const rightPosts = sortedPosts.slice(5, 10);

  return (
    <div className="home-root">
      {/* ✅ Background */}
      <img
        src="/FlexibleMoralsPicture.png"
        alt="Flexible Morals Background"
        className="home-background-balanced"
      />

      {/* ✅ Login Button (Top Left) */}
      <LoginButton />

      {/* ✅ Chat Box (Right Side) */}
      <ChatBox />

      {/* ✅ Countdown (aligned with info button) */}
      <div
        style={{
          position: "fixed",
          top: "8rem",
          right: "1rem",
          zIndex: 999,
          textAlign: "center",
          transform: "translateY(-120%)",
        }}
      >
        <span
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: "5rem",
            fontWeight: 900,
            color: "#c8b070",
            textShadow:
              "2px 2px 0px #3a2e0b, -1px -1px 0px #3a2e0b, 1px -1px 0px #3a2e0b, -1px 1px 0px #3a2e0b, 0 0 20px rgba(200, 176, 112, 0.3)",
            letterSpacing: "0.05em",
            lineHeight: 1,
          }}
        >
          {daysLeft}
        </span>
      </div>

      {/* ✅ Vote button */}
      <div className="vote-button-container">
        {showPrayerHands && (
          <>
            <span className="prayer-hands prayer-left">🙏</span>
            <span className="prayer-hands prayer-right">🙏</span>
            <span className="prayer-hands prayer-top">🙏</span>
            <span className="prayer-hands prayer-bottom">🙏</span>
          </>
        )}
        <button onClick={() => navigate("/vote")} className="vote-button">
          Vote
        </button>
      </div>

      {/* ✅ Offering link */}
      <div className="offering-link-container">
        {showCoins && (
          <div className="coin-animation">
            <div className="coin coin-1">$</div>
            <div className="coin coin-2">$</div>
            <div className="coin coin-3">$</div>
            <div className="coin coin-4">$</div>
            <div className="coin coin-5">$</div>
          </div>
        )}
        <button
          onClick={() => setShowDonationPopup(true)}
          className="offering-link"
          style={{ border: "none", fontFamily: "inherit" }}
        >
          Offering
        </button>
      </div>

      {/* ✅ Donation popup */}
      <DonationPopup
        isOpen={showDonationPopup}
        onClose={() => setShowDonationPopup(false)}
      />

      {/* ✅ Merch link */}
      <div className="merch-link-container">
        <button onClick={() => setShowMerchPopup(true)} className="merch-link">
          Merch
        </button>
      </div>

      {/* ✅ "What in the world is this?!" link (now opens popup) */}
      <div className="info-link-container">
        <button onClick={() => setShowInfoPopup(true)} className="info-link">
          What in the world is this?!
        </button>
      </div>

      {/* ✅ Merch popup */}
      {showMerchPopup && (
        <div className="popup-overlay" onClick={() => setShowMerchPopup(false)}>
          <div
            className="popup-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px", padding: "1.5rem", backgroundColor: "#1a1a1a" }}
          >
            <h2 style={{ color: "#d4af37", marginBottom: "0.5rem" }}>
              Flexible Morals Tee
            </h2>
            <p style={{ marginBottom: "1rem", color: "#aaa", fontSize: "0.9rem" }}>
              Coming Soon! Each month's top commandments on the back.
            </p>

            {/* T-Shirt mockup */}
            <div
              style={{
                position: "relative",
                width: "320px",
                margin: "0 auto",
              }}
            >
              {/* T-shirt shape */}
              <svg viewBox="0 0 200 240" style={{ width: "100%" }}>
                {/* Shirt body */}
                <path
                  d="M30 50 L30 230 L170 230 L170 50 L140 50 L130 30 Q100 20 70 30 L60 50 Z"
                  fill="#2d2d2d"
                  stroke="#444"
                  strokeWidth="2"
                />
                {/* Left sleeve */}
                <path
                  d="M30 50 L0 80 L15 95 L30 75 Z"
                  fill="#2d2d2d"
                  stroke="#444"
                  strokeWidth="2"
                />
                {/* Right sleeve */}
                <path
                  d="M170 50 L200 80 L185 95 L170 75 Z"
                  fill="#2d2d2d"
                  stroke="#444"
                  strokeWidth="2"
                />
                {/* Collar */}
                <ellipse cx="100" cy="35" rx="30" ry="12" fill="#1a1a1a" stroke="#444" strokeWidth="2" />
              </svg>

              {/* Month and Year - top left */}
              <div
                style={{
                  position: "absolute",
                  top: "85px",
                  left: "60px",
                  color: "#d4af37",
                  fontSize: "12px",
                  fontFamily: "Cinzel, serif",
                  fontWeight: "bold",
                }}
              >
                {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>

              {/* Tablets image with commandments - centered */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "200px",
                  height: "150px",
                  marginTop: "15px",
                }}
              >
                {/* Background tablets image */}
                <img
                  src="/FlexibleMoralsPicture.png"
                  alt="Tablets"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center 25%",
                    borderRadius: "4px",
                  }}
                />

                {/* Left tablet commandments */}
                <div
                  style={{
                    position: "absolute",
                    top: "18%",
                    left: "30%",
                    transform: "translateX(-50%)",
                    width: "28%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  {!loading &&
                    leftPosts.slice(0, 5).map((post) => (
                      <div
                        key={post.id}
                        style={{
                          fontSize: "6px",
                          color: "#fdf8e6",
                          backgroundColor: "rgba(0,0,0,0.55)",
                          padding: "2px 3px",
                          borderRadius: "2px",
                          border: "1px solid #d1b97b",
                          textAlign: "center",
                          width: "100%",
                          fontFamily: "Cinzel, serif",
                          lineHeight: "1.2",
                        }}
                      >
                        {(post.title || post.content || "").slice(0, 20)}
                        {(post.title || post.content || "").length > 20 ? "..." : ""}
                      </div>
                    ))}
                </div>

                {/* Right tablet commandments */}
                <div
                  style={{
                    position: "absolute",
                    top: "18%",
                    left: "70%",
                    transform: "translateX(-50%)",
                    width: "28%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  {!loading &&
                    rightPosts.slice(0, 5).map((post) => (
                      <div
                        key={post.id}
                        style={{
                          fontSize: "6px",
                          color: "#fdf8e6",
                          backgroundColor: "rgba(0,0,0,0.55)",
                          padding: "2px 3px",
                          borderRadius: "2px",
                          border: "1px solid #d1b97b",
                          textAlign: "center",
                          width: "100%",
                          fontFamily: "Cinzel, serif",
                          lineHeight: "1.2",
                        }}
                      >
                        {(post.title || post.content || "").slice(0, 20)}
                        {(post.title || post.content || "").length > 20 ? "..." : ""}
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#888" }}>
              * Design updates monthly with new commandments
            </p>
            <button
              onClick={() => setShowMerchPopup(false)}
              className="popup-close"
              style={{ marginTop: "1rem" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ✅ Info popup (new) */}
      {showInfoPopup && (
        <div className="popup-overlay" onClick={() => setShowInfoPopup(false)}>
          <div
            className="popup-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "700px",
              lineHeight: "1.6",
              textAlign: "center",
            }}
          >
            <h1 style={{ color: "#d4af37", marginBottom: "1rem" }}>
              What in the world is this?!
            </h1>
            <p>
              I'd like to think of this as the first "democratic religion", where
              it's only bounded by users' imagination on what morals to follow.
              All commandments reset at the beginning of every month, giving everyone
              a fresh start to shape the new moral code. It's a social experiment in
              crowd-sourced ethics. Users write and vote on commandments — some
              serious, some absurd — creating a living reflection of our
              collective values, humor, and contradictions.
            </p>
            <p style={{ marginTop: "1rem", opacity: 0.8 }}>
              Whether divine wisdom or chaos, every vote shapes the moral
              mosaic.
            </p>
            <button
              onClick={() => setShowInfoPopup(false)}
              className="popup-close"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ✅ Commandments overlay */}
      <div className="overlay-stones">
        {/* Left Stone */}
        <div className="stone-column">
          {loading && <div className="commandment-border">Loading...</div>}
          {error && <div className="commandment-border">{error}</div>}
          {!loading &&
            !error &&
            leftPosts.map((post) => {
              const donorStatus = post.username ? donorStatuses[post.username] : null;
              return (
                <div
                  key={post.id}
                  className="commandment-border tooltip-container"
                >
                  <div className="commandment-text">
                    {post.title || post.content}
                    {donorStatus?.tier && <DonorBadge tier={donorStatus.tier} size="small" />}
                  </div>
                  {post.votes !== undefined && (
                    <div className="vote-count">{post.votes} votes</div>
                  )}
                  <span className="tooltip-text">
                    username: {post.username ? post.username : "unknown"}
                    {donorStatus?.tier && <DonorBadge tier={donorStatus.tier} size="small" />}
                  </span>
                </div>
              );
            })}
        </div>

        {/* Right Stone */}
        <div className="stone-column">
          {loading && <div className="commandment-border">Loading...</div>}
          {error && <div className="commandment-border">{error}</div>}
          {!loading &&
            !error &&
            rightPosts.map((post) => {
              const donorStatus = post.username ? donorStatuses[post.username] : null;
              return (
                <div
                  key={post.id}
                  className="commandment-border tooltip-container"
                >
                  <div className="commandment-text">
                    {post.title || post.content}
                    {donorStatus?.tier && <DonorBadge tier={donorStatus.tier} size="small" />}
                  </div>
                  {post.votes !== undefined && (
                    <div className="vote-count">{post.votes} votes</div>
                  )}
                  <span className="tooltip-text">
                    username: {post.username ? post.username : "unknown"}
                    {donorStatus?.tier && <DonorBadge tier={donorStatus.tier} size="small" />}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
