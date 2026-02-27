import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { getPosts, voteOnPost, bulkVoteOnPosts, createPost, getComments, checkVoteCooldown, setVoteCooldown as apiSetVoteCooldown } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useDonor } from "../context/DonorContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import UserProfilePopup from "../components/UserProfilePopup";
import DonorBadge from "../components/DonorBadge";
import LoginButton from "../components/LoginButton";
import HamburgerMenu from "../components/HamburgerMenu";
import DonationPopup from "../components/DonationPopup";
import {
  getNextUnvotedPost,
  getNextSwipePost,
  calculateVoteDelta,
  filterByDownvoteThreshold,
  getBulkVoteTargets,
  shouldTriggerExhaustion,
  updateVoteStreak,
  getCooldownStorageKey,
  isGuestAtLimit,
  getInitialSlots,
  VISIBLE_COUNT,
  GUEST_VOTE_LIMIT,
  DOWNVOTE_THRESHOLD,
} from "../utils/votingLogic";
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

const ANGEL_PHRASES = [
  "Bless you, child!",
  "A righteous decree!",
  "The heavens approve!",
  "Divine wisdom!",
  "Hallelujah!",
  "Most holy!",
  "The angels sing!",
  "Heaven smiles upon thee!",
  "A blessed choice!",
  "Virtue rewarded!",
  "Grace be with you!",
  "So it is written!",
  "Amen to that!",
  "Truly inspired!",
  "The light shines!",
];

const DEMON_PHRASES = [
  "Deliciously wicked...",
  "Yes, yessss!",
  "Chaos reigns!",
  "How sinfully good...",
  "I approve...",
  "Mwahahaha!",
  "Embrace the dark!",
  "A soul after my own...",
  "Wicked choice!",
  "Burn it all!",
  "Sweet corruption...",
  "Diabolically good!",
  "Feed the flames!",
  "The abyss applauds!",
  "Perfectly evil...",
];

