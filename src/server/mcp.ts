import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { replayMatches } from "../txline/replay.js";
import { txLineLiveEngine } from "../txline/live-engine.js";
import {
  connectPredictionWallet,
  createLiveSession,
  createReplaySession,
  getSessionPulse,
  getSpokenSummary,
  getTxLineLiveHealth,
  lockPredictionPosition,
  quotePredictionPosition,
  resolveSessionPulse,
  submitAnswer,
} from "../store/sessions.js";
import type { MatchState } from "../types.js";
import {
  SIGNAL_SCORE_WIDGET_ALIASES,
  SIGNAL_SCORE_WIDGET_URI,
  signalScoreWidgetHtml,
} from "./score-widget.js";

const MCP_PATH = "/mcp";
const CORS_HEADERS =
  "authorization, content-type, mcp-session-id, openai-conversation-id, openai-ephemeral-user-id, openai-locale, x-openai-conversation-id, x-openai-ephemeral-user-id, x-openai-locale";
const recentRequests: Array<Record<string, string | undefined>> = [];
const recentToolCalls: Array<Record<string, string | number | boolean | undefined>> = [];
const recentTxLineStartupEvents: Array<Record<string, string | boolean | undefined>> = [];

const eventSchema = z.object({
  id: z.string(),
  minute: z.number(),
  type: z.string(),
  team: z.enum(["home", "away"]).optional(),
  description: z.string(),
});

const oddsSchema = z
  .object({
    timestamp: z.string(),
    market: z.string(),
    homeProbability: z.number().optional(),
    drawProbability: z.number().optional(),
    awayProbability: z.number().optional(),
    homePrice: z.number().optional(),
    drawPrice: z.number().optional(),
    awayPrice: z.number().optional(),
  })
  .nullable();

const matchStateSchema = z.object({
  fixtureId: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  minute: z.number(),
  phase: z.string(),
  score: z.object({
    home: z.number(),
    away: z.number(),
  }),
  recentEvents: z.array(eventSchema),
  latestOdds: oddsSchema,
  previousOdds: oddsSchema,
  mode: z.enum(["live", "replay"]),
});

const resolutionRuleSchema = z.object({
  type: z.string(),
  team: z.enum(["home", "away"]).optional(),
  deadlineMinute: z.number().optional(),
  signals: z.array(z.string()).optional(),
  minProbabilityMove: z.number().optional(),
  windowMinutes: z.number().optional(),
  maxProbabilityMove: z.number().optional(),
  startMinute: z.number().optional(),
});

const challengeSchema = z.object({
  id: z.string(),
  fixtureId: z.string(),
  status: z.string(),
  context: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  userAnswer: z.string().optional(),
  resolutionRule: resolutionRuleSchema,
  createdAtMinute: z.number(),
  deadlineMinute: z.number().optional(),
  answerByMinute: z.number().optional(),
});

const resultSchema = z.object({
  resolved: z.boolean(),
  correct: z.boolean().optional(),
  result: z.string().optional(),
  matchedEvent: eventSchema.optional(),
});

const highlightSchema = z.object({
  id: z.string(),
  label: z.string(),
  text: z.string(),
  source: z.enum(["txline-score", "txline-odds", "signal"]),
});

const predictionSchema = z.object({
  id: z.string(),
  fixtureId: z.string(),
  market: z.literal("team_goal_next_window"),
  marketLabel: z.string(),
  prediction: z.enum(["YES", "NO"]),
  team: z.enum(["home", "away"]),
  teamName: z.string(),
  stakeUsd: z.number(),
  asset: z.literal("USDC"),
  windowMinutes: z.number(),
  openedMinute: z.number(),
  expiryMinute: z.number(),
  status: z.enum(["quote", "ready_to_sign", "locked", "settled_demo"]),
  walletAddress: z.string().optional(),
  txSignature: z.string().optional(),
  escrowProgram: z.string(),
  settlementSource: z.literal("TxLINE score events"),
  settlementRule: z.string(),
  network: z.literal("devnet"),
  complianceNote: z.string(),
});

