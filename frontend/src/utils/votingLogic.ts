/**
 * Pure voting logic extracted from Vote.tsx for testability.
 * These functions contain NO React state, refs, or side effects.
 */

export interface Post {
  id: string | number;
  title?: string;
  content?: string;
  votes?: number;
  createdAt?: string;
  username?: string;
  userVotes?: Record<string, "up" | "down">;
}

export type VoteDirection = "up" | "down";

export interface VoteStreak {
  direction: VoteDirection;
  count: number;
}

export interface VisibleSlot {
  postId: string;
  animState: "visible" | "voted" | "fadingOut" | "fadingIn";
}

export const VISIBLE_COUNT = 4;
export const GUEST_VOTE_LIMIT = 5;
export const DOWNVOTE_THRESHOLD = -5;

/**
 * Get the next unvoted post for desktop 4-card mode.
 * Phase 1: unvoted, not yet shown this cycle, not currently visible
 * Phase 2: unvoted, not currently visible (cycle reset)
 * Returns null when all posts are voted.
 */
export function getNextUnvotedPost(
  sortedPosts: Post[],
  currentVisibleIds: Set<string>,
  shownPostIds: Set<string>,
  userVotes: Record<string, VoteDirection | null>,
  _currentUser?: string | null
): Post | null {
  // Phase 1: unvoted, not yet shown this cycle, not currently visible
  for (const post of sortedPosts) {
    const pid = String(post.id);
    if (!currentVisibleIds.has(pid) && !shownPostIds.has(pid) && !userVotes[pid]) {
      return post;
    }
  }

  // Phase 2: unvoted, not currently visible (cycle reset for unvoted batch)
  const anyUnvotedAvailable = sortedPosts.some(
    (p) => !currentVisibleIds.has(String(p.id)) && !userVotes[String(p.id)]
  );
  if (anyUnvotedAvailable) {
    for (const post of sortedPosts) {
      const pid = String(post.id);
      if (!currentVisibleIds.has(pid) && !userVotes[pid]) {
        return post;
      }
    }
  }

  // All unvoted posts exhausted
  return null;
}

/**
 * Get the next unvoted post for swipe mode.
 * Excludes the current post, user's own posts, and already-voted posts.
 * Returns { nextPost, shouldResetShown } — shouldResetShown means the
 * shown cycle was exhausted and reset.
 */
export function getNextSwipePost(
  sortedPosts: Post[],
  currentPid: string | null,
  shownPostIds: Set<string>,
  userVotes: Record<string, VoteDirection | null>,
  currentUser?: string | null
): { nextPost: Post | null; shouldResetShown: boolean } {
  const currentVisibleIds = new Set(currentPid ? [currentPid] : []);
  let nextPost: Post | null = null;

  // Phase 1: unvoted, not yet shown this cycle, not own
  for (const post of sortedPosts) {
    const pid = String(post.id);
    if (
      !currentVisibleIds.has(pid) &&
      !shownPostIds.has(pid) &&
      !userVotes[pid] &&
      post.username !== currentUser
    ) {
      nextPost = post;
      break;
    }
  }

  if (nextPost) {
    return { nextPost, shouldResetShown: false };
  }

  // Check if any unvoted posts exist at all (not counting current)
  const anyUnvoted = sortedPosts.some(
    (p) =>
      !currentVisibleIds.has(String(p.id)) &&
      !userVotes[String(p.id)] &&
      p.username !== currentUser
  );

  if (anyUnvoted) {
    // Phase 2: unvoted posts exist but all shown this cycle — reset and loop unvoted
    for (const post of sortedPosts) {
      const pid = String(post.id);
      if (
        !currentVisibleIds.has(pid) &&
        !userVotes[pid] &&
        post.username !== currentUser
      ) {
        nextPost = post;
        break;
      }
    }
    return { nextPost, shouldResetShown: true };
  }

  // All posts exhausted — nextPost stays null so cooldown timer triggers
  return { nextPost: null, shouldResetShown: false };
}

/**
 * Calculate the vote count delta when a user votes.
 * Returns +1/-1 for new votes, +2/-2 for direction changes, 0 for same direction.
 */
export function calculateVoteDelta(
  previousVote: VoteDirection | null | undefined,
  newDirection: VoteDirection
): number {
  if (previousVote === newDirection) return 0;
  if (!previousVote) {
    return newDirection === "up" ? 1 : -1;
  }
  // Changing direction: undo previous + apply new
  return newDirection === "up" ? 2 : -2;
}

/**
 * Filter posts below the downvote threshold when toggle is ON.
 */
export function filterByDownvoteThreshold(
  posts: Post[],
  hideDownvoted: boolean,
  threshold: number = DOWNVOTE_THRESHOLD
): Post[] {
  if (!hideDownvoted) return posts;
  return posts.filter((p) => (p.votes ?? 0) > threshold);
}

/**
 * Get unvoted posts eligible for bulk vote.
 * Excludes the current user's own posts.
 * Respects hideDownvoted toggle.
 */
