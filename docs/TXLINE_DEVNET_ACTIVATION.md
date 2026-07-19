# TxLINE Devnet Activation

Signal runs live TxLINE mode from an activated devnet API token. The wallet subscription and activation step should use TxLINE's official devnet scripts because they include the matching devnet IDL and generated `Txoracle` types.

## Devnet Values

| Item | Value |
| --- | --- |
| Network | `devnet` |
| Service level | `1` |
| API origin | `https://txline-dev.txodds.com` |
| Solana RPC | `https://api.devnet.solana.com` |
| TxLINE program | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxL token mint | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |
| Guest auth | `https://txline-dev.txodds.com/auth/guest/start` |
| Activation | `https://txline-dev.txodds.com/api/token/activate` |
| API base | `https://txline-dev.txodds.com/api/` |

## Preflight

Install dependencies:

```bash
npm install
```

Set a funded devnet wallet:

```bash
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export ANCHOR_WALLET="/absolute/path/to/devnet-wallet.json"
```

Run Signal's preflight:

```bash
npm run txline:devnet:preflight
```

This checks:

- Node.js 20+
- wallet file exists and is a Solana keypair
- devnet SOL balance
- TxLINE devnet guest JWT endpoint
- optional activated token access if `TXLINE_API_TOKEN` is already set

## Official Subscription Script

The safest path is to run TxLINE's official devnet script. Clone or use the official TxLINE on-chain repository:

```bash
git clone https://github.com/txodds/tx-on-chain.git
cd tx-on-chain
yarn install
```

Run the official free-tier devnet script:

```bash
TOKEN_MINT_ADDRESS=4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG \
ANCHOR_PROVIDER_URL="https://api.devnet.solana.com" \
ANCHOR_WALLET="/absolute/path/to/devnet-wallet.json" \
yarn ts-node examples/devnet/scripts/subscription_free_tier.ts
```

That script uses:

- `examples/devnet/idl/txoracle.json`
- `examples/devnet/types/txoracle.ts`
- `examples/devnet/common/config.ts`
- `examples/devnet/common/users.ts`

It performs the on-chain subscribe transaction, signs the activation message, and returns an activated API token.

## Signal Local Subscription Script

Signal also includes a local wrapper for the same documented flow:

```bash
npm run txline:devnet:subscribe
```

Before running it, copy the matching devnet IDL from the official repository:

```bash
mkdir -p txline/devnet/idl txline/devnet/types
cp /path/to/tx-on-chain/examples/devnet/idl/txoracle.json txline/devnet/idl/txoracle.json
cp /path/to/tx-on-chain/examples/devnet/types/txoracle.ts txline/devnet/types/txoracle.ts
```

The script will refuse to run if `txline/devnet/idl/txoracle.json` is missing or if the loaded IDL program ID does not match:

```text
6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
```

The script performs:

- service level `1`
- duration `4` weeks
- `SELECTED_LEAGUES=[]`
- `subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)`
- guest JWT request from `/auth/guest/start`
- activation message signing over `${txSig}::${jwt}`
- `/api/token/activate`
- printing the `TXLINE_API_TOKEN` for Render

## First API Call

After activation, verify the token against the devnet data API:

```bash
export TXLINE_NETWORK=devnet
export TXLINE_API_ORIGIN=https://txline-dev.txodds.com
export TXLINE_API_TOKEN="<activated devnet API token>"
npm run txline:devnet:first-call
```

This uses the same headers required by TxLINE:

```text
Authorization: Bearer <guestJwt>
X-Api-Token: <activatedApiToken>
```

It checks:

- `/api/fixtures/snapshot`
- `/api/scores/snapshot/{fixtureId}`
- `/api/scores/updates/{fixtureId}`
- `/api/odds/snapshot/{fixtureId}`
- `/api/scores/historical/{fixtureId}`
- `/api/scores/stat-validation` when a real `Seq`/`seq` value is observed

## Render Env Vars

After activation, set these on Render:

```text
TXLINE_NETWORK=devnet
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
TXLINE_API_TOKEN=<activated devnet API token>
TXLINE_GUEST_JWT=
TXLINE_AUTOSTART_FIXTURE_IDS=<devnet fixture id>
```

Leave `TXLINE_GUEST_JWT` blank unless TxLINE support gives you a specific value. Signal can request a fresh guest JWT from `/auth/guest/start`.

## Verify Backend

After Render redeploys:

```bash
curl https://signal-an6w.onrender.com/health
```

Expected:

```json
{
  "txline": {
    "configured": true,
    "health": []
  }
}
```

If `TXLINE_AUTOSTART_FIXTURE_IDS` is set and valid, `health` will include score and odds stream statuses for those fixtures.

## Devnet Validation Accounts

The devnet program reference defines these validation PDA seeds:

| Account | Seed |
| --- | --- |
| Daily scores roots | `daily_scores_roots` |
| Daily batch roots | `daily_batch_roots` |
| Ten daily fixtures roots | `ten_daily_fixtures_roots` |

For score, odds, or fixture validation, derive the epoch day from the timestamp in the proof response, not from `Date.now()`.

- Scores: `validation.summary.updateStats.minTimestamp`
- Fixtures: `validation.snapshot.Ts`
- Odds: `validation.odds.Ts`

Score validation must use a real `Seq` or `seq` from an observed score record. For V2 validation, keep the `statKeys` order stable because strategy indexes refer to those same positions.

## Official References

- TxLINE Quickstart: https://txline.txodds.com/documentation/quickstart
- World Cup Free Tier: https://txline.txodds.com/documentation/worldcup
- Devnet Program Reference: https://txline.txodds.com/documentation/programs/devnet
- Runnable Devnet Examples: https://txline.txodds.com/documentation/examples/devnet-examples
- Streaming Data: https://txline.txodds.com/documentation/examples/streaming-data
