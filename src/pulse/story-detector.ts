import type { MatchState, TeamSide } from "../types.js";

export type LiveStory =
  | {
      kind: "team_response";
      team: TeamSide;
      headline: string;
      context: string;
      deadlineMinute: number;
    }
  | {
      kind: "pressure_spell";
      team: TeamSide;
      headline: string;
      context: string;
      deadlineMinute: number;
    }
  | {
      kind: "card_tension";
      team: TeamSide;
      headline: string;
      context: string;
      deadlineMinute: number;
    }
  | {
      kind: "calm_window";
      headline: string;
      context: string;
      windowMinutes: number;
    };

export function detectLiveStory(state: MatchState): LiveStory {
  const latestEvent = state.recentEvents.at(-1);
  const oddsDelta = getLargestProbabilityDelta(state);

  if (oddsDelta && Math.abs(oddsDelta.delta) >= 8) {
    const teamThatLostTrust: TeamSide = oddsDelta.delta < 0 ? oddsDelta.team : opposite(oddsDelta.team);
    const teamName = getTeamName(state, teamThatLostTrust);
    const previous = oddsDelta.previous.toFixed(0);
    const current = oddsDelta.current.toFixed(0);
    return {
      kind: "team_response",
      team: teamThatLostTrust,
      headline: `${teamName} need a response`,
      context: `${teamName}'s implied win probability moved from ${previous}% to ${current}%, so the market is asking whether they can steady the match.`,
      deadlineMinute: state.phase === "first_half" ? 45 : Math.min(state.minute + 12, 90),
    };
  }

  if (latestEvent?.type === "yellow_card" && latestEvent.team) {
    const teamName = getTeamName(state, latestEvent.team);
    return {
      kind: "card_tension",
      team: latestEvent.team,
      headline: `${teamName} are walking a card tightrope`,
      context: `${teamName} just picked up a booking, which changes how aggressively they can defend the next break.`,
      deadlineMinute: Math.min(state.minute + 12, state.phase === "first_half" ? 45 : 90),
    };
  }

  if (latestEvent?.type === "corner" && latestEvent.team) {
    const teamName = getTeamName(state, latestEvent.team);
    return {
      kind: "pressure_spell",
      team: latestEvent.team,
      headline: `${teamName} are turning up the pressure`,
      context: `${teamName} just forced a corner and the match is tilting toward their attacking spell.`,
      deadlineMinute: Math.min(state.minute + 10, state.phase === "first_half" ? 45 : 90),
    };
  }

  return {
    kind: "calm_window",
    headline: "The match is waiting for the next signal",
    context: "The score and market are both holding steady, which makes the next few minutes a test of whether this calm lasts.",
    windowMinutes: 8,
  };
}

export function getTeamName(state: MatchState, team: TeamSide): string {
  return team === "home" ? state.homeTeam : state.awayTeam;
}

function opposite(team: TeamSide): TeamSide {
  return team === "home" ? "away" : "home";
}

function getLargestProbabilityDelta(
  state: MatchState,
): { team: TeamSide; previous: number; current: number; delta: number } | null {
  if (!state.latestOdds || !state.previousOdds) return null;

  const homePrevious = state.previousOdds.homeProbability;
  const homeCurrent = state.latestOdds.homeProbability;
  const awayPrevious = state.previousOdds.awayProbability;
  const awayCurrent = state.latestOdds.awayProbability;

  const deltas = [
    homePrevious !== undefined && homeCurrent !== undefined
      ? { team: "home" as const, previous: homePrevious, current: homeCurrent, delta: homeCurrent - homePrevious }
      : null,
    awayPrevious !== undefined && awayCurrent !== undefined
      ? { team: "away" as const, previous: awayPrevious, current: awayCurrent, delta: awayCurrent - awayPrevious }
      : null,
  ].filter(Boolean) as Array<{ team: TeamSide; previous: number; current: number; delta: number }>;

  return deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] ?? null;
}
