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

const franceSpainSteps: ReplayStep[] = [
  {
    minute: 67,
    phase: "second_half",
    score: { home: 0, away: 1 },
    event: {
      id: "replay-67-fra-pressure",
      minute: 67,
      type: "corner",
      team: "home",
      description: "France win back-to-back corners after Spain sit deeper to protect the lead.",
    },
    odds: {
      timestamp: "2026-07-15T20:22:00Z",
      market: "match_winner",
      homeProbability: 18,
      drawProbability: 29,
      awayProbability: 53,
      homePrice: 5.55,
      drawPrice: 3.45,
      awayPrice: 1.88,
    },
  },
  {
    minute: 72,
    phase: "second_half",
    score: { home: 0, away: 1 },
    event: {
      id: "replay-72-fra-shot",
      minute: 72,
      type: "possible_goal",
      team: "home",
      description: "France flash a low shot across the six-yard box, forcing a sharp save.",
    },
    odds: {
      timestamp: "2026-07-15T20:27:00Z",
      market: "match_winner",
      homeProbability: 24,
      drawProbability: 33,
      awayProbability: 43,
      homePrice: 4.16,
      drawPrice: 3.03,
      awayPrice: 2.32,
    },
  },
  {
    minute: 77,
    phase: "second_half",
    score: { home: 0, away: 1 },
    event: {
      id: "replay-77-esp-yellow",
      minute: 77,
      type: "yellow_card",
      team: "away",
      description: "Spain's holding midfielder is booked for stopping a France counter.",
    },
    odds: {
      timestamp: "2026-07-15T20:32:00Z",
      market: "match_winner",
      homeProbability: 27,
      drawProbability: 35,
      awayProbability: 38,
      homePrice: 3.7,
      drawPrice: 2.85,
      awayPrice: 2.63,
    },
  },
  {
    minute: 84,
    phase: "second_half",
    score: { home: 0, away: 2 },
    event: {
      id: "replay-84-esp-goal",
      minute: 84,
      type: "goal",
      team: "away",
      description: "Spain break through the press and score the second goal into an open channel.",
    },
    odds: {
      timestamp: "2026-07-15T20:39:00Z",
      market: "match_winner",
      homeProbability: 3,
      drawProbability: 8,
      awayProbability: 89,
      homePrice: 33.33,
      drawPrice: 12.5,
      awayPrice: 1.12,
    },
  },
  {
    minute: 90,
    phase: "fulltime",
    score: { home: 0, away: 2 },
    event: {
      id: "replay-90-fulltime",
      minute: 90,
      type: "other",
      description: "Full-time: Spain close out a 2-0 semi-final win over France.",
    },
    odds: {
      timestamp: "2026-07-15T20:47:00Z",
      market: "match_winner",
      homeProbability: 0,
      drawProbability: 0,
      awayProbability: 100,
      homePrice: 0,
      drawPrice: 0,
      awayPrice: 1,
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
  {
    fixtureId: "replay-france-spain",
    homeTeam: "France",
    awayTeam: "Spain",
    status: "replay",
    minute: 67,
    score: "0-1",
    mode: "replay",
  },
];

export function getReplayInitialState(fixtureId: string): MatchState {
  return getReplayStateAt(fixtureId, fixtureId === "replay-france-spain" ? 0 : 1);
}

export function getReplayStateAt(fixtureId: string, index: number): MatchState {
  const replay = replayFor(fixtureId);
  const clampedIndex = Math.max(0, Math.min(index, replay.steps.length - 1));
  const current = replay.steps[clampedIndex];
  const previous = replay.steps[clampedIndex - 1];
  const recentEvents = replay.steps
    .slice(Math.max(0, clampedIndex - 4), clampedIndex + 1)
    .flatMap((step) => (step.event ? [step.event] : []));

  return {
    fixtureId,
    homeTeam: replay.homeTeam,
    awayTeam: replay.awayTeam,
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
  const replay = replayFor(fixtureId);
  const nextIndex = Math.min(currentIndex + 1, replay.steps.length - 1);
  return {
    state: getReplayStateAt(fixtureId, nextIndex),
    index: nextIndex,
    isEnd: nextIndex === replay.steps.length - 1,
  };
}

function replayFor(fixtureId: string): {
  homeTeam: string;
  awayTeam: string;
  steps: ReplayStep[];
} {
  if (fixtureId === "replay-england-croatia") {
    return { homeTeam: "England", awayTeam: "Croatia", steps: englandCroatiaSteps };
  }

  if (fixtureId === "replay-france-spain") {
    return { homeTeam: "France", awayTeam: "Spain", steps: franceSpainSteps };
  }

  throw new Error(`Unknown replay fixture: ${fixtureId}`);
}
