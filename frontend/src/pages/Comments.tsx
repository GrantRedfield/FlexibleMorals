import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getPosts, getComments, createComment, voteOnComment, editComment, deleteComment } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useDonor } from "../context/DonorContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { replaceEmoticons, CUSTOM_EMOJIS, STANDARD_EMOJIS } from "../utils/emoji";
import DonorBadge from "../components/DonorBadge";
import LoginButton from "../components/LoginButton";
import UserProfilePopup from "../components/UserProfilePopup";

interface Comment {
  id: string;
  username: string;
  text: string;
  votes: number;
  userVotes: Record<string, string>;
  parentId: string | null;
  createdAt: string;
  editedAt?: string | null;
  deleted?: boolean;
}

interface Post {
  id: string | number;
  title?: string;
  content?: string;
  votes?: number;
  username?: string;
}

type SortOption = "top" | "new";

export default function Comments() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const cameFrom = (location.state as any)?.from;
  const { user, openLoginModal } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { getDonorStatus, loadDonorStatuses } = useDonor();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [commentVotes, setCommentVotes] = useState<Record<string, "up" | "down" | null>>({});
  const [sortOption, setSortOption] = useState<SortOption>("top");
  const [submitting, setSubmitting] = useState(false);
  const [revealedComments, setRevealedComments] = useState<Set<string>>(new Set());
  const [collapsedComments, setCollapsedComments] = useState<Set<string>>(new Set());
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [profilePopup, setProfilePopup] = useState<{ username: string; x: number; y: number } | null>(null);
  const [showCommentEmoji, setShowCommentEmoji] = useState(false);
  const [showReplyEmoji, setShowReplyEmoji] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const commentEmojiRef = useRef<HTMLDivElement>(null);
  const replyEmojiRef = useRef<HTMLDivElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved votes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`commentVotes_${postId}`);
    if (saved) setCommentVotes(JSON.parse(saved));
  }, [postId]);

  // Persist votes to localStorage
  useEffect(() => {
    localStorage.setItem(`commentVotes_${postId}`, JSON.stringify(commentVotes));
  }, [commentVotes, postId]);

  // Fetch post + comments
  useEffect(() => {
    const load = async () => {
      try {
        const [postsData, commentsData] = await Promise.all([
          getPosts(),
          getComments(postId!),
        ]);
        setAllPosts(postsData);
        const found = postsData.find(
          (p: any) => String(p.id) === String(postId)
        );
        setPost(found || null);
        const loadedComments: Comment[] = commentsData.comments || [];
        setComments(loadedComments);

        // Merge server-side userVotes with locally saved votes
        // This ensures the author's initial upvote is reflected in the UI
        const saved = localStorage.getItem(`commentVotes_${postId}`);
        const localVotes: Record<string, "up" | "down" | null> = saved ? JSON.parse(saved) : {};
        if (user) {
          loadedComments.forEach((c: Comment) => {
            if (c.userVotes[user] && !localVotes[c.id]) {
              localVotes[c.id] = c.userVotes[user] as "up" | "down";
            }
          });
        }
        setCommentVotes(localVotes);
      } catch (err) {
        console.error("Failed to load comments:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [postId]);

  // Load donor statuses for post author and commenters
  useEffect(() => {
    const usernames: string[] = [];
    if (post?.username) usernames.push(post.username);
    comments.forEach((c) => {
      if (c.username && !usernames.includes(c.username)) usernames.push(c.username);
    });
    if (usernames.length > 0) loadDonorStatuses(usernames);
  }, [post, comments, loadDonorStatuses]);

  // Close emoji pickers when clicking outside
  useEffect(() => {
    if (!showCommentEmoji && !showReplyEmoji) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (showCommentEmoji && commentEmojiRef.current && !commentEmojiRef.current.contains(e.target as Node)) {
        setShowCommentEmoji(false);
      }
      if (showReplyEmoji && replyEmojiRef.current && !replyEmojiRef.current.contains(e.target as Node)) {
        setShowReplyEmoji(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCommentEmoji, showReplyEmoji]);

  const insertCommentEmoji = (emoji: string) => {
    setNewComment((prev) => prev + emoji);
    setShowCommentEmoji(false);
    commentTextareaRef.current?.focus();
  };

  const insertReplyEmoji = (emoji: string) => {
    setReplyText((prev) => prev + emoji);
    setShowReplyEmoji(false);
    replyTextareaRef.current?.focus();
  };

  const requireLogin = useCallback((): boolean => {
    if (user) return true;
    openLoginModal();
    return false;
  }, [user, openLoginModal]);

  const getBlessings = useCallback(
    (username: string): number => {
      return allPosts
        .filter((p) => p.username === username)
        .reduce((sum, p) => sum + (p.votes ?? 0), 0);
    },
    [allPosts]
  );

  // Build comment tree
  const buildTree = useCallback(
    (allComments: Comment[]) => {
      const sorted = [...allComments];
      if (sortOption === "top") {
        sorted.sort((a, b) => b.votes - a.votes);
      } else {
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      const topLevel = sorted.filter((c) => !c.parentId);
      const childMap: Record<string, Comment[]> = {};
      sorted.forEach((c) => {
        if (c.parentId) {
          if (!childMap[c.parentId]) childMap[c.parentId] = [];
          childMap[c.parentId].push(c);
        }
      });

      return { topLevel, childMap };
    },
    [sortOption]
  );

  const { topLevel, childMap } = useMemo(
    () => buildTree(comments),
    [comments, buildTree]
  );

  // Submit top-level comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireLogin()) return;
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const created = await createComment(postId!, user!, newComment.trim());
      setComments((prev) => [...prev, created]);
      setCommentVotes((prev) => ({ ...prev, [created.id]: "up" }));
      setNewComment("");
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to post comment";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit reply
  const handleSubmitReply = async (parentId: string) => {
    if (!requireLogin()) return;
    if (!replyText.trim()) return;

    setSubmitting(true);
    try {
      const created = await createComment(
        postId!,
        user!,
        replyText.trim(),
        parentId
      );
      setComments((prev) => [...prev, created]);
      setCommentVotes((prev) => ({ ...prev, [created.id]: "up" }));
      setReplyText("");
      setReplyTo(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to post reply";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Vote on comment
  const handleVote = async (commentId: string, direction: "up" | "down") => {
    if (!requireLogin()) return;

    const prevVote = commentVotes[commentId];
    if (prevVote === direction) return;

    // Optimistic UI
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        let newVotes = c.votes;
        if (!prevVote) {
          newVotes += direction === "up" ? 1 : -1;
        } else if (prevVote === "up" && direction === "down") {
          newVotes -= 2;
        } else if (prevVote === "down" && direction === "up") {
          newVotes += 2;
        }
        return { ...c, votes: newVotes };
      })
    );

    setCommentVotes((prev) => ({ ...prev, [commentId]: direction }));

    try {
      const result = await voteOnComment(postId!, commentId, direction, user || "guest");
      setComments((prev) =>
        prev.map((c) =>
          c.id === result.id ? { ...c, votes: result.votes } : c
        )
      );
    } catch (err) {
      console.error("Vote failed:", err);
    }
  };

  // Edit a comment
  const handleEditComment = async (commentId: string) => {
    if (!editText.trim()) return;
    setSubmitting(true);
    try {
      const updated = await editComment(postId!, commentId, user!, editText.trim());
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, text: updated.text, editedAt: updated.editedAt } : c
        )
      );
      setEditingComment(null);
      setEditText("");
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to edit comment";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete a comment (soft delete, Reddit-style)
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment? This cannot be undone.")) return;
    try {
      await deleteComment(postId!, commentId, user!);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, text: "[deleted]", username: "[deleted]", deleted: true } : c
        )
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to delete comment";
      alert(msg);
    }
  };

  // Count all descendants recursively
  const countDescendants = useCallback(
    (commentId: string): number => {
      const children = childMap[commentId] || [];
      return children.reduce(
        (sum, child) => sum + 1 + countDescendants(child.id),
        0
      );
    },
    [childMap]
  );

  const toggleCollapse = (commentId: string) => {
    setCollapsedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  // Render a single comment
  const renderComment = (comment: Comment, depth: number) => {
    const children = childMap[comment.id] || [];
    const userVote = commentVotes[comment.id];
    const maxDepth = 3;
    const isHidden = comment.votes < -5 && !revealedComments.has(comment.id);
    const isCollapsed = collapsedComments.has(comment.id);

    if (isHidden) {
      return (
        <div key={comment.id} style={{ marginLeft: depth > 0 ? (isMobile ? 12 : 24) : 0 }}>
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.02)",
              border: "1px solid #333",
              borderLeft: depth > 0 ? "3px solid #555" : "1px solid #333",
              borderRadius: depth > 0 ? "0 6px 6px 0" : "6px",
              padding: "8px 14px",
              marginBottom: "8px",
              cursor: "pointer",
            }}
            onClick={() =>
              setRevealedComments((prev) => {
                const next = new Set(prev);
                next.add(comment.id);
                return next;
              })
            }
          >
            <span style={{ color: "#666", fontSize: "12px", fontStyle: "italic" }}>
              Comment hidden (score below -5) — click to reveal
            </span>
          </div>
          {/* Still render children so threads aren't broken */}
          {children.map((child) =>
            renderComment(child, Math.min(depth + 1, maxDepth))
          )}
        </div>
      );
    }

    return (
      <div key={comment.id} style={{ marginLeft: depth > 0 ? (isMobile ? 12 : 24) : 0 }}>
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            border: "1px solid #555",
            borderLeft: depth > 0 ? "3px solid #d4af37" : "1px solid #555",
            borderRadius: depth > 0 ? "0 6px 6px 0" : "6px",
            padding: "10px 14px",
            marginBottom: "8px",
          }}
        >
          {/* Comment header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: isCollapsed ? 0 : "6px",
            }}
          >
            <button
              onClick={() => toggleCollapse(comment.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#888",
                fontSize: "12px",
                padding: "0 4px 0 0",
                fontFamily: "monospace",
                lineHeight: 1,
              }}
              title={isCollapsed ? "Expand thread" : "Collapse thread"}
            >
              {isCollapsed ? "[+]" : "[–]"}
            </button>
            {comment.deleted ? (
              <span
                style={{
                  color: "#666",
                  fontWeight: 600,
                  fontSize: "13px",
                  fontStyle: "italic",
                }}
              >
                [deleted]
              </span>
            ) : (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setProfilePopup({ username: comment.username, x: e.clientX, y: e.clientY });
                }}
                style={{
                  color: "#d4af37",
                  fontWeight: 600,
                  fontSize: "13px",
                  fontFamily: "'Cinzel', serif",
                  cursor: "pointer",
                }}
              >
                {comment.username}
                {getDonorStatus(comment.username)?.tier && (
                  <DonorBadge tier={getDonorStatus(comment.username)!.tier as any} size="small" />
                )}
              </span>
            )}
            <span style={{ color: "#666", fontSize: "11px" }}>
              {new Date(comment.createdAt).toLocaleString()}
            </span>
            {comment.editedAt && !comment.deleted && (
              <span
                style={{ color: "#666", fontSize: "10px", fontStyle: "italic" }}
                title={`Edited ${new Date(comment.editedAt).toLocaleString()}`}
              >
                (edited)
              </span>
            )}
            {isCollapsed && (
              <span style={{ color: "#555", fontSize: "11px", fontStyle: "italic" }}>
                ({countDescendants(comment.id) + 1} comment{countDescendants(comment.id) + 1 !== 1 ? "s" : ""})
              </span>
            )}
          </div>

          {!isCollapsed && (
            <>
          {/* Comment text — deleted, editing, or normal */}
          {comment.deleted ? (
            <p
              style={{
                color: "#666",
                fontSize: "14px",
                margin: "0 0 8px 0",
                lineHeight: 1.5,
                fontStyle: "italic",
              }}
            >
              [deleted]
            </p>
          ) : editingComment === comment.id ? (
            <div style={{ margin: "0 0 8px 0" }}>
              <textarea
                value={editText}
                onChange={(e) => setEditText(replaceEmoticons(e.target.value))}
                maxLength={500}
                style={{
                  width: "100%",
                  height: "70px",
                  border: "1px solid #d4af37",
                  borderRadius: "6px",
                  padding: "8px",
                  fontSize: "13px",
                  resize: "none",
                  boxSizing: "border-box",
                  backgroundColor: "#1a1a1a",
                  color: "#fdf8e6",
                }}
                autoFocus
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "4px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => { setEditingComment(null); setEditText(""); }}
                  style={{
                    background: "none",
                    border: "1px solid #555",
                    cursor: "pointer",
                    color: "#888",
                    fontSize: "12px",
                    padding: "4px 12px",
                    borderRadius: "4px",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleEditComment(comment.id)}
                  disabled={!editText.trim() || submitting}
                  style={{
                    backgroundColor: !editText.trim() || submitting ? "#555" : "#b79b3d",
                    color: "#fdf8e6",
                    padding: "4px 14px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "none",
                    cursor: !editText.trim() || submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <p
              style={{
                color: "#fdf8e6",
                fontSize: "14px",
                margin: "0 0 8px 0",
                lineHeight: 1.5,
                wordBreak: "break-word",
              }}
            >
              {comment.text}
            </p>
          )}

          {/* Actions row — hidden for deleted comments */}
          {!comment.deleted && editingComment !== comment.id && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "12px",
            }}
          >
            <button
              onClick={() => handleVote(comment.id, "up")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: userVote === "up" ? "#5a7a50" : "#888",
                fontSize: isMobile ? "16px" : "14px",
                padding: isMobile ? "8px 10px" : "2px 4px",
                minHeight: isMobile ? "44px" : undefined,
              }}
              title="Upvote"
            >
              ▲
            </button>
            <span
              style={{
                color: "#d1b97b",
                fontWeight: 600,
                minWidth: "20px",
                textAlign: "center",
              }}
            >
              {comment.votes}
            </span>
            <button
              onClick={() => handleVote(comment.id, "down")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: userVote === "down" ? "#8a5a4a" : "#888",
                fontSize: isMobile ? "16px" : "14px",
                padding: isMobile ? "8px 10px" : "2px 4px",
                minHeight: isMobile ? "44px" : undefined,
              }}
              title="Downvote"
            >
              ▼
            </button>
            {depth < maxDepth && (
              <button
                onClick={() => {
                  setReplyTo(replyTo === comment.id ? null : comment.id);
                  setReplyText("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#888",
                  fontSize: isMobile ? "14px" : "12px",
                  padding: isMobile ? "8px 10px" : "2px 6px",
                  minHeight: isMobile ? "44px" : undefined,
                }}
              >
                {replyTo === comment.id ? "Cancel" : "Reply"}
              </button>
            )}
            {user && user === comment.username && (
              <>
                <button
                  onClick={() => {
                    setEditingComment(comment.id);
                    setEditText(comment.text);
                    setReplyTo(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#888",
                    fontSize: isMobile ? "14px" : "12px",
                    padding: isMobile ? "8px 10px" : "2px 6px",
                    minHeight: isMobile ? "44px" : undefined,
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#8a5a4a",
                    fontSize: isMobile ? "14px" : "12px",
                    padding: isMobile ? "8px 10px" : "2px 6px",
                    minHeight: isMobile ? "44px" : undefined,
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
          )}

          {/* Inline reply form */}
          {replyTo === comment.id && (
            <div style={{ marginTop: "8px" }}>
              <div style={{ position: "relative" }}>
                <textarea
                  ref={replyTextareaRef}
                  placeholder={user ? "Write a reply..." : "Click here to reply..."}
                  value={replyText}
                  onChange={(e) => setReplyText(replaceEmoticons(e.target.value))}
                  onFocus={(e) => {
                    if (!user) {
                      e.target.blur();
                      openLoginModal();
                    }
                  }}
                  maxLength={500}
                  style={{
                    width: "100%",
                    height: "60px",
                    border: "1px solid #555",
                    borderRadius: "6px",
                    padding: "8px",
                    fontSize: "13px",
                    resize: "none",
                    boxSizing: "border-box",
                    backgroundColor: "#1a1a1a",
                    color: "#fdf8e6",
                  }}
                />
                {/* Emoji picker for replies */}
                {showReplyEmoji && (
                  <div
                    ref={replyEmojiRef}
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      left: 0,
                      right: 0,
                      backgroundColor: "#1a1a1a",
                      border: "1px solid #d4af37",
                      borderRadius: "8px 8px 0 0",
                      padding: "6px",
                      display: "grid",
                      gridTemplateColumns: "repeat(8, 1fr)",
                      gap: "2px",
                      maxHeight: "160px",
                      overflowY: "auto",
                      zIndex: 10,
                      boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.5)",
                    }}
                  >
                    <div style={{ gridColumn: "1 / -1", color: "#d4af37", fontSize: "0.6rem", fontFamily: "'Cinzel', serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "4px 2px 2px", borderBottom: "1px solid rgba(212, 175, 55, 0.2)", marginBottom: "2px" }}>Flexible Morals</div>
                    {CUSTOM_EMOJIS.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => insertReplyEmoji(item.emoji)}
                        title={item.label}
                        type="button"
                        style={{ background: "none", border: "1px solid rgba(212, 175, 55, 0.25)", backgroundColor: "rgba(212, 175, 55, 0.06)", fontSize: "1.2rem", cursor: "pointer", padding: "4px", borderRadius: "4px", lineHeight: 1 }}
                      >
                        {item.emoji}
                      </button>
                    ))}
                    <div style={{ gridColumn: "1 / -1", color: "#d4af37", fontSize: "0.6rem", fontFamily: "'Cinzel', serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "4px 2px 2px", borderBottom: "1px solid rgba(212, 175, 55, 0.2)", marginBottom: "2px" }}>Standard</div>
                    {STANDARD_EMOJIS.map((emoji) => (
                      <button
                        key={`std-${emoji}`}
                        onClick={() => insertReplyEmoji(emoji)}
                        type="button"
                        style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: "4px", borderRadius: "4px", lineHeight: 1 }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "4px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowReplyEmoji((prev) => !prev)}
                  style={{ background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer", opacity: 0.7, padding: "2px 4px", lineHeight: 1 }}
                >
                  😀
                </button>
                <button
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={!replyText.trim() || submitting}
                  style={{
                    backgroundColor:
                      !replyText.trim() || submitting ? "#555" : "#b79b3d",
                    color: "#fdf8e6",
                    padding: "4px 14px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "none",
                    cursor:
                      !replyText.trim() || submitting
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  Reply
                </button>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Render children (hidden when collapsed) */}
        {!isCollapsed &&
          children.map((child) =>
            renderComment(child, Math.min(depth + 1, maxDepth))
          )}
      </div>
    );
  };

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0a0a0a",
          color: "#d4af37",
          fontFamily: "'Cinzel', serif",
          fontSize: "1.2rem",
        }}
      >
        Loading...
      </div>
    );
  }

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
          padding: isMobile ? "0.75rem 1rem 2rem" : "1rem 1.5rem",
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
        {/* Back button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
            paddingTop: isMobile ? "0.5rem" : 0,
          }}
        >
          <button
            onClick={() => navigate(cameFrom === "home" ? "/" : "/vote")}
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
            {cameFrom === "home" ? "← Back to Home" : "← Back to Voting"}
          </button>
          {isMobile && (
            <div className="login-inline-wrapper">
              <LoginButton />
            </div>
          )}
        </div>

        {/* Commandment header */}
        {post && (
          <div
            style={{
              backgroundColor: "rgba(212, 175, 55, 0.08)",
              border: "1px solid #d4af37",
              borderRadius: isMobile ? "6px" : "8px",
              padding: isMobile ? "12px 14px" : "16px 20px",
              marginBottom: "1rem",
            }}
          >
            <h1
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: isMobile ? "1rem" : "1.4rem",
                fontWeight: 700,
                color: "#c8b070",
                textShadow:
                  "1px 1px 0px #3a2e0b, -1px -1px 0px #3a2e0b, 0 0 10px rgba(200, 176, 112, 0.2)",
                margin: "0 0 4px 0",
                letterSpacing: "0.03em",
                wordBreak: "break-word" as const,
              }}
            >
              {post.title || post.content}
            </h1>
            <p style={{ color: "#d1b97b", fontSize: "13px", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{post.votes ?? 0} votes</span>
              {post.username && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setProfilePopup({ username: post.username!, x: e.clientX, y: e.clientY });
                  }}
                  style={{ color: "#888", fontStyle: "italic", cursor: "pointer" }}
                >
                  {post.username}
                  {getDonorStatus(post.username)?.tier && (
                    <DonorBadge tier={getDonorStatus(post.username)!.tier as any} size="small" />
                  )}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Sort + login row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ display: "flex", gap: "4px" }}>
            {(["top", "new"] as SortOption[]).map((option) => (
              <button
                key={option}
                onClick={() => setSortOption(option)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "12px",
                  backgroundColor:
                    sortOption === option ? "#b79b3d" : "transparent",
                  color: sortOption === option ? "#fdf8e6" : "#d1b97b",
                  border:
                    sortOption === option
                      ? "1px solid #d4af37"
                      : "1px solid #555",
                }}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
          <span style={{ color: "#888", fontSize: "12px" }}>
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* New comment form */}
        <form onSubmit={handleSubmitComment} style={{ marginBottom: "1rem" }}>
          <div style={{ position: "relative" }}>
            <textarea
              ref={commentTextareaRef}
              placeholder={
                user
                  ? "Share thy thoughts on this commandment..."
                  : "Click here to comment..."
              }
              value={newComment}
              onChange={(e) => setNewComment(replaceEmoticons(e.target.value))}
              onFocus={(e) => {
                if (!user) {
                  e.target.blur();
                  openLoginModal();
                }
              }}
              maxLength={500}
              style={{
                width: "100%",
                height: "70px",
                border: "1px solid #555",
                borderRadius: "6px",
                padding: "10px 12px",
                fontSize: "14px",
                resize: "none",
                boxSizing: "border-box",
                backgroundColor: "#1a1a1a",
                color: "#fdf8e6",
                cursor: user ? "text" : "pointer",
              }}
            />
            {/* Emoji picker for comments */}
            {showCommentEmoji && (
              <div
                ref={commentEmojiRef}
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #d4af37",
                  borderRadius: "8px 8px 0 0",
                  padding: "6px",
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gap: "2px",
                  maxHeight: "180px",
                  overflowY: "auto",
                  zIndex: 10,
                  boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.5)",
                }}
              >
                <div style={{ gridColumn: "1 / -1", color: "#d4af37", fontSize: "0.6rem", fontFamily: "'Cinzel', serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "4px 2px 2px", borderBottom: "1px solid rgba(212, 175, 55, 0.2)", marginBottom: "2px" }}>Flexible Morals</div>
                {CUSTOM_EMOJIS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => insertCommentEmoji(item.emoji)}
                    title={item.label}
                    type="button"
                    style={{ background: "none", border: "1px solid rgba(212, 175, 55, 0.25)", backgroundColor: "rgba(212, 175, 55, 0.06)", fontSize: "1.2rem", cursor: "pointer", padding: "4px", borderRadius: "4px", lineHeight: 1 }}
                  >
                    {item.emoji}
                  </button>
                ))}
                <div style={{ gridColumn: "1 / -1", color: "#d4af37", fontSize: "0.6rem", fontFamily: "'Cinzel', serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "4px 2px 2px", borderBottom: "1px solid rgba(212, 175, 55, 0.2)", marginBottom: "2px" }}>Standard</div>
                {STANDARD_EMOJIS.map((emoji) => (
                  <button
                    key={`std-${emoji}`}
                    onClick={() => insertCommentEmoji(emoji)}
                    type="button"
                    style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: "4px", borderRadius: "4px", lineHeight: 1 }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "4px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setShowCommentEmoji((prev) => !prev)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", opacity: 0.7, padding: "2px 4px", lineHeight: 1 }}
              >
                😀
              </button>
              <span
                style={{
                  fontSize: "11px",
                  color: newComment.length >= 450 ? "#e07050" : "#888",
                }}
              >
                {newComment.length}/500
              </span>
            </div>
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              style={{
                backgroundColor:
                  !newComment.trim() || submitting ? "#555" : "#b79b3d",
                color: "#fdf8e6",
                padding: "6px 18px",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                cursor:
                  !newComment.trim() || submitting ? "not-allowed" : "pointer",
              }}
            >
              Proclaim
            </button>
          </div>
        </form>

        {/* Comments list */}
        {comments.length === 0 && (
          <p
            style={{
              textAlign: "center",
              color: "#666",
              fontStyle: "italic",
              padding: "2rem 0",
            }}
          >
            No comments yet. Be the first to speak.
          </p>
        )}

        <div>{topLevel.map((comment) => renderComment(comment, 0))}</div>
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
