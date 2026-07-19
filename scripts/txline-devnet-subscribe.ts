import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";

const DEVNET = {
  rpcUrl: "https://api.devnet.solana.com",
  apiOrigin: "https://txline-dev.txodds.com",
  programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
  txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
  serviceLevelId: 1,
  durationWeeks: 4,
  selectedLeagues: [] as number[],
};

const IDL_PATH = "txline/devnet/idl/txoracle.json";

async function main(): Promise<void> {
  assertNode20();
  const wallet = loadWallet();
  const txoracleIdl = loadDevnetIdl();
  const apiBaseUrl = `${DEVNET.apiOrigin}/api`;
  const connection = new Connection(process.env.ANCHOR_PROVIDER_URL ?? DEVNET.rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new LocalWallet(wallet), {
    commitment: "confirmed",
  });

  anchor.setProvider(provider);

  const program = new anchor.Program(txoracleIdl, provider);
  if (!program.programId.equals(DEVNET.programId)) {
    throw new Error(
      `Loaded IDL program ${program.programId.toBase58()} does not match devnet program ${DEVNET.programId.toBase58()}`,
    );
  }

  const balance = await connection.getBalance(wallet.publicKey, "confirmed");
  if (balance <= 0) {
    throw new Error("Wallet has no devnet SOL. Fund it before subscribing.");
  }

  const txSig = await subscribeFreeTier(program, provider);
  console.log("Subscription transaction:", txSig);

  const authResponse = await axios.post(`${DEVNET.apiOrigin}/auth/guest/start`);
  const jwt = authResponse.data.token;
  if (!jwt || typeof jwt !== "string") {
    throw new Error("TxLINE guest auth did not return a token.");
  }

  const messageString = `${txSig}:${DEVNET.selectedLeagues.join(",")}:${jwt}`;
  const message = new TextEncoder().encode(messageString);
  const signatureBytes = nacl.sign.detached(message, wallet.secretKey);
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  const activationResponse = await axios.post(
    `${apiBaseUrl}/token/activate`,
    {
      txSig,
      walletSignature,
      leagues: DEVNET.selectedLeagues,
    },
    {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  );

  const apiToken = activationResponse.data.token || activationResponse.data;
  if (!apiToken || typeof apiToken !== "string") {
    throw new Error("TxLINE activation did not return an API token string.");
  }

  console.log("");
  console.log("API Token activated successfully.");
  console.log("");
  console.log("Set these Render env vars:");
  console.log(`TXLINE_NETWORK=devnet`);
  console.log(`TXLINE_API_ORIGIN=${DEVNET.apiOrigin}`);
  console.log(`TXLINE_API_TOKEN=${apiToken}`);
  console.log("TXLINE_GUEST_JWT=");
  console.log("TXLINE_AUTOSTART_FIXTURE_IDS=<devnet fixture id>");
}

async function subscribeFreeTier(
  program: anchor.Program,
  provider: anchor.AnchorProvider,
): Promise<string> {
  const user = provider.wallet.publicKey;
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId,
  );

  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    DEVNET.txlTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId,
  );

  const userTokenAccount = getAssociatedTokenAddressSync(
    DEVNET.txlTokenMint,
    user,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  await ensureAssociatedTokenAccount(provider, userTokenAccount, user);

  return program.methods
    .subscribe(DEVNET.serviceLevelId, DEVNET.durationWeeks)
    .accounts({
      user,
      pricingMatrix: pricingMatrixPda,
      tokenMint: DEVNET.txlTokenMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

async function ensureAssociatedTokenAccount(
  provider: anchor.AnchorProvider,
  associatedTokenAccount: PublicKey,
  owner: PublicKey,
): Promise<void> {
  const existing = await provider.connection.getAccountInfo(associatedTokenAccount, "confirmed");
  if (existing) return;

  const transaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      owner,
      associatedTokenAccount,
      owner,
      DEVNET.txlTokenMint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );

  const signature = await provider.sendAndConfirm(transaction, [], {
    commitment: "confirmed",
  });
  console.log("Created user TxL token account:", signature);
}

function assertNode20(): void {
  const major = Number(process.versions.node.split(".")[0]);
  if (!Number.isInteger(major) || major < 20) {
    throw new Error(`TxLINE devnet examples require Node.js 20+. Current version: ${process.version}`);
  }
}

function loadWallet(): Keypair {
  const walletPath = process.env.ANCHOR_WALLET;
  if (!walletPath) {
    throw new Error("Set ANCHOR_WALLET to a funded devnet keypair JSON path.");
  }

  const absolutePath = resolve(walletPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Wallet file not found: ${absolutePath}`);
  }

  const bytes = JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
  if (!Array.isArray(bytes)) {
    throw new Error("ANCHOR_WALLET must point to a Solana keypair JSON array.");
  }

  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

function loadDevnetIdl(): anchor.Idl {
  const absolutePath = resolve(IDL_PATH);
  if (!existsSync(absolutePath)) {
    throw new Error(
      `Missing TxLINE devnet IDL at ${absolutePath}. Copy examples/devnet/idl/txoracle.json from https://github.com/txodds/tx-on-chain.`,
    );
  }

  return JSON.parse(readFileSync(absolutePath, "utf8")) as anchor.Idl;
}

class LocalWallet implements anchor.Wallet {
  readonly publicKey: PublicKey;

  constructor(private readonly payer: Keypair) {
    this.publicKey = payer.publicKey;
  }

  async signTransaction<T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(
    tx: T,
  ): Promise<T> {
    if ("partialSign" in tx) {
      tx.partialSign(this.payer);
      return tx;
    }

    tx.sign([this.payer]);
    return tx;
  }

  async signAllTransactions<T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(
    txs: T[],
  ): Promise<T[]> {
    return Promise.all(txs.map((tx) => this.signTransaction(tx)));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
