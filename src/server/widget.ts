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
        color-scheme: light dark;
        --bg: #0f1115;
        --panel: #171a21;
        --panel-2: #20242d;
        --text: #f3f5f7;
        --muted: #a9b0bd;
        --line: #303642;
        --accent: #56d6a5;
        --warn: #f5c451;
        --bad: #ef6b73;
        --good: #74d99f;
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

      button {
        min-height: 42px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel-2);
        color: var(--text);
        font: inherit;
        cursor: pointer;
      }

      button:hover {
        border-color: var(--accent);
      }

      button:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.65;
      }

      .app {
        display: grid;
        gap: 12px;
        padding: 14px;
      }

      .match-card,
      .panel {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }

      .match-card {
        display: grid;
        gap: 14px;
        padding: 14px;
      }

      .match-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }

      .scoreboard {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 14px;
      }

      .team {
        display: grid;
        gap: 7px;
        justify-items: start;
        min-width: 0;
      }

      .team:last-child {
        justify-items: end;
        text-align: right;
      }

      .flag {
        width: 38px;
        height: 28px;
        border: 2px solid rgba(255, 255, 255, 0.78);
        border-radius: 6px;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12) inset;
      }

      .flag.home {
        background: linear-gradient(90deg, #193a9a 0 33%, #ffffff 33% 66%, #ef3340 66%);
      }

      .flag.away {
        background: linear-gradient(#c60b1e 0 25%, #ffc400 25% 75%, #c60b1e 75%);
      }

      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        font-weight: 700;
      }

      .prob {
        color: var(--muted);
        font-size: 12px;
      }

      .score {
        display: grid;
        justify-items: center;
        gap: 5px;
      }

      .score strong {
        font-size: 36px;
        line-height: 1;
      }

      .minute {
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
      }

      .panel {
        display: grid;
        gap: 10px;
        padding: 12px;
      }

      .label {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .explanation,
      .context,
      .result,
      .position {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .question {
        font-size: 18px;
        font-weight: 750;
        line-height: 1.25;
      }

      .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #08110d;
        font-weight: 750;
      }

      .secondary {
        font-weight: 700;
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .pill {
        border: 1px solid var(--line);
        border-radius: 999px;
        color: var(--muted);
        font-size: 12px;
        padding: 5px 8px;
      }

      .pill.good {
        color: var(--good);
      }

      .pill.bad {
        color: var(--bad);
      }

      .feed {
        display: grid;
        gap: 8px;
      }

      .event,
      .highlight {
        border-left: 2px solid var(--accent);
        padding-left: 8px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
      }

      .highlight strong {
        color: var(--text);
        display: block;
        font-size: 11px;
        margin-bottom: 2px;
        text-transform: uppercase;
      }

      .empty {
        color: var(--muted);
        font-size: 13px;
        padding: 10px 0;
      }

      @media (max-width: 420px) {
        .scoreboard {
          grid-template-columns: 1fr;
        }

        .team,
        .team:last-child {
          text-align: center;
        }
      }
    </style>
  </head>
  <body>
    <main class="app" aria-live="polite">
      <section class="match-card" aria-label="Match score">
        <div class="match-meta">
          <span id="competition">FIFA World Cup 2026</span>
          <span id="status">Replay</span>
        </div>
        <div class="scoreboard">
          <div class="team">
            <span class="flag" id="homeFlag" aria-hidden="true"></span>
            <span class="name" id="homeName">Home</span>
            <span class="prob" id="homeProb">--</span>
          </div>
          <div class="score">
            <strong id="score">0-0</strong>
            <span class="minute" id="minute">--'</span>
          </div>
          <div class="team">
            <span class="flag" id="awayFlag" aria-hidden="true"></span>
            <span class="name" id="awayName">Away</span>
            <span class="prob" id="awayProb">--</span>
          </div>
        </div>
      </section>

      <section class="panel" aria-label="Recent TxLINE highlights">
        <div class="label">Recent highlights</div>
        <div class="feed" id="highlights"></div>
      </section>

      <section class="panel" aria-label="Market pulse">
        <div class="label">Market pulse</div>
        <div class="explanation" id="market">Waiting for Signal data.</div>
        <div class="meta">
          <span class="pill" id="mode">Replay</span>
          <span class="pill" id="streak">Streak 0</span>
        </div>
      </section>

      <section class="panel" aria-label="Prediction position">
        <div class="label">Signal market</div>
        <div class="question" id="positionTitle">No open position</div>
        <div class="position" id="positionState">Waiting for market intent.</div>
        <div class="meta">
          <span class="pill" id="stakeLine">Stake --</span>
          <span class="pill" id="settlementLine">TxLINE settlement</span>
        </div>
      </section>

      <section class="panel" aria-label="Pulse challenge">
        <div class="label">Fan pulse</div>
        <div class="context" id="context">Waiting for the current match story.</div>
        <div class="question" id="question">Open a match to start Signal.</div>
        <div class="actions">
          <button class="primary" id="yesButton" type="button">Yes</button>
          <button class="secondary" id="noButton" type="button">No</button>
        </div>
        <div class="result" id="result"></div>
        <div class="actions">
          <button id="resolveButton" type="button">Resolve next signal</button>
          <button id="speakButton" type="button">Read summary</button>
        </div>
      </section>

      <section class="panel" aria-label="Recent TxLINE signals">
        <div class="label">Recent TxLINE signals</div>
        <div class="feed" id="feed"></div>
      </section>
    </main>

    <script>
      let pulse = null;
      let rpcId = 0;
      const pendingRequests = new Map();

      const els = {
        competition: document.getElementById("competition"),
        status: document.getElementById("status"),
        homeFlag: document.getElementById("homeFlag"),
        awayFlag: document.getElementById("awayFlag"),
        homeName: document.getElementById("homeName"),
        awayName: document.getElementById("awayName"),
        homeProb: document.getElementById("homeProb"),
        awayProb: document.getElementById("awayProb"),
        score: document.getElementById("score"),
        minute: document.getElementById("minute"),
        market: document.getElementById("market"),
        mode: document.getElementById("mode"),
        streak: document.getElementById("streak"),
        context: document.getElementById("context"),
        question: document.getElementById("question"),
        result: document.getElementById("result"),
        highlights: document.getElementById("highlights"),
        feed: document.getElementById("feed"),
        positionTitle: document.getElementById("positionTitle"),
        positionState: document.getElementById("positionState"),
        stakeLine: document.getElementById("stakeLine"),
        settlementLine: document.getElementById("settlementLine"),
        yesButton: document.getElementById("yesButton"),
        noButton: document.getElementById("noButton"),
        resolveButton: document.getElementById("resolveButton"),
        speakButton: document.getElementById("speakButton"),
      };

      function probability(value) {
        return typeof value === "number" ? value.toFixed(0) + "% implied" : "--";
      }

      function render(nextPulse) {
        pulse = nextPulse ?? pulse;
        if (!pulse?.matchState) return;

        const state = pulse.matchState;
        els.status.textContent = state.phase === "fulltime" ? "Full-time" : state.mode === "replay" ? "Replay" : "Live";
        els.homeFlag.style.background = flagBackground(state.homeTeam, "home");
        els.awayFlag.style.background = flagBackground(state.awayTeam, "away");
        els.homeName.textContent = state.homeTeam;
        els.awayName.textContent = state.awayTeam;
        els.homeProb.textContent = probability(state.latestOdds?.homeProbability);
        els.awayProb.textContent = probability(state.latestOdds?.awayProbability);
        els.score.textContent = state.score.home + "-" + state.score.away;
        els.minute.textContent = state.phase === "fulltime" ? "FT" : state.minute + "'";
        els.market.textContent = pulse.marketExplanation;
        els.mode.textContent = state.mode === "replay" ? "Replay mode" : "Live mode";
        els.streak.textContent = "Streak " + pulse.streak;
        els.context.textContent = pulse.challenge?.context ?? "";
        els.question.textContent = pulse.challenge?.question ?? "";

        const answer = pulse.challenge?.userAnswer;
        const locked = pulse.challenge?.status === "locked";
        els.yesButton.disabled = Boolean(answer);
        els.noButton.disabled = Boolean(answer);
        els.yesButton.textContent = answer === "Yes" ? "Yes locked" : "Yes";
        els.noButton.textContent = answer === "No" ? "No locked" : "No";
        els.resolveButton.disabled = !locked;

        if (pulse.lastResult?.resolved) {
          const correctness = pulse.lastResult.correct ? "Correct" : "Missed";
          els.result.textContent = correctness + ": " + pulse.lastResult.result;
        } else if (locked) {
          els.result.textContent = "Answer locked. Waiting for the next TxLINE signal.";
        } else {
          els.result.textContent = "Pick before the next signal arrives.";
        }

        renderHighlights(pulse.highlights ?? []);
        renderPosition(pulse.prediction);

        els.feed.innerHTML = "";
        const events = state.recentEvents ?? [];
        if (events.length === 0) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = "No match signals yet.";
          els.feed.appendChild(empty);
          return;
        }

        for (const event of events.slice(-4).reverse()) {
          const row = document.createElement("div");
          row.className = "event";
          row.textContent = event.minute + "' " + event.description;
          els.feed.appendChild(row);
        }
      }

      function renderHighlights(highlights) {
        els.highlights.innerHTML = "";
        if (highlights.length === 0) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = "Waiting for TxLINE highlights.";
          els.highlights.appendChild(empty);
          return;
        }

        for (const highlight of highlights.slice(0, 3)) {
          const row = document.createElement("div");
          row.className = "highlight";
          const label = document.createElement("strong");
          label.textContent = highlight.label;
          const text = document.createElement("span");
          text.textContent = highlight.text;
          row.append(label, text);
          els.highlights.appendChild(row);
        }
      }

      function renderPosition(position) {
        if (!position) {
          els.positionTitle.textContent = "No open position";
          els.positionState.textContent = "Waiting for market intent.";
          els.stakeLine.textContent = "Stake --";
          els.settlementLine.textContent = "TxLINE settlement";
          return;
        }

        els.positionTitle.textContent = position.prediction + " - " + position.marketLabel;
        els.positionState.textContent =
          position.status === "locked"
            ? "Locked with signature " + shortText(position.txSignature)
            : position.walletAddress
              ? "Wallet attached. Ready for the user to sign the devnet escrow transaction."
              : "Quote prepared. Wallet address is needed before signing.";
        els.stakeLine.textContent = position.stakeUsd + " " + position.asset + " until " + position.expiryMinute + "'";
        els.settlementLine.textContent = position.network + " escrow";
      }

      function shortText(value) {
        if (!value) return "";
        return value.length > 14 ? value.slice(0, 6) + "..." + value.slice(-6) : value;
      }

      function flagBackground(teamName, side) {
        const flags = {
          France: "linear-gradient(90deg, #193a9a 0 33%, #ffffff 33% 66%, #ef3340 66%)",
          Spain: "linear-gradient(#c60b1e 0 25%, #ffc400 25% 75%, #c60b1e 75%)",
          England: "linear-gradient(90deg, #ffffff 0 42%, #c8102e 42% 58%, #ffffff 58%)",
          Croatia: "linear-gradient(#ff0000 0 33%, #ffffff 33% 66%, #171796 66%)",
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

      const bridgeReady = (async () => {
        await rpcRequest("ui/initialize", {
          appInfo: { name: "signal-widget", version: "0.1.0" },
          appCapabilities: {},
          protocolVersion: "2026-01-26",
        });
        rpcNotify("ui/notifications/initialized", {});
      })();

      async function callTool(name, args) {
        await bridgeReady;
        const response = await rpcRequest("tools/call", {
          name,
          arguments: args,
        });
        updateFromResponse(response);
        return response;
      }

      async function answer(value) {
        if (!pulse?.sessionId || !pulse?.challenge?.id) return;
        await callTool("submit_answer", {
          sessionId: pulse.sessionId,
          challengeId: pulse.challenge.id,
          answer: value,
        });
      }

      els.yesButton.addEventListener("click", () => answer("Yes"));
      els.noButton.addEventListener("click", () => answer("No"));
      els.resolveButton.addEventListener("click", async () => {
        if (!pulse?.sessionId || !pulse?.challenge?.id) return;
        await callTool("resolve_pulse", {
          sessionId: pulse.sessionId,
          challengeId: pulse.challenge.id,
        });
      });
      els.speakButton.addEventListener("click", async () => {
        if (!pulse?.sessionId) return;
        const response = await callTool("get_spoken_summary", {
          sessionId: pulse.sessionId,
        });
        const script = response?.structuredContent?.script;
        if (script && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(script));
        }
      });

      render(pulse);
    </script>
  </body>
</html>
  `.trim();
}
