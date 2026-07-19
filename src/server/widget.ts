export const SIGNAL_WIDGET_URI = "ui://signal/pulse.html";

export function signalWidgetHtml(): string {
  return String.raw`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signal</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #ffffff;
        --panel: #f7f7f5;
        --text: #1f2024;
        --muted: #777a80;
        --soft: #a4a7ad;
        --line: #e4e4e2;
        --flag-ring: #ffffff;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        letter-spacing: 0;
      }

      .app {
        padding: 0;
      }

      .match-card {
        display: grid;
        gap: 26px;
        min-height: 230px;
        padding: 20px 26px 26px;
        background: var(--panel);
        border-bottom: 1px solid var(--line);
      }

      .match-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        color: var(--text);
        font-size: 18px;
        font-weight: 700;
      }

      .competition {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .date {
        color: var(--muted);
      }

      .status {
        flex: 0 0 auto;
      }

      .scoreboard {
        display: grid;
        grid-template-columns: minmax(112px, 1fr) auto minmax(112px, 1fr);
        align-items: center;
        gap: 42px;
      }

      .team {
        display: grid;
        gap: 16px;
        justify-items: center;
        min-width: 0;
      }

      .team:last-child {
        text-align: right;
      }

      .flag {
        width: 62px;
        height: 44px;
        border: 3px solid var(--flag-ring);
        border-radius: 6px;
        box-shadow:
          0 0 0 1px rgba(20, 22, 28, 0.14),
          0 2px 5px rgba(20, 22, 28, 0.12);
      }

      .name {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 22px;
        font-weight: 700;
      }

      .score {
        display: grid;
        justify-items: center;
        gap: 28px;
      }

      .score strong {
        color: var(--soft);
        font-size: 54px;
        font-weight: 500;
        line-height: 1;
      }

      .stage {
        color: var(--muted);
        font-size: 19px;
        font-weight: 700;
      }

      @media (max-width: 560px) {
        .match-card {
          gap: 22px;
          min-height: 210px;
          padding: 16px 18px 22px;
        }

        .match-meta {
          align-items: flex-start;
          font-size: 15px;
        }

        .scoreboard {
          grid-template-columns: minmax(72px, 1fr) auto minmax(72px, 1fr);
          gap: 16px;
        }

        .team {
          gap: 12px;
        }

        .flag {
          width: 48px;
          height: 34px;
        }

        .name {
          font-size: 17px;
        }

        .score {
          gap: 20px;
        }

        .score strong {
          font-size: 38px;
        }

        .stage {
          font-size: 15px;
        }
      }
    </style>
  </head>
  <body>
    <main class="app" aria-live="polite">
      <section class="match-card" aria-label="Match score">
        <div class="match-meta">
          <span class="competition">
            <span id="competition">FIFA World Cup 2026™</span>
            <span class="date" id="dateLabel">· Signal match</span>
          </span>
          <span class="status" id="status">Replay</span>
        </div>
        <div class="scoreboard">
          <div class="team">
            <span class="flag" id="homeFlag" aria-hidden="true"></span>
            <span class="name" id="homeName">Home</span>
          </div>
          <div class="score">
            <strong id="score">0-0</strong>
            <span class="stage" id="stage">Match</span>
          </div>
          <div class="team">
            <span class="flag" id="awayFlag" aria-hidden="true"></span>
            <span class="name" id="awayName">Away</span>
          </div>
        </div>
      </section>
    </main>

    <script>
      let pulse = null;
      let rpcId = 0;
      const pendingRequests = new Map();

      const els = {
        dateLabel: document.getElementById("dateLabel"),
        status: document.getElementById("status"),
        homeFlag: document.getElementById("homeFlag"),
        awayFlag: document.getElementById("awayFlag"),
        homeName: document.getElementById("homeName"),
        awayName: document.getElementById("awayName"),
        score: document.getElementById("score"),
        stage: document.getElementById("stage"),
      };

      function render(nextPulse) {
        pulse = nextPulse ?? pulse;
        if (!pulse?.matchState) return;

        const state = pulse.matchState;
        els.dateLabel.textContent = "· " + matchDateLabel(state);
        els.status.textContent = statusLabel(state);
        els.homeFlag.style.background = flagBackground(state.homeTeam, "home");
        els.awayFlag.style.background = flagBackground(state.awayTeam, "away");
        els.homeName.textContent = state.homeTeam;
        els.awayName.textContent = state.awayTeam;
        els.score.textContent = state.score.home + "-" + state.score.away;
        els.stage.textContent = stageLabel(state);
      }

      function statusLabel(state) {
        if (state.phase === "fulltime") return "Full-time";
        if (state.phase === "halftime") return "Half-time";
        if (state.phase === "pre_match") return "Upcoming";
        return state.minute ? state.minute + "'" : state.mode === "live" ? "Live" : "Replay";
      }

      function stageLabel(state) {
        const teams = [state.homeTeam, state.awayTeam].sort().join("-");
        if (teams === "France-Spain") return "Semi-finals";
        if (state.phase === "halftime") return "Half-time";
        if (state.phase === "pre_match") return "Kick-off soon";
        return state.mode === "live" ? "Live match" : "Replay match";
      }

      function matchDateLabel(state) {
        const teams = [state.homeTeam, state.awayTeam].sort().join("-");
        if (teams === "France-Spain") return "Wed, 15 Jul";
        return state.mode === "live" ? "TxLINE live" : "Replay";
      }

      function flagBackground(teamName, side) {
        const flags = {
          France: "linear-gradient(90deg, #193a9a 0 33%, #ffffff 33% 66%, #ef3340 66%)",
          Spain: "linear-gradient(#c60b1e 0 25%, #ffc400 25% 75%, #c60b1e 75%)",
          England: "linear-gradient(90deg, #ffffff 0 42%, #c8102e 42% 58%, #ffffff 58%)",
          Croatia: "linear-gradient(#ff0000 0 33%, #ffffff 33% 66%, #171796 66%)",
          Argentina: "linear-gradient(#74acdf 0 33%, #ffffff 33% 66%, #74acdf 66%)",
          Brazil: "linear-gradient(135deg, #009b3a 0 42%, #ffdf00 42% 58%, #002776 58%)",
        };

        return flags[teamName] ?? (side === "home" ? "#2b65f6" : "#ef6b73");
      }

      function updateFromResponse(response) {
        const nextPulse = response?.structuredContent ?? response;
        if (nextPulse?.matchState) {
          render(nextPulse);
        }
      }

      function rpcNotify(method, params) {
        window.parent.postMessage({ jsonrpc: "2.0", method, params }, "*");
      }

      function rpcRequest(method, params) {
        return new Promise((resolve, reject) => {
          const id = ++rpcId;
          pendingRequests.set(id, { resolve, reject });
          window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
        });
      }

      window.addEventListener(
        "message",
        (event) => {
          if (event.source !== window.parent) return;
          const message = event.data;
          if (!message || message.jsonrpc !== "2.0") return;

          if (typeof message.id === "number") {
            const pending = pendingRequests.get(message.id);
            if (!pending) return;
            pendingRequests.delete(message.id);
            if (message.error) {
              pending.reject(message.error);
              return;
            }
            pending.resolve(message.result);
            return;
          }

          if (message.method === "ui/notifications/tool-result") {
            updateFromResponse(message.params);
          }
        },
        { passive: true },
      );

      (async () => {
        await rpcRequest("ui/initialize", {
          appInfo: { name: "signal-score-widget", version: "0.2.0" },
          appCapabilities: {},
          protocolVersion: "2026-01-26",
        });
        rpcNotify("ui/notifications/initialized", {});
      })();

      render(pulse);
    </script>
  </body>
</html>
  `.trim();
}