export default function Vote() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCommandment, setNewCommandment] = useState("");
  const [userVotes, setUserVotes] = useState<Record<string, "up" | "down" | null>>({});
  const [sortOption, setSortOption] = useState<SortOption>("random");
  const [shuffleTrigger, setShuffleTrigger] = useState(0);
  const [postsRefreshTrigger, setPostsRefreshTrigger] = useState(0);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [visibleSlots, setVisibleSlots] = useState<VisibleSlot[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const { user, openLoginModal } = useAuth();
  // Computed on every render — reads localStorage directly, impossible to be stale
  const guestCountRaw = localStorage.getItem("guestSwipeCount");
  const guestCountNum = parseInt(guestCountRaw || "0", 10);
  const guestAtLimit = isGuestAtLimit(user, guestCountNum);
  // Ref stays in sync every render so useCallback closures always read the latest value
  const guestAtLimitRef = useRef(guestAtLimit);
  guestAtLimitRef.current = guestAtLimit;
  const navigate = useNavigate();
  const { getDonorStatus, loadDonorStatuses } = useDonor();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [profilePopup, setProfilePopup] = useState<{ username: string; x: number; y: number } | null>(null);
  const [showMerchPopup, setShowMerchPopup] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [showDonationPopup, setShowDonationPopup] = useState(false);

  // Hide-downvoted toggle — hides posts below -5 votes (default ON, persisted in localStorage)
  const [hideDownvoted, setHideDownvoted] = useState<boolean>(() => {
    const stored = localStorage.getItem("hideDownvoted");
    return stored === null ? true : stored === "true";
  });
  const hideDownvotedRef = useRef(hideDownvoted);
  useEffect(() => { hideDownvotedRef.current = hideDownvoted; }, [hideDownvoted]);
  const toggleHideDownvoted = useCallback(() => {
    setHideDownvoted(prev => {
      const next = !prev;
      localStorage.setItem("hideDownvoted", String(next));
      return next;
    });
  }, []);

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<MobileTab>("swipe");
  const [mobileFilter, setMobileFilter] = useState<MobileFilter>("top");
  const [mobileVisibleCount, setMobileVisibleCount] = useState(10);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // Swipe mode state
  const [swipeResult, setSwipeResult] = useState<{ direction: "up" | "down"; delta: number; newTotal: number } | null>(null);
  const [swipeCardKey, setSwipeCardKey] = useState(0);
  const [swipeCurrentPostId, setSwipeCurrentPostId] = useState<string | null>(null);
  // Ref for exit animation direction — survives across renders so AnimatePresence can read it
  const swipeExitDirectionRef = useRef<"up" | "down" | null>(null);
  // Emoji feedback after swipe vote
  const [swipeEmoji, setSwipeEmoji] = useState<"up" | "down" | null>(null);
  // Speech bubble state for angel/demon quips
  const [speechBubble, setSpeechBubble] = useState<{ text: string; type: "angel" | "demon" } | null>(null);
  // Consecutive vote streak tracking
  const voteStreakRef = useRef<{ direction: "up" | "down"; count: number }>({ direction: "up", count: 0 });
  const [showStreakPopup, setShowStreakPopup] = useState<"up" | "down" | null>(null);
  const showStreakPopupRef = useRef<"up" | "down" | null>(null);
  // Cooldown pulse — triggered when user tries to vote during cooldown
  const [cooldownPulse, setCooldownPulse] = useState(false);
  // Bulk vote animation state
  const [bulkVoteAnim, setBulkVoteAnim] = useState<{ type: "up" | "down"; emojiCount: number } | null>(null);
  const bulkVoteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stable random positions for bulk vote emoji flood (generated once)
  const bulkEmojiPositions = useRef(
    Array.from({ length: 250 }, () => ({
      x: Math.random() * 96 + 1,   // 1%–97% left
      y: Math.random() * 96 + 1,   // 1%–97% top
      size: 14 + Math.random() * 24, // 14–38px
      delay: Math.random() * 1.0,
    }))
  );

  // Track which posts have been shown to avoid re-showing them before queue exhausts
  // Persisted in localStorage so navigating away doesn't reset the cycle
  const getShownKey = (u?: string | null) => {
    const id = u !== undefined ? (u || localStorage.getItem("guestVoterId") || "guest") : (localStorage.getItem("fm_username") || localStorage.getItem("guestVoterId") || "guest");
    return `shownPostIds_${id}`;
  };
  const shownPostIds = useRef<Set<string>>((() => {
    try {
      const stored = localStorage.getItem(getShownKey());
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch {}
    return new Set<string>();
  })());
  // Helper: save shownPostIds to localStorage
  const saveShownPostIds = () => {
    try {
      localStorage.setItem(getShownKey(user), JSON.stringify([...shownPostIds.current]));
    } catch {}
  };
  // Helper: reset shownPostIds and clear localStorage
  const resetShownPostIds = () => {
    shownPostIds.current = new Set();
    try { localStorage.removeItem(getShownKey(user)); } catch {}
  };
  // Guest swipe tracking — persisted in localStorage so refreshing doesn't reset
  const guestSwipeCount = useRef(
    parseInt(localStorage.getItem("guestSwipeCount") || "0", 10)
  );
  const [showGuestLoginPrompt, setShowGuestLoginPrompt] = useState(() => {
    // Initialize from localStorage so prompt shows immediately on remount (no race condition)
    if (user) return false;
    const count = parseInt(localStorage.getItem("guestSwipeCount") || "0", 10);
    return count >= GUEST_VOTE_LIMIT;
  });
  // Persistent guest voter ID so guest votes are tracked per-device
  const guestVoterId = useRef<string>((() => {
    const stored = localStorage.getItem("guestVoterId");
    if (stored) return stored;
    const id = `guest_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("guestVoterId", id);
    return id;
  })());

  // Cooldown timer state — per-account, persisted in localStorage
  const COOLDOWN_SECONDS = 5 * 60; // 5 minutes
  // Build the per-account cooldown localStorage key.
  // When called from effects, pass the React `user` state so we never read a
  // stale fm_username from localStorage (logout clears it asynchronously).
  // The no-arg form reads localStorage and is only used in the useState
  // initializer (before React state is available).
  const getCooldownKey = (currentUser?: string | null) => {
    if (currentUser !== undefined) {
      return getCooldownStorageKey(currentUser, guestVoterId.current);
    }
    return getCooldownStorageKey(
      undefined,
      localStorage.getItem("fm_username") || guestVoterId.current
    );
  };
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(() => {
    const key = getCooldownKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      const end = parseInt(stored, 10);
      if (end > Date.now()) return end;
      localStorage.removeItem(key);
    }
    return null;
  });
  const [cooldownRemaining, setCooldownRemaining] = useState(() => {
    if (cooldownEnd) return Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
    return 0;
  });

  // Sorting logic
  const sortedPosts = useMemo(() => {
    const base = filterByDownvoteThreshold(posts, hideDownvoted);
    const sorted = [...base];
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
  }, [posts, sortOption, shuffleTrigger, hideDownvoted]);

  // Mobile Comments tab: sort posts by mobileFilter (independent of desktop sortOption)
  const mobileFilteredPosts = useMemo(() => {
    const base = filterByDownvoteThreshold(posts, hideDownvoted);
    const sorted = [...base];
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
  }, [posts, mobileFilter, shuffleTrigger, hideDownvoted]);

  // Mobile Comments tab: slice for infinite scroll
  const mobileVisiblePosts = useMemo(
    () => mobileFilteredPosts.slice(0, mobileVisibleCount),
    [mobileFilteredPosts, mobileVisibleCount]
  );

  // Get the next post to show (in sort order), excluding currently visible ones.
  // Voted posts are deprioritized — unvoted posts shown first. Once all posts
  // have been shown once, return null so the cooldown timer kicks in.
  const getNextPost = useCallback(
    (currentVisibleIds: Set<string>): Post | null => {
      return getNextUnvotedPost(
        sortedPosts,
        currentVisibleIds,
        shownPostIds.current,
        userVotesRef.current,
        user
      );
    },
    [sortedPosts]
  );

  // Ref to always access latest userVotes without re-triggering effects
  const userVotesRef = useRef(userVotes);
  useEffect(() => { userVotesRef.current = userVotes; }, [userVotes]);

  // Ref to always access latest sortedPosts without re-triggering effects
  const sortedPostsRef = useRef(sortedPosts);
  useEffect(() => { sortedPostsRef.current = sortedPosts; }, [sortedPosts]);

  // Ref to always access latest cooldownEnd inside callbacks
  const cooldownEndRef = useRef(cooldownEnd);
  useEffect(() => { cooldownEndRef.current = cooldownEnd; }, [cooldownEnd]);
  // Ref to block voting while Bless All / Banish All popup is showing
  useEffect(() => { showStreakPopupRef.current = showStreakPopup; }, [showStreakPopup]);

  // Initialize visible slots when posts load or sort changes
  const initializeSlots = useCallback(() => {
    // Don't populate cards during active cooldown
    if (cooldownEndRef.current && cooldownEndRef.current > Date.now()) return;
    // Don't populate cards if guest has hit the vote limit
    // Read from ref to avoid stale closure (useCallback may not re-create)
    if (guestAtLimitRef.current) {
      setShowGuestLoginPrompt(true);
      setSwipeCurrentPostId(null);
      setVisibleSlots([]);
      return;
    }

    const { slots, swipePostId } = getInitialSlots(
      sortedPostsRef.current,
      userVotesRef.current,
      VISIBLE_COUNT,
      user,
      sortOption
    );

    if (sortOption === "swipe") {
      setVisibleSlots([]);
      if (swipePostId) {
        setSwipeCurrentPostId(swipePostId);
        shownPostIds.current.add(swipePostId);
        saveShownPostIds();
      } else {
        setSwipeCurrentPostId(null);
      }
      setSwipeResult(null);
      setSwipeEmoji(null);
      swipeExitDirectionRef.current = null;
      return;
    }
    // Reset swipe state when leaving swipe mode
    setSwipeCurrentPostId(null);
    setSwipeResult(null);
    setSwipeEmoji(null);
    swipeExitDirectionRef.current = null;

    slots.forEach((s) => shownPostIds.current.add(s.postId));
    saveShownPostIds();
    setVisibleSlots(slots);
  }, [sortOption, user]);

  // === Load Posts ===
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getPosts();
        setPosts(data);

        // Load vote state from localStorage only — never from server.
        // This allows users to re-vote on everything after cooldown expires
        // (cooldown clears localStorage votes, so all posts appear unvoted).
        const storageKey = user ? `userVotes_${user}` : "userVotes_guest";
        const savedVotes = localStorage.getItem(storageKey);
        if (savedVotes) {
          const localVotes: Record<string, "up" | "down" | null> = JSON.parse(savedVotes);
          setUserVotes(localVotes);
        }

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
  }, [user, postsRefreshTrigger]);

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

  // Compute earliest post date for a user (used as "Disciple since")
  const getMemberSince = useCallback(
    (username: string): string | null => {
      const userPosts = posts.filter((p) => p.username === username && p.createdAt);
      if (userPosts.length === 0) return null;
      return userPosts.reduce((earliest, p) =>
        new Date(p.createdAt!).getTime() < new Date(earliest.createdAt!).getTime() ? p : earliest
      ).createdAt!;
    },
    [posts]
  );

  // Re-load votes from localStorage when user changes (e.g. login after page load)
  useEffect(() => {
    if (posts.length === 0) return;
    const storageKey = user ? `userVotes_${user}` : "userVotes_guest";
    const saved = localStorage.getItem(storageKey);
    const fromStorage: Record<string, "up" | "down" | null> = saved ? JSON.parse(saved) : {};
    setUserVotes((current) => ({
      ...current,
      ...fromStorage,
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
      if (guestAtLimit) {
        setShowGuestLoginPrompt(true);
        setSwipeCurrentPostId(null);
        setVisibleSlots([]);
        return;
      }
      initializeSlots();
    }
  }, [postsLoaded, sortOption, shuffleTrigger, guestAtLimit]);

  // Re-initialize slots when hideDownvoted toggle changes
  useEffect(() => {
    if (postsLoaded) {
      resetShownPostIds();
      setTimeout(() => initializeSlots(), 50);
    }
  }, [hideDownvoted]);

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
    setBulkVoteAnim(null);
    if (tab === "swipe") {
      setSortOption(isMobile ? "swipe" : "random");
      setShuffleTrigger((t) => t + 1);
    }
  }, [isMobile]);

  // === Require login ===
  const requireLogin = (): boolean => {
    if (user) return true;
    openLoginModal();
    return false;
  };

  // === Handle new post submission ===
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireLogin()) return;
    if (!newCommandment.trim()) return;

    try {
      const newPost = await createPost(newCommandment.trim(), user);
      // Ensure createdAt is set so "new" sort places it at the top
      if (!newPost.createdAt) newPost.createdAt = new Date().toISOString();
      setPosts((prev) => [...prev, newPost]);
      setNewCommandment("");
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
      // Switch to Comments tab with "new" filter so user sees their post
      setMobileTab("comments");
      setMobileFilter("new");
      setMobileVisibleCount(10);
      // Reset shown tracking so the new post appears in the first batch
      resetShownPostIds();
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

    // Already voted the same direction — no-op
    if (prevVote === direction) return;

    // Calculate correct delta: undo previous vote if changing direction
    const delta = calculateVoteDelta(prevVote, direction);

    setPosts((prev) =>
      prev.map((p) => {
        if (String(p.id) !== pid) return p;
        return { ...p, votes: (p.votes ?? 0) + delta };
      })
    );

    setUserVotes((prev) => ({ ...prev, [pid]: direction }));

    // Persist to backend — use real user ID or guest voter ID
    const voterId = user || guestVoterId.current;
    voteOnPost(pid, direction, voterId)
      .then((updated) => {
        setPosts((prev) =>
          prev.map((p) =>
            String(p.id) === String(updated.id)
              ? { ...p, votes: updated.votes, userVotes: updated.userVotes }
              : p
          )
        );
      })
      .catch((err) => {
        // If server returns cooldown (429), activate it locally
        if (err?.response?.status === 429 && err?.response?.data?.cooldownEnd) {
          const serverEnd = err.response.data.cooldownEnd;
          setCooldownEnd(serverEnd);
          setCooldownRemaining(Math.max(0, Math.ceil((serverEnd - Date.now()) / 1000)));
          cooldownTriggered.current = true;
          localStorage.setItem(getCooldownKey(user), String(serverEnd));
        }
        console.error("Vote failed:", err);
      });
  };

  // === Bulk vote all remaining posts ===
  const handleBulkVote = useCallback((direction: "up" | "down") => {
    const currentUser = user;
    const voterId = currentUser || guestVoterId.current;
    const votes = userVotesRef.current;
    const allPosts = sortedPostsRef.current;

    // Find all unvoted posts (excluding own, respecting hide-downvoted toggle)
    const unvoted = getBulkVoteTargets(allPosts, votes, currentUser, hideDownvotedRef.current);

    // Build vote map and post ID list
    const newVotes: Record<string, "up" | "down"> = {};
    const postIds: string[] = [];
    for (const post of unvoted) {
      const pid = String(post.id);
      newVotes[pid] = direction;
      postIds.push(pid);
    }

    // Single bulk API call (skip if nothing to vote on)
    if (postIds.length > 0) {
      bulkVoteOnPosts(postIds, direction, voterId).catch((err) => console.error("Bulk vote failed:", err));
    }

    // Optimistic update
    setUserVotes((prev) => ({ ...prev, ...newVotes }));
    setPosts((prev) =>
      prev.map((p) => {
        const pid = String(p.id);
        if (!newVotes[pid]) return p;
        const current = p.votes ?? 0;
        return { ...p, votes: current + (direction === "up" ? 1 : -1) };
      })
    );

    // Clear current card / desktop slots
    setSwipeCurrentPostId(null);
    setVisibleSlots([]);

    // Trigger cooldown immediately — all posts are now voted
    if (!cooldownTriggered.current) {
      cooldownTriggered.current = true;
      const end = Date.now() + COOLDOWN_SECONDS * 1000;
      setCooldownEnd(end);
      setCooldownRemaining(COOLDOWN_SECONDS);
      cooldownEndRef.current = end; // Update ref immediately so initializeSlots won't refill
      localStorage.setItem(getCooldownKey(user), String(end));
      const voterId2 = user || guestVoterId.current;
      apiSetVoteCooldown(voterId2).catch(() => {});
    }

    // Start emoji flood animation — 250 emojis fill the screen, then slowly clear
    const TOTAL_EMOJIS = 250;
    setBulkVoteAnim({ type: direction, emojiCount: TOTAL_EMOJIS });

    // After a brief flood pause, start clearing emojis one by one
    const clearDelay = setTimeout(() => {
      const interval = setInterval(() => {
        setBulkVoteAnim((prev) => {
          if (!prev || prev.emojiCount <= 2) {
            clearInterval(interval);
            bulkVoteTimerRef.current = null;
            return prev ? { ...prev, emojiCount: 0 } : null;
          }
          return { ...prev, emojiCount: prev.emojiCount - 2 };
        });
      }, 30);
      bulkVoteTimerRef.current = interval;
    }, 1500);

    return () => { clearTimeout(clearDelay); };
  }, [user]);

  // Clean up bulk vote timer on unmount
  useEffect(() => {
    return () => {
      if (bulkVoteTimerRef.current) clearInterval(bulkVoteTimerRef.current);
    };
  }, []);

  // Ref to always access latest swipeCurrentPostId inside timeouts
  const swipeCurrentPostIdRef = useRef(swipeCurrentPostId);
  useEffect(() => { swipeCurrentPostIdRef.current = swipeCurrentPostId; }, [swipeCurrentPostId]);

  // === Swipe mode: advance to next card ===
  // Voted posts are deprioritized — unvoted posts shown first. Once all unvoted
  // posts are exhausted, voted posts cycle back in for re-voting.
  const advanceSwipeCard = useCallback(() => {
    // Don't advance if guest has hit the vote limit (ref avoids stale closure)
    if (guestAtLimitRef.current) {
      setShowGuestLoginPrompt(true);
      setSwipeCurrentPostId(null);
      return;
    }
    const currentPid = swipeCurrentPostIdRef.current;
    const { nextPost, shouldResetShown } = getNextSwipePost(
      sortedPostsRef.current,
      currentPid,
      shownPostIds.current,
      userVotesRef.current,
      user
    );

    if (shouldResetShown) {
      shownPostIds.current = new Set();
    }

    if (nextPost) {
      const nextPid = String(nextPost.id);
      shownPostIds.current.add(nextPid);
      saveShownPostIds();
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
      if (sortOption === "swipe") {
        advanceSwipeCard();
      } else {
        // Desktop: reinitialize card slots so voting resumes
        initializeSlots();
      }
    }
  }, [user, showGuestLoginPrompt, advanceSwipeCard, sortOption, initializeSlots]);

  // On mount: if guest already hit the limit (persisted), show prompt immediately
  useEffect(() => {
    if (!user && posts.length > 0) {
      if (guestSwipeCount.current >= GUEST_VOTE_LIMIT) {
        setShowGuestLoginPrompt(true);
        setSwipeCurrentPostId(null);
        setVisibleSlots([]);
      }
    }
  }, [user, posts.length]);

  // === Cooldown timer: start when all commandments exhausted ===
  const cooldownTriggered = useRef(false);
  const slotsInitialized = useRef(false);
  const prevUserRef = useRef(user);

  // Reload cooldown when user changes (login/logout)
  // Checks both localStorage (for guests) and the server (for logged-in users,
  // enabling cross-device cooldown enforcement).
  useEffect(() => {
    const prevUser = prevUserRef.current;
    prevUserRef.current = user;

    // Logout detected (was logged in, now guest): if the logged-in user had
    // an active cooldown, carry it over to the guest so they can't bypass it.
    if (prevUser && !user) {
      const prevKey = getCooldownKey(prevUser);
      const prevStored = localStorage.getItem(prevKey);
      if (prevStored) {
        const prevEnd = parseInt(prevStored, 10);
        if (prevEnd > Date.now()) {
          const guestKey = getCooldownKey(null);
          localStorage.setItem(guestKey, String(prevEnd));
        }
      }
    }

    // Helper to apply a found cooldown
    const applyCooldown = (end: number) => {
      setCooldownEnd(end);
      setCooldownRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
      cooldownTriggered.current = true;
      // Also sync to localStorage
      localStorage.setItem(getCooldownKey(user), String(end));
    };

    // Helper to clear cooldown and re-init — wipes local vote memory so user can re-vote
    const clearAndReinit = () => {
      setCooldownEnd(null);
      setCooldownRemaining(0);
      cooldownTriggered.current = false;
      slotsInitialized.current = false;
      resetShownPostIds();
      // Clear local vote memory so all posts appear unvoted (server still has the votes)
      setUserVotes({});
      userVotesRef.current = {};
      const storageKey = user ? `userVotes_${user}` : "userVotes_guest";
      localStorage.removeItem(storageKey);
      setShuffleTrigger((t) => t + 1);
    };

    // Check localStorage first (fast, works for guests too)
    const key = getCooldownKey(user);
    const stored = localStorage.getItem(key);
    if (stored) {
      const end = parseInt(stored, 10);
      if (end > Date.now()) {
        applyCooldown(end);
        return;
      }
      localStorage.removeItem(key);
    }

    // For logged-in users, also check server (cross-device enforcement)
    if (user) {
      checkVoteCooldown(user)
        .then((data) => {
          if (data.cooldown && data.cooldownEnd > Date.now()) {
            applyCooldown(data.cooldownEnd);
          } else {
            clearAndReinit();
          }
        })
        .catch(() => {
          // Server check failed — fall through to no cooldown
          clearAndReinit();
        });
    } else {
      // Guest — no server check, just clear and re-init
      clearAndReinit();
    }
  }, [user]);

  // Mark slots as initialized only after the state updates from initializeSlots
  // have actually been applied. This must run BEFORE the exhaustion detector
  // (declared earlier = runs first) to prevent a race where slotsInitialized is
  // true but swipeCurrentPostId is still null from a deferred setState.
  useEffect(() => {
    if (slotsInitialized.current || !postsLoaded) return;
    const hasCards = sortOption === "swipe"
      ? !!swipeCurrentPostId
      : visibleSlots.length > 0;
    if (hasCards) {
      slotsInitialized.current = true;
    }
  }, [postsLoaded, sortOption, swipeCurrentPostId, visibleSlots.length]);

  // Detect exhaustion — mobile (swipeCurrentPostId null) or desktop (visibleSlots empty)
  useEffect(() => {
    if (shouldTriggerExhaustion(
      sortOption,
      swipeCurrentPostId,
      visibleSlots.length,
      slotsInitialized.current,
      cooldownEnd,
      cooldownTriggered.current,
      posts.length,
      showGuestLoginPrompt
    )) {
      cooldownTriggered.current = true;
      voteStreakRef.current = { direction: "up", count: 0 };
      const end = Date.now() + COOLDOWN_SECONDS * 1000;
      setCooldownEnd(end);
      setCooldownRemaining(COOLDOWN_SECONDS);
      // Persist per-account locally
      localStorage.setItem(getCooldownKey(user), String(end));
      // Also persist server-side for cross-device enforcement
      const voterId = user || guestVoterId.current;
      apiSetVoteCooldown(voterId).catch(() => {});
    }
  }, [swipeCurrentPostId, visibleSlots.length, posts.length, sortOption, cooldownEnd, showGuestLoginPrompt, COOLDOWN_SECONDS, user]);

  // When cooldown is active, clear cards/swipe so the timer message shows
  useEffect(() => {
    if (cooldownEnd && cooldownEnd > Date.now()) {
      setSwipeCurrentPostId(null);
      setVisibleSlots([]);
    }
  }, [cooldownEnd]);

  // Tick the countdown every second
  useEffect(() => {
    if (!cooldownEnd) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        // Reset cooldown and re-enable voting
        setCooldownEnd(null);
        cooldownEndRef.current = null; // Clear ref immediately so initializeSlots doesn't bail out
        localStorage.removeItem(getCooldownKey(user));
        resetShownPostIds();
        voteStreakRef.current = { direction: "up", count: 0 };
        cooldownTriggered.current = false;
        slotsInitialized.current = false; // Prevent exhaustion detector from firing before cards load
        // Clear local vote memory so all posts appear unvoted — lets user re-vote on everything
        setUserVotes({});
        userVotesRef.current = {};
        const storageKey = user ? `userVotes_${user}` : "userVotes_guest";
        localStorage.removeItem(storageKey);
        // Re-fetch posts from server to discover new commandments added during cooldown
        setPostsRefreshTrigger((t) => t + 1);
        setShuffleTrigger((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownEnd, initializeSlots, user]);

  // Format seconds as M:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // === Swipe mode: handle swipe vote ===
  const handleSwipeVote = useCallback((direction: "up" | "down") => {
    // Block voting while Bless All / Banish All popup is showing
    if (showStreakPopupRef.current) return;
    // ABSOLUTE GUARD: read localStorage directly — no closure, no ref, no state
    const rawGuestCount = parseInt(localStorage.getItem("guestSwipeCount") || "0", 10);
    const rawUsername = localStorage.getItem("fm_username");
    if (!rawUsername && rawGuestCount >= GUEST_VOTE_LIMIT) {
      setShowGuestLoginPrompt(true);
      setSwipeCurrentPostId(null);
      return;
    }
    // Block voting during cooldown — pulsate the timer
    if (cooldownEnd && cooldownEnd > Date.now()) {
      setCooldownPulse(true);
      setTimeout(() => setCooldownPulse(false), 600);
      return;
    }
    // Hard block: guest already at vote limit (ref avoids stale closure)
    if (guestAtLimitRef.current) {
      setShowGuestLoginPrompt(true);
      setSwipeCurrentPostId(null);
      return;
    }

    const currentPid = swipeCurrentPostIdRef.current;
    if (!currentPid) return;
    const post = posts.find((p) => String(p.id) === currentPid);
    if (!post) return;

    // Already voted the same direction on this post — skip
    const prevSwipeVote = userVotesRef.current[currentPid];
    if (prevSwipeVote === direction) {
      advanceSwipeCard();
      return;
    }

    // Calculate correct delta: undo previous vote if changing direction
    const delta = calculateVoteDelta(prevSwipeVote, direction);
    const newTotal = (post.votes ?? 0) + delta;

    // Optimistic update — use correctly computed delta so count matches server
    setPosts((prev) =>
      prev.map((p) => {
        if (String(p.id) !== currentPid) return p;
        return { ...p, votes: (p.votes ?? 0) + delta };
      })
    );
    // Track the vote so this post is deprioritized in the queue going forward.
    // Update ref immediately so advanceSwipeCard (called below) sees it.
    userVotesRef.current = { ...userVotesRef.current, [currentPid]: direction };
    setUserVotes((prev) => ({ ...prev, [currentPid]: direction }));
    // Fire API call — use real user ID or guest voter ID
    const voterId = user || guestVoterId.current;
    voteOnPost(currentPid, direction, voterId)
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

    // Guest limit: increment count and check BEFORE showing animations
    if (!user) {
      guestSwipeCount.current += 1;
      localStorage.setItem("guestSwipeCount", String(guestSwipeCount.current));
      if (guestSwipeCount.current >= GUEST_VOTE_LIMIT) {
        // Immediately update ref so all callbacks see the new limit
        guestAtLimitRef.current = true;
        setShowGuestLoginPrompt(true);
        setSwipeCurrentPostId(null);
        return;
      }
    }

    // Store exit direction in ref so it's available during AnimatePresence exit animation
    swipeExitDirectionRef.current = direction;
    setSwipeResult({ direction, delta, newTotal });
    // Show emoji feedback
    setSwipeEmoji(direction);
    setTimeout(() => setSwipeEmoji(null), 700);

    // Occasionally show a speech bubble from the angel or demon (~35% chance)
    if (Math.random() < 0.35) {
      const phrases = direction === "up" ? ANGEL_PHRASES : DEMON_PHRASES;
      const text = phrases[Math.floor(Math.random() * phrases.length)];
      setSpeechBubble({ text, type: direction === "up" ? "angel" : "demon" });
      setTimeout(() => setSpeechBubble(null), 2000);
    }

    // Track consecutive same-direction votes and show streak popup at 10
    const { newStreak, triggerPopup } = updateVoteStreak(voteStreakRef.current, direction);
    voteStreakRef.current = newStreak;
    if (triggerPopup) {
      setShowStreakPopup(direction);
    }

    advanceSwipeCard();
  }, [posts, user, advanceSwipeCard, cooldownEnd]);

  // === Handle vote with fade animation (4-card mode) ===
  const handleVote = (postId: string | number, direction: "up" | "down") => {
    // Block voting while Bless All / Banish All popup is showing
    if (showStreakPopup) return;
    // Block voting during cooldown — pulsate the timer
    if (cooldownEnd && cooldownEnd > Date.now()) {
      setCooldownPulse(true);
      setTimeout(() => setCooldownPulse(false), 600);
      return;
    }
    // Hard block: guest already at vote limit (ref avoids stale closure)
    if (guestAtLimitRef.current) {
      setShowGuestLoginPrompt(true);
      setVisibleSlots([]);
      return;
    }

    const pid = String(postId);
    const post = posts.find((p) => String(p.id) === pid);
    if (user && post?.username === user) return;

    handleVoteOptimistic(pid, direction);

    // Track consecutive same-direction votes and show streak popup at 10 (desktop)
    const { newStreak: desktopStreak, triggerPopup: desktopPopup } = updateVoteStreak(voteStreakRef.current, direction);
    voteStreakRef.current = desktopStreak;
    if (desktopPopup) {
      setShowStreakPopup(direction);
    }

    // Guest limit: after 5 votes, prompt login
    if (!user) {
      guestSwipeCount.current += 1;
      localStorage.setItem("guestSwipeCount", String(guestSwipeCount.current));
      if (guestSwipeCount.current >= GUEST_VOTE_LIMIT) {
        guestAtLimitRef.current = true;
        setShowGuestLoginPrompt(true);
        setVisibleSlots([]);
        return;
      }
    }

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
          saveShownPostIds();
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
          saveShownPostIds();
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
        {/* Navigation — hamburger on mobile, inline buttons on desktop */}
        {isMobile ? (
          <>
            <HamburgerMenu
              onOfferingClick={() => setShowDonationPopup(true)}
              onMerchClick={() => setShowMerchPopup(true)}
              onCharterClick={() => setShowInfoPopup(true)}
            />
            {/* Mobile top-right: Hide-downvoted toggle + Home button */}
            <div style={{
              position: "fixed",
              top: "0.5rem",
              right: "0.5rem",
              zIndex: 1000,
              display: "flex",
              gap: "6px",
              alignItems: "center",
            }}>
              {(mobileTab === "swipe" || mobileTab === "comments") && (
                <div
                  onClick={toggleHideDownvoted}
                  style={{
                    backgroundColor: "rgba(20, 15, 5, 0.85)",
                    border: "2px solid rgba(212, 175, 55, 0.3)",
                    borderRadius: "7px",
                    padding: "4px 8px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "2px",
                    cursor: "pointer",
                    minHeight: "50px",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{
                      color: hideDownvoted ? "#888" : "#d4af37",
                      fontFamily: "'Cinzel', serif",
                      fontWeight: 700,
                      fontSize: "0.5rem",
                      letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                      transition: "color 0.2s ease",
                    }}>
                      Show
                    </span>
                    <div style={{
                      width: "32px",
                      height: "18px",
                      borderRadius: "9px",
                      backgroundColor: hideDownvoted ? "rgba(100, 80, 40, 0.5)" : "#b79b3d",
                      border: `1.5px solid ${hideDownvoted ? "#555" : "#d4af37"}`,
                      position: "relative",
                      transition: "all 0.25s ease",
                      flexShrink: 0,
                    }}>
                      <div style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: hideDownvoted ? "#888" : "#fdf8e6",
                        position: "absolute",
                        top: "2px",
                        left: hideDownvoted ? "2px" : "16px",
                        transition: "all 0.25s ease",
                        boxShadow: hideDownvoted ? "none" : "0 0 6px rgba(212, 175, 55, 0.4)",
                      }} />
                    </div>
                    <span style={{
                      color: hideDownvoted ? "#d4af37" : "#888",
                      fontFamily: "'Cinzel', serif",
                      fontWeight: 700,
                      fontSize: "0.5rem",
                      letterSpacing: "0.02em",
                      whiteSpace: "nowrap",
                      transition: "color 0.2s ease",
                    }}>
                      Hide
                    </span>
                  </div>
                  <span style={{
                    color: "#c8b070",
                    fontFamily: "'Cinzel', serif",
                    fontWeight: 600,
                    fontSize: "0.4rem",
                    letterSpacing: "0.01em",
                    whiteSpace: "nowrap",
                    opacity: 0.7,
                  }}>
                    deplorable commandments
                  </span>
                </div>
              )}
              <button
                onClick={() => navigate("/")}
                style={{
                  backgroundColor: "rgba(20, 15, 5, 0.85)",
                  border: "2px solid #d4af37",
                  borderRadius: "7px",
                  padding: "12px 13px",
                  boxShadow: "0 0 8px rgba(212, 175, 55, 0.2)",
                  color: "#d4af37",
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  minWidth: "50px",
                  minHeight: "50px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Home
              </button>
            </div>
          </>
        ) : (
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            marginBottom: "0.25rem",
          }}>
            <div className="login-inline-wrapper">
              <LoginButton />
            </div>
            <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              <div
                onClick={toggleHideDownvoted}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "2px solid rgba(212, 175, 55, 0.3)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span style={{
                  color: hideDownvoted ? "#888" : "#d4af37",
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  letterSpacing: "0.03em",
                  transition: "color 0.2s ease",
                  whiteSpace: "nowrap",
                }}>
                  Show
                </span>
                <div style={{
                  width: "42px",
                  height: "24px",
                  borderRadius: "12px",
                  backgroundColor: hideDownvoted ? "rgba(100, 80, 40, 0.5)" : "#b79b3d",
                  border: `1.5px solid ${hideDownvoted ? "#555" : "#d4af37"}`,
                  position: "relative",
                  transition: "all 0.25s ease",
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    backgroundColor: hideDownvoted ? "#888" : "#fdf8e6",
                    position: "absolute",
                    top: "2px",
                    left: hideDownvoted ? "2px" : "20px",
                    transition: "all 0.25s ease",
                    boxShadow: hideDownvoted ? "none" : "0 0 8px rgba(212, 175, 55, 0.4)",
                  }} />
                </div>
                <span style={{
                  color: hideDownvoted ? "#d4af37" : "#888",
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  letterSpacing: "0.03em",
                  transition: "color 0.2s ease",
                  whiteSpace: "nowrap",
                }}>
                  Hide
                </span>
                <span style={{
                  color: "#c8b070",
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 600,
                  fontSize: "0.7rem",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                  opacity: 0.7,
                }}>
                  deplorable commandments
                </span>
              </div>
              <button
                onClick={() => navigate("/")}
                style={{
                  backgroundColor: "transparent",
                  border: "2px solid #d4af37",
                  borderRadius: "8px",
                  padding: "10px 24px",
                  boxShadow: "0 0 10px rgba(212, 175, 55, 0.2)",
                  color: "#d4af37",
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 700,
                  fontSize: "1.15rem",
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.12)";
                  e.currentTarget.style.boxShadow = "0 0 16px rgba(212, 175, 55, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.boxShadow = "0 0 10px rgba(212, 175, 55, 0.2)";
                }}
              >
                Home
              </button>
            </div>
          </div>
        )}

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

        {/* Desktop submission form removed — use Declare tab */}

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

        {/* === TAB BAR === */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: isMobile ? "6px" : "10px",
          marginBottom: isMobile ? "0.15rem" : "0.75rem",
          width: "100%",
          padding: isMobile ? "0 4px" : "0",
        }}>
          {(["swipe", "comments", "declare"] as MobileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleMobileTabChange(tab)}
              style={{
                flex: isMobile ? 1 : undefined,
                padding: isMobile ? "28px 0" : "10px 32px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: isMobile ? "1.1rem" : "1rem",
                fontFamily: "'Cinzel', serif",
                letterSpacing: "0.06em",
                backgroundColor: mobileTab === tab ? "#b79b3d" : "rgba(255,255,255,0.05)",
                color: mobileTab === tab ? "#fdf8e6" : "#d1b97b",
                border: mobileTab === tab ? "2px solid #d4af37" : "1.5px solid #555",
                borderRadius: "8px",
                transition: "all 0.2s ease",
                boxShadow: mobileTab === tab ? "0 0 12px rgba(212, 175, 55, 0.25)" : "none",
                minHeight: isMobile ? undefined : "44px",
              }}
            >
              {tab === "swipe" ? "Vote" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* === SUB-FILTER BUTTONS (Comments tab only) === */}
        {mobileTab === "comments" && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: isMobile ? "5px" : "8px",
            marginBottom: isMobile ? "0.2rem" : "0.5rem",
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
                  padding: isMobile ? "4px 14px" : "6px 20px",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: isMobile ? "0.75rem" : "0.85rem",
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

        {/* Desktop sort buttons removed — using tab system now */}

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

            {/* VOTE TAB */}
            {mobileTab === "swipe" && posts.length > 0 && (
              <div className="swipe-mode-active" style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                justifyContent: "center",
                flex: 1,
                minHeight: 0,
                position: "relative",
                width: "100%",
                padding: "0",
                overflow: "visible",
              }}>
                {/* === Bulk vote emoji flood === */}
                {bulkVoteAnim ? (
                  <div style={{
                    position: "relative",
                    flex: 1,
                    width: "100%",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.92)",
                    borderRadius: "12px",
                  }}>
                    {/* Emoji flood layer */}
                    {bulkEmojiPositions.current.slice(0, bulkVoteAnim.emojiCount).map((pos, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{ duration: 0.3, delay: pos.delay }}
                        style={{
                          position: "absolute",
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                          fontSize: `${pos.size}px`,
                          lineHeight: 1,
                          pointerEvents: "none",
                          filter: "drop-shadow(0 0 4px rgba(0,0,0,0.5))",
                        }}
                      >
                        {bulkVoteAnim.type === "up" ? "\uD83D\uDE4F" : "\uD83D\uDD25"}
                      </motion.span>
                    ))}
                    {/* Revealed message underneath */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: bulkVoteAnim.emojiCount <= 20 ? 1 : 0 }}
                      transition={{ duration: 0.6 }}
                      style={{
                        textAlign: "center",
                        padding: "1.5rem 1rem",
                        zIndex: 1,
                      }}
                    >
                      <p style={{
                        color: "#d4af37",
                        fontFamily: "'Cinzel', serif",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        margin: "0 0 8px 0",
                        lineHeight: 1.4,
                      }}>
                        You've judged all commandments!
                      </p>
                      <p style={{
                        color: "#c8b070",
                        fontFamily: "'Cinzel', serif",
                        fontSize: "0.85rem",
                        margin: "0 0 6px 0",
                      }}>
                        {bulkVoteAnim.type === "up"
                          ? "The heavens rejoice at your mercy."
                          : "The abyss welcomes your wrath."}
                      </p>
                      {cooldownEnd && cooldownRemaining > 0 ? (
                        <>
                          <p className={cooldownPulse ? "cooldown-pulse" : ""} style={{
                            color: "#fdf8e6",
                            fontFamily: "'Cinzel', serif",
                            fontSize: "2rem",
                            fontWeight: 900,
                            margin: "12px 0",
                            textShadow: "0 0 12px rgba(212, 175, 55, 0.4)",
                          }}>
                            {formatTime(cooldownRemaining)}
                          </p>
                          <p style={{ color: "#c8b070", fontSize: "0.85rem", margin: "0 0 6px 0", fontFamily: "'Cinzel', serif", lineHeight: 1.5 }}>
                            Voting reopens soon. In the meantime...
                          </p>
                          <p style={{ color: "#d4af37", fontSize: "0.9rem", margin: "8px 0", fontFamily: "'Cinzel', serif", fontWeight: 600 }}>
                            Declare a commandment of your own!
                          </p>
                        </>
                      ) : (
                        <p style={{ color: "#c8b070", fontSize: "0.85rem", margin: "8px 0 0 0", fontFamily: "'Cinzel', serif" }}>
                          Declare a commandment of your own!
                        </p>
                      )}
                      <button
                        onClick={() => handleMobileTabChange("declare")}
                        style={{
                          fontFamily: "'Cinzel', serif",
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          color: "#fdf8e6",
                          backgroundColor: "#b79b3d",
                          border: "2px solid #d4af37",
                          borderRadius: "10px",
                          padding: "12px 24px",
                          cursor: "pointer",
                          boxShadow: "0 0 12px rgba(212, 175, 55, 0.25)",
                          marginBottom: "12px",
                        }}
                      >
                        Declare
                      </button>
                      <p style={{ color: "#888", fontSize: "0.8rem", margin: "8px 0 0 0", fontStyle: "italic" }}>
                        Or perhaps... go touch some grass.
                      </p>
                    </motion.div>
                  </div>
                ) : guestAtLimit || showGuestLoginPrompt ? (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  textAlign: "center",
                  padding: "2rem 1rem",
                }}>
                  <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.1rem", margin: "0 0 10px 0", fontWeight: 700 }}>
                    Create an account to keep voting!
                  </p>
                  <p style={{ color: "#c8b070", fontSize: "0.8rem", margin: "0 0 16px 0", fontFamily: "'Cinzel', serif" }}>
                    Log in to make your votes count.
                  </p>
                  <button
                    onClick={() => { openLoginModal(); }}
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      color: "#fdf8e6",
                      backgroundColor: "#b79b3d",
                      border: "2px solid #d4af37",
                      borderRadius: "10px",
                      padding: "12px 24px",
                      cursor: "pointer",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
                      boxShadow: "0 0 12px rgba(212, 175, 55, 0.4)",
                    }}
                  >
                    Log In / Sign Up
                  </button>
                </div>
                ) : (
                <>
                {/* Top row: Angel + Upvote button — full width (hidden during cooldown) */}
                {swipeCurrentPostId && (
                <div style={{
                  display: "flex",
                  flexDirection: "row",
                  width: "100%",
                  flex: 1,
                  minHeight: 0,
                }}>
                  <div style={{ flex: "1 1 50%", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible", position: "relative" }}>
                    <img src="/angel.png" alt="Angel" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 14px rgba(138, 180, 122, 0.6))" }} />
                    <AnimatePresence>
                      {speechBubble?.type === "angel" && (
                        <motion.div
                          className="speech-bubble speech-bubble-angel"
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          transition={{ duration: 0.25 }}
                        >
                          {speechBubble.text}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    onClick={() => !showGuestLoginPrompt && handleSwipeVote("up")}
                    disabled={showGuestLoginPrompt}
                    style={{
                      flex: "1 1 50%",
                      minWidth: 0,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      overflow: "hidden",
                      background: "linear-gradient(180deg, rgba(138, 180, 122, 0.25) 0%, rgba(90, 138, 74, 0.15) 100%)",
                      border: "2px solid rgba(138, 180, 122, 0.5)",
                      borderRadius: "10px",
                      cursor: showGuestLoginPrompt ? "default" : "pointer",
                      opacity: showGuestLoginPrompt ? 0.3 : 1,
                      transition: "all 0.15s ease",
                      boxShadow: "0 0 10px rgba(138, 180, 122, 0.2)",
                    }}
                    onMouseDown={(e) => { if (!showGuestLoginPrompt) (e.currentTarget as HTMLElement).style.transform = "scale(0.94)"; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                    onTouchStart={(e) => { if (!showGuestLoginPrompt) (e.currentTarget as HTMLElement).style.transform = "scale(0.94)"; }}
                    onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                  >
                    <span style={{ fontSize: "clamp(3rem, 12vh, 10rem)", lineHeight: 0.7, fontFamily: "monospace", color: "#8ab47a" }}>↑</span>
                    <span style={{ fontSize: "clamp(0.7rem, 2vh, 1.4rem)", fontFamily: "'Cinzel', serif", fontWeight: 700, color: "#8ab47a", letterSpacing: "0.08em" }}>Upvote</span>
                  </button>
                </div>
                )}

                {/* Card area */}
                <div style={{ position: "relative", padding: "6px 12px", flexShrink: 0, overflow: "visible" }}>
                  <AnimatePresence mode="wait" custom={swipeExitDirectionRef.current} onExitComplete={() => { setSwipeResult(null); swipeExitDirectionRef.current = null; }}>
                    {swipeCurrentPostId && !guestAtLimit && !showGuestLoginPrompt && (() => {
                      const post = getPost(swipeCurrentPostId);
                      if (!post) return null;

                      return (
                        <motion.div
                          key={swipeCardKey}
                          className="swipe-card"
                          custom={swipeExitDirectionRef.current}
                          initial={{ opacity: 0, y: 30, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1, scaleX: 1, x: 0 }}
                          exit={(dir: any) => {
                            const d = dir ?? swipeExitDirectionRef.current;
                            const xShift = d === "up" ? "25%" : "-25%";
                            return {
                              // Stay fully visible during squeeze + most of the flight, fade only at end
                              opacity: [1, 1, 1, 0],
                              scaleX: [1, 0.5, 0.5, 0.5],
                              x: ["0%", xShift, xShift, xShift],
                              y: d === "up" ? [0, 0, -500, -700] : [0, 0, 500, 700],
                              transition: {
                                duration: 0.7,
                                times: [0, 0.3, 0.75, 1],
                                ease: [0.4, 0, 0.2, 1],
                              },
                            };
                          }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          style={{
                            border: "2px solid #d4af37",
                            padding: "20px 10px",
                            borderRadius: "12px",
                            backgroundColor: "rgba(255,255,255,0.05)",
                            boxShadow: "0 0 12px rgba(212, 175, 55, 0.15)",
                            textAlign: "center",
                          }}
                        >
                          <h2 style={{
                            fontWeight: 700,
                            color: "#fdf8e6",
                            fontSize: "1.2rem",
                            margin: "0 0 10px 0",
                            lineHeight: 1.4,
                            wordBreak: "break-word",
                          }}>
                            {post.title || post.content}
                          </h2>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (post.username && post.username !== "unknown") {
                                  setProfilePopup({ username: post.username, x: e.clientX, y: e.clientY });
                                }
                              }}
                              style={{ fontSize: "14px", color: "#d4af37", fontStyle: "italic", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(212, 175, 55, 0.4)", textUnderlineOffset: "3px" }}
                            >
                              — {post.username || "unknown"}
                              {getDonorStatus(post.username || "")?.tier && (
                                <DonorBadge tier={getDonorStatus(post.username || "")!.tier} size="small" />
                              )}
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
                        top: 0, left: 0, right: 0, bottom: 0,
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
                          style={{ fontSize: "6rem", lineHeight: 1, filter: "drop-shadow(0 0 30px rgba(0,0,0,0.6))" }}
                        >
                          {swipeEmoji === "down" ? "\uD83D\uDD25" : "\uD83D\uDE4F"}
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Streak popup — 10 consecutive same-direction votes */}
                  <AnimatePresence>
                    {showStreakPopup && (
                      <motion.div
                        key="streak-popup"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.3 }}
                        style={{
                          position: "absolute",
                          top: 0, left: 0, right: 0, bottom: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 20,
                          background: "rgba(0,0,0,0.95)",
                          border: "2px solid #d4af37",
                          borderRadius: "12px",
                          padding: "1rem",
                          textAlign: "center",
                        }}
                      >
                        <p style={{
                          color: showStreakPopup === "up" ? "#8ab47a" : "#c85a4a",
                          fontFamily: "'Cinzel', serif",
                          fontSize: "1rem",
                          fontWeight: 700,
                          margin: "0 0 14px 0",
                          lineHeight: 1.4,
                        }}>
                          {showStreakPopup === "up"
                            ? "Do you just want to upvote every single commandment?"
                            : "Do you just want to downvote every single commandment?"}
                        </p>
                        <div style={{ display: "flex", gap: "12px" }}>
                          <button
                            onClick={() => { const dir = showStreakPopup!; setShowStreakPopup(null); handleBulkVote(dir); }}
                            style={{
                              fontFamily: "'Cinzel', serif",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              color: "#fdf8e6",
                              backgroundColor: showStreakPopup === "up" ? "#5a8a4a" : "#8a3a2a",
                              border: `2px solid ${showStreakPopup === "up" ? "#8ab47a" : "#c85a4a"}`,
                              borderRadius: "8px",
                              padding: "8px 20px",
                              cursor: "pointer",
                            }}
                          >
                            {showStreakPopup === "up" ? "Bless All" : "Banish All"}
                          </button>
                          <button
                            onClick={() => { setShowStreakPopup(null); voteStreakRef.current = { direction: showStreakPopup!, count: 0 }; }}
                            style={{
                              fontFamily: "'Cinzel', serif",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              color: "#fdf8e6",
                              backgroundColor: "rgba(255,255,255,0.1)",
                              border: "2px solid rgba(255,255,255,0.3)",
                              borderRadius: "8px",
                              padding: "8px 20px",
                              cursor: "pointer",
                            }}
                          >
                            No
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* No more cards — cooldown timer */}
                  {!swipeCurrentPostId && !showGuestLoginPrompt && (
                    <div style={{ textAlign: "center", padding: "1.5rem 0.5rem" }}>
                      <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.1rem", margin: "0 0 8px 0", fontWeight: 700 }}>
                        You've judged all commandments!
                      </p>
                      {cooldownEnd && cooldownRemaining > 0 ? (
                        <>
                          <p className={cooldownPulse ? "cooldown-pulse" : ""} style={{
                            color: "#fdf8e6",
                            fontFamily: "'Cinzel', serif",
                            fontSize: "2rem",
                            fontWeight: 900,
                            margin: "12px 0",
                            textShadow: "0 0 12px rgba(212, 175, 55, 0.4)",
                          }}>
                            {formatTime(cooldownRemaining)}
                          </p>
                          <p style={{ color: "#c8b070", fontSize: "0.85rem", margin: "0 0 6px 0", fontFamily: "'Cinzel', serif", lineHeight: 1.5 }}>
                            Voting reopens soon. In the meantime...
                          </p>
                          <p style={{ color: "#d4af37", fontSize: "0.9rem", margin: "8px 0", fontFamily: "'Cinzel', serif", fontWeight: 600 }}>
                            Declare a commandment of your own!
                          </p>
                          <button
                            onClick={() => handleMobileTabChange("declare")}
                            style={{
                              fontFamily: "'Cinzel', serif",
                              fontSize: "0.95rem",
                              fontWeight: 700,
                              color: "#fdf8e6",
                              backgroundColor: "#b79b3d",
                              border: "2px solid #d4af37",
                              borderRadius: "10px",
                              padding: "12px 24px",
                              cursor: "pointer",
                              boxShadow: "0 0 12px rgba(212, 175, 55, 0.25)",
                              marginBottom: "12px",
                            }}
                          >
                            Declare
                          </button>
                          <p style={{ color: "#888", fontSize: "0.8rem", margin: "8px 0 0 0", fontStyle: "italic" }}>
                            Or perhaps... go touch some grass.
                          </p>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setPostsRefreshTrigger(t => t + 1)}
                            style={{
                              fontFamily: "'Cinzel', serif",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              color: "#d4af37",
                              backgroundColor: "transparent",
                              border: "2px solid #d4af37",
                              borderRadius: "10px",
                              padding: "10px 20px",
                              cursor: "pointer",
                              boxShadow: "0 0 10px rgba(212, 175, 55, 0.15)",
                              marginBottom: "8px",
                            }}
                          >
                            Check for new commandments
                          </button>
                          <p style={{ color: "#888", fontSize: "13px", margin: 0 }}>
                            Or submit a new one or switch tabs.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom row: Downvote button + Demon — full width (hidden during cooldown) */}
                {swipeCurrentPostId && (
                <div style={{
                  display: "flex",
                  flexDirection: "row",
                  width: "100%",
                  flex: 1,
                  minHeight: 0,
                }}>
                  <button
                    onClick={() => !showGuestLoginPrompt && handleSwipeVote("down")}
                    disabled={showGuestLoginPrompt}
                    style={{
                      flex: "1 1 50%",
                      minWidth: 0,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      overflow: "hidden",
                      background: "linear-gradient(180deg, rgba(200, 90, 74, 0.25) 0%, rgba(138, 58, 42, 0.15) 100%)",
                      border: "2px solid rgba(200, 90, 74, 0.5)",
                      borderRadius: "10px",
                      cursor: showGuestLoginPrompt ? "default" : "pointer",
                      opacity: showGuestLoginPrompt ? 0.3 : 1,
                      transition: "all 0.15s ease",
                      boxShadow: "0 0 10px rgba(200, 90, 74, 0.2)",
                    }}
                    onMouseDown={(e) => { if (!showGuestLoginPrompt) (e.currentTarget as HTMLElement).style.transform = "scale(0.94)"; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                    onTouchStart={(e) => { if (!showGuestLoginPrompt) (e.currentTarget as HTMLElement).style.transform = "scale(0.94)"; }}
                    onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                  >
                    <span style={{ fontSize: "clamp(0.7rem, 2vh, 1.4rem)", fontFamily: "'Cinzel', serif", fontWeight: 700, color: "#c85a4a", letterSpacing: "0.08em" }}>Downvote</span>
                    <span style={{ fontSize: "clamp(3rem, 12vh, 10rem)", lineHeight: 0.7, fontFamily: "monospace", color: "#c85a4a" }}>↓</span>
                  </button>
                  <div style={{ flex: "1 1 50%", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible", position: "relative" }}>
                    <img src="/demon.png" alt="Demon" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 14px rgba(200, 90, 74, 0.6))" }} />
                    <AnimatePresence>
                      {speechBubble?.type === "demon" && (
                        <motion.div
                          className="speech-bubble speech-bubble-demon"
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          transition={{ duration: 0.25 }}
                        >
                          {speechBubble.text}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                )}

                </>
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
                    onChange={(e) => setNewCommandment(e.target.value.slice(0, 80))}
                    maxLength={80}
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
                      color: newCommandment.length >= 65 ? "#e07050" : "#999",
                    }}>
                      {newCommandment.length}/80
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
            {/* ===== DESKTOP CONTENT (tab-based) ===== */}

            {/* VOTE TAB */}
            {mobileTab === "swipe" && (
              <>
                {/* Empty state */}
                {posts.length === 0 && (
                  <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                    <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.4rem", margin: "0 0 12px 0" }}>
                      The tablets are empty.
                    </p>
                    <p style={{ color: "#c8b070", fontSize: "1rem", margin: "0 0 8px 0", fontFamily: "'Cinzel', serif" }}>
                      Be the first to inscribe a commandment and define the morals for humanity.
                    </p>
                  </div>
                )}

                {posts.length > 0 && (
                  <>
                    {/* Desktop bulk vote emoji flood */}
                    {bulkVoteAnim ? (
                      <div style={{
                        position: "relative",
                        width: "100%",
                        minHeight: "400px",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.92)",
                        borderRadius: "12px",
                        border: "2px solid #d4af37",
                      }}>
                        {bulkEmojiPositions.current.slice(0, bulkVoteAnim.emojiCount).map((pos, i) => (
                          <motion.span
                            key={i}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: pos.delay }}
                            style={{
                              position: "absolute",
                              left: `${pos.x}%`,
                              top: `${pos.y}%`,
                              fontSize: `${pos.size + 4}px`,
                              lineHeight: 1,
                              pointerEvents: "none",
                              filter: "drop-shadow(0 0 4px rgba(0,0,0,0.5))",
                            }}
                          >
                            {bulkVoteAnim.type === "up" ? "\uD83D\uDE4F" : "\uD83D\uDD25"}
                          </motion.span>
                        ))}
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: bulkVoteAnim.emojiCount <= 20 ? 1 : 0 }}
                          transition={{ duration: 0.6 }}
                          style={{ textAlign: "center", padding: "2rem", zIndex: 1 }}
                        >
                          <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.4rem", fontWeight: 700, margin: "0 0 8px 0" }}>
                            You've judged all commandments!
                          </p>
                          <p style={{ color: "#c8b070", fontFamily: "'Cinzel', serif", fontSize: "1rem", margin: "0 0 8px 0" }}>
                            {bulkVoteAnim.type === "up"
                              ? "The heavens rejoice at your mercy."
                              : "The abyss welcomes your wrath."}
                          </p>
                          {cooldownEnd && cooldownRemaining > 0 ? (
                            <>
                              <p className={cooldownPulse ? "cooldown-pulse" : ""} style={{
                                color: "#fdf8e6",
                                fontFamily: "'Cinzel', serif",
                                fontSize: "2.5rem",
                                fontWeight: 900,
                                margin: "16px 0",
                                textShadow: "0 0 14px rgba(212, 175, 55, 0.4)",
                              }}>
                                {formatTime(cooldownRemaining)}
                              </p>
                              <p style={{ color: "#c8b070", fontSize: "1rem", margin: "0 0 8px 0", fontFamily: "'Cinzel', serif" }}>
                                Voting reopens soon. In the meantime...
                              </p>
                            </>
                          ) : (
                            <p style={{ color: "#c8b070", fontSize: "1rem", margin: "10px 0", fontFamily: "'Cinzel', serif" }}>
                              Declare a commandment of your own!
                            </p>
                          )}
                          <button
                            onClick={() => handleMobileTabChange("declare")}
                            style={{
                              fontFamily: "'Cinzel', serif",
                              fontSize: "1.05rem",
                              fontWeight: 700,
                              color: "#fdf8e6",
                              backgroundColor: "#b79b3d",
                              border: "2px solid #d4af37",
                              borderRadius: "10px",
                              padding: "14px 32px",
                              cursor: "pointer",
                              boxShadow: "0 0 12px rgba(212, 175, 55, 0.25)",
                              marginBottom: "14px",
                            }}
                          >
                            Declare
                          </button>
                          <p style={{ color: "#888", fontSize: "0.9rem", margin: "10px 0 0 0", fontStyle: "italic" }}>
                            Or perhaps... go touch some grass.
                          </p>
                        </motion.div>
                      </div>
                    ) : (
                    <>
                    {visibleSlots.length === 0 && posts.length > 0 && !showGuestLoginPrompt && (
                      <div style={{
                        textAlign: "center",
                        padding: "2.5rem 1.5rem",
                        width: "100%",
                        boxSizing: "border-box",
                        border: "2px solid #d4af37",
                        borderRadius: "12px",
                        backgroundColor: "rgba(255,255,255,0.03)",
                      }}>
                        <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.4rem", margin: "0 0 10px 0", fontWeight: 700 }}>
                          You've judged all commandments!
                        </p>
                        {cooldownEnd && cooldownRemaining > 0 ? (
                          <>
                            <p className={cooldownPulse ? "cooldown-pulse" : ""} style={{
                              color: "#fdf8e6",
                              fontFamily: "'Cinzel', serif",
                              fontSize: "2.5rem",
                              fontWeight: 900,
                              margin: "16px 0",
                              textShadow: "0 0 14px rgba(212, 175, 55, 0.4)",
                            }}>
                              {formatTime(cooldownRemaining)}
                            </p>
                            <p style={{ color: "#c8b070", fontSize: "1rem", margin: "0 0 8px 0", fontFamily: "'Cinzel', serif", lineHeight: 1.6 }}>
                              Voting reopens soon. In the meantime...
                            </p>
                            <p style={{ color: "#d4af37", fontSize: "1.05rem", margin: "10px 0", fontFamily: "'Cinzel', serif", fontWeight: 600 }}>
                              Declare a commandment of your own!
                            </p>
                            <button
                              onClick={() => handleMobileTabChange("declare")}
                              style={{
                                fontFamily: "'Cinzel', serif",
                                fontSize: "1.05rem",
                                fontWeight: 700,
                                color: "#fdf8e6",
                                backgroundColor: "#b79b3d",
                                border: "2px solid #d4af37",
                                borderRadius: "10px",
                                padding: "14px 32px",
                                cursor: "pointer",
                                boxShadow: "0 0 12px rgba(212, 175, 55, 0.25)",
                                marginBottom: "14px",
                              }}
                            >
                              Declare
                            </button>
                            <p style={{ color: "#888", fontSize: "0.9rem", margin: "10px 0 0 0", fontStyle: "italic" }}>
                              Or perhaps... go touch some grass.
                            </p>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setPostsRefreshTrigger(t => t + 1)}
                              style={{
                                fontFamily: "'Cinzel', serif",
                                fontSize: "0.95rem",
                                fontWeight: 700,
                                color: "#d4af37",
                                backgroundColor: "transparent",
                                border: "2px solid #d4af37",
                                borderRadius: "10px",
                                padding: "12px 24px",
                                cursor: "pointer",
                                boxShadow: "0 0 10px rgba(212, 175, 55, 0.15)",
                                marginBottom: "10px",
                              }}
                            >
                              Check for new commandments
                            </button>
                            <p style={{ color: "#888", fontSize: "13px", margin: 0 }}>
                              Or switch to the Declare tab to submit a new one.
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {/* Desktop guest login prompt */}
                    {(guestAtLimit || (!user && showGuestLoginPrompt)) && (
                      <div style={{
                        textAlign: "center",
                        padding: "2.5rem 1rem",
                        border: "2px solid #d4af37",
                        borderRadius: "12px",
                        backgroundColor: "rgba(212, 175, 55, 0.05)",
                        boxShadow: "0 0 20px rgba(212, 175, 55, 0.15)",
                        marginBottom: "1rem",
                      }}>
                        <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.4rem", margin: "0 0 12px 0", fontWeight: 700 }}>
                          Create an account to keep voting!
                        </p>
                        <p style={{ color: "#c8b070", fontSize: "1rem", margin: "0 0 24px 0", fontFamily: "'Cinzel', serif" }}>
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

                    {!guestAtLimit && !showGuestLoginPrompt && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", width: "100%" }}>
                      {visibleSlots.map((slot) => {
                        const post = getPost(slot.postId);
                        if (!post) return null;
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
                    </div>}

                    {/* Desktop streak popup — 10 consecutive same-direction votes */}
                    <AnimatePresence>
                      {showStreakPopup && (
                        <motion.div
                          key="desktop-streak-popup"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.3 }}
                          style={{
                            position: "fixed",
                            top: 0, left: 0, right: 0, bottom: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 1000,
                            background: "rgba(0,0,0,0.92)",
                          }}
                          onClick={() => { setShowStreakPopup(null); voteStreakRef.current = { direction: showStreakPopup!, count: 0 }; }}
                        >
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              background: "rgba(20, 15, 5, 0.95)",
                              border: "2px solid #d4af37",
                              borderRadius: "16px",
                              padding: "2rem 3rem",
                              textAlign: "center",
                              boxShadow: "0 0 30px rgba(212, 175, 55, 0.3)",
                              maxWidth: "500px",
                            }}
                          >
                            <p style={{
                              color: showStreakPopup === "up" ? "#8ab47a" : "#c85a4a",
                              fontFamily: "'Cinzel', serif",
                              fontSize: "1.2rem",
                              fontWeight: 700,
                              margin: "0 0 20px 0",
                              lineHeight: 1.4,
                            }}>
                              {showStreakPopup === "up"
                                ? "Do you just want to upvote every single commandment?"
                                : "Do you just want to downvote every single commandment?"}
                            </p>
                            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
                              <button
                                onClick={() => { const dir = showStreakPopup!; setShowStreakPopup(null); handleBulkVote(dir); }}
                                style={{
                                  fontFamily: "'Cinzel', serif",
                                  fontSize: "1rem",
                                  fontWeight: 700,
                                  color: "#fdf8e6",
                                  backgroundColor: showStreakPopup === "up" ? "#5a8a4a" : "#8a3a2a",
                                  border: `2px solid ${showStreakPopup === "up" ? "#8ab47a" : "#c85a4a"}`,
                                  borderRadius: "10px",
                                  padding: "12px 28px",
                                  cursor: "pointer",
                                }}
                              >
                                {showStreakPopup === "up" ? "Bless All" : "Banish All"}
                              </button>
                              <button
                                onClick={() => { setShowStreakPopup(null); voteStreakRef.current = { direction: showStreakPopup!, count: 0 }; }}
                                style={{
                                  fontFamily: "'Cinzel', serif",
                                  fontSize: "1rem",
                                  fontWeight: 700,
                                  color: "#fdf8e6",
                                  backgroundColor: "rgba(255,255,255,0.1)",
                                  border: "2px solid rgba(255,255,255,0.3)",
                                  borderRadius: "10px",
                                  padding: "12px 28px",
                                  cursor: "pointer",
                                }}
                              >
                                No
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                  )}
                  </>
                )}
              </>
            )}

            {/* COMMENTS TAB */}
            {mobileTab === "comments" && (
              <div
                ref={mobileScrollRef}
                onScroll={handleMobileScroll}
                style={{
                  overflowY: "auto",
                  overflowX: "hidden",
                  padding: "0 2px",
                  maxHeight: "60vh",
                }}
              >
                {mobileVisiblePosts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem 0" }}>
                    <p style={{ color: "#d4af37", fontFamily: "'Cinzel', serif", fontSize: "1.2rem" }}>
                      The tablets are empty.
                    </p>
                  </div>
                ) : (
                  mobileVisiblePosts.map((post) => (
                    <div
                      key={String(post.id)}
                      style={{
                        border: "1px solid #555",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        marginBottom: "10px",
                        backgroundColor: "rgba(255,255,255,0.05)",
                      }}
                    >
                      <h3 style={{
                        fontWeight: 700,
                        color: "#fdf8e6",
                        fontSize: "1.1rem",
                        margin: "0 0 8px 0",
                        lineHeight: 1.3,
                        wordBreak: "break-word",
                      }}>
                        {post.title || post.content}
                      </h3>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}>
                        <span style={{ fontSize: "14px", color: "#d1b97b", fontWeight: 600 }}>
                          {post.votes ?? 0} votes
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            if (post.username && post.username !== "unknown") {
                              setProfilePopup({ username: post.username, x: e.clientX, y: e.clientY });
                            }
                          }}
                          style={{ fontSize: "14px", color: "#888", fontStyle: "italic", cursor: "pointer" }}
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
                            fontSize: "14px",
                            color: "#d4af37",
                            textDecoration: "none",
                            padding: "4px 10px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(212, 175, 55, 0.12)",
                            border: "1px solid rgba(212, 175, 55, 0.3)",
                            fontWeight: 600,
                            fontFamily: "'Cinzel', serif",
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
                  ))
                )}
                {mobileVisibleCount < mobileFilteredPosts.length && (
                  <div style={{ textAlign: "center", padding: "12px 0", color: "#888", fontSize: "13px" }}>
                    Scroll for more...
                  </div>
                )}
                {mobileVisibleCount >= mobileFilteredPosts.length && mobileFilteredPosts.length > 0 && (
                  <div style={{ textAlign: "center", padding: "12px 0", color: "#666", fontSize: "13px", fontStyle: "italic" }}>
                    All {mobileFilteredPosts.length} commandments shown
                  </div>
                )}
              </div>
            )}

            {/* DECLARE TAB */}
            {mobileTab === "declare" && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem 2rem",
              }}>
                <h2 style={{
                  color: "#d4af37",
                  fontFamily: "'Cinzel', serif",
                  fontSize: "2rem",
                  fontWeight: 700,
                  textAlign: "center",
                  marginBottom: "1.5rem",
                  letterSpacing: "0.06em",
                  textShadow: "0 0 18px rgba(212, 175, 55, 0.35)",
                  lineHeight: 1.3,
                }}>
                  Declare Your Commandment
                </h2>
                <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: "600px" }}>
                  <input
                    type="text"
                    placeholder="Enter a new commandment..."
                    value={newCommandment}
                    onChange={(e) => setNewCommandment(e.target.value.slice(0, 80))}
                    maxLength={80}
                    style={{
                      width: "100%",
                      border: "2px solid #d4af37",
                      borderRadius: "10px",
                      padding: "16px 18px",
                      fontSize: "1.15rem",
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
                      color: newCommandment.length >= 65 ? "#e07050" : "#999",
                    }}>
                      {newCommandment.length}/80
                    </span>
                    <button
                      type="submit"
                      style={{
                        backgroundColor: "#b79b3d",
                        color: "#fdf8e6",
                        padding: "14px 40px",
                        borderRadius: "10px",
                        fontSize: "1.1rem",
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

            {/* Desktop Progress indicator */}
            {posts.length > 0 && mobileTab !== "declare" && (
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
          memberSince={getMemberSince(profilePopup.username)}
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
              You may only inscribe 1 commandment per day. Return tomorrow to share new wisdom with the collective.
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
            style={{ maxWidth: "520px", width: "92%", padding: isMobile ? "1rem" : "2rem", backgroundColor: "#1a1a1a", maxHeight: "90vh", overflowY: "auto" }}
          >
            <h2 style={{ color: "#d4af37", marginBottom: "0.5rem", fontSize: isMobile ? "1.2rem" : "1.5rem" }}>
              Flexible Morals Tee
            </h2>
            <p style={{ marginBottom: isMobile ? "0.5rem" : "1rem", color: "#aaa", fontSize: isMobile ? "0.8rem" : "0.9rem" }}>
              Coming Soon! Each month's top commandments on the back.
            </p>
            <img
              src="/merch_tee_back.png"
              alt="Flexible Morals Tee - Back with Commandments"
              style={{ width: "100%", borderRadius: "8px", display: "block", margin: "0 auto" }}
            />
            <img
              src="/merch_tee_2.png"
              alt="Flexible Morals Tee - Modeled Front and Back"
              style={{ width: "100%", borderRadius: "8px", display: "block", margin: isMobile ? "0.5rem auto 0" : "1rem auto 0" }}
            />
            <p style={{ marginTop: isMobile ? "0.5rem" : "1rem", fontSize: isMobile ? "0.75rem" : "0.85rem", color: "#d4af37", fontFamily: "'Cinzel', serif", fontWeight: 600 }}>
              Shirts updated with our most recent morals!
            </p>
            <button onClick={() => setShowMerchPopup(false)} className="popup-close" style={{ marginTop: isMobile ? "0.5rem" : "1rem" }}>
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
              Flexible Morals was founded to create a collaborative, ad-free, bot-free space where people can actively shape a modern moral framework inspired by timeless principles. Readers and future disciples are invited to participate in the <strong style={{ color: "#d4af37", backgroundColor: "rgba(0, 0, 0, 0.7)", padding: "2px 6px", borderRadius: "3px" }}>World's First Democratic Religion</strong> by sharing opinions, helping guide daily commandments, and voting monthly to determine the top ten moral standards.
            </p>
            <p style={{ marginTop: isMobile ? "0.6rem" : "1rem" }}>
              The mission is to foster thoughtful dialogue across cultures and generations, sustain the platform through optional support, and build a movement focused not on profit, but on making a positive impact—supporting meaningful causes and promoting hope and care for humanity's future.
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
