import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { getPosts, voteOnPost, createPost, getComments } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useDonor } from "../context/DonorContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import UserProfilePopup from "../components/UserProfilePopup";
import DonorBadge from "../components/DonorBadge";
import LoginButton from "../components/LoginButton";
import HamburgerMenu from "../components/HamburgerMenu";
import DonationPopup from "../components/DonationPopup";
import "../App.css";
import "./Vote.css";

interface Post {
  id: string | number;
  title?: string;
  content?: string;
  votes?: number;
  createdAt?: string;
  username?: string;
  userVotes?: Record<string, "up" | "down">;
}

type SortOption = "top" | "hot" | "new" | "random" | "swipe";
type MobileTab = "swipe" | "comments" | "declare";
type MobileFilter = "top" | "hot" | "new" | "random";
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
  const [sortOption, setSortOption] = useState<SortOption>("random");
  const [shuffleTrigger, setShuffleTrigger] = useState(0);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [visibleSlots, setVisibleSlots] = useState<VisibleSlot[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const { user, openLoginModal } = useAuth();
  const navigate = useNavigate();
  const { getDonorStatus, loadDonorStatuses } = useDonor();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [profilePopup, setProfilePopup] = useState<{ username: string; x: number; y: number } | null>(null);
  const [showMerchPopup, setShowMerchPopup] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [showDonationPopup, setShowDonationPopup] = useState(false);

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<MobileTab>("swipe");
  const [mobileFilter, setMobileFilter] = useState<MobileFilter>("top");
  const [mobileVisibleCount, setMobileVisibleCount] = useState(10);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // Swipe mode state
  const [swipeResult, setSwipeResult] = useState<{ direction: "up" | "down"; delta: number; newTotal: number } | null>(null);
  const [swipeCardKey, setSwipeCardKey] = useState(0);
  const [swipeCurrentPostId, setSwipeCurrentPostId] = useState<string | null>(null);
  const [swipeDragX, setSwipeDragX] = useState(0);
  const dragX = useMotionValue(0);
  const cardRotation = useTransform(dragX, [-200, 0, 200], [-12, 0, 12]);
  // Ref for exit animation direction — survives across renders so AnimatePresence can read it
  const swipeExitDirectionRef = useRef<"up" | "down" | null>(null);
  // Emoji feedback after swipe vote
  const [swipeEmoji, setSwipeEmoji] = useState<"up" | "down" | null>(null);

  // Track which posts have been shown to avoid re-showing them before queue exhausts
  const shownPostIds = useRef<Set<string>>(new Set());
  // Guest swipe tracking — persisted in localStorage so refreshing doesn't reset
  const guestSwipeCount = useRef(
    parseInt(localStorage.getItem("guestSwipeCount") || "0", 10)
  );
  const [showGuestLoginPrompt, setShowGuestLoginPrompt] = useState(false);

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
      case "swipe":
        return sorted.sort(() => Math.random() - 0.5);
      default:
        return sorted;
    }
  }, [posts, sortOption, shuffleTrigger]);

  // Mobile Comments tab: sort posts by mobileFilter (independent of desktop sortOption)
  const mobileFilteredPosts = useMemo(() => {
    const sorted = [...posts];
    switch (mobileFilter) {
      case "top":
        return sorted.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
      case "hot":
        return sorted.sort((a, b) => {
          const now = Date.now();
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          const aAge = Math.max((now - aTime) / 3600000, 0.1);
          const bAge = Math.max((now - bTime) / 3600000, 0.1);
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
  }, [posts, mobileFilter, shuffleTrigger]);

  // Mobile Comments tab: slice for infinite scroll
  const mobileVisiblePosts = useMemo(
    () => mobileFilteredPosts.slice(0, mobileVisibleCount),
    [mobileFilteredPosts, mobileVisibleCount]
  );

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
    if (sortOption === "swipe") {
      setVisibleSlots([]);
      // Find first non-own post (unlimited voting — don't skip voted)
      const firstPost = currentSorted.find((p) => {
        return p.username !== user;
      });
      if (firstPost) {
        const firstPid = String(firstPost.id);
        setSwipeCurrentPostId(firstPid);
        shownPostIds.current = new Set([firstPid]);
      } else {
        setSwipeCurrentPostId(null);
      }
      setSwipeResult(null);
      setSwipeEmoji(null);
      swipeExitDirectionRef.current = null;
      setSwipeDragX(0);
      return;
    }
    // Reset swipe state when leaving swipe mode
    setSwipeCurrentPostId(null);
    setSwipeResult(null);
    setSwipeEmoji(null);
    swipeExitDirectionRef.current = null;
    setSwipeDragX(0);

    const initial = currentSorted.slice(0, VISIBLE_COUNT).map((p) => ({
      postId: String(p.id),
      animState: "visible" as AnimState,
    }));
    shownPostIds.current = new Set(initial.map((s) => s.postId));
    setVisibleSlots(initial);
  }, [sortOption]);

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
    const fromStorage: Record<string, "up" | "down" | null> = saved ? JSON.parse(saved) : {};
    const fromServer: Record<string, "up" | "down" | null> = {};
    if (user) {
      posts.forEach((p: any) => {
        const pid = String(p.id);
        const serverVote = p.userVotes?.[user];
        if (serverVote) {
          fromServer[pid] = serverVote;
        }
      });
    }
    // Merge with current state to preserve optimistic votes
    // Priority: server > localStorage > existing React state
    setUserVotes((current) => ({
      ...current,
      ...fromStorage,
      ...fromServer,
    }));
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

  // Mobile: initialize swipe mode on first load
  useEffect(() => {
    if (isMobile && postsLoaded) {
      setSortOption("swipe");
    }
  }, [isMobile, postsLoaded]);

  // Persist userVotes locally (scoped per user)
  useEffect(() => {
    const storageKey = user ? `userVotes_${user}` : "userVotes_guest";
    localStorage.setItem(storageKey, JSON.stringify(userVotes));
  }, [userVotes, user]);

  // Voted count
  const votedCount = Object.keys(userVotes).filter((k) => userVotes[k]).length;
  const totalCount = posts.length;

  // === Mobile: infinite scroll handler ===
  const handleMobileScroll = useCallback(() => {
    const el = mobileScrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      setMobileVisibleCount((prev) => {
        const total = mobileFilteredPosts.length;
        if (prev >= total) return prev;
        return Math.min(prev + 10, total);
      });
    }
  }, [mobileFilteredPosts.length]);

  // === Mobile: tab change handler ===
  const handleMobileTabChange = useCallback((tab: MobileTab) => {
    setMobileTab(tab);
    setMobileVisibleCount(10);
    if (tab === "swipe") {
      setSortOption("swipe");
      setShuffleTrigger((t) => t + 1);
    }
  }, []);

  // === Require login ===
  const requireLogin = (): boolean => {
    if (user) return true;
    openLoginModal();
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
      setShowLimitPopup(true);
      return;
    }

    try {
      const newPost = await createPost(newCommandment.trim(), user);
      // Ensure createdAt is set so "new" sort places it at the top
      if (!newPost.createdAt) newPost.createdAt = new Date().toISOString();
      setPosts((prev) => [...prev, newPost]);
      setNewCommandment("");
      localStorage.setItem(`lastSubmission_${user}`, new Date().toISOString());
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
      if (isMobile) {
        // Mobile: switch to Comments tab with "new" filter so user sees their post
        setMobileTab("comments");
        setMobileFilter("new");
        setMobileVisibleCount(10);
      } else {
        // Desktop: Switch to "New" sort so user sees their submission at the top
        setSortOption("new");
      }
      // Reset shown tracking so the new post appears in the first batch
      shownPostIds.current = new Set();
      // Defer shuffle trigger to next tick so sortedPostsRef has the new post
      setTimeout(() => setShuffleTrigger((t) => t + 1), 0);
    } catch (err: any) {
      console.error("Failed to create post:", err);
      if (err.response?.status === 429) {
        setShowLimitPopup(true);
      } else {
        alert("Could not create new commandment.");
      }
    }
  };

  // === Optimistic vote update + API call (shared by both modes) ===
  const handleVoteOptimistic = (postId: string | number, direction: "up" | "down") => {
    const pid = String(postId);
    const prevVote = userVotes[pid];

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

    voteOnPost(pid, direction, user)
      .then((updated) => {
        setPosts((prev) =>
          prev.map((p) =>
            String(p.id) === String(updated.id)
              ? { ...p, votes: updated.votes, userVotes: updated.userVotes }
              : p
          )
        );
      })
      .catch((err) => console.error("Vote failed:", err));
  };

  // Ref to always access latest swipeCurrentPostId inside timeouts
  const swipeCurrentPostIdRef = useRef(swipeCurrentPostId);
  useEffect(() => { swipeCurrentPostIdRef.current = swipeCurrentPostId; }, [swipeCurrentPostId]);

  // === Swipe mode: advance to next card (unlimited — loops when all shown) ===
  const advanceSwipeCard = useCallback(() => {
    const currentPid = swipeCurrentPostIdRef.current;
    const currentVisibleIds = new Set(currentPid ? [currentPid] : []);
    const allPosts = sortedPostsRef.current;
    const currentUser = user;
    let nextPost: Post | null = null;
    // First try posts not yet shown this cycle (skip own posts)
    for (const post of allPosts) {
      const pid = String(post.id);
      if (!currentVisibleIds.has(pid) && !shownPostIds.current.has(pid) && post.username !== currentUser) {
        nextPost = post;
        break;
      }
    }
    // If all have been shown, reset and loop back through
    if (!nextPost) {
      shownPostIds.current = new Set();
      for (const post of allPosts) {
        const pid = String(post.id);
        if (!currentVisibleIds.has(pid) && post.username !== currentUser) {
          nextPost = post;
          break;
        }
      }
    }
    if (nextPost) {
      const nextPid = String(nextPost.id);
      shownPostIds.current.add(nextPid);
      setSwipeCurrentPostId(nextPid);
      setSwipeCardKey((k) => k + 1);
    } else {
      setSwipeCurrentPostId(null);
    }
  }, [user]);

  // Reset guest login prompt when user logs in
  useEffect(() => {
    if (user && showGuestLoginPrompt) {
      setShowGuestLoginPrompt(false);
      guestSwipeCount.current = 0;
      localStorage.removeItem("guestSwipeCount");
      advanceSwipeCard();
    }
  }, [user, showGuestLoginPrompt, advanceSwipeCard]);

  // On mount: if guest already hit the limit (persisted), show prompt immediately
  useEffect(() => {
    if (!user && posts.length > 0) {
      const halfPosts = Math.ceil(posts.length / 2);
      if (guestSwipeCount.current >= halfPosts) {
        setShowGuestLoginPrompt(true);
        setSwipeCurrentPostId(null);
      }
    }
  }, [user, posts.length]);

  // === Swipe mode: handle swipe vote (always applies +1/-1, allows re-voting on loop) ===
  const handleSwipeVote = useCallback((direction: "up" | "down") => {
    const currentPid = swipeCurrentPostIdRef.current;
    if (!currentPid) return;
    const post = posts.find((p) => String(p.id) === currentPid);
    if (!post) return;
    const currentVotes = post.votes ?? 0;
    const delta = direction === "up" ? 1 : -1;
    const newTotal = currentVotes + delta;

    // Always apply a fresh +1/-1 vote (users can re-vote when looping through commandments)
    if (user) {
      // Optimistic update — always add/subtract 1
      setPosts((prev) =>
        prev.map((p) => {
          if (String(p.id) !== currentPid) return p;
          return { ...p, votes: (p.votes ?? 0) + delta };
        })
      );
      // Fire API call
      voteOnPost(currentPid, direction, user)
        .then((updated) => {
          setPosts((prev) =>
            prev.map((p) =>
              String(p.id) === String(updated.id)
                ? { ...p, votes: updated.votes, userVotes: updated.userVotes }
                : p
            )
          );
        })
        .catch((err) => console.error("Vote failed:", err));
    }
    // Store exit direction in ref so it's available during AnimatePresence exit animation
    swipeExitDirectionRef.current = direction;
    setSwipeResult({ direction, delta, newTotal });
    // Show emoji feedback
    setSwipeEmoji(direction);
    setTimeout(() => setSwipeEmoji(null), 700);

    // Guest half-limit: after swiping through half the commandments, prompt login
    if (!user) {
      guestSwipeCount.current += 1;
      localStorage.setItem("guestSwipeCount", String(guestSwipeCount.current));
      const halfPosts = Math.ceil(sortedPostsRef.current.length / 2);
      if (guestSwipeCount.current >= halfPosts) {
        setShowGuestLoginPrompt(true);
        setSwipeCurrentPostId(null);
        return;
      }
    }
    advanceSwipeCard();
  }, [posts, user, advanceSwipeCard]);

  // === Handle vote with fade animation (4-card mode) ===
  const handleVote = (postId: string | number, direction: "up" | "down") => {
    if (!requireLogin()) return;

    const pid = String(postId);
    const post = posts.find((p) => String(p.id) === pid);
    if (post?.username === user) return;

    const prevVote = userVotes[pid];
    if (prevVote === direction) return;

    handleVoteOptimistic(pid, direction);

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
          <div className="chisel-tool"></div>
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
        background: isMobile ? "#0a0804" : "linear-gradient(180deg, #1a2a4a 0%, #2a4a7a 20%, #4a7ab5 40%, #7ab0e0 60%, #a8d4f0 80%, #d4ecfa 100%)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: isMobile ? "0" : "0.5rem",
        overflow: isMobile ? "hidden" : "auto",
      }}
    >
      {/* Heavenly clouds filling the sky */}
      {Array.from({ length: 32 }, (_, i) => (
        <div key={i} className={`cloud cloud-${i + 1}`}></div>
      ))}

      <div
        style={{
          backgroundColor: isMobile ? "#0a0804" : "rgba(20, 15, 5, 0.92)",
          borderRadius: isMobile ? "0" : "10px",
          padding: isMobile ? "0.3rem 0.75rem 0.3rem" : "0.75rem 1.5rem",
          maxWidth: isMobile ? "100%" : "1100px",
          width: isMobile ? "100%" : "95%",
          height: isMobile ? "100%" : undefined,
          boxShadow: isMobile ? "none" : "0 4px 20px rgba(0,0,0,0.5), 0 0 15px rgba(212, 175, 55, 0.15)",
          border: isMobile ? "none" : "2px solid #d4af37",
          position: "relative",
          zIndex: 2,
          boxSizing: "border-box" as const,
          display: isMobile ? "flex" : undefined,
          flexDirection: isMobile ? "column" as const : undefined,
          overflow: isMobile ? "hidden" : undefined,
        }}
      >
        {/* Navigation — hamburger on mobile, login button on desktop */}
        {isMobile ? (
          <HamburgerMenu
            onOfferingClick={() => setShowDonationPopup(true)}
            onMerchClick={() => setShowMerchPopup(true)}
            onCharterClick={() => setShowInfoPopup(true)}
          />
        ) : (
          <LoginButton />
        )}

        {/* Home Button — fixed top-right */}
        <button
          onClick={() => navigate("/")}
          style={{
            position: "fixed",
            top: isMobile ? "0.5rem" : "1rem",
            right: isMobile ? "0.5rem" : "1rem",
            zIndex: 1000,
            backgroundColor: "rgba(20, 15, 5, 0.85)",
            border: "2px solid #d4af37",
            borderRadius: "7px",
            padding: isMobile ? "12px 13px" : "0.5rem 1rem",
            boxShadow: "0 0 8px rgba(212, 175, 55, 0.2)",
            color: "#d4af37",
            fontFamily: "'Cinzel', serif",
            fontWeight: 700,
            fontSize: isMobile ? "0.85rem" : "1rem",
            cursor: "pointer",
            letterSpacing: "0.06em",
            minWidth: isMobile ? "50px" : undefined,
            minHeight: isMobile ? "50px" : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Home
        </button>

        <h1
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: isMobile ? "2.2rem" : "2.5rem",
            fontWeight: 900,
            textAlign: "center",
            color: "#c8b070",
            textShadow:
              "2px 2px 0px #3a2e0b, -1px -1px 0px #3a2e0b, 1px -1px 0px #3a2e0b, -1px 1px 0px #3a2e0b, 0 0 15px rgba(200, 176, 112, 0.25)",
            letterSpacing: "0.08em",
            marginBottom: isMobile ? "0.5rem" : "0.4rem",
            marginTop: isMobile ? "4rem" : undefined,
            textTransform: "uppercase",
          }}
        >
          {isMobile ? "Commandments" : "Vote on Commandments"}
        </h1>

        {/* Create Post Form — desktop only (mobile uses Declare tab) */}
        {!isMobile && (
          <form onSubmit={handleSubmit} style={{ marginBottom: "0.5rem", width: "100%" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Enter a new commandment..."
                value={newCommandment}
                onChange={(e) => setNewCommandment(e.target.value.slice(0, 60))}
                maxLength={60}
                style={{
                  flex: 1,
                  border: "1px solid #555",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                  backgroundColor: "#1a1a1a",
                  color: "#fdf8e6",
                  minWidth: 0,
                }}
              />
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
                  whiteSpace: "nowrap",
                }}
              >
                Submit
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", color: newCommandment.length >= 50 ? "#e07050" : "#888" }}>
                {newCommandment.length}/60
              </span>
            </div>
          </form>
        )}

        {/* Submission Success Message */}
        {submitSuccess && (
          <div style={{
            textAlign: "center",
            padding: isMobile ? "4px 8px" : "8px 16px",
            marginBottom: isMobile ? "0.2rem" : "0.5rem",
            backgroundColor: "rgba(90, 122, 80, 0.3)",
            border: "1px solid #5a7a50",
            borderRadius: "8px",
            color: "#a8d89a",
            fontSize: isMobile ? "0.75rem" : "0.95rem",
            fontFamily: "'Cinzel', serif",
            animation: "fadeIn 0.3s ease",
          }}>
            ✦ Commandment submitted! ✦
          </div>
        )}

        {/* === MOBILE TAB BAR === */}
        {isMobile && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: "6px",
            marginBottom: "0.15rem",
            width: "100%",
            padding: "0 4px",
          }}>
            {(["swipe", "comments", "declare"] as MobileTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleMobileTabChange(tab)}
                style={{
                  flex: 1,
                  padding: "28px 0",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  fontFamily: "'Cinzel', serif",
                  letterSpacing: "0.06em",
                  backgroundColor: mobileTab === tab ? "#b79b3d" : "rgba(255,255,255,0.05)",
                  color: mobileTab === tab ? "#fdf8e6" : "#d1b97b",
                  border: mobileTab === tab ? "2px solid #d4af37" : "1.5px solid #555",
                  borderRadius: "8px",
                  transition: "all 0.2s ease",
                  boxShadow: mobileTab === tab ? "0 0 12px rgba(212, 175, 55, 0.25)" : "none",
                }}
              >
                {tab === "swipe" ? "Vote" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* === MOBILE SUB-FILTER BUTTONS (Comments tab only) === */}
        {isMobile && mobileTab === "comments" && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: "5px",
            marginBottom: "0.2rem",
            marginTop: "0.15rem",
            flexWrap: "wrap",
          }}>
            {(["top", "hot", "new", "random"] as MobileFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setMobileFilter(filter);
                  setMobileVisibleCount(10);
                  setShuffleTrigger((t) => t + 1);
                }}
                style={{
                  padding: "4px 14px",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  fontFamily: "'Cinzel', serif",
                  backgroundColor: mobileFilter === filter ? "#b79b3d" : "transparent",
                  color: mobileFilter === filter ? "#fdf8e6" : "#d1b97b",
                  border: mobileFilter === filter ? "1.5px solid #d4af37" : "1.5px solid #555",
                  transition: "all 0.2s ease",
                }}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* === DESKTOP SORT BUTTONS (unchanged) === */}
        {!isMobile && (
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            {(["top", "hot", "new", "random"] as SortOption[]).map((option) => (
              <button
                key={option}
                onClick={() => {
                  setSortOption(option);
                  setShuffleTrigger((t) => t + 1);
                }}
                style={{
                  padding: "10px 24px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "1rem",
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
        )}

        {/* ===== MOBILE CONTENT AREA ===== */}
        {isMobile ? (
          <>
            {/* Empty state */}
            {posts.length === 0 && (
              <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.2rem", margin: "0 0 12px 0" }}>
                  The tablets are empty.
                </p>
                <p style={{ color: "#c8b070", fontSize: "0.9rem", margin: "0 0 8px 0", fontFamily: "'Cinzel', serif" }}>
                  Be the first to inscribe a commandment.
                </p>
              </div>
            )}

            {/* SWIPE TAB */}
            {mobileTab === "swipe" && posts.length > 0 && (
              <div className="swipe-mode-active" style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                minHeight: 0,
                position: "relative",
                width: "100%",
                gap: "0px",
                padding: "0",
                overflow: "hidden",
              }}>
                {/* Angel+Upvote composite — above the card, aligned right edge (hidden during guest prompt) */}
                {!showGuestLoginPrompt && (
                  <div className={swipeDragX > 50 ? "swipe-arrow-active-angel" : ""} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    alignSelf: "flex-end",
                    opacity: swipeDragX > 20 ? 1 : 0.85,
                    transition: "opacity 0.2s ease",
                    pointerEvents: "none",
                    overflow: "visible",
                    flex: "1 1 0",
                    minHeight: 0,
                    maxHeight: "220px",
                    marginRight: "-15px",
                  }}>
                    <img src="/angel_upvote.png" alt="Upvote" style={{ maxHeight: "100%", height: "auto", objectFit: "contain", filter: "drop-shadow(0 0 14px rgba(138, 180, 122, 0.6))" }} />
                  </div>
                )}

                {/* Card area */}
                <div style={{ position: "relative", width: "100%", padding: "0 32px", flexShrink: 0, flexGrow: 0 }}>
                  <AnimatePresence mode="wait" custom={swipeExitDirectionRef.current} onExitComplete={() => { setSwipeResult(null); swipeExitDirectionRef.current = null; }}>
                    {swipeCurrentPostId && (() => {
                      const post = getPost(swipeCurrentPostId);
                      if (!post) return null;

                      return (
                        <motion.div
                          key={swipeCardKey}
                          className="swipe-card"
                          custom={swipeExitDirectionRef.current}
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.9}
                          onDrag={(_: any, info: any) => setSwipeDragX(info.offset.x)}
                          onDragEnd={(_: any, info: any) => {
                            const threshold = 100;
                            if (info.offset.x > threshold) {
                              handleSwipeVote("up");
                            } else if (info.offset.x < -threshold) {
                              handleSwipeVote("down");
                            }
                            setSwipeDragX(0);
                          }}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={(dir: any) => ({
                            opacity: 0,
                            x: (dir ?? swipeExitDirectionRef.current) === "up" ? 300 : -300,
                            rotate: (dir ?? swipeExitDirectionRef.current) === "up" ? 15 : -15,
                          })}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          style={{
                            x: dragX,
                            rotate: cardRotation,
                            border: "2px solid #d4af37",
                            padding: "20px 10px",
                            borderRadius: "12px",
                            backgroundColor: "rgba(255,255,255,0.05)",
                            boxShadow: "0 0 12px rgba(212, 175, 55, 0.15)",
                            cursor: "grab",
                            textAlign: "center",
                          }}
                          whileDrag={{ cursor: "grabbing" }}
                        >
                          <h2 style={{
                            fontWeight: 700,
                            color: "#fdf8e6",
                            fontSize: "1.4rem",
                            margin: "0 0 10px 0",
                            lineHeight: 1.4,
                            wordBreak: "break-word",
                          }}>
                            {post.title || post.content}
                          </h2>

                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "14px", color: "#888", fontStyle: "italic" }}>
                              — {post.username || "unknown"}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>

                  {/* Emoji feedback overlay */}
                  <AnimatePresence>
                    {swipeEmoji && (
                      <div style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10,
                        pointerEvents: "none",
                      }}>
                        <motion.div
                          key="swipe-emoji"
                          initial={{ opacity: 0, scale: 0.3 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.8 }}
                          transition={{ duration: 0.3 }}
                          style={{
                            fontSize: "8rem",
                            lineHeight: 1,
                            filter: "drop-shadow(0 0 30px rgba(0,0,0,0.6))",
                          }}
                        >
                          {swipeEmoji === "down" ? "\uD83D\uDD25" : "\uD83D\uDE4F"}
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Guest login prompt — shown after swiping half the commandments */}
                  {showGuestLoginPrompt && (
                    <div style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "2rem 1rem",
                    }}>
                      <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.3rem", margin: "0 0 12px 0", fontWeight: 700 }}>
                        Create an account to keep voting!
                      </p>
                      <p style={{ color: "#c8b070", fontSize: "0.9rem", margin: "0 0 20px 0", fontFamily: "'Cinzel', serif" }}>
                        Log in to make your votes count and see all commandments.
                      </p>
                      <button
                        onClick={() => { openLoginModal(); }}
                        style={{
                          fontFamily: "'Cinzel', serif",
                          fontSize: "1.1rem",
                          fontWeight: 700,
                          color: "#fdf8e6",
                          backgroundColor: "#b79b3d",
                          border: "2px solid #d4af37",
                          borderRadius: "10px",
                          padding: "14px 32px",
                          cursor: "pointer",
                          textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
                          boxShadow: "0 0 12px rgba(212, 175, 55, 0.4)",
                        }}
                      >
                        Log In / Sign Up
                      </button>
                    </div>
                  )}

                  {/* No more cards */}
                  {!swipeCurrentPostId && !showGuestLoginPrompt && (
                    <div style={{ textAlign: "center", padding: "2rem 0" }}>
                      <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.2rem", margin: "0 0 8px 0" }}>
                        You've seen all commandments!
                      </p>
                      <p style={{ color: "#888", fontSize: "13px", margin: 0 }}>
                        Submit a new one or switch tabs.
                      </p>
                    </div>
                  )}
                </div>

                {/* Demon+Downvote composite — below the card, aligned left edge (hidden during guest prompt) */}
                {!showGuestLoginPrompt && (
                  <div className={swipeDragX < -50 ? "swipe-arrow-active-demon" : ""} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    alignSelf: "flex-start",
                    opacity: swipeDragX < -20 ? 1 : 0.85,
                    transition: "opacity 0.2s ease",
                    pointerEvents: "none",
                    overflow: "visible",
                    flex: "1 1 0",
                    minHeight: 0,
                    maxHeight: "220px",
                    marginLeft: "-15px",
                  }}>
                    <img src="/demon_downvote.png" alt="Downvote" style={{ maxHeight: "100%", height: "auto", objectFit: "contain", filter: "drop-shadow(0 0 14px rgba(200, 90, 74, 0.6))" }} />
                  </div>
                )}

              </div>
            )}

            {/* COMMENTS TAB — Reddit-style infinite scroll feed */}
            {mobileTab === "comments" && (
              <div
                ref={mobileScrollRef}
                onScroll={handleMobileScroll}
                className="mobile-comments-feed"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  overflowX: "hidden",
                  WebkitOverflowScrolling: "touch",
                  padding: "0 2px",
                }}
              >
                {mobileVisiblePosts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem 0" }}>
                    <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1rem" }}>
                      The tablets are empty.
                    </p>
                  </div>
                ) : (
                  mobileVisiblePosts.map((post) => (
                    <div
                      key={String(post.id)}
                      className="mobile-comment-card"
                      style={{
                        border: "1px solid #555",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        marginBottom: "8px",
                        backgroundColor: "rgba(255,255,255,0.05)",
                      }}
                    >
                      <h3 style={{
                        fontWeight: 700,
                        color: "#fdf8e6",
                        fontSize: "1rem",
                        margin: "0 0 6px 0",
                        lineHeight: 1.3,
                        wordBreak: "break-word",
                      }}>
                        {post.title || post.content}
                      </h3>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}>
                        <span style={{ fontSize: "13px", color: "#d1b97b", fontWeight: 600 }}>
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
                          state={{ from: "vote" }}
                          style={{
                            fontSize: "13px",
                            color: "#d4af37",
                            textDecoration: "none",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(212, 175, 55, 0.12)",
                            border: "1px solid rgba(212, 175, 55, 0.3)",
                            fontWeight: 600,
                            fontFamily: "'Cinzel', serif",
                          }}
                        >
                          💬 {commentCounts[String(post.id)] ?? 0}
                        </Link>
                      </div>
                    </div>
                  ))
                )}
                {/* Loading more indicator */}
                {mobileVisibleCount < mobileFilteredPosts.length && (
                  <div style={{ textAlign: "center", padding: "12px 0", color: "#888", fontSize: "12px" }}>
                    Scroll for more...
                  </div>
                )}
                {mobileVisibleCount >= mobileFilteredPosts.length && mobileFilteredPosts.length > 0 && (
                  <div style={{ textAlign: "center", padding: "12px 0", color: "#666", fontSize: "12px", fontStyle: "italic" }}>
                    All {mobileFilteredPosts.length} commandments shown
                  </div>
                )}
              </div>
            )}

            {/* DECLARE TAB — Submit a new commandment */}
            {mobileTab === "declare" && (
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "1.5rem 1.5rem",
              }}>
                <h2 style={{
                  color: "#d4af37",
                  fontFamily: "'Cinzel', serif",
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  textAlign: "center",
                  marginBottom: "1.5rem",
                  letterSpacing: "0.06em",
                  textShadow: "0 0 18px rgba(212, 175, 55, 0.35)",
                  lineHeight: 1.3,
                }}>
                  Declare Your Commandment
                </h2>
                <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: "500px" }}>
                  <input
                    type="text"
                    placeholder="Enter a new commandment..."
                    value={newCommandment}
                    onChange={(e) => setNewCommandment(e.target.value.slice(0, 60))}
                    maxLength={60}
                    style={{
                      width: "100%",
                      border: "2px solid #d4af37",
                      borderRadius: "10px",
                      padding: "18px 18px",
                      fontSize: "1.2rem",
                      boxSizing: "border-box",
                      backgroundColor: "rgba(26, 26, 26, 0.9)",
                      color: "#fdf8e6",
                      fontFamily: "'Cinzel', serif",
                    }}
                  />
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "14px",
                  }}>
                    <span style={{
                      fontSize: "13px",
                      color: newCommandment.length >= 50 ? "#e07050" : "#999",
                    }}>
                      {newCommandment.length}/60
                    </span>
                    <button
                      type="submit"
                      style={{
                        backgroundColor: "#b79b3d",
                        color: "#fdf8e6",
                        padding: "16px 40px",
                        borderRadius: "10px",
                        fontSize: "1.15rem",
                        fontWeight: 700,
                        fontFamily: "'Cinzel', serif",
                        border: "2px solid #d4af37",
                        cursor: "pointer",
                        letterSpacing: "0.06em",
                        boxShadow: "0 0 12px rgba(212, 175, 55, 0.25)",
                      }}
                    >
                      Submit
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Mobile progress indicator */}
            {posts.length > 0 && mobileTab !== "declare" && (
              <div style={{ textAlign: "center", marginTop: "4px", paddingTop: "3px", borderTop: "1px solid #555" }}>
                <span style={{ color: "#d1b97b", fontSize: "12px" }}>
                  Voted on {votedCount} of {totalCount} commandments
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ===== DESKTOP CONTENT (unchanged) ===== */}

            {/* Empty state */}
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

            {/* ===== DESKTOP 4-CARD GRID MODE ===== */}
            {posts.length > 0 && (
              <>
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", width: "100%" }}>
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
                          padding: "16px 20px",
                          borderRadius: "12px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          backgroundColor: "rgba(255,255,255,0.05)",
                          overflow: "hidden",
                          minHeight: "140px",
                          transition: "all 0.25s ease",
                          ...getAnimStyle(slot.animState),
                        }}
                      >
                        <div>
                          <h2 style={{ fontWeight: 700, color: "#fdf8e6", fontSize: "1.4rem", margin: "0 0 6px 0", lineHeight: 1.35, wordBreak: "break-word", whiteSpace: "normal" }}>
                            {post.title || post.content}
                          </h2>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "16px", color: "#d1b97b", fontWeight: 600 }}>
                              {post.votes ?? 0} votes
                            </span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (post.username && post.username !== "unknown") {
                                  setProfilePopup({ username: post.username, x: e.clientX, y: e.clientY });
                                }
                              }}
                              style={{ fontSize: "15px", color: "#888", fontStyle: "italic", cursor: "pointer" }}
                            >
                              {post.username || "unknown"}
                              {getDonorStatus(post.username || "")?.tier && (
                                <DonorBadge tier={getDonorStatus(post.username || "")!.tier} size="small" />
                              )}
                            </span>
                            <Link
                              to={`/comments/${post.id}`}
                              style={{
                                fontSize: "16px",
                                color: "#d4af37",
                                textDecoration: "none",
                                padding: "5px 10px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(212, 175, 55, 0.12)",
                                border: "1px solid rgba(212, 175, 55, 0.3)",
                                fontWeight: 600,
                                fontFamily: "'Cinzel', serif",
                                letterSpacing: "0.02em",
                                transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.25)";
                                e.currentTarget.style.borderColor = "rgba(212, 175, 55, 0.6)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.12)";
                                e.currentTarget.style.borderColor = "rgba(212, 175, 55, 0.3)";
                              }}
                            >
                              💬 {commentCounts[String(post.id)] ?? 0}
                            </Link>
                          </div>
                        </div>
                    {isOwnPost ? (
                      <div style={{ marginTop: "auto", paddingTop: "8px" }}>
                        <p style={{ textAlign: "center", color: "#888", fontSize: "0.85rem", fontStyle: "italic", margin: "0 0 4px 0" }}>
                          Your commandment
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
                      <div style={{ display: "flex", gap: "10px", marginTop: "auto", paddingTop: "8px" }}>
                        <button
                          style={{
                            flex: 1,
                            padding: "12px 0",
                            borderRadius: "8px",
                            border: "none",
                            cursor: "pointer",
                            backgroundColor: "#7a9a6a",
                            background: "linear-gradient(180deg, #8ab47a 0%, #5a8a4a 100%)",
                            color: "#fdf8e6",
                            fontSize: "26px",
                            minHeight: "48px",
                            boxShadow: "0 0 12px rgba(200, 220, 140, 0.25)",
                          }}
                          onClick={() => handleVote(post.id, "up")}
                        >
                          <span style={{ filter: "drop-shadow(0 0 6px rgba(255, 223, 100, 0.8))" }}>👍</span>
                        </button>
                        <button
                          style={{
                            flex: 1,
                            padding: "12px 0",
                            borderRadius: "8px",
                            border: "none",
                            cursor: "pointer",
                            backgroundColor: "#a87a6a",
                            background: "linear-gradient(180deg, #c85a4a 0%, #8a3a2a 100%)",
                            color: "#fdf8e6",
                            fontSize: "26px",
                            minHeight: "48px",
                            boxShadow: "0 0 12px rgba(255, 80, 40, 0.2)",
                          }}
                          onClick={() => handleVote(post.id, "down")}
                        >
                          <span style={{ filter: "drop-shadow(0 0 6px rgba(255, 50, 20, 0.8))" }}>👎</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
              </>
            )}

            {/* Desktop Progress indicator */}
            {posts.length > 0 && (
              <div style={{ textAlign: "center", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #555" }}>
                <span style={{ color: "#d1b97b", fontSize: "12px" }}>
                  Voted on {votedCount} of {totalCount} commandments
                </span>
              </div>
            )}
          </>
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

      {/* Daily Submission Limit Popup */}
      {showLimitPopup && (
        <div
          onClick={() => setShowLimitPopup(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#1a1408",
              border: "2px solid #d4af37",
              borderRadius: "12px",
              padding: isMobile ? "1.5rem 1.25rem" : "2rem 2.5rem",
              maxWidth: isMobile ? "90%" : "420px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 0 30px rgba(212, 175, 55, 0.3)",
              fontFamily: "'Cinzel', serif",
            }}
          >
            <div style={{ fontSize: isMobile ? "2rem" : "2.5rem", marginBottom: "0.75rem" }}>
              ⏳
            </div>
            <h2 style={{
              color: "#d4af37",
              fontSize: isMobile ? "1.1rem" : "1.3rem",
              fontWeight: 700,
              margin: "0 0 0.75rem 0",
              letterSpacing: "0.08em",
            }}>
              Daily Limit Reached
            </h2>
            <p style={{
              color: "#c8b070",
              fontSize: isMobile ? "0.85rem" : "0.95rem",
              lineHeight: 1.6,
              margin: "0 0 1.25rem 0",
            }}>
              You may only inscribe one commandment per day. Return tomorrow to share new wisdom with the collective.
            </p>
            <button
              onClick={() => setShowLimitPopup(false)}
              style={{
                backgroundColor: "#b79b3d",
                color: "#fdf8e6",
                border: "none",
                borderRadius: "8px",
                padding: isMobile ? "10px 28px" : "10px 32px",
                fontSize: isMobile ? "0.9rem" : "1rem",
                fontWeight: 700,
                fontFamily: "'Cinzel', serif",
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Donation popup */}
      <DonationPopup
        isOpen={showDonationPopup}
        onClose={() => setShowDonationPopup(false)}
      />

      {/* Merch popup */}
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
            <img
              src="/merch_tee_back.png"
              alt="Flexible Morals Tee - Back with Commandments"
              style={{ width: "100%", maxWidth: "800px", borderRadius: "8px", display: "block", margin: "0 auto" }}
            />
            <img
              src="/merch_tee_2.png"
              alt="Flexible Morals Tee - Modeled Front and Back"
              style={{ width: "100%", maxWidth: "800px", borderRadius: "8px", display: "block", margin: "1rem auto 0" }}
            />
            <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#d4af37", fontFamily: "'Cinzel', serif", fontWeight: 600 }}>
              Shirts updated with our most recent morals!
            </p>
            <button onClick={() => setShowMerchPopup(false)} className="popup-close" style={{ marginTop: "1rem" }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Charter popup */}
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
              Flexible Morals was founded by two individuals looking for a framework of morality that would proactively evolve with the times. Our goal is to create an ad-free, bot-free space to serve as a forum for what the internet believes to be the present day ten commandments for living a moral life. Will the internet reinforce human principles like not murdering others, or will it reward timely meme-like reactions to inform our moral code?
            </p>
            <p style={{ marginTop: isMobile ? "0.6rem" : "1rem" }}>
              You, dear reader and future disciple, can voice your opinion in the <strong style={{ color: "#d4af37", backgroundColor: "rgba(0, 0, 0, 0.7)", padding: "2px 6px", borderRadius: "3px" }}>world's first democratic religion</strong>. Share the daily commandment guiding your life, and vote on the commandments of others. The collective will decide our top ten commandments, with voting resetting every month.
            </p>
            <p style={{ marginTop: isMobile ? "0.6rem" : "1rem" }}>
              If you are compelled by the mission of navigating morality through the flexible nature of culture and time, please consider making an offering to support keeping this website alive, ad-free, and bot-free.
            </p>
            <p style={{ marginTop: isMobile ? "0.6rem" : "1rem" }}>
              If you would like to spread the word, share the website with your friends or consider buying our merchandise to represent the good word.
            </p>
            <p style={{ marginTop: isMobile ? "0.6rem" : "1rem" }}>
              Our objective is not to make a profit, but to facilitate a movement. One inflexible principle of our founding is that we will donate to Save the Children, in support of those providing hope and care for humanity's future.
            </p>
            <button onClick={() => setShowInfoPopup(false)} className="popup-close" style={{ marginTop: isMobile ? "0.6rem" : undefined }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
