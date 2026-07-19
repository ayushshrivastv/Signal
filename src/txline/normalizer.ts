import type {
  LiveMatchSummary,
  MatchEvent,
  MatchEventType,
  MatchPhase,
  MatchState,
  OddsSnapshot,
  TeamSide,
} from "../types.js";

type AnyRecord = Record<string, unknown>;

export function normalizeFixture(item: unknown, index: number): LiveMatchSummary {
  const record = asRecord(item);
  const fixtureId = String(read(record, ["FixtureId", "fixtureId", "fixture_id", "id"]) ?? `txline-fixture-${index}`);
  const participant1 = String(read(record, ["Participant1", "participant1", "homeTeam", "home_team", "home"]) ?? "Home");
  const participant2 = String(read(record, ["Participant2", "participant2", "awayTeam", "away_team", "away"]) ?? "Away");
  const participant1IsHome = readBoolean(record, ["Participant1IsHome", "participant1IsHome"], true);
  const homeTeam = participant1IsHome ? participant1 : participant2;
  const awayTeam = participant1IsHome ? participant2 : participant1;
  const gameState = read(record, ["GameState", "gameState", "StatusId", "statusId", "status", "state"]);
  const score = scoreFromRecord(record, participant1IsHome);

  return {
    fixtureId,
    homeTeam,
    awayTeam,
    participant1IsHome,
    competition: optionalString(read(record, ["Competition", "competition", "FixtureGroup", "fixtureGroup"])),
    startTime: optionalString(read(record, ["StartTime", "startTime", "start_time"])),
    status: normalizeFixtureStatus(gameState),
    minute: numberFrom(read(record, ["Minute", "minute", "GameTime", "gameTime"])),
    score: score ? `${score.home}-${score.away}` : undefined,
    mode: "live",
  };
}

export function matchStateFromFixture(fixture: LiveMatchSummary): MatchState {
  const [homeScore = 0, awayScore = 0] = (fixture.score ?? "0-0")
    .split("-")
    .map((part) => Number(part.trim()));

  return {
    fixtureId: fixture.fixtureId,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    participant1IsHome: fixture.participant1IsHome,
    minute: fixture.minute ?? 0,
    phase: fixture.status === "finished" ? "fulltime" : fixture.status === "live" ? "first_half" : "pre_match",
    score: {
      home: Number.isFinite(homeScore) ? homeScore : 0,
      away: Number.isFinite(awayScore) ? awayScore : 0,
    },
    recentEvents: [],
    latestOdds: null,
    previousOdds: null,
    mode: "live",
  };
}

export function mergeScoresUpdate(state: MatchState, payload: unknown): MatchState {
  const records = normalizePayloadArray(payload);
  let next = state;

  for (const record of records) {
    if (!recordMatchesFixture(record, state.fixtureId)) continue;

    const score = scoreFromRecord(record, state.participant1IsHome ?? true);
    const phase = phaseFromRecord(record) ?? next.phase;
    const minute = numberFrom(read(record, ["Minute", "minute", "GameTime", "gameTime", "ClockMinute", "clockMinute"])) ?? next.minute;
    const event = eventFromRecord(record, next);

    next = {
      ...next,
      minute,
      phase,
      score: score ?? next.score,
      recentEvents: event ? dedupeEvents([...next.recentEvents, event]).slice(-12) : next.recentEvents,
    };
  }

  return next;
}

export function mergeOddsUpdate(state: MatchState, payload: unknown): MatchState {
  const records = normalizePayloadArray(payload);
  let next = state;

  for (const record of records) {
    if (!recordMatchesFixture(record, state.fixtureId)) continue;
    const odds = oddsFromRecord(record);
    if (!odds) continue;

    next = {
      ...next,
      latestOdds: odds,
      previousOdds: next.latestOdds,
    };
  }

  return next;
}

export function payloadTouchesFixture(payload: unknown, fixtureId: string): boolean {
  return normalizePayloadArray(payload).some((record) => recordMatchesFixture(record, fixtureId));
}

