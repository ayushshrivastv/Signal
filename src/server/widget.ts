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

      .header,
      .panel {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }

      .header {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 10px;
        padding: 12px;
      }

      .team {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      .team:last-child {
        text-align: right;
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
        gap: 2px;
      }

      .score strong {
        font-size: 26px;
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
      .result {
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

      .event {
        border-left: 2px solid var(--accent);
        padding-left: 8px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
      }

      .empty {
        color: var(--muted);
        font-size: 13px;
        padding: 10px 0;
      }

      @media (max-width: 420px) {
        .header {
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
      <section class="header" aria-label="Match score">
        <div class="team">
          <span class="name" id="homeName">Home</span>
          <span class="prob" id="homeProb">--</span>
        </div>
        <div class="score">
          <strong id="score">0-0</strong>
          <span class="minute" id="minute">--'</span>
        </div>
        <div class="team">
          <span class="name" id="awayName">Away</span>
          <span class="prob" id="awayProb">--</span>
        </div>
      </section>

      <section class="panel" aria-label="Market pulse">
        <div class="label">Market pulse</div>
        <div class="explanation" id="market">Waiting for Signal data.</div>
        <div class="meta">
          <span class="pill" id="mode">Replay</span>
          <span class="pill" id="streak">Streak 0</span>
        </div>
      </section>

      <section class="panel" aria-label="Pulse challenge">
        <div class="label">Pulse challenge</div>
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
      let pulse = window.openai?.toolOutput ?? null;

      const els = {
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
        feed: document.getElementById("feed"),
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
        els.homeName.textContent = state.homeTeam;
        els.awayName.textContent = state.awayTeam;
        els.homeProb.textContent = probability(state.latestOdds?.homeProbability);
        els.awayProb.textContent = probability(state.latestOdds?.awayProbability);
        els.score.textContent = state.score.home + "-" + state.score.away;
        els.minute.textContent = state.minute + "'";
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

      async function callTool(name, args) {
        if (!window.openai?.callTool) {
          throw new Error("This widget must run inside a ChatGPT Apps host.");
        }
        const response = await window.openai.callTool(name, args);
        if (response?.structuredContent) {
          render(response.structuredContent);
        }
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
        const response = await window.openai?.callTool?.("get_spoken_summary", {
          sessionId: pulse.sessionId,
        });
        const script = response?.structuredContent?.script;
        if (script && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(script));
        }
      });

      window.addEventListener(
        "openai:set_globals",
        (event) => {
          render(event.detail?.globals?.toolOutput ?? window.openai?.toolOutput);
        },
        { passive: true },
      );

      render(pulse);
    </script>
  </body>
</html>
  `.trim();
}

