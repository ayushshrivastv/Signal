import type { LiveMatchSummary } from "../types.js";
import { normalizeFixture } from "./normalizer.js";

type TxLineNetwork = "mainnet" | "devnet";

type TxLineConfig = {
  network: TxLineNetwork;
  apiOrigin: string;
  apiToken?: string;
  guestJwt?: string;
};

export type TxLineSseMessage = {
  id?: string;
  event?: string;
  data: unknown;
  retry?: number;
};

export class TxLineClient {
  private readonly network: TxLineNetwork;
  private readonly apiOrigin: string;
  private readonly apiToken?: string;
  private guestJwt?: string;

  constructor(config: TxLineConfig) {
    this.network = config.network;
    this.apiOrigin = config.apiOrigin.replace(/\/$/, "");
    this.apiToken = config.apiToken;
    this.guestJwt = config.guestJwt;
  }

  get isConfigured(): boolean {
    return Boolean(this.apiToken);
  }

  get origin(): string {
    return this.apiOrigin;
  }

  async listFixtures(params?: Record<string, string | number | boolean>): Promise<LiveMatchSummary[]> {
    const data = await this.fetchJson<unknown>("/api/fixtures/snapshot", params);
    const items = Array.isArray(data) ? data : pickArray(data);
    return items.map((item, index) => normalizeFixture(item, index));
  }

  async getScoresSnapshot(fixtureId: string): Promise<unknown[]> {
    return this.fetchArray(`/api/scores/snapshot/${fixtureId}`);
  }

  async getScoresUpdates(fixtureId: string): Promise<unknown[]> {
    return this.fetchArray(`/api/scores/updates/${fixtureId}`);
  }

  async getHistoricalScores(fixtureId: string): Promise<unknown[]> {
    return this.fetchArray(`/api/scores/historical/${fixtureId}`);
  }

  async getOddsSnapshot(fixtureId: string): Promise<unknown[]> {
    return this.fetchArray(`/api/odds/snapshot/${fixtureId}`);
  }

  async getScoreValidation(params: {
    fixtureId: string | number;
    seq: string | number;
    statKey?: string | number;
    statKeys?: Array<string | number>;
  }): Promise<unknown> {
    const query: Record<string, string | number> = {
      fixtureId: params.fixtureId,
      seq: params.seq,
    };

    if (params.statKey !== undefined) query.statKey = params.statKey;
    if (params.statKeys?.length) query.statKeys = params.statKeys.join(",");

    return this.fetchJson("/api/scores/stat-validation", query);
  }

  streamScores(signal?: AbortSignal): AsyncGenerator<TxLineSseMessage> {
    return this.stream("/api/scores/stream", signal);
  }

  streamOdds(signal?: AbortSignal): AsyncGenerator<TxLineSseMessage> {
    return this.stream("/api/odds/stream", signal);
  }

  async *stream(path: string, signal?: AbortSignal): AsyncGenerator<TxLineSseMessage> {
    const response = await this.request(path, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`TxLINE stream failed ${response.status}: ${response.statusText}`);
    }

    for await (const message of readSseMessages(response)) {
      yield {
        ...message,
        data: parseSseData(message.data),
      };
    }
  }

  private async fetchArray(path: string): Promise<unknown[]> {
    const data = await this.fetchJson<unknown>(path);
    return Array.isArray(data) ? data : pickArray(data);
  }

  private async fetchJson<T>(
    path: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const response = await this.request(path, { params });

    if (!response.ok) {
      throw new Error(`TxLINE request failed ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    if (!text.trim()) return [] as T;
    return JSON.parse(text) as T;
  }

  private async request(
    path: string,
    options: {
      params?: Record<string, string | number | boolean>;
      headers?: HeadersInit;
      signal?: AbortSignal;
      retryAuth?: boolean;
    } = {},
  ): Promise<Response> {
    const headers = await this.headers(options.headers);
    const response = await fetch(this.url(path, options.params), {
      headers,
      signal: options.signal,
    });

    if (response.status === 401 && options.retryAuth !== false && !this.hasPinnedGuestJwt()) {
      this.guestJwt = undefined;
      return this.request(path, { ...options, retryAuth: false });
    }

    return response;
  }

  private async headers(extra?: HeadersInit): Promise<HeadersInit> {
    const guestJwt = await this.ensureGuestJwt();
    return {
      "Content-Type": "application/json",
      ...(guestJwt ? { Authorization: `Bearer ${guestJwt}` } : {}),
      ...(this.apiToken ? { "X-Api-Token": this.apiToken } : {}),
      ...extra,
    };
  }

  private async ensureGuestJwt(): Promise<string | undefined> {
    if (this.guestJwt) return this.guestJwt;
    if (!this.apiToken) return undefined;

    const response = await fetch(`${this.apiOrigin}/auth/guest/start`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`TxLINE guest auth failed ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as unknown;
    const token = tokenFromAuthResponse(data);
    if (!token) throw new Error("TxLINE guest auth did not return a token.");
    this.guestJwt = token;
    return token;
  }

  private hasPinnedGuestJwt(): boolean {
    return Boolean(process.env.TXLINE_GUEST_JWT);
  }

  private url(path: string, params?: Record<string, string | number | boolean>): string {
    const url = new URL(path.startsWith("http") ? path : `${this.apiOrigin}${path.startsWith("/") ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }
}

export function createTxLineClientFromEnv(): TxLineClient {
  const network = (process.env.TXLINE_NETWORK === "devnet" ? "devnet" : "mainnet") satisfies TxLineNetwork;
  const defaultOrigin =
    network === "devnet" ? "https://txline-dev.txodds.com" : "https://txline.txodds.com";

  return new TxLineClient({
    network,
    apiOrigin: process.env.TXLINE_API_ORIGIN ?? process.env.TXLINE_API_BASE_URL ?? defaultOrigin,
    apiToken: process.env.TXLINE_API_TOKEN,
    guestJwt: process.env.TXLINE_GUEST_JWT,
  });
}

type SseWireMessage = {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
};

function parseSseBlock(block: string): SseWireMessage | null {
  const message: SseWireMessage = { data: "" };

  for (const rawLine of block.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(":")) continue;
    const separatorIndex = rawLine.indexOf(":");
    const field = separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    const value =
      separatorIndex === -1 ? "" : rawLine.slice(separatorIndex + 1).replace(/^ /, "");

    if (field === "data") message.data += `${value}\n`;
    if (field === "event") message.event = value;
    if (field === "id") message.id = value;
    if (field === "retry") message.retry = Number(value);
  }

  message.data = message.data.replace(/\n$/, "");
  return message.data || message.event || message.id ? message : null;
}

async function* readSseMessages(response: Response): AsyncGenerator<SseWireMessage> {
  if (!response.body) throw new Error("Stream response has no body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.match(/\r?\n\r?\n/);
      while (separator?.index !== undefined) {
        const block = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);

        const message = parseSseBlock(block);
        if (message) yield message;

        separator = buffer.match(/\r?\n\r?\n/);
      }
    }

    buffer += decoder.decode();
    const message = parseSseBlock(buffer);
    if (message) yield message;
  } finally {
    reader.releaseLock();
  }
}

function parseSseData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function pickArray(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];
  for (const candidate of ["fixtures", "data", "items", "results", "updates", "scores", "odds"]) {
    const maybeArray = (value as Record<string, unknown>)[candidate];
    if (Array.isArray(maybeArray)) return maybeArray;
  }
  return [];
}

function tokenFromAuthResponse(data: unknown): string | undefined {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  const token = record.token ?? record.jwt ?? record.accessToken;
  return typeof token === "string" ? token : undefined;
}
