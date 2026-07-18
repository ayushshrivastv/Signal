import type {
  MatchState,
  PredictionSide,
  SignalHighlight,
  SignalPredictionPosition,
  TeamSide,
} from "../types.js";

let positionCounter = 1;

export type PredictionQuoteInput = {
  team: TeamSide;
  prediction: PredictionSide;
  stakeUsd: number;
  windowMinutes?: number;
  walletAddress?: string;
};

export function createPredictionQuote(
  state: MatchState,
  input: PredictionQuoteInput,
): SignalPredictionPosition {
  const windowMinutes = input.windowMinutes ?? 10;
  const teamName = getTeamName(state, input.team);
  const openedMinute = state.minute;
  const expiryMinute = openedMinute + windowMinutes;

  return {
    id: `position-${Date.now()}-${positionCounter++}`,
    fixtureId: state.fixtureId,
    market: "team_goal_next_window",
    marketLabel: `${teamName} goal in next ${windowMinutes} minutes`,
    prediction: input.prediction,
    team: input.team,
    teamName,
    stakeUsd: roundStake(input.stakeUsd),
    asset: "USDC",
    windowMinutes,
    openedMinute,
    expiryMinute,
    status: input.walletAddress ? "ready_to_sign" : "quote",
    walletAddress: input.walletAddress,
    escrowProgram: process.env.SIGNAL_ESCROW_PROGRAM_ID ?? "SignalEscrowDevnet111111111111111111111111111",
    settlementSource: "TxLINE score events",
    settlementRule: `${input.prediction} resolves from TxLINE score events between ${openedMinute}' and ${expiryMinute}' for ${teamName}.`,
    network: "devnet",
    complianceNote:
      "Hackathon demo only. This prepares escrow metadata and does not offer production wagering or legal advice.",
  };
}

export function attachWallet(
  position: SignalPredictionPosition,
  walletAddress: string,
): SignalPredictionPosition {
  return {
    ...position,
    walletAddress,
    status: "ready_to_sign",
  };
}

export function recordDemoSignature(
  position: SignalPredictionPosition,
  walletAddress: string,
  txSignature: string,
): SignalPredictionPosition {
  return {
    ...position,
    walletAddress,
    txSignature,
    status: "locked",
  };
}

export function createSignalHighlights(state: MatchState, marketExplanation: string): SignalHighlight[] {
  const latestEvent = state.recentEvents.at(-1);
  const scoreLine = `${state.homeTeam} ${state.score.home}-${state.score.away} ${state.awayTeam}`;
  const highlights: SignalHighlight[] = [];

  if (latestEvent) {
    highlights.push({
      id: `${latestEvent.id}-highlight`,
      label: `${latestEvent.minute}' TxLINE event`,
      text: latestEvent.description,
      source: "txline-score",
    });
  }

  highlights.push({
    id: `${state.fixtureId}-${state.minute}-odds`,
    label: "Market move",
    text: marketExplanation,
    source: "txline-odds",
  });

  highlights.push({
    id: `${state.fixtureId}-${state.minute}-state`,
    label: state.phase === "fulltime" ? "Full-time" : `${state.minute}' match state`,
    text: `${scoreLine}. Signal is tracking the next short window from the live feed.`,
    source: "signal",
  });

  return highlights.slice(0, 3);
}

function getTeamName(state: MatchState, team: TeamSide): string {
  return team === "home" ? state.homeTeam : state.awayTeam;
}

function roundStake(stakeUsd: number): number {
  return Math.max(0.01, Math.round(stakeUsd * 100) / 100);
}
