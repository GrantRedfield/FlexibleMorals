import { describe, it, expect } from "vitest";
import {
  shouldTriggerExhaustion,
  updateVoteStreak,
  getCooldownStorageKey,
  type VoteStreak,
} from "../src/utils/votingLogic";

/* ================================================================== */
/*  shouldTriggerExhaustion                                            */
/* ================================================================== */
describe("shouldTriggerExhaustion", () => {
  it("swipe mode + null currentPostId + initialized + no cooldown → true", () => {
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, null, false, 10, false)
    ).toBe(true);
  });

  it("desktop mode + empty slots + initialized + no cooldown → true", () => {
    expect(
      shouldTriggerExhaustion("top", null, 0, true, null, false, 10, false)
    ).toBe(true);
  });

  it("race condition guard: not initialized yet → false", () => {
    expect(
      shouldTriggerExhaustion("swipe", null, 0, false, null, false, 10, false)
    ).toBe(false);
  });

  it("active cooldown already exists → false", () => {
    const futureEnd = Date.now() + 60000;
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, futureEnd, false, 10, false)
    ).toBe(false);
  });

  it("cooldownTriggered already true → false", () => {
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, null, true, 10, false)
    ).toBe(false);
  });

  it("posts length 0 → false", () => {
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, null, false, 0, false)
    ).toBe(false);
  });

  it("guest login prompt showing → false", () => {
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, null, false, 10, true)
    ).toBe(false);
  });

  it("swipe mode + valid currentPostId → false (not exhausted)", () => {
    expect(
      shouldTriggerExhaustion("swipe", "p1", 0, true, null, false, 10, false)
    ).toBe(false);
  });

  it("desktop mode + non-empty slots → false", () => {
    expect(
      shouldTriggerExhaustion("top", null, 3, true, null, false, 10, false)
    ).toBe(false);
  });

  it("random sort mode + empty slots + initialized → true", () => {
    expect(
      shouldTriggerExhaustion("random", null, 0, true, null, false, 10, false)
    ).toBe(true);
  });

  it("hot sort mode + non-empty slots → false", () => {
    expect(
      shouldTriggerExhaustion("hot", null, 2, true, null, false, 10, false)
    ).toBe(false);
  });
});

/* ================================================================== */
/*  updateVoteStreak                                                   */
/* ================================================================== */
describe("updateVoteStreak", () => {
  it("first vote up → streak count 1", () => {
    const initial: VoteStreak = { direction: "up", count: 0 };
    const { newStreak, triggerPopup } = updateVoteStreak(initial, "up");
    expect(newStreak).toEqual({ direction: "up", count: 1 });
    expect(triggerPopup).toBe(false);
  });

  it("9 consecutive up votes → count 9, no popup", () => {
    const streak: VoteStreak = { direction: "up", count: 8 };
    const { newStreak, triggerPopup } = updateVoteStreak(streak, "up");
    expect(newStreak.count).toBe(9);
    expect(triggerPopup).toBe(false);
  });

  it("10 consecutive up votes → count 10, triggerPopup true", () => {
    const streak: VoteStreak = { direction: "up", count: 9 };
    const { newStreak, triggerPopup } = updateVoteStreak(streak, "up");
    expect(newStreak.count).toBe(10);
    expect(triggerPopup).toBe(true);
  });

  it("5 up then 1 down → resets to down count 1", () => {
    const streak: VoteStreak = { direction: "up", count: 5 };
    const { newStreak, triggerPopup } = updateVoteStreak(streak, "down");
    expect(newStreak).toEqual({ direction: "down", count: 1 });
    expect(triggerPopup).toBe(false);
  });

  it("cross-cooldown bug: streak starts at 0 after reset → 3 votes = count 3, not 10", () => {
    // Simulates what happens after cooldown expiry resets streak to { up, 0 }
    let streak: VoteStreak = { direction: "up", count: 0 };
    for (let i = 0; i < 3; i++) {
      const result = updateVoteStreak(streak, "up");
      streak = result.newStreak;
    }
    expect(streak.count).toBe(3);
  });

  it("alternating up/down → always count 1, never triggers popup", () => {
    let streak: VoteStreak = { direction: "up", count: 0 };
    for (let i = 0; i < 20; i++) {
      const dir = i % 2 === 0 ? "up" : "down";
      const { newStreak, triggerPopup } = updateVoteStreak(streak, dir as "up" | "down");
      expect(newStreak.count).toBe(1);
      expect(triggerPopup).toBe(false);
      streak = newStreak;
    }
  });

  it("10 consecutive down votes → triggerPopup true", () => {
    let streak: VoteStreak = { direction: "down", count: 0 };
    let popup = false;
    for (let i = 0; i < 10; i++) {
      const result = updateVoteStreak(streak, "down");
      streak = result.newStreak;
      popup = result.triggerPopup;
    }
    expect(streak.count).toBe(10);
    expect(popup).toBe(true);
  });

  it("reset streak + 10 new votes → triggers popup correctly", () => {
    // Simulate cooldown reset
    let streak: VoteStreak = { direction: "up", count: 0 };
    let popup = false;
    for (let i = 0; i < 10; i++) {
      const result = updateVoteStreak(streak, "up");
      streak = result.newStreak;
      popup = result.triggerPopup;
    }
    expect(popup).toBe(true);
    expect(streak.count).toBe(10);
  });

  it("custom threshold of 5 triggers at 5", () => {
    const streak: VoteStreak = { direction: "up", count: 4 };
    const { triggerPopup } = updateVoteStreak(streak, "up", 5);
    expect(triggerPopup).toBe(true);
  });

  it("does NOT trigger at count 11 (only at exact threshold)", () => {
    const streak: VoteStreak = { direction: "up", count: 10 };
    const { triggerPopup } = updateVoteStreak(streak, "up");
    expect(triggerPopup).toBe(false);
  });

  it("direction change at count 9 resets to 1", () => {
    const streak: VoteStreak = { direction: "up", count: 9 };
    const { newStreak } = updateVoteStreak(streak, "down");
    expect(newStreak).toEqual({ direction: "down", count: 1 });
  });
});

