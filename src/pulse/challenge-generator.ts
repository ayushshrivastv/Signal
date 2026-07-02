import type { MatchState, PulseChallenge, ResolutionRule } from "../types.js";
import { detectLiveStory, getTeamName } from "./story-detector.js";

let challengeCounter = 1;

export function createPulseChallenge(state: MatchState): PulseChallenge {
  const story = detectLiveStory(state);
  const id = `signal-${Date.now()}-${challengeCounter++}`;
  const rule = selectResolutionRule(state, story);
  const question = writeQuestion(state, story, rule);
  const deadlineMinute =
    "deadlineMinute" in rule
      ? rule.deadlineMinute
      : rule.type === "no_major_change"
        ? rule.startMinute + rule.windowMinutes
        : undefined;

  return {
    id,
    fixtureId: state.fixtureId,
    status: "open",
    context: story.context,
    question,
    options: ["Yes", "No"],
    resolutionRule: rule,
    createdAtMinute: state.minute,
    answerByMinute: state.minute + 2,
    deadlineMinute,
  };
}

export function explainMarket(state: MatchState): string {
  if (!state.latestOdds) {
    return "Signal is waiting for TxLINE odds before reading the market reaction.";
  }

  const latest = state.latestOdds;
  const previous = state.previousOdds;
  const home = state.homeTeam;
  const away = state.awayTeam;

  if (!previous) {
    return `${home} are priced at ${fmt(latest.homeProbability)} while ${away} are at ${fmt(latest.awayProbability)}. Signal is waiting for the next odds move.`;
  }

  const homeDelta = delta(previous.homeProbability, latest.homeProbability);
  const awayDelta = delta(previous.awayProbability, latest.awayProbability);
  const leader =
    (latest.homeProbability ?? 0) >= (latest.awayProbability ?? 0) ? home : away;

  return `${home} moved ${homeDelta}; ${away} moved ${awayDelta}. The market is currently pricing ${leader} as the stronger side, but the match state is still live.`;
}

function selectResolutionRule(
  state: MatchState,
  story: ReturnType<typeof detectLiveStory>,
): ResolutionRule {
  switch (story.kind) {
    case "team_response":
      return {
        type: "team_pressure_response",
        team: story.team,
        deadlineMinute: story.deadlineMinute,
        signals: ["corner", "goal", "penalty", "possible_goal", "major_odds_recovery"],
      };
    case "pressure_spell":
      return {
        type: "team_pressure_response",
        team: story.team,
        deadlineMinute: story.deadlineMinute,
        signals: ["corner", "goal", "penalty", "possible_goal"],
      };
    case "card_tension":
      return {
        type: "team_gets_next_card",
        team: story.team,
        deadlineMinute: story.deadlineMinute,
      };
    case "calm_window":
      return {
        type: "no_major_change",
        startMinute: state.minute,
        windowMinutes: story.windowMinutes,
        maxProbabilityMove: 6,
      };
  }
}

function writeQuestion(
  state: MatchState,
  story: ReturnType<typeof detectLiveStory>,
  rule: ResolutionRule,
): string {
  if (rule.type === "team_pressure_response") {
    const teamName = getTeamName(state, rule.team);
    if (story.kind === "team_response") {
      return `Will ${teamName} create the next dangerous spell before ${minuteLabel(rule.deadlineMinute)}?`;
    }
    return `Will ${teamName} turn this pressure into another clear signal before ${minuteLabel(rule.deadlineMinute)}?`;
  }

  if (rule.type === "team_gets_next_card") {
    const teamName = getTeamName(state, rule.team);
    return `Will ${teamName}'s discipline wobble again before ${minuteLabel(rule.deadlineMinute)}?`;
  }

  if (rule.type === "no_major_change") {
    return `Will the next ${rule.windowMinutes} minutes stay calm, with no major score or market swing?`;
  }

  if (rule.type === "team_scores_before_minute") {
    return `Will ${getTeamName(state, rule.team)} score before ${minuteLabel(rule.deadlineMinute)}?`;
  }

  if (rule.type === "team_gets_next_corner") {
    return `Will ${getTeamName(state, rule.team)} win the next corner before ${minuteLabel(rule.deadlineMinute)}?`;
  }

  return `Will ${getTeamName(state, rule.team)} get the market moving back their way before ${minuteLabel(rule.deadlineMinute)}?`;
}

function fmt(value: number | undefined): string {
  return value === undefined ? "unknown" : `${value.toFixed(0)}%`;
}

function delta(previous: number | undefined, current: number | undefined): string {
  if (previous === undefined || current === undefined) return "without a clean probability read";
  const diff = current - previous;
  const sign = diff > 0 ? "+" : "";
  return `from ${previous.toFixed(0)}% to ${current.toFixed(0)}% (${sign}${diff.toFixed(0)} pts)`;
}

function minuteLabel(minute: number): string {
  if (minute === 45) return "halftime";
  if (minute === 90) return "full-time";
  return `${minute}'`;
}

