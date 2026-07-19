export type TeamSide = "home" | "away";

export type MatchPhase =
  | "pre_match"
  | "first_half"
  | "halftime"
  | "second_half"
  | "fulltime";

export type MatchEventType =
  | "goal"
  | "yellow_card"
  | "red_card"
  | "corner"
  | "penalty"
  | "possible_goal"
  | "odds_swing"
  | "other";

export type MatchEvent = {
  id: string;
  minute: number;
  type: MatchEventType;
  team?: TeamSide;
  description: string;
  raw?: unknown;
};

export type OddsSnapshot = {
  timestamp: string;
  market: string;
  homeProbability?: number;
  drawProbability?: number;
  awayProbability?: number;
  homePrice?: number;
  drawPrice?: number;
  awayPrice?: number;
  raw?: unknown;
};

export type MatchState = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  participant1IsHome?: boolean;
  minute: number;
  phase: MatchPhase;
  score: {
    home: number;
    away: number;
  };
  recentEvents: MatchEvent[];
  latestOdds: OddsSnapshot | null;
  previousOdds: OddsSnapshot | null;
  mode: "live" | "replay";
};

export type LiveMatchSummary = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  participant1IsHome?: boolean;
  startTime?: string;
  competition?: string;
  status: "live" | "upcoming" | "finished" | "replay";
  minute?: number;
  score?: string;
  mode: "live" | "replay";
};

export type ResolutionRule =
  | {
      type: "team_gets_next_corner";
      team: TeamSide;
      deadlineMinute: number;
    }
  | {
      type: "team_scores_before_minute";
      team: TeamSide;
      deadlineMinute: number;
    }
  | {
      type: "team_gets_next_card";
      team: TeamSide;
      deadlineMinute: number;
    }
  | {
      type: "team_pressure_response";
      team: TeamSide;
      deadlineMinute: number;
      signals: Array<
        "corner" | "goal" | "penalty" | "possible_goal" | "major_odds_recovery"
      >;
    }
  | {
      type: "odds_reversal";
      team: TeamSide;
      minProbabilityMove: number;
      deadlineMinute: number;
    }
  | {
      type: "no_major_change";
      windowMinutes: number;
      maxProbabilityMove: number;
      startMinute: number;
    };

export type PulseChallenge = {
  id: string;
  fixtureId: string;
  status: "open" | "locked" | "resolved" | "expired";
  context: string;
  question: string;
  options: ["Yes", "No"] | ["Goal", "Card", "Corner", "Calm"];
  userAnswer?: string;
  resolutionRule: ResolutionRule;
  createdAtMinute: number;
  deadlineMinute?: number;
  answerByMinute?: number;
};

export type PulseResult = {
  resolved: boolean;
  correct?: boolean;
  result?: string;
  matchedEvent?: MatchEvent;
};

export type SignalPulse = {
  sessionId: string;
  matchState: MatchState;
  marketExplanation: string;
  highlights: SignalHighlight[];
  challenge: PulseChallenge;
  prediction?: SignalPredictionPosition;
  streak: number;
  lastResult?: PulseResult;
};

export type SignalSession = {
  id: string;
  fixtureId: string;
  mode: "live" | "replay";
  matchState: MatchState;
  challenge: PulseChallenge;
  prediction?: SignalPredictionPosition;
  streak: number;
  replayIndex: number;
  lastResult?: PulseResult;
};

export type TxLineStreamHealth = {
  fixtureId: string;
  scoresStatus: "idle" | "connecting" | "open" | "error";
  oddsStatus: "idle" | "connecting" | "open" | "error";
  lastScoresAt?: string;
  lastOddsAt?: string;
  lastError?: string;
};

export type SignalHighlight = {
  id: string;
  label: string;
  text: string;
  source: "txline-score" | "txline-odds" | "signal";
};

export type PredictionMarketType = "team_goal_next_window";
export type PredictionSide = "YES" | "NO";
export type PredictionPositionStatus = "quote" | "ready_to_sign" | "locked" | "settled_demo";

export type SignalPredictionPosition = {
  id: string;
  fixtureId: string;
  market: PredictionMarketType;
  marketLabel: string;
  prediction: PredictionSide;
  team: TeamSide;
  teamName: string;
  stakeUsd: number;
  asset: "USDC";
  windowMinutes: number;
  openedMinute: number;
  expiryMinute: number;
  status: PredictionPositionStatus;
  walletAddress?: string;
  txSignature?: string;
  escrowProgram: string;
  settlementSource: "TxLINE score events";
  settlementRule: string;
  network: "devnet";
  complianceNote: string;
};
