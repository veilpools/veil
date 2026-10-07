// TESTNET ONLY (46630). Deploys fresh registry + treasury + mined hook,
// proves attestation gating path. Never touches mainnet.
import { createPublicClient, createWalletClient, custom, encodeAbiParameters, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import {
  VEIL_ATTESTATION_REGISTRY_ABI,
  VEIL_ATTESTATION_REGISTRY_BYTECODE,
  VEIL_TREASURY_ABI,
  VEIL_TREASURY_BYTECODE,
  VEIL_HOOK_ABI,
  VEIL_HOOK_BYTECODE,
  VEIL_CREATE2_DEPLOYER_ABI,
} from "../lib/veil-artifact.mjs";
import { mineHookSalt } from "./mine-hook.mjs";
import { rpcRequest } from "./rpc-helper.mjs";
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

const MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const CREATE2 = "0x25ed04b42071086c3a8647954422c9c958e35f3e";

const key = process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!key) throw new Error("Missing key in env");
const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(46630, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const publicClient = createPublicClient({ chain: robinhoodTestnet, transport });
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport });
const out = {};

let hash = await wallet.deployContract({
  abi: VEIL_ATTESTATION_REGISTRY_ABI,
  bytecode: VEIL_ATTESTATION_REGISTRY_BYTECODE,
  args: [account.address],
});
let rc = await publicClient.waitForTransactionReceipt({ hash });
out.registry = rc.contractAddress;
console.log("registry:", rc.contractAddress, hash);

hash = await wallet.deployContract({
  abi: VEIL_TREASURY_ABI,
  bytecode: VEIL_TREASURY_BYTECODE,
  args: [account.address, "0x0000000000000000000000000000000000000000"],
});
rc = await publicClient.waitForTransactionReceipt({ hash });
out.treasury = rc.contractAddress;
console.log("treasury:", rc.contractAddress, hash);

const { salt, address } = mineHookSalt(CREATE2, MANAGER, out.treasury, out.registry, account.address);
out.hookSalt = salt;
out.hook = address;
const ctor = encodeAbiParameters(
  [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }],
  [MANAGER, out.treasury, out.registry, account.address]
).slice(2);
hash = await wallet.writeContract({
  address: CREATE2,
  abi: VEIL_CREATE2_DEPLOYER_ABI,
  functionName: "deploy",
  args: [salt, `${VEIL_HOOK_BYTECODE}${ctor}`],
});
rc = await publicClient.waitForTransactionReceipt({ hash });
console.log("hook:", address, hash, rc.status);
if (rc.status !== "success") throw new Error("hook deploy reverted");

const proofRoot = keccak256(new TextEncoder().encode(`veil-testnet-attest-${Date.now()}`));
hash = await wallet.writeContract({
  address: out.registry,
  abi: VEIL_ATTESTATION_REGISTRY_ABI,
  functionName: "registerAttestation",
  args: [account.address, proofRoot],
});
await publicClient.waitForTransactionReceipt({ hash });
const ok = await publicClient.readContract({
  address: out.registry,
  abi: VEIL_ATTESTATION_REGISTRY_ABI,
  functionName: "verifyAttestation",
  args: [account.address],
});
console.log("attested:", ok, hash);
if (!ok) throw new Error("attestation not verifiable");

fs.writeFileSync("deployments/hook-gating-testnet-latest.json", JSON.stringify({ chainId: 46630, ...out, attested: ok }, null, 2));
console.log("HOOK GATING PROVEN ON TESTNET");
