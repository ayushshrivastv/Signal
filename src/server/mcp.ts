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
import { createTxLineClientFromEnv } from "../txline/client.js";
import {
  createReplaySession,
  getSessionPulse,
  getSpokenSummary,
  resolveSessionPulse,
  submitAnswer,
} from "../store/sessions.js";
import { SIGNAL_WIDGET_URI, signalWidgetHtml } from "./widget.js";

const MCP_PATH = "/mcp";
const CORS_HEADERS =
  "authorization, content-type, mcp-session-id, openai-conversation-id, openai-ephemeral-user-id, openai-locale, x-openai-conversation-id, x-openai-ephemeral-user-id, x-openai-locale";

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

const pulseOutputSchema = {
  sessionId: z.string(),
  matchState: matchStateSchema,
  marketExplanation: z.string(),
  challenge: challengeSchema,
  streak: z.number(),
  lastResult: resultSchema.optional(),
};

export function createSignalMcpServer(): McpServer {
  const server = new McpServer({ name: "signal", version: "0.1.0" });

  registerAppResource(
    server,
    "Signal Pulse Widget",
    SIGNAL_WIDGET_URI,
    {
      description: "Interactive Signal match companion UI for ChatGPT.",
    },
    async () => ({
      contents: [
        {
          uri: SIGNAL_WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: signalWidgetHtml(),
          _meta: {
            ui: {
              prefersBorder: true,
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
    async () => {
      const matches = [...replayMatches];

      if (process.env.TXLINE_API_TOKEN) {
        try {
          const txlineMatches = await createTxLineClientFromEnv().listFixtures();
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
    },
  );

  registerAppTool(
    server,
    "open_match",
    {
      title: "Open Signal match",
      description:
        "Open a Signal match companion session. For the hackathon demo, use mode=replay with fixtureId=replay-england-croatia.",
      inputSchema: {
        fixtureId: z.string().min(1),
        mode: z.enum(["live", "replay"]).default("replay"),
      },
      outputSchema: pulseOutputSchema,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: { resourceUri: SIGNAL_WIDGET_URI },
        "openai/outputTemplate": SIGNAL_WIDGET_URI,
        "openai/toolInvocation/invoking": "Opening Signal…",
        "openai/toolInvocation/invoked": "Signal is live.",
      },
    },
    async ({ fixtureId, mode }) => {
      if (mode !== "replay") {
        throw new Error("Live mode is scaffolded but replay mode is the current working MVP.");
      }

      const pulse = createReplaySession(fixtureId);
      return {
        structuredContent: pulse,
        content: [
          {
            type: "text",
            text: `${pulse.matchState.homeTeam} vs ${pulse.matchState.awayTeam} is open in Signal. ${pulse.marketExplanation} Pulse Challenge: ${pulse.challenge.question}`,
          },
        ],
      };
    },
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
    async ({ sessionId }) => {
      const pulse = getSessionPulse(sessionId);
      return {
        structuredContent: pulse,
        content: [{ type: "text", text: pulse.challenge.question }],
      };
    },
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
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ sessionId, challengeId, answer }) => {
      const pulse = submitAnswer(sessionId, challengeId, answer);
      return {
        structuredContent: pulse,
        content: [{ type: "text", text: `${answer} locked. Waiting for the next TxLINE signal.` }],
      };
    },
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
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ sessionId, challengeId }) => {
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
    },
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
    async ({ sessionId }) => {
      const summary = getSpokenSummary(sessionId);
      return {
        structuredContent: summary,
        content: [{ type: "text", text: summary.script }],
      };
    },
  );

  return server;
}

export function startHttpServer(): void {
  const port = Number(process.env.PORT ?? 8787);
  const httpServer = createServer(handleRequest);

  httpServer.listen(port, () => {
    console.log(`Signal MCP server listening on http://localhost:${port}`);
    console.log(`MCP endpoint: http://localhost:${port}${MCP_PATH}`);
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  console.log(`${req.method ?? "UNKNOWN"} ${url.pathname}`);

  if (req.method === "OPTIONS") {
    writeCors(res, 204);
    res.end();
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
    writeJson(res, 200, { ok: true, service: "signal", mode: process.env.SIGNAL_DEFAULT_MODE ?? "replay" });
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

  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
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
