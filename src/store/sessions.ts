import type { PredictionSide, SignalPulse, SignalSession, TeamSide } from "../types.js";
import {
  attachWallet,
  createPredictionQuote,
  createSignalHighlights,
  recordDemoSignature,
} from "../markets/predictions.js";
import { createPulseChallenge, explainMarket } from "../pulse/challenge-generator.js";
import { resolveChallenge } from "../pulse/resolver.js";
import { txLineLiveEngine } from "../txline/live-engine.js";
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

export async function createLiveSession(fixtureId: string): Promise<SignalPulse> {
  const matchState = await txLineLiveEngine.openFixture(fixtureId);
  const session: SignalSession = {
    id: `session-${crypto.randomUUID()}`,
    fixtureId,
    mode: "live",
    matchState,
    challenge: createPulseChallenge(matchState),
    streak: 0,
    replayIndex: 0,
  };

  sessions.set(session.id, session);
  return toPulse(session);
}

export function getSessionPulse(sessionId: string): SignalPulse {
  const session = requireSession(sessionId);
  refreshLiveSession(session);
  return toPulse(session);
}

export function quotePredictionPosition(
  sessionId: string,
  input: {
    team: TeamSide;
    prediction?: PredictionSide;
    stakeUsd: number;
    windowMinutes?: number;
    walletAddress?: string;
  },
): SignalPulse {
  const session = requireSession(sessionId);
  refreshLiveSession(session);
  session.prediction = createPredictionQuote(session.matchState, {
    team: input.team,
    prediction: input.prediction ?? "YES",
    stakeUsd: input.stakeUsd,
    windowMinutes: input.windowMinutes,
    walletAddress: input.walletAddress,
  });

  return toPulse(session);
}

export function connectPredictionWallet(
  sessionId: string,
  positionId: string,
  walletAddress: string,
): SignalPulse {
  const session = requireSession(sessionId);
  if (!session.prediction || session.prediction.id !== positionId) {
    throw new Error("That prediction position is no longer active.");
  }

  session.prediction = attachWallet(session.prediction, walletAddress);
  return toPulse(session);
}

export function lockPredictionPosition(
  sessionId: string,
  positionId: string,
  walletAddress: string,
  txSignature: string,
): SignalPulse {
  const session = requireSession(sessionId);
  if (!session.prediction || session.prediction.id !== positionId) {
    throw new Error("That prediction position is no longer active.");
  }

  session.prediction = recordDemoSignature(session.prediction, walletAddress, txSignature);
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
  if (session.mode === "live") {
    refreshLiveSession(session);
  } else {
    const next = getNextReplayState(session.fixtureId, session.replayIndex);
    session.matchState = next.state;
    session.replayIndex = next.index;
  }

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
  refreshLiveSession(session);
  const score = `${session.matchState.score.home}-${session.matchState.score.away}`;
  const resultLine = session.lastResult?.result
    ? `${session.lastResult.result} ${session.lastResult.correct ? "Your read was right." : "That one went the other way."}`
    : "The current challenge is still waiting for the next TxLINE signal.";

  return {
    script: `${session.matchState.homeTeam} ${score} ${session.matchState.awayTeam}, ${session.matchState.minute} minutes played. ${resultLine} ${explainMarket(session.matchState)}`,
  };
}

export function getTxLineLiveHealth(fixtureId?: string) {
  return txLineLiveEngine.getHealth(fixtureId);
}

function requireSession(sessionId: string): SignalSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Unknown Signal session: ${sessionId}`);
  return session;
}

function refreshLiveSession(session: SignalSession): void {
  if (session.mode !== "live") return;
  const latest = txLineLiveEngine.getState(session.fixtureId);
  if (latest) session.matchState = latest;
}

function toPulse(session: SignalSession): SignalPulse {
  const marketExplanation = explainMarket(session.matchState);
  return {
    sessionId: session.id,
    matchState: session.matchState,
    marketExplanation,
    highlights: createSignalHighlights(session.matchState, marketExplanation),
    challenge: session.challenge,
    prediction: session.prediction,
    streak: session.streak,
    lastResult: session.lastResult,
  };
}
