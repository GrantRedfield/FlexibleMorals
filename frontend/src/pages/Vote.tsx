import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPosts, voteOnPost, createPost } from "../utils/api";
import { useAuth } from "../context/AuthContext";

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
  const [newCommandment, setNewCommandment] = useState("");
  const [userVotes, setUserVotes] = useState<Record<string, "up" | "down" | null>>({});
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

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

  useEffect(() => {
    localStorage.setItem("userVotes", JSON.stringify(userVotes));
  }, [userVotes]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireLogin()) return;
    if (!newCommandment.trim()) return;

    try {
      const newPost = await createPost(newCommandment.trim());
      setPosts((prev) => [...prev, newPost]);
      setNewCommandment("");
    } catch (err) {
      console.error("❌ Failed to create post:", err);
      alert("Could not create new commandment.");
    }
  };

  const handleVote = async (postId: string | number, direction: "up" | "down") => {
    if (!requireLogin()) return;

    const pid = String(postId);
    const prevVote = userVotes[pid];
    if (prevVote === direction) return;

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
      const updated = await voteOnPost(pid, direction);
      setPosts((prev) =>
        prev.map((p) =>
          String(p.id) === String(updated.id) ? { ...p, votes: updated.votes } : p
        )
      );
    } catch (err) {
      console.error("❌ Vote failed:", err);
    }
  };

  if (loading) return <p className="p-4 text-gray-500">Loading...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;

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
        paddingTop: "4rem",
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
        {/* ✅ Home Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => navigate("/")}
            className="home-button"
          >
            🏠 Home
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-4 text-center text-gray-900">
          Vote on Commandments
        </h1>

        {/* ✅ Login Info */}
        <div className="flex justify-between items-center mb-4">
          {user ? (
            <p className="text-gray-800 text-sm">
              Logged in as <span className="font-semibold">{user}</span>
            </p>
          ) : (
            <p className="text-gray-600 text-sm italic">Not logged in</p>
          )}
          {user ? (
            <button
              onClick={logout}
              className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-800 transition"
            >
              Log Out
            </button>
          ) : (
            <button
              onClick={requireLogin}
              className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 transition"
            >
              Log In
            </button>
          )}
        </div>

        {/* ✅ Create Post Form */}
        <form onSubmit={handleSubmit} className="flex mb-4 space-x-2">
          <input
            type="text"
            placeholder="Enter a new commandment..."
            value={newCommandment}
            onChange={(e) => setNewCommandment(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <button
            type="submit"
            className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition"
          >
            Submit
          </button>
        </form>

        {posts.length === 0 && <p className="text-center text-gray-600">No commandments found.</p>}

        {posts.map((post) => {
          const userVote = userVotes[String(post.id)];
          return (
            <div
              key={post.id}
              className="border border-gray-300 p-3 rounded flex justify-between items-center mb-3 bg-white shadow"
            >
              <div>
                <h2 className="font-semibold text-gray-900">{post.title || post.content}</h2>
                <p className="text-sm text-gray-600">{post.votes ?? 0} votes</p>
              </div>
              <div className="flex space-x-2">
                <button
                  className={`px-3 py-1 rounded transition ${
                    userVote === "up"
                      ? "bg-green-700 text-white"
                      : "bg-green-500 text-white hover:bg-green-600"
                  }`}
                  onClick={() => handleVote(post.id, "up")}
                >
                  👍
                </button>
                <button
                  className={`px-3 py-1 rounded transition ${
                    userVote === "down"
                      ? "bg-red-700 text-white"
                      : "bg-red-500 text-white hover:bg-red-600"
                  }`}
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
  );
}
