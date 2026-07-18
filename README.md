# Signal

Signal is a ChatGPT-native World Cup match companion for the TxODDS Consumer and Fan Experiences hackathon.

It uses TxLINE scores, events, and odds as the live input layer, then turns match movement into contextual prediction challenges and devnet Signal Markets quotes inside ChatGPT.

## Current Status

- MCP server for ChatGPT Apps SDK.
- Interactive ChatGPT widget resource.
- Replay-backed England vs Croatia demo flow.
- Signal Markets France vs Spain replay flow with scoreboard, highlights, and prediction quote.
- Dynamic challenge generation from match state.
- Automatic answer locking and challenge resolution.
- Devnet escrow-ready prediction metadata for short match windows.
- TxLINE client scaffold for fixtures and SSE streams.

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:8787/health
```

MCP endpoint:

```text
http://localhost:8787/mcp
```

Demo metadata:

```text
http://localhost:8787/demo
```

## ChatGPT Developer Mode

1. Start the server.
2. Expose it with a public HTTPS tunnel.
3. Add the MCP endpoint in ChatGPT Developer Mode.
4. Ask:

```text
Open Signal for the England vs Croatia replay match.
```

For Signal Markets:

```text
Open Signal Markets demo.
```

Then ask:

```text
Put 1 USDC on France to score in the next 10 minutes.
```

Use:

```json
{
  "fixtureId": "replay-england-croatia",
  "mode": "replay"
}
```

## Environment

Copy `.env.example` to `.env` and fill TxLINE credentials when available.

```bash
TXLINE_API_BASE_URL=https://txline.txodds.com
TXLINE_API_TOKEN=
```

Without `TXLINE_API_TOKEN`, Signal still runs the replay demo.

## Compliance

Signal Markets currently prepares devnet escrow metadata only. The server does not custody funds, does not sign transactions for users, and does not offer production betting or wagering. Mainnet or real-money launch requires proper legal review and licensing.

## References

- Product plan: [SIGNAL_PLAN.md](./SIGNAL_PLAN.md)
- Signal Markets plan: [docs/SIGNAL_MARKETS.md](./docs/SIGNAL_MARKETS.md)
- TxLINE endpoints: [docs/TXLINE_ENDPOINTS.md](./docs/TXLINE_ENDPOINTS.md)
- Demo script: [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md)
- Render deploy: [docs/RENDER_DEPLOY.md](./docs/RENDER_DEPLOY.md)
