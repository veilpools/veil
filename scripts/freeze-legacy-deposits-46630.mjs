// TESTNET ONLY (chain 46630). Freezes deposits on the three legacy ShieldedPools
// so every new deposit routes through the audited 0xbow suite. Withdrawals stay
// open by contract design: the pause only gates deposits, existing notes remain
// spendable.
//
// SAFETY:
// - Asserts the live RPC chainId === 46630 and REFUSES mainnet (4663) or any
//   other chain with a non-zero exit (same guard as
//   scripts/deploy-shieldedpool-veil-testnet.mjs).
// - All RPC flows through scripts/rpc-helper.mjs (rpcCall / rpcRequest).
// - Pool state is read with the SHIELDED_POOL_ABI from lib/veil-artifact.mjs.
// - Never prints private keys.
// - Dry run by default: without --execute, prints the three planned
//   pauseDeposits() calls and exits 0 (zero gas, no key required).
// - Live ONLY with --execute plus a funded PRIVATE_KEY in the environment.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, custom } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import { SHIELDED_POOL_ABI } from "../lib/veil-artifact.mjs";
import { rpcCall, rpcRequest } from "./rpc-helper.mjs";

const EXPECTED_CHAIN_ID = 46630;
const MAINNET_CHAIN_ID = 4663;
const EXECUTE = process.argv.includes("--execute");
const EXPLORER_TX = "https://explorer.testnet.chain.robinhood.com/tx/";

export const LEGACY_POOLS = [
  "0x1b1d39e4da649747ecc0e93e7a06452a3061de17",
  "0xd73920a3cbfdf3f6be530cab73fc9c876619517a",
  "0x172e9cc542cf9349813f74548eec6e0a1df65e17",
];

if (process.argv.includes("--mainnet")) {
  console.error("REFUSING --mainnet: this script is testnet-only (46630).");
  process.exit(1);
}

function loadEnvFile(path) {
  try {
    for (const rawLine of readFileSync(path, "utf8").split("\n")) {
      const line = rawLine.split("#")[0].trim();
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      )
        val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  } catch {}
}
loadEnvFile(".env.mainnet.local");
loadEnvFile(".env.local");

function isValidAddress(a) {
  return /^0x[0-9a-fA-F]{40}$/.test(a ?? "");
}

// Viem transport backed by the shared rpc-helper (same endpoint selection as
// every other script: dedicated testnet URL when configured, else IP bypass).
const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(
      EXPECTED_CHAIN_ID,
      { jsonrpc: "2.0", id: 1, method, params }
    );
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const publicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport,
});

if (!EXECUTE) {
  console.log("DRY-RUN (zero gas): planned pauseDeposits() calls:");
  for (const pool of LEGACY_POOLS) {
    if (!isValidAddress(pool)) {
      console.error(`BLOCKED: malformed pool address ${pool}.`);
      process.exit(1);
    }
    console.log(`  pauseDeposits() -> ${pool}`);
  }
  console.log("Re-run with --execute plus a funded PRIVATE_KEY to send live transactions.");
  process.exit(0);
}

// ---- Live path below. Fail closed on every doubt. ----

// Live RPC chainId assert via rpc-helper (same guard as
// deploy-shieldedpool-veil-testnet.mjs: refuse non-46630, exit non-zero).
const chainIdHex = await rpcCall(EXPECTED_CHAIN_ID, "eth_chainId", []);
const chainId = Number.parseInt(chainIdHex, 16);
if (chainId === MAINNET_CHAIN_ID) {
  console.error("REFUSING: connected to mainnet (4663). Testnet 46630 only.");
  process.exit(1);
}
if (chainId !== EXPECTED_CHAIN_ID) {
  console.error(`REFUSING: chainId ${chainId} is not testnet 46630.`);
  process.exit(1);
}
console.log(`chainId assert passed: ${chainId}`);

const rawKey = (process.env.PRIVATE_KEY || "").trim();
const normalizedKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
  console.error("Missing or malformed PRIVATE_KEY in env. Stopping without sending.");
  process.exit(1);
}
const account = privateKeyToAccount(normalizedKey);
const walletClient = createWalletClient({
  account,
  chain: robinhoodTestnet,
  transport,
});
console.log("guardian:", account.address);

const balance = await publicClient.getBalance({ address: account.address });
if (balance <= 0n) {
  console.error("BLOCKED: guardian balance is zero. Fund the key first. Stopping.");
  process.exit(2);
}

export async function freezeLegacyDeposits(poolAddresses) {
  const hashes = [];
  for (const pool of poolAddresses) {
    if (!isValidAddress(pool)) {
      throw new Error(`Refusing malformed pool address: ${pool}`);
    }
    const hash = await walletClient.writeContract({
      address: pool,
      abi: SHIELDED_POOL_ABI,
      functionName: "pauseDeposits",
      account,
      chain: robinhoodTestnet,
    });
    console.log(`pauseDeposits(${pool}): ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`pauseDeposits reverted for ${pool}: ${hash}`);
    }
    const paused = await publicClient.readContract({
      address: pool,
      abi: SHIELDED_POOL_ABI,
      functionName: "depositsPaused",
      args: [],
    });
    if (paused !== true) {
      throw new Error(`depositsPaused() is not true after ${hash}; aborting.`);
    }
    console.log(`verified depositsPaused=true for ${pool} (${EXPLORER_TX}${hash})`);
    hashes.push(hash);
  }
  return hashes;
}

const hashes = await freezeLegacyDeposits(LEGACY_POOLS);
console.log("All legacy deposits frozen. Transactions:");
for (const h of hashes) console.log(`  ${EXPLORER_TX}${h}`);