function normalizePayloadArray(payload: unknown): AnyRecord[] {
  if (Array.isArray(payload)) return payload.map(asRecord);
  const record = asRecord(payload);
  for (const key of ["data", "items", "results", "updates", "scores", "odds"]) {
    const value = record[key];
    if (Array.isArray(value)) return value.map(asRecord);
  }
  return [record];
}

function recordMatchesFixture(record: AnyRecord, fixtureId: string): boolean {
  const value = read(record, ["FixtureId", "fixtureId", "fixture_id", "id"]);
  return value === undefined || String(value) === String(fixtureId);
}

function scoreFromRecord(
  record: AnyRecord,
  participant1IsHome: boolean,
): MatchState["score"] | undefined {
  const home = numberFrom(read(record, ["HomeScore", "homeScore", "home_score", "ScoreHome", "scoreHome"]));
  const away = numberFrom(read(record, ["AwayScore", "awayScore", "away_score", "ScoreAway", "scoreAway"]));
  if (home !== undefined && away !== undefined) return { home, away };

  const p1 = statValue(record, 1) ?? numberFrom(read(record, ["Participant1Score", "participant1Score", "participant1Goals"]));
  const p2 = statValue(record, 2) ?? numberFrom(read(record, ["Participant2Score", "participant2Score", "participant2Goals"]));
  if (p1 === undefined || p2 === undefined) return undefined;

  return participant1IsHome ? { home: p1, away: p2 } : { home: p2, away: p1 };
}

function statValue(record: AnyRecord, key: number): number | undefined {
  const stats = read(record, ["Stats", "stats"]);
  if (!stats || typeof stats !== "object") return undefined;

  if (Array.isArray(stats)) {
    for (const item of stats) {
      const stat = asRecord(item);
      const statKey = numberFrom(read(stat, ["Key", "key", "StatKey", "statKey"]));
      if (statKey === key) return numberFrom(read(stat, ["Value", "value"]));
    }
    return undefined;
  }

  const value = (stats as AnyRecord)[String(key)] ?? (stats as AnyRecord)[key];
  return numberFrom(value);
}

function eventFromRecord(record: AnyRecord, state: MatchState): MatchEvent | undefined {
  const action = String(read(record, ["Action", "action", "Type", "type", "event", "eventType"]) ?? "").toLowerCase();
  const data = asRecord(read(record, ["Data", "data"]));
  const dataType = String(read(data, ["Type", "type", "Outcome", "outcome", "FreeKickType", "freeKickType"]) ?? "").toLowerCase();
  const type = eventTypeFromAction(action, dataType);
  if (!type) return undefined;

  const participant = numberFrom(read(record, ["Participant", "participant", "Team", "team", "TeamId", "teamId"]));
  const team = participantToSide(participant, state.participant1IsHome ?? true);
  const minute = numberFrom(read(record, ["Minute", "minute", "GameTime", "gameTime", "ClockMinute", "clockMinute"])) ?? state.minute;
  const seq = read(record, ["Seq", "seq", "Sequence", "sequence"]);
  const id = `${state.fixtureId}-${seq ?? type}-${minute}-${team ?? "match"}`;

  return {
    id,
    minute,
    type,
    team,
    description: describeEvent(type, team, state, record),
    raw: record,
  };
}

function oddsFromRecord(record: AnyRecord): OddsSnapshot | undefined {
  const homeProbability = probabilityFromRecord(record, ["homeProbability", "HomeProbability", "p1Probability", "Participant1Probability"]);
  const drawProbability = probabilityFromRecord(record, ["drawProbability", "DrawProbability"]);
  const awayProbability = probabilityFromRecord(record, ["awayProbability", "AwayProbability", "p2Probability", "Participant2Probability"]);
  const homePrice = priceFromRecord(record, ["homePrice", "HomePrice", "Participant1Price", "P1Price"]);
  const drawPrice = priceFromRecord(record, ["drawPrice", "DrawPrice"]);
  const awayPrice = priceFromRecord(record, ["awayPrice", "AwayPrice", "Participant2Price", "P2Price"]);

  if (
    homeProbability === undefined &&
    drawProbability === undefined &&
    awayProbability === undefined &&
    homePrice === undefined &&
    drawPrice === undefined &&
    awayPrice === undefined
  ) {
    return undefined;
  }

  return {
    timestamp: optionalString(read(record, ["Timestamp", "timestamp", "Ts", "ts", "UpdatedAt", "updatedAt"])) ?? new Date().toISOString(),
    market: String(read(record, ["SuperOddsType", "superOddsType", "Market", "market", "marketName"]) ?? "stable_price"),
    homeProbability,
    drawProbability,
    awayProbability,
    homePrice,
    drawPrice,
    awayPrice,
    raw: record,
  };
}

