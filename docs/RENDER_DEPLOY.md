# Deploy Signal MCP on Render

Signal runs as a long-lived Node web service. Render is a good free hackathon deployment target because it provides HTTPS and can run the MCP `/mcp` endpoint.

## Option A: Blueprint Deploy

1. Push this repo to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Connect the GitHub repo.
4. Render should detect `render.yaml`.
5. Create the `signal-mcp` service.
6. Set environment variables marked `sync: false`:

```text
APP_PUBLIC_URL=https://YOUR-SERVICE.onrender.com
TXLINE_NETWORK=devnet
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
TXLINE_API_TOKEN=
TXLINE_GUEST_JWT=
TXLINE_AUTOSTART_FIXTURE_IDS=
OPENAI_API_KEY=
```

`TXLINE_API_TOKEN` and `OPENAI_API_KEY` can stay blank for the replay demo. Live TxLINE mode requires an activated TxLINE API token from the official subscription/activation flow. `TXLINE_GUEST_JWT` is optional because Signal can request a fresh guest JWT from `/auth/guest/start`.

Use `TXLINE_AUTOSTART_FIXTURE_IDS=18257739` or another comma-separated fixture list when you want Render to start live scores and odds background streams on boot.

## Option B: Manual Web Service

Create a new **Web Service** and use:

```text
Runtime: Node
Build Command: npm ci && npm run build
Start Command: npm start
Plan: Free
```

Environment variables:

```text
NODE_ENV=production
SIGNAL_DEFAULT_MODE=replay
APP_PUBLIC_URL=https://YOUR-SERVICE.onrender.com
TXLINE_NETWORK=devnet
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
TXLINE_API_TOKEN=
TXLINE_GUEST_JWT=
TXLINE_AUTOSTART_FIXTURE_IDS=
OPENAI_API_KEY=
```

## After Deploy

Check:

```text
https://YOUR-SERVICE.onrender.com/health
https://YOUR-SERVICE.onrender.com/demo
https://YOUR-SERVICE.onrender.com/mcp
```

Use this in ChatGPT Developer Mode:

```text
https://YOUR-SERVICE.onrender.com/mcp
```

Prompt:

```text
Open Signal for the England vs Croatia replay match.
```

## Free Plan Caveat

Render free web services can sleep. For the hackathon demo video, open `/health` once before recording so the service wakes up.
