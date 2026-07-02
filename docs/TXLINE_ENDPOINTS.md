# TxLINE Endpoints Used by Signal

Signal is designed around TxLINE as the live input layer.

## MVP Endpoints

| Purpose | Endpoint family |
| --- | --- |
| List World Cup fixtures | `/api/fixtures/snapshot` |
| Consume live score and event updates | `/api/scores/stream` |
| Consume live odds updates | `/api/odds/stream` |
| Replay historical match activity for judging | TxLINE historical score and odds endpoints |

## Current Implementation Status

- Replay mode is implemented and uses TxLINE-shaped score/event/odds data.
- Live fixture fetching is scaffolded through `TxLineClient.listFixtures()`.
- Live score and odds SSE parsing is scaffolded through `TxLineClient.stream()`.
- Once credentials are available, wire the exact fixture ID and stream query parameters from the TxLINE quickstart/World Cup docs into the state engine.

## Hackathon Notes

The demo must show TxLINE as the backend input. If a live match is unavailable during review, Signal should use replay mode while explaining that the same state engine consumes live TxLINE streams.

