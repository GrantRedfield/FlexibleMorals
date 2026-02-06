import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getPosts, voteOnPost, createPost } from "../utils/api";
import { useAuth } from "../context/AuthContext";

interface Post {
  id: string | number;
  title?: string;
  content?: string;
  votes?: number;
  createdAt?: string;
}

type SortOption = "top" | "hot" | "new" | "random";

const POSTS_PER_PAGE = 16;

export default function Vote() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCommandment, setNewCommandment] = useState("");
  const [userVotes, setUserVotes] = useState<Record<string, "up" | "down" | null>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOption, setSortOption] = useState<SortOption>("top");
  const [shuffleTrigger, setShuffleTrigger] = useState(0);
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  // Sorting logic - memoized to prevent reshuffling on every render
  const sortedPosts = useMemo(() => {
    const sorted = [...posts];
    switch (sortOption) {
      case "top":
        return sorted.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
      case "hot":
        // Hot = votes weighted by recency (higher score for newer posts with votes)
        return sorted.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          const aScore = (a.votes ?? 0) + (aTime / 1000000000000);
          const bScore = (b.votes ?? 0) + (bTime / 1000000000000);
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

  // Pagination calculations
  const totalPages = Math.ceil(sortedPosts.length / POSTS_PER_PAGE);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const paginatedPosts = sortedPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);

  // === Load Posts ===
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getPosts();
        setPosts(data);
      } catch (err: any) {
        console.error("Error fetching posts:", err);
        setError("Failed to load posts.");
      } finally {
        setLoading(false);
      }
    };
    load();

    const savedVotes = localStorage.getItem("userVotes");
    if (savedVotes) setUserVotes(JSON.parse(savedVotes));
  }, []);

  // === Persist userVotes locally ===
  useEffect(() => {
    localStorage.setItem("userVotes", JSON.stringify(userVotes));
  }, [userVotes]);

  // === Require login before posting or voting ===
  const requireLogin = (): boolean => {
    if (user) return true;
    const name = prompt("🔒 Please log in to continue.\nEnter your username:");
    if (name && name.trim()) {
      login(name.trim());
      return true;
    }
    alert("You must log in to perform this action.");
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
      // ✅ Send username to backend
      const newPost = await createPost(newCommandment.trim(), user);
      setPosts((prev) => [...prev, newPost]);
      setNewCommandment("");
      // Record submission time
      localStorage.setItem(`lastSubmission_${user}`, new Date().toISOString());
    } catch (err: any) {
      console.error("❌ Failed to create post:", err);
      if (err.response?.status === 429) {
        alert("You can only submit one commandment per day. Come back tomorrow!");
      } else {
        alert("Could not create new commandment.");
      }
    }
  };

  // === Handle vote action ===
  const handleVote = async (postId: string | number, direction: "up" | "down") => {
    if (!requireLogin()) return;

    const pid = String(postId);
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

    try {
      const updated = await voteOnPost(pid, direction, user);
      setPosts((prev) =>
        prev.map((p) =>
          String(p.id) === String(updated.id) ? { ...p, votes: updated.votes } : p
        )
      );
    } catch (err) {
      console.error("❌ Vote failed:", err);
    }
  };

  // === Loading & Error States ===
  if (loading) return <p className="p-4 text-gray-500">Loading...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;

  // === Render ===
  return (
    <div
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
        paddingTop: "0.5rem",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(253, 248, 230, 0.95)",
          borderRadius: "10px",
          padding: "0.5rem 1rem",
          maxWidth: "1000px",
          width: "95%",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          border: "1px solid #d1b97b",
        }}
      >
        {/* 🏠 Home Button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.25rem" }}>
          <button onClick={() => navigate("/")} className="home-button">
            🏠 Home
          </button>
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.4rem", textAlign: "center", color: "#3a2e0b" }}>
          Vote on Commandments
        </h1>

        {/* 👤 Login Info & Sort Options - Same Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {user ? (
              <button
                onClick={logout}
                style={{ backgroundColor: "#5c5040", color: "#fdf8e6", padding: "2px 8px", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "12px" }}
              >
                Log Out
              </button>
            ) : (
              <button
                onClick={requireLogin}
                style={{ backgroundColor: "#b79b3d", color: "#fdf8e6", padding: "2px 8px", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "12px" }}
              >
                Log In
              </button>
            )}
            {user ? (
              <p style={{ color: "#4b3a0d", fontSize: "12px", margin: 0 }}>
                Logged in as <span style={{ fontWeight: 600 }}>{user}</span>
              </p>
            ) : (
              <p style={{ color: "#7a6a3a", fontSize: "12px", fontStyle: "italic", margin: 0 }}>Not logged in</p>
            )}
          </div>

          {/* Sort Options */}
          <div style={{ display: "flex", gap: "4px" }}>
            {(["top", "hot", "new", "random"] as SortOption[]).map((option) => (
              <button
                key={option}
                onClick={() => {
                  setSortOption(option);
                  setCurrentPage(1);
                  if (option === "random") {
                    setShuffleTrigger((t) => t + 1);
                  }
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "1px solid #d1b97b",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "12px",
                  backgroundColor: sortOption === option ? "#b79b3d" : "#f5edd6",
                  color: sortOption === option ? "#fdf8e6" : "#4b3a0d",
                }}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ✍️ Create Post Form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: "0.5rem", width: "100%" }}>
          <textarea
            placeholder="Enter a new commandment..."
            value={newCommandment}
            onChange={(e) => setNewCommandment(e.target.value)}
            maxLength={80}
            style={{
              width: "100%",
              height: "50px",
              border: "1px solid #d1b97b",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "0.95rem",
              resize: "none",
              boxSizing: "border-box",
              backgroundColor: "#fffef9",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", color: newCommandment.length >= 70 ? "#a85032" : "#7a6a3a" }}>
              {newCommandment.length}/80
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

        {/* 🗳️ Commandments List - Two Columns */}
        {posts.length === 0 && (
          <p className="text-center text-gray-600">No commandments found.</p>
        )}

        <div style={{ display: "flex", flexDirection: "row", gap: "16px", overflow: "hidden", width: "100%" }}>
          {/* Left Column */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {paginatedPosts.slice(0, 8).map((post) => {
              const userVote = userVotes[String(post.id)];
              return (
                <div
                  key={post.id}
                  style={{
                    border: "1px solid #d1b97b",
                    padding: "14px 16px",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#fffef9",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, marginRight: "10px" }}>
                    <h2 style={{ fontWeight: 600, color: "#3a2e0b", fontSize: "18px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                      {post.title || post.content}
                    </h2>
                    <p style={{ fontSize: "14px", color: "#7a6a3a", margin: 0 }}>
                      {post.votes ?? 0} votes
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: userVote === "up" ? "#5a7a50" : "#7a9a6a",
                        color: "#fdf8e6",
                        fontSize: "16px",
                      }}
                      onClick={() => handleVote(post.id, "up")}
                    >
                      👍
                    </button>
                    <button
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: userVote === "down" ? "#8a5a4a" : "#a87a6a",
                        color: "#fdf8e6",
                        fontSize: "16px",
                      }}
                      onClick={() => handleVote(post.id, "down")}
                    >
                      👎
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {paginatedPosts.slice(8, 16).map((post) => {
              const userVote = userVotes[String(post.id)];
              return (
                <div
                  key={post.id}
                  style={{
                    border: "1px solid #d1b97b",
                    padding: "14px 16px",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#fffef9",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, marginRight: "10px" }}>
                    <h2 style={{ fontWeight: 600, color: "#3a2e0b", fontSize: "18px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                      {post.title || post.content}
                    </h2>
                    <p style={{ fontSize: "14px", color: "#7a6a3a", margin: 0 }}>
                      {post.votes ?? 0} votes
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: userVote === "up" ? "#5a7a50" : "#7a9a6a",
                        color: "#fdf8e6",
                        fontSize: "16px",
                      }}
                      onClick={() => handleVote(post.id, "up")}
                    >
                      👍
                    </button>
                    <button
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: userVote === "down" ? "#8a5a4a" : "#a87a6a",
                        color: "#fdf8e6",
                        fontSize: "16px",
                      }}
                      onClick={() => handleVote(post.id, "down")}
                    >
                      👎
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #d1b97b" }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: "4px 12px",
                borderRadius: "4px",
                fontWeight: 600,
                fontSize: "12px",
                border: "none",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                backgroundColor: currentPage === 1 ? "#e5dcc8" : "#b79b3d",
                color: currentPage === 1 ? "#9a8a6a" : "#fdf8e6",
              }}
            >
              Previous
            </button>
            <span style={{ color: "#4b3a0d", fontSize: "12px" }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: "4px 12px",
                borderRadius: "4px",
                fontWeight: 600,
                fontSize: "12px",
                border: "none",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                backgroundColor: currentPage === totalPages ? "#e5dcc8" : "#b79b3d",
                color: currentPage === totalPages ? "#9a8a6a" : "#fdf8e6",
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
