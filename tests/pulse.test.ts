import { describe, expect, it } from "vitest";
import { createPulseChallenge } from "../src/pulse/challenge-generator.js";
import { resolveChallenge } from "../src/pulse/resolver.js";
import { getNextReplayState, getReplayInitialState } from "../src/txline/replay.js";

describe("Signal pulse engine", () => {
  it("creates a contextual challenge from the live replay state", () => {
    const state = getReplayInitialState("replay-england-croatia");
    const challenge = createPulseChallenge(state);

    expect(challenge.question).toContain("England");
    expect(challenge.question).not.toMatch(/goal\/card\/corner/i);
    expect(challenge.resolutionRule.type).toBe("team_pressure_response");
  });

  it("resolves a locked challenge from the next TxLINE-style update", () => {
    const state = getReplayInitialState("replay-england-croatia");
    const challenge = {
      ...createPulseChallenge(state),
      status: "locked" as const,
      userAnswer: "Yes",
    };
    const next = getNextReplayState("replay-england-croatia", 1);

    const result = resolveChallenge(challenge, state, next.state);

    expect(result.resolved).toBe(true);
    expect(result.correct).toBe(true);
    expect(result.result).toContain("England");
  });
});
