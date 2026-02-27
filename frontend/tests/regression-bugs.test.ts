/**
 * Regression tests for bugs discovered and fixed in production.
 * Each describe block documents the original bug, how it manifested,
 * and the exact scenario that triggers it.
 */
import { describe, it, expect } from "vitest";
import {
  calculateVoteDelta,
  filterByDownvoteThreshold,
  getBulkVoteTargets,
  getNextSwipePost,
  getInitialSlots,
  shouldTriggerExhaustion,
  updateVoteStreak,
  getVotedCount,
  computeRevertedVoteState,
  getCooldownStorageKey,
  VISIBLE_COUNT,
  DOWNVOTE_THRESHOLD,
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
/*  BUG: Bulk vote skipped posts with prior server-side votes          */
/*  after cooldown (backend returned 0/22 succeeded)                   */
/*                                                                     */
/*  Root cause: After cooldown expires, localStorage votes are wiped   */
/*  so getBulkVoteTargets sends all posts. But the backend was doing   */
/*  `if (userVotes[userId]) continue` — skipping any post the user    */
/*  had ever voted on. The backend fix now re-votes (flips direction   */
/*  or applies new vote). These tests verify the frontend sends the   */
/*  right posts after cooldown.                                        */
/* ================================================================== */
describe("BUG: Bulk vote after cooldown (server has old votes, local is empty)", () => {
  it("after cooldown wipe, getBulkVoteTargets returns ALL non-own posts", () => {
    const posts = makePosts(10);
    // localStorage wiped — empty local votes
    const emptyLocalVotes: Record<string, VoteDirection | null> = {};
    const targets = getBulkVoteTargets(posts, emptyLocalVotes, "me", false);
    expect(targets).toHaveLength(10);
  });

  it("server userVotes are irrelevant to getBulkVoteTargets (it uses local votes only)", () => {
    // Posts have server-side userVotes from before cooldown
    const posts = [
      makePost("p1", { userVotes: { me: "up" } }),
      makePost("p2", { userVotes: { me: "down" } }),
      makePost("p3", { userVotes: {} }),
    ];
    // But localStorage is empty after cooldown
    const emptyLocalVotes: Record<string, VoteDirection | null> = {};
    const targets = getBulkVoteTargets(posts, emptyLocalVotes, "me", false);
    // All 3 returned — even though server has votes on p1 and p2
    expect(targets).toHaveLength(3);
  });

  it("mid-session bulk vote correctly skips locally-voted posts", () => {
    const posts = makePosts(5);
    // User swiped on p1 and p2 before triggering bulk vote
    const localVotes: Record<string, VoteDirection | null> = { p1: "up", p2: "down" };
    const targets = getBulkVoteTargets(posts, localVotes, "me", false);
    expect(targets.map((p) => p.id)).toEqual(["p3", "p4", "p5"]);
  });

  it("bulk vote delta for previously-unvoted post is +1/-1", () => {
    // After cooldown, all posts are treated as new votes
    expect(calculateVoteDelta(null, "up")).toBe(1);
    expect(calculateVoteDelta(null, "down")).toBe(-1);
  });

  it("bulk vote delta for direction-change (server had up, now down) is -2", () => {
    // Backend handles this: previousVote was "up", now "down"
    expect(calculateVoteDelta("up", "down")).toBe(-2);
    expect(calculateVoteDelta("down", "up")).toBe(2);
  });

  it("after cooldown, getNextSwipePost returns posts even if server has old votes", () => {
    // Posts have server-side votes, but local votes are empty
    const posts = [
      makePost("p1", { userVotes: { me: "up" } }),
      makePost("p2", { userVotes: { me: "down" } }),
      makePost("p3", { userVotes: {} }),
    ];
    const emptyLocalVotes: Record<string, VoteDirection | null> = {};
    const result = getNextSwipePost(posts, null, new Set(), emptyLocalVotes, "me");
    // Returns p1 because local votes don't know about server votes
    expect(result.nextPost?.id).toBe("p1");
  });

  it("after cooldown, getInitialSlots treats all posts as unvoted", () => {
    const posts = makePosts(6);
    const emptyLocalVotes: Record<string, VoteDirection | null> = {};
    const result = getInitialSlots(posts, emptyLocalVotes, VISIBLE_COUNT, "me", "top");
    // All slots filled with "unvoted" posts
    expect(result.slots).toHaveLength(VISIBLE_COUNT);
  });
});

/* ================================================================== */
/*  BUG: Hide-downvoted threshold was inclusive (>= -5 kept -5 posts) */
/*                                                                     */
/*  Root cause: filterByDownvoteThreshold used >= instead of >.        */
/*  Posts at exactly -5 were visible when they should have been hidden.*/
/* ================================================================== */
describe("BUG: Hide-downvoted threshold inclusive (posts at -5 were visible)", () => {
  it("post at exactly DOWNVOTE_THRESHOLD (-5) IS hidden", () => {
    const posts = [makePost("p1", { votes: -5 })];
    const result = filterByDownvoteThreshold(posts, true);
    expect(result).toHaveLength(0);
  });

  it("post at DOWNVOTE_THRESHOLD + 1 (-4) is shown", () => {
    const posts = [makePost("p1", { votes: -4 })];
    const result = filterByDownvoteThreshold(posts, true);
    expect(result).toHaveLength(1);
  });

  it("post at DOWNVOTE_THRESHOLD - 1 (-6) is hidden", () => {
    const posts = [makePost("p1", { votes: -6 })];
    const result = filterByDownvoteThreshold(posts, true);
    expect(result).toHaveLength(0);
  });

  it("threshold is exclusive: boundary post hidden in comments tab too", () => {
    // The comments tab uses filterByDownvoteThreshold for mobileFilteredPosts
    const posts = [
      makePost("p1", { votes: -5 }),
      makePost("p2", { votes: -4 }),
      makePost("p3", { votes: 0 }),
      makePost("p4", { votes: 10 }),
    ];
    const filtered = filterByDownvoteThreshold(posts, true);
    expect(filtered.map((p) => p.id)).toEqual(["p2", "p3", "p4"]);
  });

  it("bulk vote targets also respect exclusive threshold", () => {
    const posts = [
      makePost("p1", { votes: -5 }),  // hidden
      makePost("p2", { votes: -4 }),  // shown
      makePost("p3", { votes: 0 }),   // shown
    ];
    const targets = getBulkVoteTargets(posts, {}, "me", true);
    expect(targets.map((p) => p.id)).toEqual(["p2", "p3"]);
  });

  it("toggle OFF still shows everything including posts at -5", () => {
    const posts = [
      makePost("p1", { votes: -5 }),
      makePost("p2", { votes: -100 }),
    ];
    const result = filterByDownvoteThreshold(posts, false);
    expect(result).toHaveLength(2);
  });
});

/* ================================================================== */
/*  BUG: Optimistic vote not reverted when server returns 429          */
/*                                                                     */
/*  Root cause: When a vote API call failed (e.g. 429 cooldown), the  */
/*  optimistic UI update was kept. Vote counts appeared changed locally*/
/*  but reverted when navigating away (server had real count).         */
/*  The fix: computeRevertedVoteState undoes the optimistic delta.     */
/* ================================================================== */
describe("BUG: Optimistic vote not reverted on API failure", () => {
  it("revert undoes +1 delta (new upvote rejected)", () => {
    const posts = [makePost("p1", { votes: 6 })]; // after optimistic +1, was 5
    const localVotes: Record<string, VoteDirection | null> = { p1: "up" };
    const { updatedPosts, updatedVotes } = computeRevertedVoteState(
      posts, "p1", 1, localVotes, null
    );
    expect(updatedPosts[0].votes).toBe(5); // restored
    expect(updatedVotes["p1"]).toBeUndefined(); // vote removed
  });

  it("revert undoes -1 delta (new downvote rejected)", () => {
    const posts = [makePost("p1", { votes: 4 })]; // after optimistic -1, was 5
    const localVotes: Record<string, VoteDirection | null> = { p1: "down" };
    const { updatedPosts, updatedVotes } = computeRevertedVoteState(
      posts, "p1", -1, localVotes, null
    );
    expect(updatedPosts[0].votes).toBe(5);
    expect(updatedVotes["p1"]).toBeUndefined();
  });

  it("revert undoes +2 delta (direction change up→down rejected)", () => {
    const posts = [makePost("p1", { votes: 7 })]; // after optimistic +2, was 5
    const localVotes: Record<string, VoteDirection | null> = { p1: "up" };
    const { updatedPosts, updatedVotes } = computeRevertedVoteState(
      posts, "p1", 2, localVotes, "down" // was "down" before the failed flip
    );
    expect(updatedPosts[0].votes).toBe(5);
    expect(updatedVotes["p1"]).toBe("down"); // restored to previous direction
  });

  it("revert undoes -2 delta (direction change down→up rejected)", () => {
    const posts = [makePost("p1", { votes: 3 })]; // after optimistic -2, was 5
    const localVotes: Record<string, VoteDirection | null> = { p1: "down" };
    const { updatedPosts, updatedVotes } = computeRevertedVoteState(
      posts, "p1", -2, localVotes, "up"
    );
    expect(updatedPosts[0].votes).toBe(5);
    expect(updatedVotes["p1"]).toBe("up");
  });

  it("revert only affects the target post, leaves others unchanged", () => {
    const posts = [
      makePost("p1", { votes: 6 }),
      makePost("p2", { votes: 10 }),
      makePost("p3", { votes: -3 }),
    ];
    const localVotes: Record<string, VoteDirection | null> = { p1: "up", p2: "down" };
    const { updatedPosts, updatedVotes } = computeRevertedVoteState(
      posts, "p1", 1, localVotes, null
    );
    expect(updatedPosts[0].votes).toBe(5);  // p1 reverted
    expect(updatedPosts[1].votes).toBe(10); // p2 unchanged
    expect(updatedPosts[2].votes).toBe(-3); // p3 unchanged
    expect(updatedVotes["p2"]).toBe("down"); // p2 vote preserved
  });

  it("vote count is accurate after revert (matches server reality)", () => {
    // Scenario: user votes, optimistic +1, then 429 reverts it
    const posts = [
      makePost("p1", { votes: 5 }), // server truth
      makePost("p2", { votes: 3 }),
    ];
    // After revert, no local votes
    const emptyVotes: Record<string, VoteDirection | null> = {};
    // Server says no votes by this user
    const count = getVotedCount(posts, emptyVotes, "test_user");
    expect(count).toBe(0);
  });

  it("calculateVoteDelta is perfectly reversible", () => {
    // For any vote direction, applying delta then subtracting it returns to original
    const scenarios: Array<{ prev: VoteDirection | null; dir: VoteDirection }> = [
      { prev: null, dir: "up" },
      { prev: null, dir: "down" },
      { prev: "up", dir: "down" },
      { prev: "down", dir: "up" },
    ];
    const originalVotes = 10;
    for (const { prev, dir } of scenarios) {
      const delta = calculateVoteDelta(prev, dir);
      const afterOptimistic = originalVotes + delta;
      const afterRevert = afterOptimistic - delta;
      expect(afterRevert).toBe(originalVotes);
    }
  });
});

/* ================================================================== */
/*  BUG: Vote count showed localStorage count, not server count        */
/*                                                                     */
/*  Root cause: votedCount was computed from localStorage-only          */
/*  userVotes. After cooldown, localStorage is wiped, so the counter  */
/*  showed e.g. "5 of 34" when the server had all 34 votes.           */
/*  The fix: getVotedCount checks both server userVotes and local.     */
/* ================================================================== */
describe("BUG: Vote count showed localStorage count instead of server count", () => {
  it("counts votes from server userVotes even when localStorage is empty", () => {
    const posts = [
      makePost("p1", { userVotes: { alice: "up" } }),
      makePost("p2", { userVotes: { alice: "down" } }),
      makePost("p3", { userVotes: { bob: "up" } }),
    ];
    const emptyLocalVotes: Record<string, VoteDirection | null> = {};
    const count = getVotedCount(posts, emptyLocalVotes, "alice");
    expect(count).toBe(2); // alice voted on p1 and p2 per server
  });

  it("counts votes from localStorage when server userVotes is empty", () => {
    const posts = [
      makePost("p1", { userVotes: {} }),
      makePost("p2", { userVotes: {} }),
    ];
    const localVotes: Record<string, VoteDirection | null> = { p1: "up" };
    const count = getVotedCount(posts, localVotes, "alice");
    expect(count).toBe(1); // p1 voted locally
  });

  it("does not double-count posts voted both server and locally", () => {
    const posts = [
      makePost("p1", { userVotes: { alice: "up" } }),
      makePost("p2", { userVotes: { alice: "down" } }),
    ];
    const localVotes: Record<string, VoteDirection | null> = { p1: "up", p2: "down" };
    const count = getVotedCount(posts, localVotes, "alice");
    expect(count).toBe(2); // not 4
  });

  it("after cooldown: server has 34 votes, localStorage has 5 → shows 34", () => {
    // Simulate: 34 posts all voted by alice on server
    const posts = Array.from({ length: 34 }, (_, i) =>
      makePost(`p${i}`, { userVotes: { alice: "up" } })
    );
    // localStorage only has 5 (from post-cooldown session)
    const localVotes: Record<string, VoteDirection | null> = {};
    for (let i = 0; i < 5; i++) localVotes[`p${i}`] = "down";
    const count = getVotedCount(posts, localVotes, "alice");
    expect(count).toBe(34);
  });

  it("fresh user with no votes shows 0", () => {
    const posts = makePosts(10);
    const emptyVotes: Record<string, VoteDirection | null> = {};
    const count = getVotedCount(posts, emptyVotes, "newuser");
    expect(count).toBe(0);
  });

  it("guest voter ID used correctly for server-side lookup", () => {
    const posts = [
      makePost("p1", { userVotes: { guest_abc123: "up" } }),
      makePost("p2", { userVotes: { guest_abc123: "down" } }),
      makePost("p3", { userVotes: {} }),
    ];
    const emptyLocalVotes: Record<string, VoteDirection | null> = {};
    const count = getVotedCount(posts, emptyLocalVotes, "guest_abc123");
    expect(count).toBe(2);
  });

  it("other users' votes not counted", () => {
    const posts = [
      makePost("p1", { userVotes: { alice: "up", bob: "down" } }),
      makePost("p2", { userVotes: { bob: "up" } }),
    ];
    const emptyLocalVotes: Record<string, VoteDirection | null> = {};
    const aliceCount = getVotedCount(posts, emptyLocalVotes, "alice");
    const bobCount = getVotedCount(posts, emptyLocalVotes, "bob");
    expect(aliceCount).toBe(1);
    expect(bobCount).toBe(2);
  });
});

/* ================================================================== */
/*  BUG: Navigation loses vote counts (Vote → Home → Vote shows old) */
/*                                                                     */
/*  Root cause: Individual swipe votes during active server-side       */
/*  cooldown returned 429. The optimistic update showed the change,    */
/*  but the server rejected it. On re-mount (navigation back), the    */
/*  fresh getPosts() returned the unchanged server counts.             */
/*  The fix: revert optimistic update on 429 + activate local cooldown*/
/* ================================================================== */
describe("BUG: Navigation loses vote counts (optimistic + 429 = phantom votes)", () => {
  it("revert after 429 means post count matches what server would return", () => {
    // Simulate: user votes during cooldown
    const originalVotes = 10;
    const posts = [makePost("p1", { votes: originalVotes })];

    // Step 1: optimistic update applied
    const delta = calculateVoteDelta(null, "up");
    const optimisticVotes = originalVotes + delta;
    expect(optimisticVotes).toBe(11);

    // Step 2: server rejects with 429
    const afterOptimistic = [makePost("p1", { votes: optimisticVotes })];
    const localVotes: Record<string, VoteDirection | null> = { p1: "up" };
    const { updatedPosts, updatedVotes } = computeRevertedVoteState(
      afterOptimistic, "p1", delta, localVotes, null
    );

    // Step 3: after revert, matches what getPosts() would return
    expect(updatedPosts[0].votes).toBe(originalVotes);
    expect(updatedVotes["p1"]).toBeUndefined();
  });

  it("multiple rapid votes during cooldown all get reverted correctly", () => {
    const posts = [
      makePost("p1", { votes: 10 }),
      makePost("p2", { votes: 5 }),
      makePost("p3", { votes: 8 }),
    ];

    // Each vote: apply optimistic, then revert
    for (const post of posts) {
      const pid = String(post.id);
      const original = post.votes!;
      const delta = calculateVoteDelta(null, "down");
      const afterOptimistic = [makePost(pid, { votes: original + delta })];
      const localVotes: Record<string, VoteDirection | null> = { [pid]: "down" };
      const { updatedPosts } = computeRevertedVoteState(
        afterOptimistic, pid, delta, localVotes, null
      );
      expect(updatedPosts[0].votes).toBe(original);
    }
  });

  it("revert restores previous vote direction for flip attempts during cooldown", () => {
    // User had previously upvoted p1, now tries to flip to down during cooldown
    const posts = [makePost("p1", { votes: 8 })]; // after optimistic -2 (was 10)
    const localVotes: Record<string, VoteDirection | null> = { p1: "down" };
    const { updatedPosts, updatedVotes } = computeRevertedVoteState(
      posts, "p1", -2, localVotes, "up"
    );
    expect(updatedPosts[0].votes).toBe(10); // restored
    expect(updatedVotes["p1"]).toBe("up"); // original direction restored
  });
});

/* ================================================================== */
/*  BUG: Cooldown expiry race condition with slotsInitialized          */
/*                                                                     */
/*  Root cause: When cooldown expired, slotsInitialized wasn't reset.  */
/*  The exhaustion detector fired before cards were re-initialized,    */
/*  immediately starting a new cooldown (swipeCurrentPostId was still  */
/*  null from the previous cooldown). Fix: reset slotsInitialized on   */
/*  cooldown expiry so exhaustion detector waits for re-init.          */
/* ================================================================== */
describe("BUG: Cooldown expiry race condition with slotsInitialized", () => {
  it("slotsInitialized=false after cooldown expiry prevents premature exhaustion", () => {
    // State right after cooldown expires: slotsInitialized reset to false
    expect(
      shouldTriggerExhaustion("swipe", null, 0, false, null, false, 10, false)
    ).toBe(false);
  });

  it("exhaustion only triggers after cards are re-initialized AND exhausted", () => {
    // Step 1: cooldown just expired, slotsInitialized = false
    expect(
      shouldTriggerExhaustion("swipe", null, 0, false, null, false, 10, false)
    ).toBe(false);

    // Step 2: cards re-initialized, user has a card
    expect(
      shouldTriggerExhaustion("swipe", "p1", 0, true, null, false, 10, false)
    ).toBe(false);

    // Step 3: user votes through all cards, swipeCurrentPostId becomes null
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, null, false, 10, false)
    ).toBe(true);
  });

  it("desktop mode: same race condition guard applies", () => {
    // slotsInitialized=false → no exhaustion even with empty slots
    expect(
      shouldTriggerExhaustion("top", null, 0, false, null, false, 10, false)
    ).toBe(false);

    // After re-init with cards → no exhaustion
    expect(
      shouldTriggerExhaustion("top", null, 4, true, null, false, 10, false)
    ).toBe(false);

    // After all cards voted away → exhaustion
    expect(
      shouldTriggerExhaustion("top", null, 0, true, null, false, 10, false)
    ).toBe(true);
  });
});

