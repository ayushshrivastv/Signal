import type { MatchEvent, MatchState, PulseChallenge, PulseResult, TeamSide } from "../types.js";

export function resolveChallenge(
  challenge: PulseChallenge,
  previousState: MatchState,
  nextState: MatchState,
): PulseResult {
  const newEvents = nextState.recentEvents.filter(
    (event) => !previousState.recentEvents.some((oldEvent) => oldEvent.id === event.id),
  );
  const rule = challenge.resolutionRule;

  if (rule.type === "team_pressure_response") {
    const matchedEvent = newEvents.find(
      (event) =>
        event.team === rule.team &&
        event.minute <= rule.deadlineMinute &&
        isPressureSignal(event, rule.signals),
    );
    if (matchedEvent) return outcome(challenge, true, describeEvent(nextState, matchedEvent), matchedEvent);
    if (nextState.minute >= rule.deadlineMinute) return outcome(challenge, false, "The window closed before that response arrived.");
    return { resolved: false };
  }

  if (rule.type === "team_gets_next_card") {
    const matchedEvent = newEvents.find(
      (event) =>
        event.team === rule.team &&
        event.minute <= rule.deadlineMinute &&
        (event.type === "yellow_card" || event.type === "red_card"),
    );
    if (matchedEvent) return outcome(challenge, true, describeEvent(nextState, matchedEvent), matchedEvent);
    if (nextState.minute >= rule.deadlineMinute) return outcome(challenge, false, "The card-pressure window closed without another booking.");
    return { resolved: false };
  }

  if (rule.type === "team_gets_next_corner") {
    return resolveSimpleEvent(challenge, nextState, newEvents, rule.team, "corner", rule.deadlineMinute);
  }

  if (rule.type === "team_scores_before_minute") {
    return resolveSimpleEvent(challenge, nextState, newEvents, rule.team, "goal", rule.deadlineMinute);
  }

  if (rule.type === "odds_reversal") {
    const previous = probabilityFor(previousState, rule.team);
    const current = probabilityFor(nextState, rule.team);
    if (previous !== undefined && current !== undefined && current - previous >= rule.minProbabilityMove) {
      return outcome(challenge, true, `${teamName(nextState, rule.team)} got a meaningful market recovery.`);
    }
    if (nextState.minute >= rule.deadlineMinute) return outcome(challenge, false, "The market did not reverse enough before the deadline.");
    return { resolved: false };
  }

  const hasMajorEvent = newEvents.some((event) =>
    ["goal", "red_card", "penalty", "possible_goal"].includes(event.type),
  );
  const homeMove = Math.abs(
    (nextState.latestOdds?.homeProbability ?? 0) - (previousState.latestOdds?.homeProbability ?? 0),
  );
  const awayMove = Math.abs(
    (nextState.latestOdds?.awayProbability ?? 0) - (previousState.latestOdds?.awayProbability ?? 0),
  );
  const isMajorMove = Math.max(homeMove, awayMove) > rule.maxProbabilityMove;

  if (hasMajorEvent || isMajorMove) {
    return outcome(challenge, false, "The calm broke: Signal saw a meaningful match or market move.");
  }

  if (nextState.minute >= rule.startMinute + rule.windowMinutes) {
    return outcome(challenge, true, "The window stayed calm without a major score or market signal.");
  }

  return { resolved: false };
}

function resolveSimpleEvent(
  challenge: PulseChallenge,
  state: MatchState,
  newEvents: MatchEvent[],
  team: TeamSide,
  eventType: MatchEvent["type"],
  deadlineMinute: number,
): PulseResult {
  const matchedEvent = newEvents.find(
    (event) => event.team === team && event.type === eventType && event.minute <= deadlineMinute,
  );
  if (matchedEvent) return outcome(challenge, true, describeEvent(state, matchedEvent), matchedEvent);
  if (state.minute >= deadlineMinute) return outcome(challenge, false, "The deadline passed before the signal arrived.");
  return { resolved: false };
}

function isPressureSignal(
  event: MatchEvent,
  signals: Array<"corner" | "goal" | "penalty" | "possible_goal" | "major_odds_recovery">,
): boolean {
  return signals.some((signal) => signal === event.type);
}

function outcome(
  challenge: PulseChallenge,
  yesOutcomeHappened: boolean,
  result: string,
  matchedEvent?: MatchEvent,
): PulseResult {
  const answeredYes = challenge.userAnswer?.toLowerCase() === "yes";
  return {
    resolved: true,
    correct: answeredYes === yesOutcomeHappened,
    result,
    matchedEvent,
  };
}

function describeEvent(state: MatchState, event: MatchEvent): string {
  const name = event.team ? teamName(state, event.team) : "The match";
  return `${name} triggered the signal: ${event.description}`;
}

function teamName(state: MatchState, team: TeamSide): string {
  return team === "home" ? state.homeTeam : state.awayTeam;
}

function probabilityFor(state: MatchState, team: TeamSide): number | undefined {
  return team === "home" ? state.latestOdds?.homeProbability : state.latestOdds?.awayProbability;
}

