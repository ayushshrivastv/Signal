# TxLINE Endpoints Used by Signal

Signal is designed around TxLINE as the live input layer.

## MVP Endpoints

| Purpose | Endpoint family |
| --- | --- |
| List World Cup fixtures | `/api/fixtures/snapshot` |
| Fetch score state for a fixture | `/api/scores/snapshot/{fixtureId}` |
| Fetch live score updates for a fixture | `/api/scores/updates/{fixtureId}` |
| Consume live score and event updates | `/api/scores/stream` |
| Fetch odds state for a fixture | `/api/odds/snapshot/{fixtureId}` |
| Consume live odds updates | `/api/odds/stream` |
| Replay historical match activity for judging | `/api/scores/historical/{fixtureId}` and historical update endpoints |
| Settlement proof lookup | `/api/scores/stat-validation` |

## Current Implementation Status

- Replay mode is implemented and uses TxLINE-shaped score/event/odds data.
- Live fixture fetching is implemented through `TxLineClient.listFixtures()`.
- The TxLINE client sends official data-request headers: `Authorization: Bearer <guestJwt>` and `X-Api-Token: <activatedApiToken>`.
- If `TXLINE_GUEST_JWT` is not provided, the backend requests one from `/auth/guest/start`.
- `open_match` with `mode=live` starts background `/api/scores/stream` and `/api/odds/stream` loops for the selected fixture.
- `TXLINE_AUTOSTART_FIXTURE_IDS` can start those background streams on server boot for known fixture IDs.
- The live engine hydrates initial state from score and odds snapshots, updates in-memory match state from SSE messages, and reconnects with exponential backoff.
- `get_txline_live_health` reports stream status for opened live fixtures.

## Hackathon Notes

The demo can use replay mode when a live fixture is unavailable during review. The production path is now wired to the same state engine through TxLINE fixtures, snapshots, scores stream, odds stream, historical scores, and validation-proof endpoints.

TxLINE subscription and activation still happen outside the server through the official wallet flow. The backend consumes the activated credentials after they are provided as environment variables.
