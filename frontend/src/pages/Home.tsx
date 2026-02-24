import { useEffect, useState, useCallback, useRef } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useNavigate } from "react-router-dom";
import { getPosts } from "../utils/api";
import DonationPopup from "../components/DonationPopup";
import DonorBadge from "../components/DonorBadge";
import LoginButton from "../components/LoginButton";
import ChatBox from "../components/ChatBox";
import type { ChatBoxHandle } from "../components/ChatBox";
import HamburgerMenu from "../components/HamburgerMenu";
import UserProfilePopup from "../components/UserProfilePopup";
import { useDonor } from "../context/DonorContext";
import { useAuth } from "../context/AuthContext";
import "../App.css";

interface Post {
  id: number | string;
  title?: string;
  content?: string;
  votes?: number;
  username?: string;
}

const toRoman = (num: number): string => {
  const romanNumerals: [number, string][] = [
    [10, "X"], [9, "IX"], [8, "VIII"], [7, "VII"], [6, "VI"],
    [5, "V"], [4, "IV"], [3, "III"], [2, "II"], [1, "I"],
  ];
  let result = "";
  for (const [value, symbol] of romanNumerals) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
};

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMerchPopup, setShowMerchPopup] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [showDonationPopup, setShowDonationPopup] = useState(false);

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showPrayerHands, setShowPrayerHands] = useState(false);
  const [showCoins, setShowCoins] = useState(false);
  const [profilePopup, setProfilePopup] = useState<{ username: string; x: number; y: number } | null>(null);

  const chatBoxRef = useRef<ChatBoxHandle>(null);
  const wheelContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { donorStatuses, loadDonorStatuses, getDonorStatus } = useDonor();
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const getBlessings = useCallback(
    (username: string): number => {
      return posts
        .filter((p) => p.username === username)
        .reduce((sum, p) => sum + (p.votes ?? 0), 0);
    },
    [posts]
  );

  // ✅ Countdown logic — ticks every second for days/hours/minutes/seconds
  useEffect(() => {
    const calcTimeLeft = () => {
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0); // midnight of 1st next month
      const diff = endOfMonth.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds });
    };
    calcTimeLeft();
    const interval = setInterval(calcTimeLeft, 1000);
    return () => clearInterval(interval);
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


  // ✅ Fetch posts — initial load + poll every 30s + refetch on window focus
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

    // Poll every 30 seconds so votes are reflected without a page refresh
    const interval = setInterval(fetchPosts, 30000);

    // Refetch immediately when the user returns to this tab/window
    const handleFocus = () => fetchPosts();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
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

  // Wheel carousel scroll handler for mobile commandments
  useEffect(() => {
    if (!isMobile || loading || posts.length === 0) return;
    const container = wheelContainerRef.current;
    if (!container) return;

    let rafId: number;

    const updateWheel = () => {
      const items = container.querySelectorAll('.wheel-item') as NodeListOf<HTMLElement>;
      const containerRect = container.getBoundingClientRect();
      const containerHeight = containerRect.height;
      // Only bottom fade zone — items at top are fully visible, bottom 20% fades out.
      // Items that scroll above the container are clipped by overflow + CSS mask.
      const bottomFade = containerHeight * 0.18;
      const safeBottom = containerRect.bottom - bottomFade;

      items.forEach((item) => {
        const itemRect = item.getBoundingClientRect();
        const itemCenter = itemRect.top + itemRect.height / 2;

        let t = 0; // 0 = fully visible, 1 = fully faded
        if (itemCenter > safeBottom) {
          t = Math.min((itemCenter - safeBottom) / bottomFade, 1);
        }

        const scale = 1 - t * 0.2;
        const opacity = 1 - t * 0.65;
        item.style.transform = `scale(${scale})`;
        item.style.opacity = `${Math.max(opacity, 0.25)}`;
      });
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateWheel);
    };

    // Set bottom spacer — enough so last commandment can scroll above the fade zone
    const bottomSpacer = container.querySelector('.wheel-spacer-bottom') as HTMLElement;
    if (bottomSpacer) bottomSpacer.style.height = `${container.clientHeight * 0.2}px`;

    container.addEventListener('scroll', onScroll, { passive: true });

    // Start at top, then apply initial transforms
    setTimeout(() => {
      container.scrollTop = 0;
      updateWheel();
    }, 50);

    return () => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [isMobile, posts, loading]);

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
          {showNumber && <span className="commandment-number">{toRoman(index + 1)}. </span>}
          {post.title || post.content}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "6px", marginTop: "2px" }}>
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
            style={{ fontSize: "0.8rem", color: "#c8b070", cursor: "pointer", fontStyle: "italic" }}
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
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100dvh", overflow: "hidden", backgroundImage: "url(/mobile_bg_4.png)", backgroundSize: "100% 100%", backgroundPosition: "center center", backgroundRepeat: "no-repeat" }}>
          {/* Countdown — top right */}
          <div
            style={{
              position: "absolute",
              top: "0.4rem",
              right: "0.5rem",
              zIndex: 20,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
              {[
                { val: timeLeft.days, label: "D" },
                { val: timeLeft.hours, label: "H" },
                { val: timeLeft.minutes, label: "M" },
                { val: timeLeft.seconds, label: "S" },
              ].map((unit) => (
                <div key={unit.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: "1.6rem",
                      fontWeight: 900,
                      color: "#c8b070",
                      textShadow: "2px 2px 0px #3a2e0b, -1px -1px 0px #3a2e0b, 1px -1px 0px #3a2e0b, -1px 1px 0px #3a2e0b, 0 0 10px rgba(200, 176, 112, 0.3)",
                      lineHeight: 1,
                      minWidth: "1.8rem",
                    }}
                  >
                    {String(unit.val).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: "0.55rem",
                      fontWeight: 700,
                      color: "#c8b070",
                      textShadow: "1px 1px 0px #3a2e0b",
                      letterSpacing: "0.08em",
                      marginTop: "1px",
                    }}
                  >
                    {unit.label}
                  </span>
                </div>
              ))}
            </div>
            <span
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: "0.65rem",
                fontWeight: 700,
                color: "#c8b070",
                textShadow: "1px 1px 0px #3a2e0b, 0 0 10px rgba(200, 176, 112, 0.3)",
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                marginTop: "3px",
                display: "block",
              }}
            >
              until moral reset
            </span>
          </div>
          {/* Commandments — wheel carousel on the tablet */}
          <div className="mobile-tablet-overlay" ref={wheelContainerRef}>
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
              {!loading && !error && (
                <>
                  {allPosts.map((post, index) => (
                    <div key={post.id} className="wheel-item">
                      {renderCommandment(post, index, true)}
                    </div>
                  ))}
                  <div className="wheel-spacer wheel-spacer-bottom" />
                </>
              )}
            </div>
          </div>
          {/* Mobile buttons — Vote + Live Chat */}
          <div className="mobile-buttons-overlay">
            <button onClick={() => navigate("/vote")} className="vote-button mobile-btn">
              Vote
            </button>
            <button onClick={() => chatBoxRef.current?.expand()} className="vote-button mobile-btn">
              Live Chat
            </button>
          </div>
        </div>
      ) : (
        <>
          <img
            src="/FlexibleMoralsPicture.png"
            alt="Flexible Morals Background"
            className="home-background-balanced"
          />
          {/* Desktop countdown — fixed position, DD:HH:MM:SS */}
          <div
            style={{
              position: "fixed",
              top: "1rem",
              right: "1rem",
              zIndex: 999,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              {[
                { val: timeLeft.days, label: "DAYS" },
                { val: timeLeft.hours, label: "HRS" },
                { val: timeLeft.minutes, label: "MIN" },
                { val: timeLeft.seconds, label: "SEC" },
              ].map((unit) => (
                <div key={unit.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: "2.8rem",
                      fontWeight: 900,
                      color: "#c8b070",
                      textShadow: "2px 2px 0px #3a2e0b, -1px -1px 0px #3a2e0b, 1px -1px 0px #3a2e0b, -1px 1px 0px #3a2e0b, 0 0 20px rgba(200, 176, 112, 0.3)",
                      lineHeight: 1,
                      minWidth: "3.2rem",
                    }}
                  >
                    {String(unit.val).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#c8b070",
                      textShadow: "1px 1px 0px #3a2e0b",
                      letterSpacing: "0.1em",
                      marginTop: "4px",
                    }}
                  >
                    {unit.label}
                  </span>
                </div>
              ))}
            </div>
            <span
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#c8b070",
                textShadow: "2px 2px 0px #3a2e0b, -1px -1px 0px #3a2e0b, 1px -1px 0px #3a2e0b, -1px 1px 0px #3a2e0b, 0 0 20px rgba(200, 176, 112, 0.3)",
                letterSpacing: "0.15em",
                textTransform: "uppercase" as const,
                marginTop: "8px",
                display: "block",
              }}
            >
              until moral reset
            </span>
          </div>
        </>
      )}

      {/* Login / Menu (Top Left) */}
      {isMobile ? (
        <HamburgerMenu
          onOfferingClick={() => setShowDonationPopup(true)}
          onMerchClick={() => setShowMerchPopup(true)}
          onCharterClick={() => setShowInfoPopup(true)}
        />
      ) : (
        <LoginButton />
      )}

      {/* Chat Box (Right Side) */}
      <ChatBox ref={chatBoxRef} hideMobileFab={isMobile} />

      {/* ✅ Vote button */}
      <div className="vote-button-container">
        {showPrayerHands && !isMobile && (
          <>
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
          </div>
        )}
        <button
          onClick={() => setShowDonationPopup(true)}
          className="offering-link"
          style={{ fontFamily: "inherit" }}
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
        <button onClick={() => setShowInfoPopup(true)} className={`info-link${!user ? " charter-glow" : ""}`}>
          OUR CHARTER
        </button>
      </div>

      {/* ✅ Merch popup */}
      {showMerchPopup && (
        <div className="popup-overlay" onClick={() => setShowMerchPopup(false)}>
          <div
            className="popup-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "520px", width: "92%", padding: isMobile ? "1rem" : "2rem", backgroundColor: "#1a1a1a", maxHeight: "90vh", overflowY: "auto" }}
          >
            <h2 style={{ color: "#d4af37", marginBottom: "0.5rem", fontSize: isMobile ? "1.2rem" : "1.5rem" }}>
              Flexible Morals Tee
            </h2>
            <p style={{ marginBottom: isMobile ? "0.5rem" : "1rem", color: "#aaa", fontSize: isMobile ? "0.8rem" : "0.9rem" }}>
              Coming Soon! Each month's top commandments on the back.
            </p>

            {/* T-Shirt photos */}
            <img
              src="/merch_tee_back.png"
              alt="Flexible Morals Tee - Back with Commandments"
              style={{
                width: "100%",
                borderRadius: "8px",
                display: "block",
                margin: "0 auto",
              }}
            />
            <img
              src="/merch_tee_2.png"
              alt="Flexible Morals Tee - Modeled Front and Back"
              style={{
                width: "100%",
                borderRadius: "8px",
                display: "block",
                margin: isMobile ? "0.5rem auto 0" : "1rem auto 0",
              }}
            />

            <p style={{ marginTop: isMobile ? "0.5rem" : "1rem", fontSize: isMobile ? "0.75rem" : "0.85rem", color: "#d4af37", fontFamily: "'Cinzel', serif", fontWeight: 600 }}>
              Shirts updated with our most recent morals!
            </p>
            <button
              onClick={() => setShowMerchPopup(false)}
              className="popup-close"
              style={{ marginTop: isMobile ? "0.5rem" : "1rem" }}
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
              lineHeight: isMobile ? "1.4" : "1.6",
              textAlign: "center",
              position: "relative",
              padding: isMobile ? "1rem 1rem 0.8rem" : undefined,
              fontSize: isMobile ? "0.85rem" : undefined,
            }}
          >
            <button
              onClick={() => setShowInfoPopup(false)}
              style={{
                position: isMobile ? "sticky" : "absolute",
                top: isMobile ? 0 : "12px",
                right: isMobile ? undefined : "16px",
                float: isMobile ? "right" : undefined,
                background: isMobile ? "rgba(253, 248, 230, 0.95)" : "none",
                border: "none",
                color: "#d4af37",
                fontSize: isMobile ? "1.3rem" : "1.5rem",
                cursor: "pointer",
                fontFamily: "'Cinzel', serif",
                fontWeight: 700,
                lineHeight: 1,
                padding: isMobile ? "2px 6px" : "4px 8px",
                zIndex: 10,
                borderRadius: isMobile ? "4px" : undefined,
              }}
              aria-label="Close"
            >
              ✕
            </button>
            <h1 style={{ color: "#d4af37", marginBottom: isMobile ? "0.5rem" : "1rem", fontFamily: "'Cinzel', serif", letterSpacing: "0.1em", fontSize: isMobile ? "1.2rem" : undefined }}>
              OUR CHARTER
            </h1>
            <p>
              Flexible Morals was founded to create a collaborative, ad-free, bot-free space where people can actively shape a modern moral framework inspired by timeless principles. Readers and future disciples are invited to participate in the <strong style={{ color: "#d4af37", backgroundColor: "rgba(0, 0, 0, 0.7)", padding: "2px 6px", borderRadius: "3px" }}>World's First Democratic Religion</strong> by sharing opinions, helping guide daily commandments, and voting monthly to determine the top ten moral standards.
            </p>
            <p style={{ marginTop: isMobile ? "0.6rem" : "1rem" }}>
              The mission is to foster thoughtful dialogue across cultures and generations, sustain the platform through optional support, and build a movement focused not on profit, but on making a positive impact—supporting meaningful causes and promoting hope and care for humanity's future.
            </p>
            <button
              onClick={() => setShowInfoPopup(false)}
              className="popup-close"
              style={{ marginTop: isMobile ? "0.6rem" : undefined }}
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
            {!loading && !error && leftPosts.map((post, index) => renderCommandment(post, index, true))}
          </div>
          <div className="stone-column">
            {loading && <div className="commandment-border">Loading...</div>}
            {error && <div className="commandment-border">{error}</div>}
            {!loading && !error && rightPosts.map((post, index) => renderCommandment(post, index + 5, true))}
          </div>
        </div>
      )}

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
