# Deploy Signal on Vercel

Signal is primarily designed as a long-lived Node service on Render. Vercel can run the MCP HTTP handler through `api/index.ts`, but long-running TxLINE background SSE streams are better suited to Render or another persistent web service.

## Vercel Settings

Use:

```text
Framework Preset: Other
Build Command: npm run build
Output Directory: public
Install Command: npm install
```

The repository includes:

- `public/index.html` so Vercel's output directory check passes
- `api/index.ts` as the Vercel serverless request handler
- `vercel.json` to route all paths to the MCP handler

## Environment Variables

```text
TXLINE_NETWORK=devnet
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
TXLINE_API_TOKEN=<activated devnet API token>
TXLINE_GUEST_JWT=
TXLINE_AUTOSTART_FIXTURE_IDS=
APP_PUBLIC_URL=https://YOUR-VERCEL-APP.vercel.app
```

Leave `TXLINE_AUTOSTART_FIXTURE_IDS` blank on Vercel. Use Render when you want persistent TxLINE score and odds streams running in the background.
