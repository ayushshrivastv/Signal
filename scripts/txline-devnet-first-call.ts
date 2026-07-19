import { createTxLineClientFromEnv } from "../src/txline/client.js";

async function main(): Promise<void> {
  assertDevnetEnv();

  const client = createTxLineClientFromEnv();
  const fixtures = await client.listFixtures();

  console.log("TxLINE devnet first API call");
  console.log("-----------------------------");
  console.log(`API origin: ${client.origin}`);
  console.log(`Fixtures returned: ${fixtures.length}`);

  const fixture = findFixture(fixtures);
  if (!fixture) {
    console.log("No fixtures returned, so score/odds snapshot checks were skipped.");
    return;
  }

  console.log(`Fixture: ${fixture.fixtureId} ${fixture.homeTeam} vs ${fixture.awayTeam}`);

  const [scoresSnapshot, scoresUpdates, oddsSnapshot, historicalScores] = await Promise.allSettled([
    client.getScoresSnapshot(fixture.fixtureId),
    client.getScoresUpdates(fixture.fixtureId),
    client.getOddsSnapshot(fixture.fixtureId),
    client.getHistoricalScores(fixture.fixtureId),
  ]);

  printResult("Scores snapshot", scoresSnapshot);
  printResult("Scores updates", scoresUpdates);
  printResult("Odds snapshot", oddsSnapshot);
  printResult("Historical scores", historicalScores);

  const seq = firstSequence(scoresSnapshot.status === "fulfilled" ? scoresSnapshot.value : []);
  if (seq !== undefined) {
    const validation = await Promise.allSettled([
      client.getScoreValidation({
        fixtureId: fixture.fixtureId,
        seq,
        statKeys: [1, 2],
      }),
    ]);
    printResult("Score validation", validation[0]);
  } else {
    console.log("Score validation: skipped, no observed score sequence in snapshot.");
  }
}

function assertDevnetEnv(): void {
  if (process.env.TXLINE_NETWORK !== "devnet") {
    throw new Error("Set TXLINE_NETWORK=devnet before running this check.");
  }

  if (process.env.TXLINE_API_ORIGIN !== "https://txline-dev.txodds.com") {
    throw new Error("Set TXLINE_API_ORIGIN=https://txline-dev.txodds.com before running this check.");
  }

  if (!process.env.TXLINE_API_TOKEN) {
    throw new Error("Set TXLINE_API_TOKEN to the activated devnet API token.");
  }
}

function findFixture(
  fixtures: Array<{ fixtureId: string; status: string; homeTeam: string; awayTeam: string }>,
) {
  return (
    fixtures.find((fixture) => fixture.status === "live") ??
    fixtures.find((fixture) => fixture.status === "upcoming") ??
    fixtures[0]
  );
}

function printResult(
  label: string,
  result: PromiseSettledResult<unknown[] | unknown>,
): void {
  if (result.status === "rejected") {
    console.log(`${label}: failed (${result.reason instanceof Error ? result.reason.message : result.reason})`);
    return;
  }

  if (Array.isArray(result.value)) {
    console.log(`${label}: OK (${result.value.length} records)`);
    return;
  }

  console.log(`${label}: OK`);
}

function firstSequence(records: unknown[]): number | undefined {
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const value = (record as Record<string, unknown>).Seq ?? (record as Record<string, unknown>).seq;
    if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
  }
  return undefined;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
