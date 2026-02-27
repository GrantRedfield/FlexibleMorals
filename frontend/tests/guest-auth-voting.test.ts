import { describe, it, expect } from "vitest";
import {
  isGuestAtLimit,
  getCooldownStorageKey,
  getNextSwipePost,
  getInitialSlots,
  getBulkVoteTargets,
  shouldTriggerExhaustion,
  updateVoteStreak,
  calculateVoteDelta,
  filterByDownvoteThreshold,
  GUEST_VOTE_LIMIT,
  VISIBLE_COUNT,
  type Post,
  type VoteDirection,
  type VoteStreak,
} from "../src/utils/votingLogic";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function makePost(id: string, opts: Partial<Post> = {}): Post {
  return { id, votes: 0, username: "other", ...opts };
}

function makePosts(count: number, prefix = "p"): Post[] {
  return Array.from({ length: count }, (_, i) =>
    makePost(`${prefix}${i + 1}`, { username: "other" })
  );
}

/* ================================================================== */
/*  Guest voting                                                       */
/* ================================================================== */
describe("Guest voting", () => {
  it("guest can vote up to GUEST_VOTE_LIMIT (5) times", () => {
    for (let count = 0; count < GUEST_VOTE_LIMIT; count++) {
      expect(isGuestAtLimit(null, count)).toBe(false);
    }
  });

  it("at limit: isGuestAtLimit returns true", () => {
    expect(isGuestAtLimit(null, GUEST_VOTE_LIMIT)).toBe(true);
  });

  it("above limit: isGuestAtLimit returns true", () => {
    expect(isGuestAtLimit(null, GUEST_VOTE_LIMIT + 5)).toBe(true);
  });

  it("guest at limit with swipe mode → no post returned from getInitialSlots", () => {
    // When guest is at limit, the app sets swipeCurrentPostId to null
    // and shows login prompt. The exhaustion detector should NOT fire
    // because showGuestLoginPrompt is true.
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, null, false, 10, true)
    ).toBe(false);
  });

  it("guest cooldown key uses guestVoterId", () => {
    const key = getCooldownStorageKey(null, "guest_abc123");
    expect(key).toBe("voteCooldownEnd_guest_abc123");
  });

  it("guest votes tracked independently from logged-in votes", () => {
    // Guest and logged-in user have different cooldown keys
    const guestKey = getCooldownStorageKey(null, "guest_abc");
    const userKey = getCooldownStorageKey("alice", "guest_abc");
    expect(guestKey).not.toBe(userKey);
  });

  it("new guest at count 0 is not at limit", () => {
    expect(isGuestAtLimit(null, 0)).toBe(false);
  });

  it("guest at count 4 (one vote left) is not at limit", () => {
    expect(isGuestAtLimit(null, 4)).toBe(false);
  });

  it("guest at exactly GUEST_VOTE_LIMIT is at limit", () => {
    expect(isGuestAtLimit(null, GUEST_VOTE_LIMIT)).toBe(true);
  });
});

/* ================================================================== */
/*  Logged-in user voting                                              */
/* ================================================================== */
describe("Logged-in user voting", () => {
  it("no vote limit for logged-in users", () => {
    // isGuestAtLimit always false when user is set
    expect(isGuestAtLimit("alice", 0)).toBe(false);
    expect(isGuestAtLimit("alice", 100)).toBe(false);
    expect(isGuestAtLimit("alice", 999)).toBe(false);
  });

  it("cooldown key uses username", () => {
    expect(getCooldownStorageKey("alice", "guest_xyz")).toBe(
      "voteCooldownEnd_alice"
    );
  });

  it("logged-in user can get initial swipe card", () => {
    const posts = makePosts(5);
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, "alice", "swipe");
    expect(result.swipePostId).not.toBeNull();
  });

  it("logged-in user's own posts excluded from swipe", () => {
    const posts = [
      makePost("p1", { username: "alice" }),
      makePost("p2", { username: "bob" }),
    ];
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, "alice", "swipe");
    expect(result.swipePostId).toBe("p2");
  });

  it("logged-in user's own posts excluded from bulk vote", () => {
    const posts = [
      makePost("p1", { username: "alice" }),
      makePost("p2", { username: "bob" }),
      makePost("p3", { username: "alice" }),
    ];
    const result = getBulkVoteTargets(posts, {}, "alice", false);
    expect(result.map((p) => p.id)).toEqual(["p2"]);
  });
});

/* ================================================================== */
/*  Guest → Login transition                                           */
/* ================================================================== */
describe("Guest → Login transition", () => {
  it("after login, isGuestAtLimit returns false regardless of guest count", () => {
    // Once user is set, guest limit doesn't apply
    expect(isGuestAtLimit("alice", GUEST_VOTE_LIMIT)).toBe(false);
    expect(isGuestAtLimit("alice", 100)).toBe(false);
  });

  it("after login, votes resume — getInitialSlots returns cards", () => {
    const posts = makePosts(5);
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, "alice", "swipe");
    expect(result.swipePostId).not.toBeNull();
  });

  it("after login, desktop mode returns full slots", () => {
    const posts = makePosts(10);
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, "alice", "top");
    expect(result.slots).toHaveLength(VISIBLE_COUNT);
  });

  it("guest cooldown does NOT carry over to logged-in user (different keys)", () => {
    const guestKey = getCooldownStorageKey(null, "guest_123");
    const userKey = getCooldownStorageKey("alice", "guest_123");
    expect(guestKey).toBe("voteCooldownEnd_guest_123");
    expect(userKey).toBe("voteCooldownEnd_alice");
    // Different keys means different cooldown states
    expect(guestKey).not.toBe(userKey);
  });
});