const txLineHealthSchema = z.object({
  fixtureId: z.string(),
  scoresStatus: z.enum(["idle", "connecting", "open", "error"]),
  oddsStatus: z.enum(["idle", "connecting", "open", "error"]),
  lastScoresAt: z.string().optional(),
  lastOddsAt: z.string().optional(),
  lastError: z.string().optional(),
});

const pulseOutputSchema = {
  sessionId: z.string(),
  matchState: matchStateSchema,
  marketExplanation: z.string(),
  highlights: z.array(highlightSchema),
  challenge: challengeSchema,
  prediction: predictionSchema.optional(),
  streak: z.number(),
  lastResult: resultSchema.optional(),
};

export function createSignalMcpServer(): McpServer {
  const server = new McpServer({ name: "signal", version: "0.3.0" });

  registerAppResource(
    server,
    "Signal World Cup Scoreboard",
    SIGNAL_SCORE_WIDGET_URI,
    {
      description: "Light-mode World Cup scoreboard UI for ChatGPT.",
    },
    async () => ({
      contents: [
        {
          uri: SIGNAL_SCORE_WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: signalScoreWidgetHtml(),
          _meta: {
            ui: {
              prefersBorder: true,
              domain: process.env.APP_PUBLIC_URL ?? "https://signal-an6w.onrender.com",
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
            },
          },
        },
      ],
    }),
  );

  for (const aliasUri of SIGNAL_SCORE_WIDGET_ALIASES) {
    registerAppResource(
      server,
      "Signal Scoreboard Compatibility Template",
      aliasUri,
      {
        description: "Compatibility URI serving the current score-only Signal UI.",
      },
      async () => ({
        contents: [
          {
            uri: aliasUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: signalScoreWidgetHtml(),
            _meta: {
              ui: {
                prefersBorder: true,
                domain: process.env.APP_PUBLIC_URL ?? "https://signal-an6w.onrender.com",
                csp: {
                  connectDomains: [],
                  resourceDomains: [],
                },
              },
              "openai/widgetDescription": "Shows only the World Cup match score.",
            },
          },
        ],
      }),
    );
  }

  server.registerTool(
    "list_live_matches",
    {
      title: "List Signal matches",
      description:
        "List World Cup fixtures available to Signal. Uses TxLINE live fixtures when configured, plus replay fixtures for judge demos.",
      inputSchema: {},
      outputSchema: {
        matches: z.array(
          z.object({
            fixtureId: z.string(),
            homeTeam: z.string(),
            awayTeam: z.string(),
            status: z.string(),
            minute: z.number().optional(),
            score: z.string().optional(),
            mode: z.enum(["live", "replay"]),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async () => withToolTrace("list_live_matches", async () => {
      const matches = [...replayMatches];

      if (txLineLiveEngine.isConfigured) {
        try {
          const txlineMatches = await txLineLiveEngine.listFixtures();
          matches.unshift(...txlineMatches);
        } catch (error) {
          console.warn("Unable to fetch TxLINE fixtures; keeping replay fixtures.", error);
        }
      }

      return {
        structuredContent: { matches },
        content: [
          {
            type: "text",
            text: `Signal found ${matches.length} available match${matches.length === 1 ? "" : "es"}.`,
          },
        ],
      };
    }),
  );

  registerAppTool(
    server,
    "open_signal_scoreboard",
    {
      title: "Open Signal Scoreboard",
      description: "Open the France vs Spain World Cup score-only view in light mode.",
      inputSchema: {},
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: { resourceUri: SIGNAL_SCORE_WIDGET_URI },
        "openai/outputTemplate": SIGNAL_SCORE_WIDGET_URI,
        "openai/toolInvocation/invoking": "Opening scoreboard…",
        "openai/toolInvocation/invoked": "Scoreboard opened.",
      },
    },
    async () => withToolTrace("open_signal_scoreboard", async () => {
      const pulse = createReplaySession("replay-france-spain");
      return {
        structuredContent: pulse,
        content: [
          {
            type: "text",
            text: scoreText(pulse.matchState),
          },
        ],
      };
    }),
  );

  registerAppTool(
    server,
    "open_signal_live_scoreboard",
    {
      title: "Open Signal Live Scoreboard",
      description:
        "Open a live TxLINE scoreboard. Defaults to fixture 18257739, the configured devnet autostart fixture.",
      inputSchema: {
        fixtureId: z.string().min(1).optional(),
      },
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: { resourceUri: SIGNAL_SCORE_WIDGET_URI },
        "openai/outputTemplate": SIGNAL_SCORE_WIDGET_URI,
        "openai/toolInvocation/invoking": "Opening live scoreboard…",
        "openai/toolInvocation/invoked": "Live scoreboard opened.",
      },
    },
    async ({ fixtureId }) => withToolTrace("open_signal_live_scoreboard", async () => {
      const pulse = await createLiveSession(fixtureId ?? defaultLiveFixtureId());
      return {
        structuredContent: pulse,
        content: [
          {
            type: "text",
            text: `${scoreText(pulse.matchState)} TxLINE live polling is active in the scoreboard.`,
          },
        ],
      };
    }),
  );

  registerAppTool(
    server,
    "open_signal_demo",
    {
      title: "Open Signal demo",
      description:
        "Open the England vs Croatia Signal replay score view.",
      inputSchema: {},
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: { resourceUri: SIGNAL_SCORE_WIDGET_URI },
        "openai/outputTemplate": SIGNAL_SCORE_WIDGET_URI,
        "openai/toolInvocation/invoking": "Opening Signal demo…",
        "openai/toolInvocation/invoked": "Signal demo is live.",
      },
    },
    async () => withToolTrace("open_signal_demo", async () => {
      const pulse = createReplaySession("replay-england-croatia");
      return {
        structuredContent: pulse,
        content: [
          {
            type: "text",
            text: scoreText(pulse.matchState),
          },
        ],
      };
    }),
  );

  registerAppTool(
    server,
    "open_signal_markets_demo",
    {
      title: "Open Signal Markets demo",
      description:
        "Open the France vs Spain Signal score view.",
      inputSchema: {},
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: { resourceUri: SIGNAL_SCORE_WIDGET_URI },
        "openai/outputTemplate": SIGNAL_SCORE_WIDGET_URI,
        "openai/toolInvocation/invoking": "Opening Signal Markets…",
        "openai/toolInvocation/invoked": "Signal Markets is live.",
      },
    },
    async () => withToolTrace("open_signal_markets_demo", async () => {
      const pulse = createReplaySession("replay-france-spain");
      return {
        structuredContent: pulse,
        content: [
          {
            type: "text",
            text: scoreText(pulse.matchState),
          },
        ],
      };
    }),
  );

  registerAppTool(
    server,
    "open_match",
    {
      title: "Open Signal match",
      description:
        "Open a Signal score view. For the hackathon demo, use mode=replay with fixtureId=replay-france-spain.",
      inputSchema: {
        fixtureId: z.string().min(1),
        mode: z.enum(["live", "replay"]).default("replay"),
      },
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: { resourceUri: SIGNAL_SCORE_WIDGET_URI },
        "openai/outputTemplate": SIGNAL_SCORE_WIDGET_URI,
        "openai/toolInvocation/invoking": "Opening Signal…",
        "openai/toolInvocation/invoked": "Signal is live.",
      },
    },
    async ({ fixtureId, mode }) => withToolTrace("open_match", async () => {
      const pulse = mode === "live" ? await createLiveSession(fixtureId) : createReplaySession(fixtureId);
      return {
        structuredContent: pulse,
        content: [
          {
            type: "text",
            text: scoreText(pulse.matchState),
          },
        ],
      };
    }),
  );

  server.registerTool(
    "get_current_pulse",
    {
      title: "Get current Signal pulse",
      description: "Return the current match state, market explanation, and active Pulse Challenge.",
      inputSchema: {
        sessionId: z.string().min(1),
      },
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ sessionId }) => withToolTrace("get_current_pulse", async () => {
      const pulse = getSessionPulse(sessionId);
      return {
        structuredContent: pulse,
        content: [{ type: "text", text: pulse.challenge.question }],
      };
    }),
  );

  server.registerTool(
    "get_txline_live_health",
    {
      title: "Get TxLINE live health",
      description:
        "Return background TxLINE scores and odds stream health for opened live fixtures.",
      inputSchema: {
        fixtureId: z.string().min(1).optional(),
      },
      outputSchema: {
        configured: z.boolean(),
        health: z.array(txLineHealthSchema),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ fixtureId }) =>
      withToolTrace("get_txline_live_health", async () => ({
        structuredContent: {
          configured: txLineLiveEngine.isConfigured,
          health: getTxLineLiveHealth(fixtureId),
        },
        content: [
          {
            type: "text",
            text: txLineLiveEngine.isConfigured
              ? "TxLINE live engine is configured. Open a live fixture to start background scores and odds streams."
              : "TxLINE live engine is not configured because TXLINE_API_TOKEN is missing.",
          },
        ],
      })),
  );

  server.registerTool(
    "quote_signal_prediction",
    {
      title: "Quote Signal prediction",
      description:
        "Prepare a devnet Signal Markets prediction quote from a fan request, such as France to score in the next 10 minutes for 1 USDC. This does not move funds.",
      inputSchema: {
        sessionId: z.string().min(1),
        team: z.enum(["home", "away"]).describe("Use home for the left-side team and away for the right-side team."),
        prediction: z.enum(["YES", "NO"]).default("YES"),
        stakeUsd: z.number().positive().max(100),
        windowMinutes: z.number().int().min(1).max(30).default(10),
        walletAddress: z.string().min(1).optional(),
      },
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ sessionId, team, prediction, stakeUsd, windowMinutes, walletAddress }) =>
      withToolTrace("quote_signal_prediction", async () => {
        const pulse = quotePredictionPosition(sessionId, {
          team,
          prediction,
          stakeUsd,
          windowMinutes,
          walletAddress,
        });
        const quote = pulse.prediction;
        return {
          structuredContent: pulse,
          content: [
            {
              type: "text",
              text: quote
                ? `Prepared devnet escrow quote: ${quote.prediction} on ${quote.marketLabel}, ${quote.stakeUsd} ${quote.asset}, expires at ${quote.expiryMinute}'. User must sign before funds are locked.`
                : "Signal could not prepare that prediction quote.",
            },
          ],
        };
      }),
  );

  server.registerTool(
    "connect_signal_wallet",
    {
      title: "Connect Signal wallet",
      description:
        "Attach a Solana wallet address to a prepared Signal Markets prediction quote before signing a devnet escrow transaction.",
      inputSchema: {
        sessionId: z.string().min(1),
        positionId: z.string().min(1),
        walletAddress: z.string().min(1),
      },
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ sessionId, positionId, walletAddress }) =>
      withToolTrace("connect_signal_wallet", async () => {
        const pulse = connectPredictionWallet(sessionId, positionId, walletAddress);
        return {
          structuredContent: pulse,
          content: [{ type: "text", text: "Wallet attached to the Signal Markets devnet quote." }],
        };
      }),
  );

  server.registerTool(
    "record_signal_prediction_signature",
    {
      title: "Record Signal prediction signature",
      description:
        "Record the signed devnet escrow transaction signature for a prepared Signal Markets position. Use after the user signs externally.",
      inputSchema: {
        sessionId: z.string().min(1),
        positionId: z.string().min(1),
        walletAddress: z.string().min(1),
        txSignature: z.string().min(1),
      },
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ sessionId, positionId, walletAddress, txSignature }) =>
      withToolTrace("record_signal_prediction_signature", async () => {
        const pulse = lockPredictionPosition(sessionId, positionId, walletAddress, txSignature);
        return {
          structuredContent: pulse,
          content: [
            {
              type: "text",
              text: "Signal recorded the signed devnet escrow transaction. Settlement will be driven by TxLINE score events.",
            },
          ],
        };
      }),
  );

  server.registerTool(
    "submit_answer",
    {
      title: "Submit Signal answer",
      description: "Lock the fan's answer to the active Pulse Challenge.",
      inputSchema: {
        sessionId: z.string().min(1),
        challengeId: z.string().min(1),
        answer: z.enum(["Yes", "No"]),
      },
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ sessionId, challengeId, answer }) => withToolTrace("submit_answer", async () => {
      const pulse = submitAnswer(sessionId, challengeId, answer);
      return {
        structuredContent: pulse,
        content: [{ type: "text", text: `${answer} locked. Waiting for the next TxLINE signal.` }],
      };
    }),
  );

  server.registerTool(
    "resolve_pulse",
    {
      title: "Resolve Signal pulse",
      description:
        "Advance the live/replay TxLINE feed and resolve the active Pulse Challenge when its rule is satisfied.",
      inputSchema: {
        sessionId: z.string().min(1),
        challengeId: z.string().min(1),
      },
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ sessionId, challengeId }) => withToolTrace("resolve_pulse", async () => {
      const pulse = resolveSessionPulse(sessionId, challengeId);
      const result = pulse.lastResult?.result ?? "Signal advanced to the next TxLINE update.";
      return {
        structuredContent: pulse,
        content: [
          {
            type: "text",
            text: `${result} ${pulse.lastResult?.correct ? "The fan read was correct." : "The streak resets if that read missed."} Next Pulse Challenge: ${pulse.challenge.question}`,
          },
        ],
      };
    }),
  );

  server.registerTool(
    "get_spoken_summary",
    {
      title: "Get spoken Signal summary",
      description: "Return a short TTS-ready match and challenge summary.",
      inputSchema: {
        sessionId: z.string().min(1),
      },
      outputSchema: {
        script: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ sessionId }) => withToolTrace("get_spoken_summary", async () => {
      const summary = getSpokenSummary(sessionId);
      return {
        structuredContent: summary,
        content: [{ type: "text", text: summary.script }],
      };
    }),
  );

  return server;
}