function probabilityFromRecord(record: AnyRecord, keys: string[]): number | undefined {
  const direct = numberFrom(read(record, keys));
  if (direct !== undefined) return direct > 1 ? direct : direct * 100;
  const price = priceFromRecord(record, keys.map((key) => key.replace(/Probability/i, "Price")));
  return price && price > 0 ? 100 / price : undefined;
}

function priceFromRecord(record: AnyRecord, keys: string[]): number | undefined {
  return numberFrom(read(record, keys));
}

function eventTypeFromAction(action: string, dataType: string): MatchEventType | undefined {
  const value = `${action} ${dataType}`;
  if (value.includes("goal")) return "goal";
  if (value.includes("yellow")) return "yellow_card";
  if (value.includes("red")) return "red_card";
  if (value.includes("corner")) return "corner";
  if (value.includes("penalty")) return "penalty";
  if (value.includes("shot") || value.includes("danger")) return "possible_goal";
  return undefined;
}

function phaseFromRecord(record: AnyRecord): MatchPhase | undefined {
  const value = read(record, ["StatusId", "statusId", "GameState", "gameState", "Period", "period"]);
  const id = numberFrom(value);
  if (id === 1) return "pre_match";
  if (id === 2) return "first_half";
  if (id === 3) return "halftime";
  if (id === 4) return "second_half";
  if (id === 5 || id === 10 || id === 13 || id === 100) return "fulltime";

  const text = String(value ?? "").toLowerCase();
  if (text.includes("first") || text === "h1") return "first_half";
  if (text.includes("half") || text === "ht") return "halftime";
  if (text.includes("second") || text === "h2") return "second_half";
  if (text.includes("final") || text.includes("ended") || text.includes("full")) return "fulltime";
  return undefined;
}

function normalizeFixtureStatus(value: unknown): LiveMatchSummary["status"] {
  const id = numberFrom(value);
  if (id === 5 || id === 10 || id === 13 || id === 100) return "finished";
  if (id && id > 1) return "live";

  const text = String(value ?? "").toLowerCase();
  if (text.includes("live") || text.includes("play") || text.includes("running")) return "live";
  if (text.includes("finish") || text.includes("ended") || text.includes("final")) return "finished";
  return "upcoming";
}

function participantToSide(participant: number | undefined, participant1IsHome: boolean): TeamSide | undefined {
  if (participant === undefined) return undefined;
  if (participant === 1) return participant1IsHome ? "home" : "away";
  if (participant === 2) return participant1IsHome ? "away" : "home";
  return undefined;
}

function describeEvent(type: MatchEventType, team: TeamSide | undefined, state: MatchState, record: AnyRecord): string {
  const teamName = team === "home" ? state.homeTeam : team === "away" ? state.awayTeam : "The match";
  const text = optionalString(read(asRecord(read(record, ["Data", "data"])), ["Text", "text", "Description", "description"]));
  if (text) return text;

  const labels: Record<MatchEventType, string> = {
    goal: "score a goal",
    yellow_card: "receive a yellow card",
    red_card: "receive a red card",
    corner: "win a corner",
    penalty: "are involved in a penalty signal",
    possible_goal: "create a dangerous attacking signal",
    odds_swing: "trigger a market move",
    other: "produce a match signal",
  };

  return `${teamName} ${labels[type]}.`;
}

function dedupeEvents(events: MatchEvent[]): MatchEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function read(record: AnyRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) return record[key];
  }
  return undefined;
}

function readBoolean(record: AnyRecord, keys: string[], fallback: boolean): boolean {
  const value = read(record, keys);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}
