import type { LiveMatchSummary } from "../types.js";

type TxLineConfig = {
  baseUrl: string;
  apiToken?: string;
};

export class TxLineClient {
  private readonly baseUrl: string;
  private readonly apiToken?: string;

  constructor(config: TxLineConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiToken = config.apiToken;
  }

  async listFixtures(): Promise<LiveMatchSummary[]> {
    const data = await this.fetchJson<unknown>("/api/fixtures/snapshot");
    const items = Array.isArray(data) ? data : this.pickArray(data);

    return items.map((item, index) => this.normalizeFixture(item, index));
  }

  // TxLINE streams are Server-Sent Events. This parser keeps the adapter tiny
  // and lets live mode plug into the same state engine as replay mode.
  async *stream(path: string): AsyncGenerator<unknown> {
    const response = await fetch(this.url(path), {
      headers: this.headers(),
    });

    if (!response.ok || !response.body) {
      throw new Error(`TxLINE stream failed ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLine = chunk
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line.startsWith("data:"));

        if (dataLine) {
          const payload = dataLine.slice("data:".length).trim();
          if (payload && payload !== "[DONE]") {
            yield JSON.parse(payload) as unknown;
          }
        }

        boundary = buffer.indexOf("\n\n");
      }
    }
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(this.url(path), {
      headers: this.headers(),
    });

    if (!response.ok) {
      throw new Error(`TxLINE request failed ${response.status}: ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  private url(path: string): string {
    if (path.startsWith("http")) return path;
    return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }

  private headers(): HeadersInit {
    return {
      accept: "application/json",
      ...(this.apiToken ? { authorization: `Bearer ${this.apiToken}` } : {}),
    };
  }

  private pickArray(value: unknown): unknown[] {
    if (!value || typeof value !== "object") return [];
    for (const candidate of ["fixtures", "data", "items", "results"]) {
      const maybeArray = (value as Record<string, unknown>)[candidate];
      if (Array.isArray(maybeArray)) return maybeArray;
    }
    return [];
  }

  private normalizeFixture(item: unknown, index: number): LiveMatchSummary {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const fixtureId = String(
      record.fixtureId ?? record.fixture_id ?? record.id ?? `txline-fixture-${index}`,
    );
    const homeTeam = String(
      record.homeTeam ?? record.home_team ?? record.home ?? record.participant1 ?? "Home",
    );
    const awayTeam = String(
      record.awayTeam ?? record.away_team ?? record.away ?? record.participant2 ?? "Away",
    );
    const status = String(record.status ?? record.state ?? "upcoming").toLowerCase();

    return {
      fixtureId,
      homeTeam,
      awayTeam,
      status: status.includes("live") ? "live" : status.includes("finish") ? "finished" : "upcoming",
      minute: typeof record.minute === "number" ? record.minute : undefined,
      score:
        typeof record.score === "string"
          ? record.score
          : typeof record.homeScore === "number" && typeof record.awayScore === "number"
            ? `${record.homeScore}-${record.awayScore}`
            : undefined,
      mode: "live",
    };
  }
}

export function createTxLineClientFromEnv(): TxLineClient {
  return new TxLineClient({
    baseUrl: process.env.TXLINE_API_BASE_URL ?? "https://txline.txodds.com",
    apiToken: process.env.TXLINE_API_TOKEN,
  });
}