export function startHttpServer(): void {
  const port = Number(process.env.PORT ?? 8787);
  const httpServer = createServer(handleRequest);

  httpServer.listen(port, () => {
    console.log(`Signal MCP server listening on http://localhost:${port}`);
    console.log(`MCP endpoint: http://localhost:${port}${MCP_PATH}`);
    startConfiguredTxLineStreams();
  });
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  console.log(`${req.method ?? "UNKNOWN"} ${url.pathname}`);
  recordRequest(req, url);

  if (req.method === "OPTIONS") {
    writeCors(res, 204);
    res.end();
    return;
  }

  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  const shouldHandleMcp =
    url.pathname === MCP_PATH ||
    (url.pathname === "/" && req.method === "POST") ||
    (url.pathname === "/" && req.method === "GET" && acceptsEventStream(req)) ||
    (url.pathname === "/" && req.method === "DELETE");

  if (url.pathname === "/" && shouldHandleMcp && req.method && MCP_METHODS.has(req.method)) {
    await handleMcpRequest(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    writeJson(res, 200, {
      name: "Signal",
      description: "ChatGPT-native TxLINE match companion.",
      mcp: MCP_PATH,
      health: "/health",
      demo: "/demo",
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    writeJson(res, 200, {
      ok: true,
      service: "signal",
      mode: process.env.SIGNAL_DEFAULT_MODE ?? "replay",
      txline: {
        configured: txLineLiveEngine.isConfigured,
        network: txLineLiveEngine.network,
        apiOrigin: txLineLiveEngine.origin,
        tokenLength: txLineLiveEngine.tokenLength,
        tokenFingerprint: txLineLiveEngine.tokenFingerprint,
        autostartFixtureIds: txLineAutostartFixtureIds(),
        health: getTxLineLiveHealth(),
        startupEvents: recentTxLineStartupEvents.slice(-5),
      },
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/demo") {
    writeJson(res, 200, {
      prompt: "Open Signal for the England vs Croatia replay match.",
      fixtureId: "replay-england-croatia",
      mode: "replay",
      mcp: `${process.env.APP_PUBLIC_URL ?? "http://localhost:8787"}${MCP_PATH}`,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/debug/requests") {
    writeJson(res, 200, {
      now: new Date().toISOString(),
      recentRequests,
      recentToolCalls,
    });
    return;
  }

  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
    await handleMcpRequest(req, res);
    return;
  }

  res.writeHead(404).end("Not Found");
}

function writeCors(res: ServerResponse, status = 200): void {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": CORS_HEADERS,
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
  });
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", CORS_HEADERS);
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

function writeJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(value, null, 2));
}

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCorsHeaders(res);
  const server = createSignalMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Internal server error");
    }
  }
}