export function getBulkVoteTargets(
  allPosts: Post[],
  userVotes: Record<string, VoteDirection | null>,
  currentUser: string | null | undefined,
  hideDownvoted: boolean,
  threshold: number = DOWNVOTE_THRESHOLD
): Post[] {
  return allPosts.filter(
    (p) =>
      !userVotes[String(p.id)] &&
      p.username !== currentUser &&
      (!hideDownvoted || (p.votes ?? 0) > threshold)
  );
}

/**
 * Determine if all posts are exhausted and cooldown should start.
 * Guards against race conditions (slotsInitialized must be true).
 */
export function shouldTriggerExhaustion(
  sortOption: string,
  swipeCurrentPostId: string | null,
  visibleSlotsLength: number,
  slotsInitialized: boolean,
  cooldownEnd: number | null,
  cooldownTriggered: boolean,
  postsLength: number,
  showGuestLoginPrompt: boolean
): boolean {
  if (postsLength === 0 || showGuestLoginPrompt) return false;
  // Don't trigger until cards have been initialized at least once
  if (!slotsInitialized) return false;
  const allExhausted =
    (sortOption === "swipe" && !swipeCurrentPostId) ||
    (sortOption !== "swipe" && visibleSlotsLength === 0);
  if (allExhausted && !cooldownEnd && !cooldownTriggered) {
    return true;
  }
  return false;
}

/**
 * Update the consecutive vote streak.
 * Returns the new streak state and whether the popup should trigger.
 */
export function updateVoteStreak(
  currentStreak: VoteStreak,
  newDirection: VoteDirection,
  threshold: number = 10
): { newStreak: VoteStreak; triggerPopup: boolean } {
  let newStreak: VoteStreak;
  if (currentStreak.direction === newDirection) {
    newStreak = { direction: newDirection, count: currentStreak.count + 1 };
  } else {
    newStreak = { direction: newDirection, count: 1 };
  }
  return {
    newStreak,
    triggerPopup: newStreak.count === threshold,
  };
}

/**
 * Build the per-account cooldown localStorage key.
 * When currentUser is provided (including null for guest), uses that.
 * When currentUser is undefined, reads from the provided guestVoterId.
 */
export function getCooldownStorageKey(
  currentUser: string | null | undefined,
  guestVoterId: string
): string {
  const identity =
    currentUser !== undefined
      ? currentUser || guestVoterId
      : guestVoterId;
  return `voteCooldownEnd_${identity}`;
}

/**
 * Check if a guest user has hit the vote limit.
 */
export function isGuestAtLimit(
  user: string | null | undefined,
  guestSwipeCount: number,
  limit: number = GUEST_VOTE_LIMIT
): boolean {
  return !user && guestSwipeCount >= limit;
}

/**
 * Compute initial card slots for display.
 * Swipe mode: returns a single unvoted non-own post (or null).
 * Desktop mode: returns up to VISIBLE_COUNT posts, prioritizing unvoted.
 */
export function getInitialSlots(
  sortedPosts: Post[],
  userVotes: Record<string, VoteDirection | null>,
  visibleCount: number,
  currentUser: string | null | undefined,
  sortOption: string
): { slots: VisibleSlot[]; swipePostId: string | null } {
  if (sortOption === "swipe") {
    // First unvoted non-own post
    const firstPost = sortedPosts.find(
      (p) => p.username !== currentUser && !userVotes[String(p.id)]
    );
    if (firstPost) {
      return {
        slots: [],
        swipePostId: String(firstPost.id),
      };
    }
    return { slots: [], swipePostId: null };
  }

  // Desktop: prefer unvoted posts for initial slots; fill remaining with voted posts
  const unvoted = sortedPosts.filter((p) => !userVotes[String(p.id)]);
  const voted = sortedPosts.filter((p) => !!userVotes[String(p.id)]);
  const prioritized = [...unvoted, ...voted];
  const initial = prioritized.slice(0, visibleCount).map((p) => ({
    postId: String(p.id),
    animState: "visible" as const,
  }));
  return { slots: initial, swipePostId: null };
}

/**
 * Compute voted count using both server-side userVotes and local state.
 * Server userVotes survive cooldown; local votes are wiped on cooldown expiry.
 * This ensures the counter always shows the accurate total.
 */
export function getVotedCount(
  posts: Post[],
  localVotes: Record<string, VoteDirection | null>,
  voterId: string
): number {
  let count = 0;
  for (const post of posts) {
    if (post.userVotes?.[voterId] || localVotes[String(post.id)]) {
      count++;
    }
  }
  return count;
}

/**
 * Compute the reverted vote state after a failed API call.
 * Undoes the optimistic delta on the post's vote count and restores the
 * previous vote direction in the local votes map.
 */
export function computeRevertedVoteState(
  posts: Post[],
  postId: string,
  delta: number,
  localVotes: Record<string, VoteDirection | null>,
  previousVote: VoteDirection | null | undefined
): { updatedPosts: Post[]; updatedVotes: Record<string, VoteDirection | null> } {
  const updatedPosts = posts.map((p) => {
    if (String(p.id) !== postId) return p;
    return { ...p, votes: (p.votes ?? 0) - delta };
  });
  const updatedVotes = { ...localVotes };
  if (previousVote) {
    updatedVotes[postId] = previousVote;
  } else {
    delete updatedVotes[postId];
  }
  return { updatedPosts, updatedVotes };
}
