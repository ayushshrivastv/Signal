import type { SignalPulse, SignalSession } from "../types.js";
import { createPulseChallenge, explainMarket } from "../pulse/challenge-generator.js";
import { resolveChallenge } from "../pulse/resolver.js";
import { getNextReplayState, getReplayInitialState } from "../txline/replay.js";

const sessions = new Map<string, SignalSession>();

export function createReplaySession(fixtureId: string): SignalPulse {
  const matchState = getReplayInitialState(fixtureId);
  const session: SignalSession = {
    id: `session-${crypto.randomUUID()}`,
    fixtureId,
    mode: "replay",
    matchState,
    challenge: createPulseChallenge(matchState),
    streak: 0,
    replayIndex: 1,
  };

  sessions.set(session.id, session);
  return toPulse(session);
}

export function getSessionPulse(sessionId: string): SignalPulse {
  const session = requireSession(sessionId);
  return toPulse(session);
}

export function submitAnswer(sessionId: string, challengeId: string, answer: string): SignalPulse {
  const session = requireSession(sessionId);
  if (session.challenge.id !== challengeId) {
    throw new Error("That challenge is no longer active.");
  }

  if (!["Yes", "No"].includes(answer)) {
    throw new Error("Signal challenges currently accept Yes or No.");
  }

  session.challenge = {
    ...session.challenge,
    status: "locked",
    userAnswer: answer,
  };

  return toPulse(session);
}

export function resolveSessionPulse(sessionId: string, challengeId: string): SignalPulse {
  const session = requireSession(sessionId);
  if (session.challenge.id !== challengeId) {
    throw new Error("That challenge is no longer active.");
  }

  const previousState = session.matchState;
  const next = getNextReplayState(session.fixtureId, session.replayIndex);
  session.matchState = next.state;
  session.replayIndex = next.index;

  const result = resolveChallenge(session.challenge, previousState, session.matchState);
  session.lastResult = result;

  if (result.resolved) {
    session.streak = result.correct ? session.streak + 1 : 0;
    session.challenge = {
      ...createPulseChallenge(session.matchState),
      status: "open",
    };
  }

  return toPulse(session);
}

export function getSpokenSummary(sessionId: string): { script: string } {
  const session = requireSession(sessionId);
  const score = `${session.matchState.score.home}-${session.matchState.score.away}`;
  const resultLine = session.lastResult?.result
    ? `${session.lastResult.result} ${session.lastResult.correct ? "Your read was right." : "That one went the other way."}`
    : "The current challenge is still waiting for the next TxLINE signal.";

  return {
    script: `${session.matchState.homeTeam} ${score} ${session.matchState.awayTeam}, ${session.matchState.minute} minutes played. ${resultLine} ${explainMarket(session.matchState)}`,
  };
}

function requireSession(sessionId: string): SignalSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Unknown Signal session: ${sessionId}`);
  return session;
}

function toPulse(session: SignalSession): SignalPulse {
  return {
    sessionId: session.id,
    matchState: session.matchState,
    marketExplanation: explainMarket(session.matchState),
    challenge: session.challenge,
    streak: session.streak,
    lastResult: session.lastResult,
  };
}

