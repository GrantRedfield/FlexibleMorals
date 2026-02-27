import { describe, it, expect } from "vitest";
import {
  getNextUnvotedPost,
  getNextSwipePost,
  calculateVoteDelta,
  filterByDownvoteThreshold,
  getBulkVoteTargets,
  getInitialSlots,
  VISIBLE_COUNT,
  DOWNVOTE_THRESHOLD,
  type Post,
  type VoteDirection,
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
/*  getNextUnvotedPost                                                 */
/* ================================================================== */
describe("getNextUnvotedPost", () => {
  it("returns first unvoted, unseen post", () => {
    const posts = makePosts(3);
    const result = getNextUnvotedPost(posts, new Set(), new Set(), {});
    expect(result).toBe(posts[0]);
  });

  it("skips posts the user already voted on", () => {
    const posts = makePosts(3);
    const votes: Record<string, VoteDirection | null> = { p1: "up" };
    const result = getNextUnvotedPost(posts, new Set(), new Set(), votes);
    expect(result?.id).toBe("p2");
  });

  it("skips posts already in visible slots", () => {
    const posts = makePosts(3);
    const visible = new Set(["p1"]);
    const result = getNextUnvotedPost(posts, visible, new Set(), {});
    expect(result?.id).toBe("p2");
  });

  it("skips posts already shown this cycle", () => {
    const posts = makePosts(3);
    const shown = new Set(["p1", "p2"]);
    const result = getNextUnvotedPost(posts, new Set(), shown, {});
    expect(result?.id).toBe("p3");
  });

  it("returns null when all posts are voted", () => {
    const posts = makePosts(3);
    const votes: Record<string, VoteDirection | null> = { p1: "up", p2: "down", p3: "up" };
    const result = getNextUnvotedPost(posts, new Set(), new Set(), votes);
    expect(result).toBeNull();
  });

  it("with 10 posts and 3 voted, returns first unvoted", () => {
    const posts = makePosts(10);
    const votes: Record<string, VoteDirection | null> = { p1: "up", p2: "down", p3: "up" };
    const result = getNextUnvotedPost(posts, new Set(), new Set(), votes);
    expect(result?.id).toBe("p4");
  });

  it("with all posts shown but some unvoted, resets cycle and returns unvoted", () => {
    const posts = makePosts(3);
    const shown = new Set(["p1", "p2", "p3"]);
    const votes: Record<string, VoteDirection | null> = { p1: "up" };
    // Phase 1 finds nothing (all shown), Phase 2 finds p2 (unvoted, not visible)
    const result = getNextUnvotedPost(posts, new Set(), shown, votes);
    expect(result?.id).toBe("p2");
  });

  it("with mix of voted/unvoted/shown, uses correct priority", () => {
    const posts = makePosts(5);
    const visible = new Set(["p1"]);
    const shown = new Set(["p1", "p2"]);
    const votes: Record<string, VoteDirection | null> = { p3: "up" };
    // Phase 1: not visible, not shown, not voted → p4, p5 candidates. p4 first.
    const result = getNextUnvotedPost(posts, visible, shown, votes);
    expect(result?.id).toBe("p4");
  });

  it("empty post list returns null", () => {
    const result = getNextUnvotedPost([], new Set(), new Set(), {});
    expect(result).toBeNull();
  });

  it("ignores currentUser param (desktop mode doesn't filter by own)", () => {
    const posts = [makePost("p1", { username: "alice" })];
    // currentUser is passed but getNextUnvotedPost doesn't filter by username
    const result = getNextUnvotedPost(posts, new Set(), new Set(), {}, "alice");
    expect(result?.id).toBe("p1");
  });
});

/* ================================================================== */
/*  getNextSwipePost                                                   */
/* ================================================================== */
describe("getNextSwipePost", () => {
  it("returns next unvoted, unseen, non-own post", () => {
    const posts = makePosts(3);
    const result = getNextSwipePost(posts, null, new Set(), {}, "me");
    expect(result.nextPost?.id).toBe("p1");
    expect(result.shouldResetShown).toBe(false);
  });

  it("skips current card (currentPid)", () => {
    const posts = makePosts(3);
    const result = getNextSwipePost(posts, "p1", new Set(), {}, "me");
    expect(result.nextPost?.id).toBe("p2");
  });

  it("phase 1: unvoted + unseen returns post without reset", () => {
    const posts = makePosts(5);
    const shown = new Set(["p1", "p2"]);
    const result = getNextSwipePost(posts, "p1", shown, {}, "me");
    expect(result.nextPost?.id).toBe("p3");
    expect(result.shouldResetShown).toBe(false);
  });

  it("phase 2: all shown but unvoted exist → signals reset, returns post", () => {
    const posts = makePosts(3);
    const shown = new Set(["p1", "p2", "p3"]);
    const result = getNextSwipePost(posts, "p1", shown, {}, "me");
    expect(result.nextPost).not.toBeNull();
    expect(result.shouldResetShown).toBe(true);
    // Should return p2 or p3 (not p1 which is current)
    expect(["p2", "p3"]).toContain(result.nextPost?.id);
  });

  it("all voted returns null (triggers exhaustion)", () => {
    const posts = makePosts(3);
    const votes: Record<string, VoteDirection | null> = { p1: "up", p2: "down", p3: "up" };
    const result = getNextSwipePost(posts, "p1", new Set(), votes, "me");
    expect(result.nextPost).toBeNull();
    expect(result.shouldResetShown).toBe(false);
  });

  it("only own posts unvoted returns null", () => {
    const posts = [
      makePost("p1", { username: "me" }),
      makePost("p2", { username: "me" }),
    ];
    const result = getNextSwipePost(posts, null, new Set(), {}, "me");
    expect(result.nextPost).toBeNull();
  });

  it("single post remaining after all others voted returns it", () => {
    const posts = makePosts(3);
    const votes: Record<string, VoteDirection | null> = { p1: "up", p2: "down" };
    const result = getNextSwipePost(posts, "p1", new Set(), votes, "me");
    expect(result.nextPost?.id).toBe("p3");
  });

  it("after reset, re-discovers previously shown posts", () => {
    const posts = makePosts(2);
    // Both shown, both unvoted, neither is current
    const shown = new Set(["p1", "p2"]);
    const result = getNextSwipePost(posts, null, shown, {}, "me");
    expect(result.nextPost).not.toBeNull();
    expect(result.shouldResetShown).toBe(true);
  });

  it("skips own posts in all phases", () => {
    const posts = [
      makePost("p1", { username: "me" }),
      makePost("p2", { username: "other" }),
      makePost("p3", { username: "me" }),
    ];
    const result = getNextSwipePost(posts, null, new Set(), {}, "me");
    expect(result.nextPost?.id).toBe("p2");
  });
});

/* ================================================================== */
/*  calculateVoteDelta                                                 */
/* ================================================================== */
describe("calculateVoteDelta", () => {
  it("no previous vote + up → +1", () => {
    expect(calculateVoteDelta(null, "up")).toBe(1);
  });

  it("no previous vote + down → -1", () => {
    expect(calculateVoteDelta(null, "down")).toBe(-1);
  });

  it("previous up + down → -2", () => {
    expect(calculateVoteDelta("up", "down")).toBe(-2);
  });

  it("previous down + up → +2", () => {
    expect(calculateVoteDelta("down", "up")).toBe(2);
  });

  it("previous up + up → 0 (same direction, no-op)", () => {
    expect(calculateVoteDelta("up", "up")).toBe(0);
  });

  it("previous down + down → 0", () => {
    expect(calculateVoteDelta("down", "down")).toBe(0);
  });

  it("undefined previous vote + up → +1", () => {
    expect(calculateVoteDelta(undefined, "up")).toBe(1);
  });

  it("undefined previous vote + down → -1", () => {
    expect(calculateVoteDelta(undefined, "down")).toBe(-1);
  });
});

/* ================================================================== */
/*  filterByDownvoteThreshold                                          */
/* ================================================================== */
describe("filterByDownvoteThreshold", () => {
  it("hideDownvoted ON, threshold -5: filters posts below -5", () => {
    const posts = [
      makePost("p1", { votes: -6 }),
      makePost("p2", { votes: 0 }),
      makePost("p3", { votes: -5 }),
    ];
    const result = filterByDownvoteThreshold(posts, true, -5);
    expect(result.map((p) => p.id)).toEqual(["p2", "p3"]);
  });

  it("hideDownvoted OFF: returns all posts unchanged", () => {
    const posts = [
      makePost("p1", { votes: -100 }),
      makePost("p2", { votes: 0 }),
    ];
    const result = filterByDownvoteThreshold(posts, false, -5);
    expect(result).toEqual(posts);
  });

  it("post at exactly threshold is kept", () => {
    const posts = [makePost("p1", { votes: -5 })];
    const result = filterByDownvoteThreshold(posts, true, -5);
    expect(result).toHaveLength(1);
  });

  it("post at threshold - 1 is filtered", () => {
    const posts = [makePost("p1", { votes: -6 })];
    const result = filterByDownvoteThreshold(posts, true, -5);
    expect(result).toHaveLength(0);
  });

  it("post at 0 is kept", () => {
    const posts = [makePost("p1", { votes: 0 })];
    const result = filterByDownvoteThreshold(posts, true, -5);
    expect(result).toHaveLength(1);
  });

  it("empty posts returns empty result", () => {
    const result = filterByDownvoteThreshold([], true, -5);
    expect(result).toEqual([]);
  });

  it("all posts below threshold returns empty result", () => {
    const posts = [
      makePost("p1", { votes: -10 }),
      makePost("p2", { votes: -20 }),
    ];
    const result = filterByDownvoteThreshold(posts, true, -5);
    expect(result).toEqual([]);
  });

  it("uses default threshold DOWNVOTE_THRESHOLD when not specified", () => {
    const posts = [
      makePost("p1", { votes: DOWNVOTE_THRESHOLD }),
      makePost("p2", { votes: DOWNVOTE_THRESHOLD - 1 }),
    ];
    const result = filterByDownvoteThreshold(posts, true);
    expect(result.map((p) => p.id)).toEqual(["p1"]);
  });

  it("posts with undefined votes treated as 0", () => {
    const posts = [makePost("p1")]; // votes defaults to 0 in makePost
    const result = filterByDownvoteThreshold(posts, true, -5);
    expect(result).toHaveLength(1);
  });
});

/* ================================================================== */
/*  getBulkVoteTargets                                                 */
/* ================================================================== */
describe("getBulkVoteTargets", () => {
  it("returns only unvoted posts", () => {
    const posts = makePosts(3);
    const votes: Record<string, VoteDirection | null> = { p1: "up" };
    const result = getBulkVoteTargets(posts, votes, "me", false);
    expect(result.map((p) => p.id)).toEqual(["p2", "p3"]);
  });

  it("excludes current user's own posts", () => {
    const posts = [
      makePost("p1", { username: "me" }),
      makePost("p2", { username: "other" }),
    ];
    const result = getBulkVoteTargets(posts, {}, "me", false);
    expect(result.map((p) => p.id)).toEqual(["p2"]);
  });

  it("respects hideDownvoted toggle ON — filters low-vote posts", () => {
    const posts = [
      makePost("p1", { votes: -10 }),
      makePost("p2", { votes: 5 }),
    ];
    const result = getBulkVoteTargets(posts, {}, "me", true, -5);
    expect(result.map((p) => p.id)).toEqual(["p2"]);
  });

  it("hideDownvoted OFF includes all unvoted non-own posts", () => {
    const posts = [
      makePost("p1", { votes: -10 }),
      makePost("p2", { votes: 5 }),
    ];
    const result = getBulkVoteTargets(posts, {}, "me", false);
    expect(result.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("all posts already voted returns empty", () => {
    const posts = makePosts(3);
    const votes: Record<string, VoteDirection | null> = { p1: "up", p2: "down", p3: "up" };
    const result = getBulkVoteTargets(posts, votes, "me", false);
    expect(result).toEqual([]);
  });

  it("mix: some voted, some own, some eligible → correct subset", () => {
    const posts = [
      makePost("p1", { username: "other" }), // voted
      makePost("p2", { username: "me" }),     // own
      makePost("p3", { username: "other" }),  // eligible
      makePost("p4", { username: "other" }),  // eligible
    ];
    const votes: Record<string, VoteDirection | null> = { p1: "up" };
    const result = getBulkVoteTargets(posts, votes, "me", false);
    expect(result.map((p) => p.id)).toEqual(["p3", "p4"]);
  });

  it("null currentUser includes all non-voted posts", () => {
    const posts = makePosts(2);
    const result = getBulkVoteTargets(posts, {}, null, false);
    expect(result).toHaveLength(2);
  });
});

/* ================================================================== */
/*  getInitialSlots                                                    */
/* ================================================================== */
describe("getInitialSlots", () => {
  it("swipe mode: returns single unvoted non-own post", () => {
    const posts = [
      makePost("p1", { username: "me" }),
      makePost("p2", { username: "other" }),
      makePost("p3", { username: "other" }),
    ];
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, "me", "swipe");
    expect(result.swipePostId).toBe("p2");
    expect(result.slots).toEqual([]);
  });

  it("swipe mode: all voted returns null swipePostId", () => {
    const posts = makePosts(2);
    const votes: Record<string, VoteDirection | null> = { p1: "up", p2: "down" };
    const result = getInitialSlots(posts, votes, VISIBLE_COUNT, "me", "swipe");
    expect(result.swipePostId).toBeNull();
  });

  it("swipe mode: all own posts returns null swipePostId", () => {
    const posts = [
      makePost("p1", { username: "me" }),
      makePost("p2", { username: "me" }),
    ];
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, "me", "swipe");
    expect(result.swipePostId).toBeNull();
  });

  it("desktop mode: returns up to VISIBLE_COUNT posts", () => {
    const posts = makePosts(10);
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, "me", "top");
    expect(result.slots).toHaveLength(VISIBLE_COUNT);
    expect(result.swipePostId).toBeNull();
  });

  it("desktop mode: prioritizes unvoted posts in slots", () => {
    const posts = makePosts(6);
    const votes: Record<string, VoteDirection | null> = { p1: "up", p2: "down" };
    const result = getInitialSlots(posts, votes, VISIBLE_COUNT, "me", "top");
    // p3-p6 are unvoted, should appear first
    const slotIds = result.slots.map((s) => s.postId);
    expect(slotIds).toEqual(["p3", "p4", "p5", "p6"]);
  });

  it("desktop mode: fills remaining slots with voted posts", () => {
    const posts = makePosts(5);
    // 4 voted, only 1 unvoted
    const votes: Record<string, VoteDirection | null> = { p1: "up", p2: "down", p3: "up", p4: "down" };
    const result = getInitialSlots(posts, votes, VISIBLE_COUNT, "me", "top");
    const slotIds = result.slots.map((s) => s.postId);
    // p5 is unvoted and comes first, then fill with voted: p1, p2, p3
    expect(slotIds[0]).toBe("p5");
    expect(slotIds).toHaveLength(VISIBLE_COUNT);
  });

  it("desktop mode: fewer posts than VISIBLE_COUNT returns all", () => {
    const posts = makePosts(2);
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, "me", "top");
    expect(result.slots).toHaveLength(2);
  });

  it("empty post list returns empty slots", () => {
    const result = getInitialSlots([], {}, VISIBLE_COUNT, "me", "top");
    expect(result.slots).toEqual([]);
    expect(result.swipePostId).toBeNull();
  });

  it("desktop mode: all slots have animState 'visible'", () => {
    const posts = makePosts(4);
    const result = getInitialSlots(posts, {}, VISIBLE_COUNT, "me", "top");
    result.slots.forEach((slot) => {
      expect(slot.animState).toBe("visible");
    });
  });
});
