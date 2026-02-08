import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getPosts, voteOnPost, createPost, getComments } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useDonor } from "../context/DonorContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import UserProfilePopup from "../components/UserProfilePopup";
import DonorBadge from "../components/DonorBadge";
import "./Vote.css";

interface Post {
  id: string | number;
  title?: string;
  content?: string;
  votes?: number;
  createdAt?: string;
  username?: string;
}

type SortOption = "top" | "hot" | "new" | "random";
type AnimState = "visible" | "voted" | "fadingOut" | "fadingIn";

interface VisibleSlot {
  postId: string;
  animState: AnimState;
}

const VISIBLE_COUNT = 4;

export default function Vote() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCommandment, setNewCommandment] = useState("");
  const [userVotes, setUserVotes] = useState<Record<string, "up" | "down" | null>>({});
  const [sortOption, setSortOption] = useState<SortOption>("top");
  const [shuffleTrigger, setShuffleTrigger] = useState(0);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [visibleSlots, setVisibleSlots] = useState<VisibleSlot[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const { getDonorStatus, loadDonorStatuses } = useDonor();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [profilePopup, setProfilePopup] = useState<{ username: string; x: number; y: number } | null>(null);

  // Track which posts have been shown to avoid re-showing them before queue exhausts
  const shownPostIds = useRef<Set<string>>(new Set());

  // Sorting logic
  const sortedPosts = useMemo(() => {
    const sorted = [...posts];
    switch (sortOption) {
      case "top":
        return sorted.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
      case "hot":
        return sorted.sort((a, b) => {
          const now = Date.now();
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          // Hours since creation — newer posts get a bigger boost
          const aAge = Math.max((now - aTime) / 3600000, 0.1);
          const bAge = Math.max((now - bTime) / 3600000, 0.1);
          // Hot score: votes divided by age (gravity decay)
          const aScore = (a.votes ?? 0) / Math.pow(aAge, 1.5);
          const bScore = (b.votes ?? 0) / Math.pow(bAge, 1.5);
          return bScore - aScore;
        });
      case "new":
        return sorted.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      case "random":
        return sorted.sort(() => Math.random() - 0.5);
      default:
        return sorted;
    }
  }, [posts, sortOption, shuffleTrigger]);

  // Get the next post to show (in sort order), excluding currently visible ones
  const getNextPost = useCallback(
    (currentVisibleIds: Set<string>): Post | null => {
      // First try posts not yet shown this cycle
      for (const post of sortedPosts) {
        const pid = String(post.id);
        if (!currentVisibleIds.has(pid) && !shownPostIds.current.has(pid)) {
          return post;
        }
      }
      // If all have been shown, reset and allow re-showing posts not currently visible
      for (const post of sortedPosts) {
        const pid = String(post.id);
        if (!currentVisibleIds.has(pid)) {
          return post;
        }
      }
      return null;
    },
    [sortedPosts]
  );

  // Ref to always access latest userVotes without re-triggering effects
  const userVotesRef = useRef(userVotes);
  useEffect(() => { userVotesRef.current = userVotes; }, [userVotes]);

  // Ref to always access latest sortedPosts without re-triggering effects
  const sortedPostsRef = useRef(sortedPosts);
  useEffect(() => { sortedPostsRef.current = sortedPosts; }, [sortedPosts]);

  // Initialize visible slots when posts load or sort changes
  const initializeSlots = useCallback(() => {
    const currentSorted = sortedPostsRef.current;
    const initial = currentSorted.slice(0, VISIBLE_COUNT).map((p) => ({
      postId: String(p.id),
      animState: "visible" as AnimState,
    }));
    shownPostIds.current = new Set(initial.map((s) => s.postId));
    setVisibleSlots(initial);
  }, []);

  // === Load Posts ===
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getPosts();
        setPosts(data);

        // Merge server-side userVotes with localStorage (scoped per user)
        const storageKey = user ? `userVotes_${user}` : "userVotes_guest";
        const savedVotes = localStorage.getItem(storageKey);
        const localVotes: Record<string, "up" | "down" | null> = savedVotes ? JSON.parse(savedVotes) : {};
        const merged = { ...localVotes };
        if (user) {
          data.forEach((p: any) => {
            const pid = String(p.id);
            const serverVote = p.userVotes?.[user];
            if (serverVote) {
              merged[pid] = serverVote;
            }
          });
        }
        setUserVotes(merged);

        // Fetch comment counts for all posts
        const counts: Record<string, number> = {};
        await Promise.all(
          data.map(async (p: any) => {
            try {
              const res = await getComments(String(p.id));
              counts[String(p.id)] = (res.comments || []).length;
            } catch {
              counts[String(p.id)] = 0;
            }
          })
        );
        setCommentCounts(counts);
      } catch (err: any) {
        console.error("Error fetching posts:", err);
        setError("Failed to load posts.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Load donor statuses for displayed posts
  useEffect(() => {
    if (posts.length > 0) {
      const usernames = posts
        .map((p) => p.username)
        .filter((u): u is string => !!u && u !== "unknown");
      if (usernames.length > 0) loadDonorStatuses(usernames);
    }
  }, [posts, loadDonorStatuses]);

  // Compute total blessings (votes) for a given username
  const getBlessings = useCallback(
    (username: string): number => {
      return posts
        .filter((p) => p.username === username)
        .reduce((sum, p) => sum + (p.votes ?? 0), 0);
    },
    [posts]
  );

  // Re-load votes from localStorage + server when user changes (e.g. login after page load)
  useEffect(() => {
    if (posts.length === 0) return;
    const storageKey = user ? `userVotes_${user}` : "userVotes_guest";
    const saved = localStorage.getItem(storageKey);
    const merged: Record<string, "up" | "down" | null> = saved ? JSON.parse(saved) : {};
    if (user) {
      posts.forEach((p: any) => {
        const pid = String(p.id);
        const serverVote = p.userVotes?.[user];
        if (serverVote) {
          merged[pid] = serverVote;
        }
      });
    }
    setUserVotes(merged);
  }, [user, posts]);

  // Initialize slots when sort changes or posts first load
  const [postsLoaded, setPostsLoaded] = useState(false);
  useEffect(() => {
    if (sortedPosts.length > 0 && !postsLoaded) {
      setPostsLoaded(true);
    }
  }, [sortedPosts.length]);

  useEffect(() => {
    if (postsLoaded) {
      initializeSlots();
    }
  }, [postsLoaded, sortOption, shuffleTrigger]);

  // Persist userVotes locally (scoped per user)
  useEffect(() => {
    const storageKey = user ? `userVotes_${user}` : "userVotes_guest";
    localStorage.setItem(storageKey, JSON.stringify(userVotes));
  }, [userVotes, user]);

  // Voted count
  const votedCount = Object.keys(userVotes).filter((k) => userVotes[k]).length;
  const totalCount = posts.length;

  // === Require login ===
  const requireLogin = (): boolean => {
    if (user) return true;
    const name = prompt("Enter your username:");
    if (name && name.trim()) {
      login(name.trim());
      return true;
    }
    return false;
  };

  // === Check if user already submitted today ===
  const hasSubmittedToday = (): boolean => {
    if (!user) return false;
    const lastSubmission = localStorage.getItem(`lastSubmission_${user}`);
    if (!lastSubmission) return false;
    const lastDate = new Date(lastSubmission).toDateString();
    const today = new Date().toDateString();
    return lastDate === today;
  };

  // === Handle new post submission ===
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireLogin()) return;
    if (!newCommandment.trim()) return;

    if (hasSubmittedToday()) {
      alert("You can only submit one commandment per day. Come back tomorrow!");
      return;
    }

    try {
      const newPost = await createPost(newCommandment.trim(), user);
      setPosts((prev) => [...prev, newPost]);
      setNewCommandment("");
      localStorage.setItem(`lastSubmission_${user}`, new Date().toISOString());
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
      // Switch to "New" sort so user sees their submission
      setSortOption("new");
      setShuffleTrigger((t) => t + 1);
    } catch (err: any) {
      console.error("Failed to create post:", err);
      if (err.response?.status === 429) {
        alert("You can only submit one commandment per day. Come back tomorrow!");
      } else {
        alert("Could not create new commandment.");
      }
    }
  };

  // === Handle vote with fade animation ===
  const handleVote = (postId: string | number, direction: "up" | "down") => {
    if (!requireLogin()) return;

    const pid = String(postId);
    // Block voting on your own post
    const post = posts.find((p) => String(p.id) === pid);
    if (post?.username === user) return;

    const prevVote = userVotes[pid];
    if (prevVote === direction) return;

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (String(p.id) !== pid) return p;
        const current = p.votes ?? 0;
        let newVotes = current;
        if (!prevVote) {
          newVotes += direction === "up" ? 1 : -1;
        } else if (prevVote === "up" && direction === "down") {
          newVotes -= 2;
        } else if (prevVote === "down" && direction === "up") {
          newVotes += 2;
        }
        return { ...p, votes: newVotes };
      })
    );

    setUserVotes((prev) => ({ ...prev, [pid]: direction }));

    // Fire API call in background (don't block animation)
    voteOnPost(pid, direction, user)
      .then((updated) => {
        setPosts((prev) =>
          prev.map((p) =>
            String(p.id) === String(updated.id) ? { ...p, votes: updated.votes } : p
          )
        );
      })
      .catch((err) => console.error("Vote failed:", err));

    // Immediately show "voted" state, then start fade-out after brief flash
    setVisibleSlots((prev) =>
      prev.map((slot) =>
        slot.postId === pid ? { ...slot, animState: "voted" as AnimState } : slot
      )
    );

    // Start fade-out shortly after the voted flash
    setTimeout(() => {
      setVisibleSlots((prev) =>
        prev.map((slot) =>
          slot.postId === pid ? { ...slot, animState: "fadingOut" as AnimState } : slot
        )
      );
    }, 150);

    // After fade-out completes, replace with next card
    setTimeout(() => {
      setVisibleSlots((prev) => {
        const currentVisibleIds = new Set(prev.map((s) => s.postId));
        const nextPost = getNextPost(currentVisibleIds);

        if (nextPost) {
          const nextPid = String(nextPost.id);
          shownPostIds.current.add(nextPid);
          return prev.map((slot) =>
            slot.postId === pid
              ? { postId: nextPid, animState: "fadingIn" as AnimState }
              : slot
          );
        } else {
          // No more unvoted posts, remove the slot
          return prev.filter((slot) => slot.postId !== pid);
        }
      });

      // Trigger fade-in after a brief delay
      setTimeout(() => {
        setVisibleSlots((prev) =>
          prev.map((slot) =>
            slot.animState === "fadingIn"
              ? { ...slot, animState: "visible" as AnimState }
              : slot
          )
        );
      }, 50);
    }, 450);
  };

  // === Handle skip (for already-voted posts) ===
  const handleSkip = (postId: string | number) => {
    const pid = String(postId);

    // Start fade-out
    setVisibleSlots((prev) =>
      prev.map((slot) =>
        slot.postId === pid ? { ...slot, animState: "fadingOut" as AnimState } : slot
      )
    );

    // After fade-out completes, replace with next card
    setTimeout(() => {
      setVisibleSlots((prev) => {
        const currentVisibleIds = new Set(prev.map((s) => s.postId));
        const nextPost = getNextPost(currentVisibleIds);

        if (nextPost) {
          const nextPid = String(nextPost.id);
          shownPostIds.current.add(nextPid);
          return prev.map((slot) =>
            slot.postId === pid
              ? { postId: nextPid, animState: "fadingIn" as AnimState }
              : slot
          );
        } else {
          return prev.filter((slot) => slot.postId !== pid);
        }
      });

      setTimeout(() => {
        setVisibleSlots((prev) =>
          prev.map((slot) =>
            slot.animState === "fadingIn"
              ? { ...slot, animState: "visible" as AnimState }
              : slot
          )
        );
      }, 50);
    }, 300);
  };

  // Get animation styles for a slot
  const getAnimStyle = (animState: AnimState): React.CSSProperties => {
    switch (animState) {
      case "voted":
        return { opacity: 0.6, transform: "scale(0.97)", borderColor: "#d4af37" };
      case "fadingOut":
        return { opacity: 0, transform: "translateY(-10px) scale(0.95)" };
      case "fadingIn":
        return { opacity: 0, transform: "translateY(10px)" };
      case "visible":
      default:
        return { opacity: 1, transform: "translateY(0)" };
    }
  };

  // Find post by ID
  const getPost = (postId: string): Post | undefined =>
    posts.find((p) => String(p.id) === postId);

  // === Loading & Error States ===
  if (loading) return (
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
  if (error) return <p className="p-4 text-red-600">{error}</p>;

  // === Render ===
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #1a2a4a 0%, #2a4a7a 20%, #4a7ab5 40%, #7ab0e0 60%, #a8d4f0 80%, #d4ecfa 100%)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "0.5rem",
        overflow: "auto",
      }}
    >
      {/* Heavenly clouds filling the sky */}
      {Array.from({ length: 32 }, (_, i) => (
        <div key={i} className={`cloud cloud-${i + 1}`}></div>
      ))}

      <div
        style={{
          backgroundColor: "rgba(20, 15, 5, 0.92)",
          borderRadius: isMobile ? "0" : "10px",
          padding: isMobile ? "0.75rem 0.75rem" : "0.75rem 1.5rem",
          maxWidth: isMobile ? "100%" : "1100px",
          width: isMobile ? "100%" : "95%",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 15px rgba(212, 175, 55, 0.15)",
          border: isMobile ? "none" : "2px solid #d4af37",
          borderBottom: isMobile ? "2px solid #d4af37" : undefined,
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Home Button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.25rem" }}>
          <button onClick={() => navigate("/")} className="home-button">
            🏠 Home
          </button>
        </div>

        <h1
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: isMobile ? "1.6rem" : "2.5rem",
            fontWeight: 900,
            textAlign: "center",
            color: "#c8b070",
            textShadow:
              "2px 2px 0px #3a2e0b, -1px -1px 0px #3a2e0b, 1px -1px 0px #3a2e0b, -1px 1px 0px #3a2e0b, 0 0 15px rgba(200, 176, 112, 0.25)",
            letterSpacing: "0.08em",
            marginBottom: "0.4rem",
            textTransform: "uppercase",
          }}
        >
          Vote on Commandments
        </h1>

        {/* Login Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.5rem" }}>
          {user ? (
            <button
              onClick={logout}
              style={{ backgroundColor: "transparent", color: "#aaa", padding: "2px 8px", borderRadius: "4px", border: "1px solid #888", cursor: "pointer", fontSize: "12px" }}
            >
              Log Out
            </button>
          ) : (
            <button
              onClick={() => requireLogin()}
              style={{ backgroundColor: "transparent", color: "#d4af37", padding: "2px 8px", borderRadius: "4px", border: "1px solid #d4af37", cursor: "pointer", fontSize: "12px" }}
            >
              Log In
            </button>
          )}
          {user ? (
            <p style={{ color: "#d4af37", fontSize: "12px", margin: 0 }}>
              Logged in as <span style={{ fontWeight: 600 }}>{user}</span>
            </p>
          ) : (
            <p style={{ color: "#888", fontSize: "12px", fontStyle: "italic", margin: 0 }}>Not logged in</p>
          )}
        </div>

        {/* Create Post Form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: "0.5rem", width: "100%" }}>
          <textarea
            placeholder="Enter a new commandment..."
            value={newCommandment}
            onChange={(e) => setNewCommandment(e.target.value)}
            maxLength={60}
            style={{
              width: "100%",
              height: "50px",
              border: "1px solid #d1b97b",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "0.95rem",
              resize: "none",
              boxSizing: "border-box",
              backgroundColor: "#1a1a1a",
              color: "#fdf8e6",
              borderColor: "#555",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", color: newCommandment.length >= 50 ? "#e07050" : "#888" }}>
              {newCommandment.length}/60
            </span>
            <button
              type="submit"
              style={{
                backgroundColor: "#b79b3d",
                color: "#fdf8e6",
                padding: "4px 16px",
                borderRadius: "4px",
                fontSize: "0.9rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              Submit
            </button>
          </div>
        </form>

        {/* Submission Success Message */}
        {submitSuccess && (
          <div style={{
            textAlign: "center",
            padding: "8px 16px",
            marginBottom: "0.5rem",
            backgroundColor: "rgba(90, 122, 80, 0.3)",
            border: "1px solid #5a7a50",
            borderRadius: "8px",
            color: "#a8d89a",
            fontSize: "0.95rem",
            fontFamily: "'Cinzel', serif",
            animation: "fadeIn 0.3s ease",
          }}>
            ✦ Your commandment has been submitted successfully! ✦
          </div>
        )}

        {/* Sort Options */}
        <div style={{ display: "flex", justifyContent: "center", gap: isMobile ? "6px" : "10px", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          {(["top", "hot", "new", "random"] as SortOption[]).map((option) => (
            <button
              key={option}
              onClick={() => {
                setSortOption(option);
                setShuffleTrigger((t) => t + 1);
              }}
              style={{
                padding: isMobile ? "8px 16px" : "10px 24px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: isMobile ? "0.9rem" : "1rem",
                fontFamily: "'Cinzel', serif",
                letterSpacing: "0.04em",
                backgroundColor: sortOption === option ? "#b79b3d" : "transparent",
                color: sortOption === option ? "#fdf8e6" : "#d1b97b",
                border: sortOption === option ? "2px solid #d4af37" : "2px solid #555",
                transition: "all 0.2s ease",
                minHeight: "44px",
              }}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>

        {/* Commandment Cards — Single Column, 4 at a time */}
        {posts.length === 0 && (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
            <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.4rem", margin: "0 0 12px 0" }}>
              The tablets are empty.
            </p>
            <p style={{ color: "#c8b070", fontSize: "1rem", margin: "0 0 8px 0", fontFamily: "'Cinzel', serif" }}>
              Be the first to inscribe a commandment and define the morals for humanity.
            </p>
            <p style={{ color: "#888", fontSize: "13px", margin: 0, fontStyle: "italic" }}>
              Use the form above to submit your commandment.
            </p>
          </div>
        )}
        {visibleSlots.length === 0 && posts.length > 0 && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.2rem", margin: "0 0 8px 0" }}>
              You've seen all commandments!
            </p>
            <p style={{ color: "#888", fontSize: "13px", margin: 0 }}>
              Submit a new one or change the sort order.
            </p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "12px" : "16px", width: "100%" }}>
          {visibleSlots.map((slot) => {
            const post = getPost(slot.postId);
            if (!post) return null;
            const userVote = userVotes[String(post.id)];
            const isOwnPost = post.username === user;

            return (
              <div
                key={slot.postId}
                style={{
                  border: "1px solid #555",
                  padding: "24px",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  overflow: "hidden",
                  minHeight: "180px",
                  transition: "all 0.25s ease",
                  ...getAnimStyle(slot.animState),
                }}
              >
                <div>
                  <h2 style={{ fontWeight: 700, color: "#fdf8e6", fontSize: "1.15rem", margin: "0 0 8px 0", lineHeight: 1.4, wordBreak: "break-word", whiteSpace: "normal" }}>
                    {post.title || post.content}
                  </h2>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "15px", color: "#d1b97b", fontWeight: 600 }}>
                      {post.votes ?? 0} votes
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (post.username && post.username !== "unknown") {
                          setProfilePopup({ username: post.username, x: e.clientX, y: e.clientY });
                        }
                      }}
                      style={{ fontSize: "13px", color: "#888", fontStyle: "italic", cursor: "pointer" }}
                    >
                      {post.username || "unknown"}
                      {getDonorStatus(post.username || "")?.tier && (
                        <DonorBadge tier={getDonorStatus(post.username || "")!.tier} size="small" />
                      )}
                    </span>
                    <Link
                      to={`/comments/${post.id}`}
                      style={{ fontSize: "13px", color: "#888", textDecoration: "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#d4af37")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#888")}
                    >
                      💬 Comments ({commentCounts[String(post.id)] ?? 0})
                    </Link>
                  </div>
                </div>
                {isOwnPost ? (
                  <div style={{ textAlign: "center", marginTop: "16px", color: "#888", fontSize: "0.85rem", fontStyle: "italic" }}>
                    Your commandment
                  </div>
                ) : userVote ? (
                  <div style={{ marginTop: "16px" }}>
                    <p style={{ textAlign: "center", color: "#888", fontSize: "0.8rem", fontStyle: "italic", margin: "0 0 8px 0" }}>
                      You have already voted on this one
                    </p>
                    <button
                      style={{
                        width: "100%",
                        padding: "10px 0",
                        borderRadius: "8px",
                        border: "1px solid #555",
                        cursor: "pointer",
                        backgroundColor: "rgba(255,255,255,0.08)",
                        color: "#d1b97b",
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        fontFamily: "'Cinzel', serif",
                        minHeight: "44px",
                      }}
                      onClick={() => handleSkip(post.id)}
                    >
                      Skip
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                    <button
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: "#7a9a6a",
                        color: "#fdf8e6",
                        fontSize: "20px",
                        minHeight: "44px",
                      }}
                      onClick={() => handleVote(post.id, "up")}
                    >
                      👍
                    </button>
                    <button
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: "#a87a6a",
                        color: "#fdf8e6",
                        fontSize: "20px",
                        minHeight: "44px",
                      }}
                      onClick={() => handleVote(post.id, "down")}
                    >
                      👎
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress indicator */}
        {posts.length > 0 && (
          <div style={{ textAlign: "center", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #555" }}>
            <span style={{ color: "#d1b97b", fontSize: "12px" }}>
              Voted on {votedCount} of {totalCount} commandments
            </span>
          </div>
        )}
      </div>

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