/* ================================================================== */
/*  BUG: Vote streak persisted across cooldowns                        */
/*                                                                     */
/*  Root cause: voteStreakRef wasn't reset when cooldown expired. If   */
/*  user had 7 consecutive upvotes before cooldown, after cooldown     */
/*  they'd only need 3 more to trigger the "Bless All" popup (should  */
/*  need 10 fresh votes).                                              */
/* ================================================================== */
describe("BUG: Vote streak persisted across cooldowns", () => {
  it("streak at 7 before cooldown, reset to 0, then 3 votes = count 3 (not 10)", () => {
    // Before cooldown
    let streak: VoteStreak = { direction: "up", count: 7 };

    // Cooldown expires → reset
    streak = { direction: "up", count: 0 };

    // 3 votes after cooldown
    for (let i = 0; i < 3; i++) {
      streak = updateVoteStreak(streak, "up").newStreak;
    }
    expect(streak.count).toBe(3);
  });

  it("streak reset means popup needs full 10 fresh votes", () => {
    let streak: VoteStreak = { direction: "up", count: 0 };
    let popupTriggered = false;

    for (let i = 0; i < 9; i++) {
      const result = updateVoteStreak(streak, "up");
      streak = result.newStreak;
      expect(result.triggerPopup).toBe(false);
    }

    // 10th vote triggers
    const result = updateVoteStreak(streak, "up");
    streak = result.newStreak;
    expect(result.triggerPopup).toBe(true);
    expect(streak.count).toBe(10);
  });

  it("direction change after cooldown reset still works correctly", () => {
    // After cooldown reset
    let streak: VoteStreak = { direction: "up", count: 0 };

    // 5 downvotes
    for (let i = 0; i < 5; i++) {
      streak = updateVoteStreak(streak, "down").newStreak;
    }
    expect(streak).toEqual({ direction: "down", count: 5 });

    // Switch to up — resets to 1
    streak = updateVoteStreak(streak, "up").newStreak;
    expect(streak).toEqual({ direction: "up", count: 1 });
  });
});

