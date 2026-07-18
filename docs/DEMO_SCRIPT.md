# Signal Demo Script

Target length: 3 to 5 minutes.

## 1. Problem

Most fans watch football with a phone in their hand, but live score apps only say what happened. Signal turns live TxLINE score and odds movement into an AI match companion inside ChatGPT.

## 2. Open Signal in ChatGPT

Prompt:

```text
Open Signal for the England vs Croatia replay match.
```

For the Signal Markets version, use:

```text
Open Signal Markets demo.
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
- three recent TxLINE highlights
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

## 5. Show Signal Markets

Ask ChatGPT:

```text
Put 1 USDC on France to score in the next 10 minutes.
```

Signal prepares a devnet escrow quote with the match ID, prediction side, stake, expiry minute, wallet field, and TxLINE settlement rule. Explain that the hackathon build uses devnet metadata and requires user signing before funds could be locked by a real escrow program.

## 6. Show Why This Is ChatGPT-Native

Ask a follow-up:

```text
Why did the market move so sharply?
```

ChatGPT can explain the match story using the structured data returned by Signal.

## 7. Close

Signal is not another sports website. It is a ChatGPT-native fan companion and devnet prediction-market prototype powered by TxLINE live scores, events, odds, and settlement-ready match data.
