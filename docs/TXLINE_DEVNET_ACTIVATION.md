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

Clone or use the official TxLINE on-chain repository:

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

## Official References

- TxLINE Quickstart: https://txline.txodds.com/documentation/quickstart
- World Cup Free Tier: https://txline.txodds.com/documentation/worldcup
- Runnable Devnet Examples: https://txline.txodds.com/documentation/examples/devnet-examples
- Streaming Data: https://txline.txodds.com/documentation/examples/streaming-data
