import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getArchivedPosts, getArchiveMonths } from "../utils/api";
import { useDonor } from "../context/DonorContext";
import DonorBadge from "../components/DonorBadge";
import LoginButton from "../components/LoginButton";
import { useMediaQuery } from "../hooks/useMediaQuery";
import "../App.css";

interface ArchivedPost {
  id: string | number;
  title?: string;
  content?: string;
  votes?: number;
  username?: string;
  monthYear?: string;
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

const formatMonthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleString("default", { month: "long", year: "numeric" });
};

export default function Archive() {
  const [posts, setPosts] = useState<ArchivedPost[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { donorStatuses, loadDonorStatuses } = useDonor();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Load available months on mount
  useEffect(() => {
    const loadMonths = async () => {
      try {
        const data = await getArchiveMonths();
        setMonths(data);
        if (data.length > 0) {
          setSelectedMonth(data[0]); // Default to most recent
        }
      } catch (err) {
        console.error("Failed to load archive months:", err);
      }
    };
    loadMonths();
  }, []);

  // Load posts when selected month changes
  useEffect(() => {
    if (!selectedMonth) {
      setLoading(false);
      return;
    }
    const loadPosts = async () => {
      setLoading(true);
      try {
        const data = await getArchivedPosts(selectedMonth);
        setPosts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load archived posts:", err);
      } finally {
        setLoading(false);
      }
    };
    loadPosts();
  }, [selectedMonth]);

  // Load donor statuses
  useEffect(() => {
    if (posts.length > 0) {
      const usernames = posts
        .map((p) => p.username)
        .filter((u): u is string => !!u && u !== "unknown");
      if (usernames.length > 0) loadDonorStatuses(usernames);
    }
  }, [posts, loadDonorStatuses]);

  return (
    <div
      style={{
        backgroundImage: isMobile ? "none" : "url('/Voting_Background.png')",
        backgroundColor: isMobile ? "#0a0804" : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: isMobile ? "0" : "0.5rem",
        overflow: "auto",
        overflowX: "hidden",
      }}
    >
      {!isMobile && <LoginButton />}
      <div
        style={{
          backgroundColor: isMobile ? "#0a0804" : "rgba(20, 15, 5, 0.92)",
          borderRadius: isMobile ? "0" : "10px",
          padding: isMobile ? "0.75rem 1rem 2rem" : "1.5rem 2rem",
          maxWidth: "800px",
          width: isMobile ? "100%" : "95%",
          boxShadow: isMobile
            ? "none"
            : "0 4px 20px rgba(0,0,0,0.5), 0 0 15px rgba(212, 175, 55, 0.15)",
          border: isMobile ? "none" : "2px solid #d4af37",
          marginBottom: isMobile ? "0" : "2rem",
          minHeight: isMobile ? "100vh" : undefined,
          boxSizing: "border-box" as const,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            paddingTop: isMobile ? "0.5rem" : 0,
          }}
        >
          <button
            onClick={() => navigate("/")}
            style={{
              backgroundColor: "transparent",
              color: "#d4af37",
              padding: isMobile ? "8px 14px" : "4px 12px",
              borderRadius: "4px",
              border: "1px solid #d4af37",
              cursor: "pointer",
              fontSize: isMobile ? "13px" : "12px",
              fontWeight: 600,
            }}
          >
            ← Back to Home
          </button>
          {isMobile && (
            <div className="login-inline-wrapper">
              <LoginButton />
            </div>
          )}
        </div>

        <h1
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: isMobile ? "1.3rem" : "1.8rem",
            fontWeight: 700,
            color: "#c8b070",
            textShadow: "1px 1px 0px #3a2e0b, 0 0 10px rgba(200, 176, 112, 0.2)",
            textAlign: "center",
            margin: "0 0 1rem 0",
            letterSpacing: "0.1em",
          }}
        >
          ARCHIVES
        </h1>

        {/* Month selector */}
        {months.length > 0 && (
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "#c8b070",
                backgroundColor: "#1a1a1a",
                border: "1px solid #d4af37",
                borderRadius: "6px",
                padding: "8px 16px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <p
            style={{
              textAlign: "center",
              color: "#d4af37",
              fontFamily: "'Cinzel', serif",
              fontSize: "1rem",
              padding: "2rem 0",
            }}
          >
            Loading...
          </p>
        )}

        {/* Empty state */}
        {!loading && posts.length === 0 && (
          <p
            style={{
              textAlign: "center",
              color: "#888",
              fontStyle: "italic",
              fontFamily: "'Cinzel', serif",
              fontSize: "1rem",
              padding: "3rem 0",
            }}
          >
            No archived commandments yet.
          </p>
        )}

        {/* Commandment cards */}
        {!loading &&
          posts.map((post, index) => {
            const donorStatus = post.username ? donorStatuses[post.username] : null;
            return (
              <div
                key={post.id}
                onClick={() =>
                  navigate(`/comments/${post.id}`, { state: { from: "archive" } })
                }
                style={{
                  backgroundColor: "rgba(212, 175, 55, 0.08)",
                  border: "1px solid rgba(212, 175, 55, 0.3)",
                  borderRadius: "8px",
                  padding: isMobile ? "12px 14px" : "14px 18px",
                  marginBottom: "10px",
                  cursor: "pointer",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "#d4af37")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(212, 175, 55, 0.3)")
                }
              >
                <div
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: isMobile ? "0.95rem" : "1.05rem",
                    fontWeight: 700,
                    color: "#c8b070",
                    letterSpacing: "0.03em",
                    wordBreak: "break-word",
                  }}
                >
                  <span style={{ color: "#d4af37", marginRight: "6px" }}>
                    {toRoman(index + 1)}.
                  </span>
                  {post.title || post.content}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "4px",
                  }}
                >
                  {post.votes !== undefined && (
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#d1b97b",
                        fontWeight: 600,
                      }}
                    >
                      {post.votes} votes
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "#c8b070",
                      fontStyle: "italic",
                    }}
                  >
                    — {post.username || "unknown"}
                    {donorStatus?.tier && (
                      <DonorBadge tier={donorStatus.tier} size="small" />
                    )}
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