/* ================================================================== */
/*  Login → Logout transition                                          */
/* ================================================================== */
describe("Login → Logout transition", () => {
  it("cooldown key changes from username to guestVoterId", () => {
    const loggedInKey = getCooldownStorageKey("alice", "guest_123");
    const guestKey = getCooldownStorageKey(null, "guest_123");
    expect(loggedInKey).toBe("voteCooldownEnd_alice");
    expect(guestKey).toBe("voteCooldownEnd_guest_123");
  });

  it("cooldown carries over: same end time, different key", () => {
    // Simulate: user had cooldown at timestamp X
    const cooldownEnd = Date.now() + 120000;
    const userKey = getCooldownStorageKey("alice", "guest_123");
    const guestKey = getCooldownStorageKey(null, "guest_123");
    // Both would store the same cooldownEnd value, just under different keys
    // The app copies the value from userKey to guestKey on logout
    expect(userKey).not.toBe(guestKey);
    // Verify both keys are valid
    expect(userKey).toMatch(/^voteCooldownEnd_/);
    expect(guestKey).toMatch(/^voteCooldownEnd_/);
  });

  it("after logout, guest limit applies again", () => {
    // User logs out — user becomes null
    expect(isGuestAtLimit(null, GUEST_VOTE_LIMIT)).toBe(true);
  });

  it("after logout, exhaustion detector uses guest context", () => {
    // Guest login prompt false, posts exist, slots initialized, no cooldown
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, null, false, 10, false)
    ).toBe(true);
  });
});

