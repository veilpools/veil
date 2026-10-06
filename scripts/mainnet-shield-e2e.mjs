// scripts/mainnet-shield-e2e.mjs
// Small-value deposit/withdraw verification. Pre-checks every revert path
// BEFORE spending gas, persists the note to disk BEFORE depositing so funds
// are never stranded with a lost note. Transport via rpc-helper (IP bypass).
import { createPublicClient, createWalletClient, custom, parseAbi, keccak256, concatHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodMainnet } from "../lib/chains.mjs";
import { rpcRequest } from "./rpc-helper.mjs";
import crypto from "node:crypto";
import fs from "node:fs";

function loadEnvFile(path) {
  try {
    for (const rawLine of fs.readFileSync(path, "utf8").split("\n")) {
      const line = rawLine.split("#")[0].trim();
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  } catch {}
}
loadEnvFile(".env.mainnet.local");
loadEnvFile(".env.local");

const key = process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!key) throw new Error("Missing MAINNET_PRIVATE_KEY or PRIVATE_KEY in env");
const pool = process.env.NEXT_PUBLIC_PRIVACY_POOL_ETH;
if (!pool) throw new Error("Missing NEXT_PUBLIC_PRIVACY_POOL_ETH in env");

const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(4663, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const publicClient = createPublicClient({ chain: robinhoodMainnet, transport });
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const wallet = createWalletClient({ account, chain: robinhoodMainnet, transport });
const abi = parseAbi([
  "function deposit(bytes32 commitment) payable returns (uint32)",
  "function withdraw(bytes proof, bytes32 root, bytes32 nullifierHash, address recipient, uint256 fee)",
  "function nextIndex() view returns (uint32)",
  "function rootHistory(uint256 i) view returns (bytes32)",
  "function isKnownRoot(bytes32 r) view returns (bool)",
  "function isNullifierSpent(bytes32 n) view returns (bool)",
  "function totalDeposits() view returns (uint256)",
  "function totalWithdrawn() view returns (uint256)",
  "function denomination() view returns (uint256)",
  "function poolCap() view returns (uint256)",
  "function depositsPaused() view returns (bool)",
  "function associationRoot() view returns (bytes32)",
]);
const verifierAbi = parseAbi(["function shouldPass() view returns (bool)"]);
const verifier = process.env.NEXT_PUBLIC_SHIELDED_VERIFIER;
if (!verifier) throw new Error("Missing NEXT_PUBLIC_SHIELDED_VERIFIER in env");

// Pre-checks before spending any gas.
const [paused, denom, cap, total, shouldPass] = await Promise.all([
  publicClient.readContract({ address: pool, abi, functionName: "depositsPaused" }),
  publicClient.readContract({ address: pool, abi, functionName: "denomination" }),
  publicClient.readContract({ address: pool, abi, functionName: "poolCap" }),
  publicClient.readContract({ address: pool, abi, functionName: "totalDeposits" }),
  publicClient.readContract({ address: verifier, abi: verifierAbi, functionName: "shouldPass" }),
]);
if (paused) throw new Error("Pool deposits are paused, aborting E2E.");
if (!shouldPass) throw new Error("Provisional verifier is disabled, aborting E2E.");
if (total + denom > cap) throw new Error("Deposit would exceed pool cap, aborting E2E.");

const rand32 = () => `0x${crypto.randomBytes(32).toString("hex")}`;
const secret = rand32();
const nullifier = rand32();
const nullifierHash = keccak256(nullifier);
const commitment = keccak256(concatHex([nullifier, secret]));
fs.writeFileSync(
  "e2e-note-backup.json",
  JSON.stringify({ asset: "0x0000000000000000000000000000000000000000", denomination: denom.toString(), nullifier, secret }, null, 2),
  { mode: 0o600 }
);
console.log("Note persisted to e2e-note-backup.json (mode 600) before deposit.");
console.log("WARNING: e2e-note-backup.json holds plaintext secrets. Delete it after the withdraw completes and never commit it.");
const before = await publicClient.readContract({ address: pool, abi, functionName: "nextIndex" });
const depHash = await wallet.writeContract({ address: pool, abi, functionName: "deposit", args: [commitment], value: denom });
console.log("Deposit hash:", depHash);
await publicClient.waitForTransactionReceipt({ hash: depHash });
const after = await publicClient.readContract({ address: pool, abi, functionName: "nextIndex" });
if (after !== before + 1) throw new Error("nextIndex did not increment");
const root = await publicClient.readContract({ address: pool, abi, functionName: "rootHistory", args: [BigInt(after - 1)] });
const known = await publicClient.readContract({ address: pool, abi, functionName: "isKnownRoot", args: [root] });
if (!known) throw new Error("Fresh root not known, aborting withdraw.");
const fresh = `0x${crypto.randomBytes(20).toString("hex")}`;
const wdHash = await wallet.writeContract({ address: pool, abi, functionName: "withdraw", args: ["0x12345678", root, nullifierHash, fresh, 0n] });
console.log("Withdraw hash:", wdHash);
await publicClient.waitForTransactionReceipt({ hash: wdHash });
const spent = await publicClient.readContract({ address: pool, abi, functionName: "isNullifierSpent", args: [nullifierHash] });
if (!spent) throw new Error("Nullifier not marked spent");
const [dep, wd, bal] = await Promise.all([
  publicClient.readContract({ address: pool, abi, functionName: "totalDeposits" }),
  publicClient.readContract({ address: pool, abi, functionName: "totalWithdrawn" }),
  publicClient.getBalance({ address: pool }),
]);
if (dep - wd !== bal) throw new Error("Invariant mismatch: deposits - withdrawals != balance");
console.log("E2E OK", JSON.stringify({ depHash, wdHash, fresh }));