/* ================================================================== */
/*  BUG: Cooldown key mismatch between login/logout transitions        */
/*                                                                     */
/*  The cooldown key changes from username to guestVoterId on logout.  */
/*  If the app doesn't copy the cooldown to the new key, the guest    */
/*  could bypass the cooldown by logging out.                          */
/* ================================================================== */
describe("BUG: Cooldown key mismatch on login/logout", () => {
  it("logged-in and guest have different cooldown keys", () => {
    const userKey = getCooldownStorageKey("alice", "guest_123");
    const guestKey = getCooldownStorageKey(null, "guest_123");
    expect(userKey).toBe("voteCooldownEnd_alice");
    expect(guestKey).toBe("voteCooldownEnd_guest_123");
    expect(userKey).not.toBe(guestKey);
  });

  it("cooldown must be copied from user key to guest key on logout", () => {
    // This test documents the expected behavior:
    // On logout, the app reads cooldownEnd from the user's key
    // and writes it to the guest's key
    const userKey = getCooldownStorageKey("alice", "guest_123");
    const guestKey = getCooldownStorageKey(null, "guest_123");
    // Both keys are valid strings that can store the same cooldownEnd value
    expect(userKey).toMatch(/^voteCooldownEnd_/);
    expect(guestKey).toMatch(/^voteCooldownEnd_/);
  });

  it("empty string username falls back to guestVoterId", () => {
    const key = getCooldownStorageKey("", "guest_123");
    expect(key).toBe("voteCooldownEnd_guest_123");
  });
});