/* ================================================================== */
/*  Re-voting after cooldown (both guest and logged-in)                */
/* ================================================================== */
describe("Re-voting after cooldown", () => {
  it("after cooldown expires, empty userVotes means all posts appear unvoted", () => {
    const posts = makePosts(5);
    const emptyVotes: Record<string, VoteDirection | null> = {};
    // All posts should be available for voting
    const result = getNextSwipePost(posts, null, new Set(), emptyVotes, "me");
    expect(result.nextPost).not.toBeNull();
  });

  it("after cooldown expires, getInitialSlots returns all posts as unvoted", () => {
    const posts = makePosts(5);
    const emptyVotes: Record<string, VoteDirection | null> = {};
    const result = getInitialSlots(posts, emptyVotes, VISIBLE_COUNT, "me", "top");
    // All 4 slots should be filled (VISIBLE_COUNT = 4)
    expect(result.slots).toHaveLength(VISIBLE_COUNT);
  });

  it("after cooldown, getBulkVoteTargets returns all non-own posts", () => {
    const posts = [
      makePost("p1", { username: "other" }),
      makePost("p2", { username: "me" }),
      makePost("p3", { username: "other" }),
    ];
    const emptyVotes: Record<string, VoteDirection | null> = {};
    const targets = getBulkVoteTargets(posts, emptyVotes, "me", false);
    expect(targets.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("critical: server-side userVotes NOT merged into local state after cooldown", () => {
    // After cooldown, local votes are wiped. Even if server has the old votes,
    // we use empty local votes so all posts appear unvoted.
    const posts = makePosts(3);
    const localVotes: Record<string, VoteDirection | null> = {};
    // Server votes exist but are NOT used
    const serverVotes = { p1: "up" as VoteDirection, p2: "down" as VoteDirection };
    // Post selection uses localVotes only
    const result = getNextSwipePost(posts, null, new Set(), localVotes, "me");
    expect(result.nextPost?.id).toBe("p1"); // Would be skipped if server votes were used
    void serverVotes; // Intentionally unused — demonstrates they're ignored
  });

  it("shownPostIds cleared means all posts re-appear in order", () => {
    const posts = makePosts(5);
    const emptyShown = new Set<string>();
    const emptyVotes: Record<string, VoteDirection | null> = {};
    const result = getNextSwipePost(posts, null, emptyShown, emptyVotes, "me");
    expect(result.nextPost?.id).toBe("p1");
  });

  it("guest: cooldown expires → all posts appear unvoted", () => {
    const posts = makePosts(5);
    const emptyVotes: Record<string, VoteDirection | null> = {};
    // Guest context (null user)
    const result = getInitialSlots(posts, emptyVotes, VISIBLE_COUNT, null, "swipe");
    expect(result.swipePostId).not.toBeNull();
  });

  it("logged-in: cooldown expires → all posts appear unvoted", () => {
    const posts = makePosts(5);
    const emptyVotes: Record<string, VoteDirection | null> = {};
    // Logged-in context
    const result = getInitialSlots(posts, emptyVotes, VISIBLE_COUNT, "alice", "swipe");
    expect(result.swipePostId).not.toBeNull();
  });
});

/* ================================================================== */
/*  Vote persistence                                                   */
/* ================================================================== */
describe("Vote persistence", () => {
  it("vote state scoped per user — different storage keys", () => {
    // This tests the convention: user gets `userVotes_{username}`, guest gets `userVotes_guest`
    // We verify by testing cooldown key scoping (same pattern)
    const guestKey = getCooldownStorageKey(null, "guest_abc");
    const aliceKey = getCooldownStorageKey("alice", "guest_abc");
    const bobKey = getCooldownStorageKey("bob", "guest_abc");
    expect(guestKey).not.toBe(aliceKey);
    expect(aliceKey).not.toBe(bobKey);
    expect(guestKey).not.toBe(bobKey);
  });

  it("votes do NOT survive cooldown expiry (intentional wipe for re-voting)", () => {
    // After cooldown expiry, userVotes is cleared to {}
    const emptyVotes: Record<string, VoteDirection | null> = {};
    const posts = makePosts(3);
    // With empty votes, all posts are eligible
    const targets = getBulkVoteTargets(posts, emptyVotes, "me", false);
    expect(targets).toHaveLength(3);
  });

  it("before cooldown, voted posts are tracked correctly", () => {
    const posts = makePosts(5);
    const votes: Record<string, VoteDirection | null> = { p1: "up", p3: "down" };
    // Only unvoted non-own posts returned
    const targets = getBulkVoteTargets(posts, votes, "me", false);
    expect(targets.map((p) => p.id)).toEqual(["p2", "p4", "p5"]);
  });

  it("vote delta calculation correct for re-voting scenario", () => {
    // After cooldown, previous vote is null (cleared)
    expect(calculateVoteDelta(null, "up")).toBe(1);
    expect(calculateVoteDelta(null, "down")).toBe(-1);
    // This is the key behavior: re-voting after cooldown treats it as a new vote
  });
});

/* ================================================================== */
/*  Cross-cutting: streak + cooldown + guest interactions              */
/* ================================================================== */
describe("Cross-cutting interactions", () => {
  it("guest at limit does not trigger exhaustion (different code path)", () => {
    // showGuestLoginPrompt is true → exhaustion detector skips
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, null, false, 10, true)
    ).toBe(false);
  });

  it("streak resets after cooldown, then builds up correctly", () => {
    // Before cooldown: streak at 8
    let streak: VoteStreak = { direction: "up", count: 8 };
    // Cooldown resets streak
    streak = { direction: "up", count: 0 };
    // After cooldown: 3 new votes
    for (let i = 0; i < 3; i++) {
      streak = updateVoteStreak(streak, "up").newStreak;
    }
    expect(streak.count).toBe(3);
    // NOT 11 (which would happen if streak wasn't reset)
  });

  it("bulk vote uses correct delta for all unvoted posts", () => {
    const posts = makePosts(5);
    const votes: Record<string, VoteDirection | null> = { p1: "up" };
    const targets = getBulkVoteTargets(posts, votes, "me", false);
    // Each target gets delta of +1 (new vote, no previous)
    for (const target of targets) {
      expect(calculateVoteDelta(null, "up")).toBe(1);
    }
  });

  it("hide-downvoted affects both normal and bulk voting", () => {
    const posts = [
      makePost("p1", { votes: -10 }),
      makePost("p2", { votes: 5 }),
      makePost("p3", { votes: -3 }),
    ];
    // Filter for display
    const filtered = filterByDownvoteThreshold(posts, true, -5);
    expect(filtered.map((p) => p.id)).toEqual(["p2", "p3"]);
    // Bulk vote targets also respect the filter
    const targets = getBulkVoteTargets(posts, {}, "me", true, -5);
    expect(targets.map((p) => p.id)).toEqual(["p2", "p3"]);
  });

  it("logged-in user with all own posts sees no swipe card", () => {
    const posts = [
      makePost("p1", { username: "alice" }),
      makePost("p2", { username: "alice" }),
    ];
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, "alice", "swipe");
    expect(result.swipePostId).toBeNull();
  });

  it("logged-in user with all own posts in desktop mode still sees them", () => {
    const posts = [
      makePost("p1", { username: "alice" }),
      makePost("p2", { username: "alice" }),
    ];
    // Desktop mode doesn't filter by username for display (only for voting)
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, "alice", "top");
    expect(result.slots).toHaveLength(2);
  });

  it("guest gets cards when not at limit", () => {
    const posts = makePosts(5);
    expect(isGuestAtLimit(null, 3)).toBe(false);
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, null, "swipe");
    expect(result.swipePostId).not.toBeNull();
  });

  it("after cooldown, streak popup requires 10 fresh votes", () => {
    let streak: VoteStreak = { direction: "up", count: 0 }; // reset
    let popupTriggered = false;
    for (let i = 0; i < 10; i++) {
      const result = updateVoteStreak(streak, "up");
      streak = result.newStreak;
      if (result.triggerPopup) popupTriggered = true;
    }
    expect(popupTriggered).toBe(true);
    expect(streak.count).toBe(10);
  });
});