/* ================================================================== */
/*  getCooldownStorageKey                                              */
/* ================================================================== */
describe("getCooldownStorageKey", () => {
  it("logged-in user 'alice' → voteCooldownEnd_alice", () => {
    expect(getCooldownStorageKey("alice", "guest_abc123")).toBe(
      "voteCooldownEnd_alice"
    );
  });

  it("guest with ID 'guest_abc123' → voteCooldownEnd_guest_abc123", () => {
    expect(getCooldownStorageKey(null, "guest_abc123")).toBe(
      "voteCooldownEnd_guest_abc123"
    );
  });

  it("null user + guest ID → uses guest ID", () => {
    expect(getCooldownStorageKey(null, "guest_xyz")).toBe(
      "voteCooldownEnd_guest_xyz"
    );
  });

  it("empty string user + guest ID → uses guest ID", () => {
    expect(getCooldownStorageKey("", "guest_xyz")).toBe(
      "voteCooldownEnd_guest_xyz"
    );
  });

  it("undefined user → uses guest ID", () => {
    expect(getCooldownStorageKey(undefined, "guest_abc")).toBe(
      "voteCooldownEnd_guest_abc"
    );
  });

  it("user with special characters preserved", () => {
    expect(getCooldownStorageKey("user@email.com", "guest_x")).toBe(
      "voteCooldownEnd_user@email.com"
    );
  });
});

/* ================================================================== */
/*  Cooldown lifecycle (integration-style tests using pure functions)  */
/* ================================================================== */
describe("Cooldown lifecycle", () => {
  it("start cooldown: shouldTriggerExhaustion true → state transitions correctly", () => {
    // Step 1: exhaustion detected
    const shouldTrigger = shouldTriggerExhaustion(
      "swipe", null, 0, true, null, false, 10, false
    );
    expect(shouldTrigger).toBe(true);

    // Step 2: after setting cooldownTriggered, it shouldn't trigger again
    const shouldTriggerAgain = shouldTriggerExhaustion(
      "swipe", null, 0, true, null, true, 10, false
    );
    expect(shouldTriggerAgain).toBe(false);
  });

  it("during cooldown: exhaustion detector ignores (cooldownEnd set)", () => {
    const futureEnd = Date.now() + 300000; // 5 min from now
    const shouldTrigger = shouldTriggerExhaustion(
      "swipe", null, 0, true, futureEnd, true, 10, false
    );
    expect(shouldTrigger).toBe(false);
  });

  it("cooldown expires: slotsInitialized must be false to prevent race", () => {
    // After cooldown expires, slotsInitialized is reset to false
    // This means the exhaustion detector should NOT fire
    const shouldTrigger = shouldTriggerExhaustion(
      "swipe", null, 0, false, null, false, 10, false
    );
    expect(shouldTrigger).toBe(false);
  });

  it("cooldown expiry resets vote streak", () => {
    // Before expiry: streak at 7
    const streak: VoteStreak = { direction: "up", count: 7 };
    // After expiry: streak reset to { direction: "up", count: 0 }
    const resetStreak: VoteStreak = { direction: "up", count: 0 };
    // New votes after reset start from 0
    const { newStreak } = updateVoteStreak(resetStreak, "up");
    expect(newStreak.count).toBe(1);
    // Original streak was 7, so this confirms no carry-over
    expect(newStreak.count).not.toBe(streak.count + 1);
  });

  it("cooldown storage key changes with user identity", () => {
    const guestKey = getCooldownStorageKey(null, "guest_123");
    const userKey = getCooldownStorageKey("alice", "guest_123");
    expect(guestKey).not.toBe(userKey);
    expect(guestKey).toBe("voteCooldownEnd_guest_123");
    expect(userKey).toBe("voteCooldownEnd_alice");
  });

  it("server 429 cooldown activates for both cooldownEnd and cooldownTriggered", () => {
    // Before 429: no cooldown
    expect(
      shouldTriggerExhaustion("swipe", "p1", 0, true, null, false, 10, false)
    ).toBe(false);

    // After 429: cooldownEnd set, cooldownTriggered true
    const serverEnd = Date.now() + 300000;
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, serverEnd, true, 10, false)
    ).toBe(false);
  });

  it("exhaustion → cooldown → expire → re-init cycle works", () => {
    // 1. Exhaustion detected
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, null, false, 5, false)
    ).toBe(true);

    // 2. Cooldown set — no more triggering
    const end = Date.now() + 300000;
    expect(
      shouldTriggerExhaustion("swipe", null, 0, true, end, true, 5, false)
    ).toBe(false);

    // 3. Cooldown expires — slotsInitialized reset to false
    expect(
      shouldTriggerExhaustion("swipe", null, 0, false, null, false, 5, false)
    ).toBe(false);

    // 4. Cards re-initialized (slotsInitialized = true, swipeCurrentPostId set)
    expect(
      shouldTriggerExhaustion("swipe", "p1", 0, true, null, false, 5, false)
    ).toBe(false);
  });
});
