import type { LiveMatchSummary, MatchEvent, MatchState, OddsSnapshot } from "../types.js";

type ReplayStep = {
  minute: number;
  phase: MatchState["phase"];
  score: MatchState["score"];
  event?: MatchEvent;
  odds: OddsSnapshot;
};

const englandCroatiaSteps: ReplayStep[] = [
  {
    minute: 12,
    phase: "first_half",
    score: { home: 0, away: 0 },
    odds: {
      timestamp: "2026-07-02T18:12:00Z",
      market: "match_winner",
      homeProbability: 54,
      drawProbability: 18,
      awayProbability: 28,
      homePrice: 1.85,
      drawPrice: 5.55,
      awayPrice: 3.57,
    },
  },
  {
    minute: 28,
    phase: "first_half",
    score: { home: 0, away: 0 },
    event: {
      id: "replay-28-cro-corners",
      minute: 28,
      type: "corner",
      team: "away",
      description: "Croatia win a second corner during a sustained pressure spell.",
    },
    odds: {
      timestamp: "2026-07-02T18:28:00Z",
      market: "match_winner",
      homeProbability: 31,
      drawProbability: 22,
      awayProbability: 47,
      homePrice: 3.22,
      drawPrice: 4.55,
      awayPrice: 2.13,
    },
  },
  {
    minute: 34,
    phase: "first_half",
    score: { home: 0, away: 0 },
    event: {
      id: "replay-34-eng-corner",
      minute: 34,
      type: "corner",
      team: "home",
      description: "England force a corner after their first fast break in several minutes.",
    },
    odds: {
      timestamp: "2026-07-02T18:34:00Z",
      market: "match_winner",
      homeProbability: 38,
      drawProbability: 23,
      awayProbability: 39,
      homePrice: 2.63,
      drawPrice: 4.35,
      awayPrice: 2.56,
    },
  },
  {
    minute: 41,
    phase: "first_half",
    score: { home: 0, away: 0 },
    event: {
      id: "replay-41-cro-yellow",
      minute: 41,
      type: "yellow_card",
      team: "away",
      description: "Croatia's right back is booked while stopping an England break.",
    },
    odds: {
      timestamp: "2026-07-02T18:41:00Z",
      market: "match_winner",
      homeProbability: 42,
      drawProbability: 25,
      awayProbability: 33,
      homePrice: 2.38,
      drawPrice: 4,
      awayPrice: 3.03,
    },
  },
  {
    minute: 52,
    phase: "second_half",
    score: { home: 0, away: 1 },
    event: {
      id: "replay-52-cro-goal",
      minute: 52,
      type: "goal",
      team: "away",
      description: "Croatia score from the first clear chance of the second half.",
    },
    odds: {
      timestamp: "2026-07-02T19:07:00Z",
      market: "match_winner",
      homeProbability: 18,
      drawProbability: 24,
      awayProbability: 58,
      homePrice: 5.55,
      drawPrice: 4.16,
      awayPrice: 1.72,
    },
  },
  {
    minute: 63,
    phase: "second_half",
    score: { home: 0, away: 1 },
    event: {
      id: "replay-63-eng-possible-goal",
      minute: 63,
      type: "possible_goal",
      team: "home",
      description: "England have a possible goal checked after a crowded box scramble.",
    },
    odds: {
      timestamp: "2026-07-02T19:18:00Z",
      market: "match_winner",
      homeProbability: 27,
      drawProbability: 31,
      awayProbability: 42,
      homePrice: 3.7,
      drawPrice: 3.22,
      awayPrice: 2.38,
    },
  },
];

export const replayMatches: LiveMatchSummary[] = [
  {
    fixtureId: "replay-england-croatia",
    homeTeam: "England",
    awayTeam: "Croatia",
    status: "replay",
    minute: 28,
    score: "0-0",
    mode: "replay",
  },
];

export function getReplayInitialState(fixtureId: string): MatchState {
  if (fixtureId !== "replay-england-croatia") {
    throw new Error(`Unknown replay fixture: ${fixtureId}`);
  }

  return getReplayStateAt(fixtureId, 1);
}

export function getReplayStateAt(fixtureId: string, index: number): MatchState {
  if (fixtureId !== "replay-england-croatia") {
    throw new Error(`Unknown replay fixture: ${fixtureId}`);
  }

  const clampedIndex = Math.max(0, Math.min(index, englandCroatiaSteps.length - 1));
  const current = englandCroatiaSteps[clampedIndex];
  const previous = englandCroatiaSteps[clampedIndex - 1];
  const recentEvents = englandCroatiaSteps
    .slice(Math.max(0, clampedIndex - 4), clampedIndex + 1)
    .flatMap((step) => (step.event ? [step.event] : []));

  return {
    fixtureId,
    homeTeam: "England",
    awayTeam: "Croatia",
    minute: current.minute,
    phase: current.phase,
    score: current.score,
    recentEvents,
    latestOdds: current.odds,
    previousOdds: previous?.odds ?? null,
    mode: "replay",
  };
}

export function getNextReplayState(
  fixtureId: string,
  currentIndex: number,
): { state: MatchState; index: number; isEnd: boolean } {
  const nextIndex = Math.min(currentIndex + 1, englandCroatiaSteps.length - 1);
  return {
    state: getReplayStateAt(fixtureId, nextIndex),
    index: nextIndex,
    isEnd: nextIndex === englandCroatiaSteps.length - 1,
  };
}

