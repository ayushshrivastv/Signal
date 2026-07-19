import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const DEVNET = {
  network: "devnet",
  rpcUrl: "https://api.devnet.solana.com",
  apiOrigin: "https://txline-dev.txodds.com",
  programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
  txlTokenMint: "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",
  serviceLevelId: 1,
};

async function main(): Promise<void> {
  assertNode20();
  assertPublicKey("TxLINE devnet program", DEVNET.programId);
  assertPublicKey("TxL token mint", DEVNET.txlTokenMint);

  const walletPath = process.env.ANCHOR_WALLET;
  if (!walletPath) {
    throw new Error("Set ANCHOR_WALLET to a funded devnet keypair JSON path.");
  }

  const wallet = loadWallet(walletPath);
  const connection = new Connection(process.env.ANCHOR_PROVIDER_URL ?? DEVNET.rpcUrl, "confirmed");
  const lamports = await connection.getBalance(wallet.publicKey, "confirmed");
  const sol = lamports / 1_000_000_000;
  const guestJwt = await fetchGuestJwt();

  console.log("TxLINE devnet preflight");
  console.log("-----------------------");
  console.log(`Network: ${DEVNET.network}`);
  console.log(`RPC: ${connection.rpcEndpoint}`);
  console.log(`API origin: ${DEVNET.apiOrigin}`);
  console.log(`Program ID: ${DEVNET.programId}`);
  console.log(`TxL mint: ${DEVNET.txlTokenMint}`);
  console.log(`Service level: ${DEVNET.serviceLevelId}`);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`SOL balance: ${sol.toFixed(4)}`);
  console.log(`Guest JWT: ${guestJwt.slice(0, 12)}...${guestJwt.slice(-8)}`);

  if (sol <= 0) {
    throw new Error("Wallet has no devnet SOL. Request devnet SOL before subscribing.");
  }

  if (process.env.TXLINE_API_TOKEN) {
    const fixtureCount = await verifyActivatedToken(guestJwt, process.env.TXLINE_API_TOKEN);
    console.log(`Activated API token: OK (${fixtureCount} fixture records returned)`);
  } else {
    console.log("Activated API token: not set. Run the official subscription activation script next.");
  }

  console.log("");
  console.log("Next official TxLINE command:");
  console.log(
    [
      `TOKEN_MINT_ADDRESS=${DEVNET.txlTokenMint}`,
      `ANCHOR_PROVIDER_URL="${DEVNET.rpcUrl}"`,
      `ANCHOR_WALLET="${resolve(walletPath)}"`,
      "yarn ts-node examples/devnet/scripts/subscription_free_tier.ts",
    ].join(" \\\n  "),
  );
}

function assertNode20(): void {
  const major = Number(process.versions.node.split(".")[0]);
  if (!Number.isInteger(major) || major < 20) {
    throw new Error(`TxLINE devnet examples require Node.js 20+. Current version: ${process.version}`);
  }
}

function assertPublicKey(label: string, value: string): void {
  try {
    new PublicKey(value);
  } catch {
    throw new Error(`${label} is not a valid Solana public key: ${value}`);
  }
}

function loadWallet(path: string): Keypair {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new Error(`Wallet file not found: ${absolutePath}`);
  }

  const bytes = JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
  if (!Array.isArray(bytes)) {
    throw new Error("ANCHOR_WALLET must point to a Solana keypair JSON array.");
  }

  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

async function fetchGuestJwt(): Promise<string> {
  const response = await fetch(`${DEVNET.apiOrigin}/auth/guest/start`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Guest JWT request failed ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  const token =
    typeof data === "string"
      ? data
      : data && typeof data === "object"
        ? (data as Record<string, unknown>).token
        : undefined;

  if (typeof token !== "string") {
    throw new Error("Guest JWT response did not include a token string.");
  }

  return token;
}

async function verifyActivatedToken(guestJwt: string, apiToken: string): Promise<number> {
  const response = await fetch(`${DEVNET.apiOrigin}/api/fixtures/snapshot`, {
    headers: {
      Authorization: `Bearer ${guestJwt}`,
      "X-Api-Token": apiToken,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Activated token fixture check failed ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? data.length : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
