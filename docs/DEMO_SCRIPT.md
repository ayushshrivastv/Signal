# Signal Demo Script

Target length: 3 to 5 minutes.

## 1. Problem

Most fans watch football with a phone in their hand, but live score apps only say what happened. Signal turns live TxLINE score and odds movement into an AI match companion inside ChatGPT.

## 2. Open Signal in ChatGPT

Prompt:

```text
Open Signal for the England vs Croatia replay match.
```

The app calls `list_live_matches`, then `open_match` with:

```json
{
  "fixtureId": "replay-england-croatia",
  "mode": "replay"
}
```

## 3. Show the Live Pulse

Point out:

- score
- match minute
- implied probability movement
- market explanation
- contextual Pulse Challenge

Example challenge:

```text
Will Croatia turn this pressure into another clear signal before halftime?
```

## 4. Answer and Resolve

Click **Yes** or ask ChatGPT:

```text
Yes, lock that in.
```

Then click **Resolve next signal**. Signal advances the TxLINE replay feed and resolves the answer from the next match event.

## 5. Show Why This Is ChatGPT-Native

Ask a follow-up:

```text
Why did the market move so sharply?
```

ChatGPT can explain the match story using the structured data returned by Signal.

## 6. Close

Signal is not another sports website. It is a ChatGPT-native fan companion powered by TxLINE live scores, events, and odds.

