import type { LiveMatchSummary, MatchState, TxLineStreamHealth } from "../types.js";
import { createPulseChallenge } from "../pulse/challenge-generator.js";
import { createTxLineClientFromEnv, type TxLineClient } from "./client.js";
import {
  matchStateFromFixture,
  mergeOddsUpdate,
  mergeScoresUpdate,
  payloadTouchesFixture,
} from "./normalizer.js";

type LiveFixtureRuntime = {
  fixture: LiveMatchSummary;
  state: MatchState;
  health: TxLineStreamHealth;
  controllers: {
    scores?: AbortController;
    odds?: AbortController;
  };
  started: boolean;
};

export class TxLineLiveEngine {
  private readonly client: TxLineClient;
  private readonly runtimes = new Map<string, LiveFixtureRuntime>();

  constructor(client = createTxLineClientFromEnv()) {
    this.client = client;
  }

  get isConfigured(): boolean {
    return this.client.isConfigured;
  }

  async listFixtures(): Promise<LiveMatchSummary[]> {
    return this.client.listFixtures();
  }

  async openFixture(fixtureId: string): Promise<MatchState> {
    const existing = this.runtimes.get(fixtureId);
    if (existing) return existing.state;

    if (!this.client.isConfigured) {
      throw new Error("TxLINE live mode requires TXLINE_API_TOKEN and a valid activated subscription.");
    }

    const fixture = await this.findFixture(fixtureId);
    const runtime: LiveFixtureRuntime = {
      fixture,
      state: matchStateFromFixture(fixture),
      health: {
        fixtureId,
        scoresStatus: "idle",
        oddsStatus: "idle",
      },
      controllers: {},
      started: false,
    };

    this.runtimes.set(fixtureId, runtime);
    await this.hydrateSnapshots(runtime);
    this.startStreams(runtime);
    return runtime.state;
  }

  getState(fixtureId: string): MatchState | undefined {
    return this.runtimes.get(fixtureId)?.state;
  }

  getHealth(fixtureId?: string): TxLineStreamHealth[] {
    const values = [...this.runtimes.values()].map((runtime) => runtime.health);
    return fixtureId ? values.filter((health) => health.fixtureId === fixtureId) : values;
  }

  stopFixture(fixtureId: string): void {
    const runtime = this.runtimes.get(fixtureId);
    if (!runtime) return;
    runtime.controllers.scores?.abort();
    runtime.controllers.odds?.abort();
    this.runtimes.delete(fixtureId);
  }

  private async findFixture(fixtureId: string): Promise<LiveMatchSummary> {
    const fixtures = await this.client.listFixtures();
    const fixture = fixtures.find((item) => String(item.fixtureId) === String(fixtureId));
    if (!fixture) throw new Error(`TxLINE fixture not found: ${fixtureId}`);
    return fixture;
  }

  private async hydrateSnapshots(runtime: LiveFixtureRuntime): Promise<void> {
    const [scoresResult, oddsResult] = await Promise.allSettled([
      this.client.getScoresSnapshot(runtime.fixture.fixtureId),
      this.client.getOddsSnapshot(runtime.fixture.fixtureId),
    ]);

    if (scoresResult.status === "fulfilled") {
      runtime.state = mergeScoresUpdate(runtime.state, scoresResult.value);
      runtime.health.lastScoresAt = new Date().toISOString();
    } else {
      runtime.health.lastError = scoresResult.reason instanceof Error ? scoresResult.reason.message : String(scoresResult.reason);
    }

    if (oddsResult.status === "fulfilled") {
      runtime.state = mergeOddsUpdate(runtime.state, oddsResult.value);
      runtime.health.lastOddsAt = new Date().toISOString();
    } else {
      runtime.health.lastError = oddsResult.reason instanceof Error ? oddsResult.reason.message : String(oddsResult.reason);
    }
  }

  private startStreams(runtime: LiveFixtureRuntime): void {
    if (runtime.started) return;
    runtime.started = true;

    runtime.controllers.scores = new AbortController();
    runtime.controllers.odds = new AbortController();

    void this.runScoresLoop(runtime, runtime.controllers.scores.signal);
    void this.runOddsLoop(runtime, runtime.controllers.odds.signal);
  }

  private async runScoresLoop(runtime: LiveFixtureRuntime, signal: AbortSignal): Promise<void> {
    let attempt = 0;
    while (!signal.aborted) {
      runtime.health.scoresStatus = "connecting";
      try {
        for await (const message of this.client.streamScores(signal)) {
          runtime.health.scoresStatus = "open";
          if (!payloadTouchesFixture(message.data, runtime.fixture.fixtureId)) continue;
          runtime.state = mergeScoresUpdate(runtime.state, message.data);
          runtime.health.lastScoresAt = new Date().toISOString();
          attempt = 0;
        }
      } catch (error) {
        if (signal.aborted) break;
        runtime.health.scoresStatus = "error";
        runtime.health.lastError = error instanceof Error ? error.message : String(error);
        await sleep(backoffMs(attempt++), signal);
      }
    }
  }

  private async runOddsLoop(runtime: LiveFixtureRuntime, signal: AbortSignal): Promise<void> {
    let attempt = 0;
    while (!signal.aborted) {
      runtime.health.oddsStatus = "connecting";
      try {
        for await (const message of this.client.streamOdds(signal)) {
          runtime.health.oddsStatus = "open";
          if (!payloadTouchesFixture(message.data, runtime.fixture.fixtureId)) continue;
          runtime.state = mergeOddsUpdate(runtime.state, message.data);
          runtime.health.lastOddsAt = new Date().toISOString();
          attempt = 0;
        }
      } catch (error) {
        if (signal.aborted) break;
        runtime.health.oddsStatus = "error";
        runtime.health.lastError = error instanceof Error ? error.message : String(error);
        await sleep(backoffMs(attempt++), signal);
      }
    }
  }
}

export const txLineLiveEngine = new TxLineLiveEngine();

export function challengeFromLiveState(state: MatchState) {
  return createPulseChallenge(state);
}

function backoffMs(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}