function acceptsEventStream(req: IncomingMessage): boolean {
  const accept = header(req, "accept") ?? "";
  return accept.includes("text/event-stream") || accept.includes("application/json");
}

function recordRequest(req: IncomingMessage, url: URL): void {
  recentRequests.push({
    at: new Date().toISOString(),
    method: req.method,
    path: url.pathname,
    query: url.search || undefined,
    accept: header(req, "accept"),
    origin: header(req, "origin"),
    userAgent: header(req, "user-agent"),
    accessControlRequestHeaders: header(req, "access-control-request-headers"),
  });

  while (recentRequests.length > 80) recentRequests.shift();
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value.join(", ") : value;
}

async function withToolTrace<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    recordToolCall({
      at: new Date().toISOString(),
      name,
      ok: true,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    recordToolCall({
      at: new Date().toISOString(),
      name,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function recordToolCall(entry: Record<string, string | number | boolean | undefined>): void {
  recentToolCalls.push(entry);
  while (recentToolCalls.length > 80) recentToolCalls.shift();
}

function startConfiguredTxLineStreams(): void {
  const fixtureIds = txLineAutostartFixtureIds();

  if (fixtureIds.length === 0) return;

  if (!txLineLiveEngine.isConfigured) {
    console.warn("TXLINE_AUTOSTART_FIXTURE_IDS is set, but TXLINE_API_TOKEN is missing.");
    recordTxLineStartupEvent({
      at: new Date().toISOString(),
      ok: false,
      error: "TXLINE_API_TOKEN is missing.",
    });
    return;
  }

  for (const fixtureId of fixtureIds) {
    void txLineLiveEngine
      .openFixture(fixtureId)
      .then(() => {
        console.log(`Started TxLINE background streams for fixture ${fixtureId}`);
        recordTxLineStartupEvent({
          at: new Date().toISOString(),
          fixtureId,
          ok: true,
        });
      })
      .catch((error) => {
        console.warn(
          `Unable to start TxLINE background streams for fixture ${fixtureId}:`,
          error,
        );
        recordTxLineStartupEvent({
          at: new Date().toISOString(),
          fixtureId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }
}

function txLineAutostartFixtureIds(): string[] {
  return (process.env.TXLINE_AUTOSTART_FIXTURE_IDS ?? "")
    .split(",")
    .map((fixtureId) => fixtureId.trim())
    .filter(Boolean);
}

function scoreText(state: MatchState): string {
  const status =
    state.phase === "fulltime"
      ? "Full-time"
      : state.phase === "halftime"
        ? "Half-time"
        : state.minute
          ? `${state.minute}'`
          : state.mode === "live"
            ? "Live"
            : "Replay";

  return `${state.homeTeam} ${state.score.home}-${state.score.away} ${state.awayTeam}. ${status}.`;
}

function defaultLiveFixtureId(): string {
  return txLineAutostartFixtureIds()[0] ?? "18257739";
}

function recordTxLineStartupEvent(entry: Record<string, string | boolean | undefined>): void {
  recentTxLineStartupEvents.push(entry);
  while (recentTxLineStartupEvents.length > 20) recentTxLineStartupEvents.shift();
}
