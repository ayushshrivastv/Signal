import { describe, expect, it } from "vitest";
import {
  matchStateFromFixture,
  mergeOddsUpdate,
  mergeScoresUpdate,
  normalizeFixture,
} from "../src/txline/normalizer.js";

describe("TxLINE normalizer", () => {
  it("maps fixture participant fields into Signal home and away teams", () => {
    const fixture = normalizeFixture(
      {
        FixtureId: 18237038,
        Participant1: "France",
        Participant2: "Spain",
        Participant1IsHome: true,
        GameState: 2,
      },
      0,
    );

    expect(fixture.fixtureId).toBe("18237038");
    expect(fixture.homeTeam).toBe("France");
    expect(fixture.awayTeam).toBe("Spain");
    expect(fixture.status).toBe("live");
  });

  it("updates score state from documented soccer stat keys", () => {
    const fixture = normalizeFixture(
      {
        FixtureId: 18237038,
        Participant1: "France",
        Participant2: "Spain",
        Participant1IsHome: true,
      },
      0,
    );

    const initial = matchStateFromFixture(fixture);
    const next = mergeScoresUpdate(initial, {
      FixtureId: 18237038,
      Seq: 42,
      StatusId: 4,
      Minute: 67,
      Action: "goal",
      Participant: 2,
      Stats: {
        1: 0,
        2: 1,
      },
    });

    expect(next.minute).toBe(67);
    expect(next.phase).toBe("second_half");
    expect(next.score).toEqual({ home: 0, away: 1 });
    expect(next.recentEvents.at(-1)?.type).toBe("goal");
    expect(next.recentEvents.at(-1)?.team).toBe("away");
  });

  it("updates odds state from StablePrice-style probability fields", () => {
    const initial = matchStateFromFixture({
      fixtureId: "18237038",
      homeTeam: "France",
      awayTeam: "Spain",
      status: "live",
      mode: "live",
    });

    const next = mergeOddsUpdate(initial, {
      FixtureId: 18237038,
      SuperOddsType: "match_winner",
      HomeProbability: 0.27,
      DrawProbability: 0.35,
      AwayProbability: 0.38,
    });

    expect(next.latestOdds?.market).toBe("match_winner");
    expect(next.latestOdds?.homeProbability).toBe(27);
    expect(next.latestOdds?.awayProbability).toBe(38);
  });
});
