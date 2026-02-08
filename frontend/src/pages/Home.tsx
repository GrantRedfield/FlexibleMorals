import { useEffect, useState, useCallback } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useNavigate } from "react-router-dom";
import { getPosts } from "../utils/api";
import DonationPopup from "../components/DonationPopup";
import DonorBadge from "../components/DonorBadge";
import LoginButton from "../components/LoginButton";
import ChatBox from "../components/ChatBox";
import UserProfilePopup from "../components/UserProfilePopup";
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
  const [profilePopup, setProfilePopup] = useState<{ username: string; x: number; y: number } | null>(null);

  const navigate = useNavigate();
  const { donorStatuses, loadDonorStatuses, getDonorStatus } = useDonor();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const getBlessings = useCallback(
    (username: string): number => {
      return posts
        .filter((p) => p.username === username)
        .reduce((sum, p) => sum + (p.votes ?? 0), 0);
    },
    [posts]
  );

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
  const allPosts = sortedPosts.slice(0, 10);

  // Shared renderer for a single commandment card
  const renderCommandment = (post: Post, index: number, showNumber: boolean) => {
    const donorStatus = post.username ? donorStatuses[post.username] : null;
    return (
      <div
        key={post.id}
        className="commandment-border"
        onClick={() => navigate(`/comments/${post.id}`, { state: { from: "home" } })}
        style={{ cursor: "pointer" }}
      >
        <div className="commandment-text">
          {showNumber && <span className="commandment-number">{index + 1}. </span>}
          {post.title || post.content}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "2px" }}>
          {post.votes !== undefined && (
            <span className="vote-count" style={{ margin: 0 }}>{post.votes} votes</span>
          )}
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (post.username && post.username !== "unknown") {
                setProfilePopup({ username: post.username, x: e.clientX, y: e.clientY });
              }
            }}
            style={{ fontSize: "0.7rem", color: "#c8b070", cursor: "pointer", fontStyle: "italic" }}
          >
            — {post.username || "unknown"}
            {donorStatus?.tier && <DonorBadge tier={donorStatus.tier} size="small" />}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-tablets">
          <div className="loading-tablet left-tablet">
            <div className="tablet-arch"></div>
            <div className="tablet-body"></div>
            <div className="chisel-sparks">
              <span className="spark">✦</span>
              <span className="spark">✧</span>
              <span className="spark">✦</span>
            </div>
          </div>
          <div className="loading-chisel">
            <div className="chisel-tool">🪨</div>
          </div>
          <div className="loading-tablet right-tablet">
            <div className="tablet-arch"></div>
            <div className="tablet-body"></div>
          </div>
        </div>
        <p className="loading-text">Loading morals....</p>
      </div>
    );
  }

  return (
    <div className="home-root">
      {/* ✅ Background + overlays wrapper */}
      {isMobile ? (
        <div style={{ position: "relative", width: "100%" }}>
          <img
            src="/FlexibleMoralsMobile.png"
            alt="Flexible Morals Background"
            className="home-background-balanced"
          />
          {/* Countdown — top right, scrolls with image */}
          <div
            style={{
              position: "absolute",
              top: "0.3rem",
              right: "0.3rem",
              zIndex: 20,
              textAlign: "right",
            }}
          >
            <span
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: "0.55rem",
                fontWeight: 900,
                color: "#c8b070",
                textShadow: "2px 2px 0px #3a2e0b, -1px -1px 0px #3a2e0b, 1px -1px 0px #3a2e0b, -1px 1px 0px #3a2e0b, 0 0 20px rgba(200, 176, 112, 0.3)",
                letterSpacing: "0.05em",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {daysLeft} days until moral reset
            </span>
          </div>
          {/* Commandments — overlaid on the tablet */}
          <div className="mobile-tablet-overlay">
            {!loading && !error && posts.length === 0 && (
              <div className="empty-state" style={{ textAlign: "center", zIndex: 10 }}>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: "1.1rem", fontWeight: 700, color: "#3a2e0b", textShadow: "0 0 4px rgba(200,176,112,0.3)", margin: "0 0 8px 0" }}>
                  The tablet is empty.
                </p>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: "0.85rem", color: "#5a4a2a", margin: "0 0 12px 0" }}>
                  Be the first to inscribe a commandment.
                </p>
                <button onClick={() => navigate("/vote")} style={{ fontFamily: "'Cinzel', serif", fontSize: "0.9rem", fontWeight: 700, color: "#fdf8e6", backgroundColor: "#b79b3d", border: "2px solid #d4af37", borderRadius: "8px", padding: "8px 20px", cursor: "pointer", textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>
                  Inscribe a Commandment
                </button>
              </div>
            )}
            <div className="stone-column">
              {loading && <div className="commandment-border">Loading...</div>}
              {error && <div className="commandment-border">{error}</div>}
              {!loading && !error && allPosts.map((post, index) => renderCommandment(post, index, true))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <img
            src="/FlexibleMoralsPicture.png"
            alt="Flexible Morals Background"
            className="home-background-balanced"
          />
          {/* Desktop countdown — fixed position */}
          <div
            style={{
              position: "fixed",
              top: "8rem",
              right: "1rem",
              zIndex: 999,
              textAlign: "center",
              transform: "translateY(-120%)",
              width: "380px",
            }}
          >
            <span
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: "1.2rem",
                fontWeight: 900,
                color: "#c8b070",
                textShadow: "2px 2px 0px #3a2e0b, -1px -1px 0px #3a2e0b, 1px -1px 0px #3a2e0b, -1px 1px 0px #3a2e0b, 0 0 20px rgba(200, 176, 112, 0.3)",
                letterSpacing: "0.08em",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {daysLeft} days until moral reset
            </span>
          </div>
        </>
      )}

      {/* ✅ Login Button (Top Left) */}
      <LoginButton />

      {/* ✅ Chat Box (Right Side) */}
      <ChatBox />

      {/* ✅ Vote button */}
      <div className="vote-button-container">
        {showPrayerHands && !isMobile && (
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

      {/* ✅ "OUR CHARTER" link (opens popup) */}
      <div className="info-link-container">
        <button onClick={() => setShowInfoPopup(true)} className="info-link">
          OUR CHARTER
        </button>
      </div>

      {/* ✅ Merch popup */}
      {showMerchPopup && (
        <div className="popup-overlay" onClick={() => setShowMerchPopup(false)}>
          <div
            className="popup-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "900px", width: "90%", padding: "2rem", backgroundColor: "#1a1a1a" }}
          >
            <h2 style={{ color: "#d4af37", marginBottom: "0.5rem" }}>
              Flexible Morals Tee
            </h2>
            <p style={{ marginBottom: "1rem", color: "#aaa", fontSize: "0.9rem" }}>
              Coming Soon! Each month's top commandments on the back.
            </p>

            {/* T-Shirt photo */}
            <img
              src="/merch_tee.png"
              alt="Flexible Morals Tee - Front and Back"
              style={{
                width: "100%",
                maxWidth: "800px",
                borderRadius: "8px",
                display: "block",
                margin: "0 auto",
              }}
            />

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
            <h1 style={{ color: "#d4af37", marginBottom: "1rem", fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}>
              OUR CHARTER
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

      {/* DESKTOP: Commandments AFTER buttons (original position) */}
      {!isMobile && (
        <div className="overlay-stones">
          {!loading && !error && posts.length === 0 && (
            <div
              className="empty-state"
              style={{
                position: "absolute",
                top: "30%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                zIndex: 10,
                width: "60%",
              }}
            >
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: "1.3rem", fontWeight: 700, color: "#d4af37", textShadow: "1px 1px 4px rgba(0,0,0,0.8)", margin: "0 0 8px 0" }}>
                The tablets are empty.
              </p>
              <p style={{ fontFamily: "'Cinzel', serif", fontSize: "0.95rem", color: "#c8b070", textShadow: "1px 1px 3px rgba(0,0,0,0.8)", margin: "0 0 12px 0" }}>
                Be the first to create a commandment and define the morals for humanity.
              </p>
              <button onClick={() => navigate("/vote")} style={{ fontFamily: "'Cinzel', serif", fontSize: "1rem", fontWeight: 700, color: "#fdf8e6", backgroundColor: "#b79b3d", border: "2px solid #d4af37", borderRadius: "8px", padding: "10px 24px", cursor: "pointer", textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>
                Inscribe a Commandment
              </button>
            </div>
          )}
          <div className="stone-column">
            {loading && <div className="commandment-border">Loading...</div>}
            {error && <div className="commandment-border">{error}</div>}
            {!loading && !error && leftPosts.map((post, index) => renderCommandment(post, index, false))}
          </div>
          <div className="stone-column">
            {loading && <div className="commandment-border">Loading...</div>}
            {error && <div className="commandment-border">{error}</div>}
            {!loading && !error && rightPosts.map((post, index) => renderCommandment(post, index + 5, false))}
          </div>
        </div>
      )}

      {/* GitHub open source link */}
      <a
        href="https://github.com/GrantRedfield/FlexibleMorals"
        target="_blank"
        rel="noopener noreferrer"
        className="github-link"
        title="View source on GitHub"
      >
        ⛧ Open Source
      </a>

      {/* User Profile Popup */}
      {profilePopup && (
        <UserProfilePopup
          username={profilePopup.username}
          blessings={getBlessings(profilePopup.username)}
          donorTier={getDonorStatus(profilePopup.username)?.tier}
          position={{ x: profilePopup.x, y: profilePopup.y }}
          onClose={() => setProfilePopup(null)}
        />
      )}
    </div>
  );
}
