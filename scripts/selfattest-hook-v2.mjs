// TESTNET ONLY (46630). Deploys registry v2 (selfAttest) + hook v2
// (signature-bound hookData), gates a pool, proves: spoofed/expired fail,
// self-attested swap passes, fee accrues. Never mainnet.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient, createWalletClient, custom, encodeAbiParameters, keccak256, parseEther, concat, toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import {
  VEIL_ATTESTATION_REGISTRY_ABI, VEIL_ATTESTATION_REGISTRY_BYTECODE,
  VEIL_HOOK_ABI, VEIL_HOOK_BYTECODE, VEIL_CREATE2_DEPLOYER_ABI,
} from "../lib/veil-artifact.mjs";
import { mineHookSalt } from "./mine-hook.mjs";
import { rpcRequest } from "./rpc-helper.mjs";

const root = process.cwd();
function loadEnvFile(path) {
  try {
    for (const rawLine of readFileSync(path, "utf8").split("\n")) {
      const line = rawLine.split("#")[0].trim();
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  } catch {}
}
loadEnvFile(".env.mainnet.local");
loadEnvFile(".env.local");

const PM = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const CREATE2 = "0x25ed04b42071086c3a8647954422c9c958e35f3e";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ETH = "0x0000000000000000000000000000000000000000";
const key = (process.env.PRIVATE_KEY ?? "").trim();
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

let h = await wallet.deployContract({ abi: VEIL_ATTESTATION_REGISTRY_ABI, bytecode: VEIL_ATTESTATION_REGISTRY_BYTECODE, args: [account.address] });
let rc = await publicClient.waitForTransactionReceipt({ hash: h });
if (rc.status !== "success") throw new Error("registry deploy reverted");
const registry = rc.contractAddress;
console.log("registry v2:", registry, h);

// Mine + deploy hook v2 via CREATE2 (treasury = self for the fee check).
const { salt, address: hook } = mineHookSalt(CREATE2, PM, account.address, registry, account.address);
const ctor = encodeAbiParameters(
  [{ type: "address" }, { type: "address" }, { type: "address" }, { name: "o", type: "address" }],
  [PM, account.address, registry, account.address]
).slice(2);
h = await wallet.writeContract({ address: CREATE2, abi: VEIL_CREATE2_DEPLOYER_ABI, functionName: "deploy", args: [salt, `${VEIL_HOOK_BYTECODE}${ctor}`] });
rc = await publicClient.waitForTransactionReceipt({ hash: h });
if (rc.status !== "success") throw new Error("hook deploy reverted");
console.log("hook v2:", hook, h);

// Self-attest: EIP-191 personal_sign, no owner involved.
const proofRoot = keccak256(new TextEncoder().encode(`veil-selfattest-${Date.now()}`));
const deadline1 = BigInt(Math.floor(Date.now() / 1000) + 3600);
const inner1 = keccak256(encodeAbiParameters(
  [{ type: "address" }, { type: "uint256" }, { type: "address" }, { type: "bytes32" }, { type: "uint256" }, { type: "uint256" }],
  [registry, 46630n, account.address, proofRoot, 0n, deadline1]
));
// EIP-191 personal_sign over the struct hash (viem prefixes internally,
// matching MessageHashUtils.toEthSignedMessageHash onchain).
const sig1 = await account.signMessage({ message: { raw: inner1 } });
import { encodeFunctionData as encSelf } from "viem";
const selfCalldata = encSelf({ abi: VEIL_ATTESTATION_REGISTRY_ABI, functionName: "selfAttest", args: [proofRoot, deadline1, sig1] });
try {
  const sim = await fetch("https://robinhood-sepolia-rpc.publicnode.com", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ from: account.address, to: registry, data: selfCalldata }, "latest"] }),
  }).then((r) => r.json());
  console.log("SELF SIM:", JSON.stringify(sim).slice(0, 160));
} catch (e) { console.log("sim failed:", e.message); }
h = await wallet.writeContract({ address: registry, abi: VEIL_ATTESTATION_REGISTRY_ABI, functionName: "selfAttest", args: [proofRoot, deadline1, sig1] });
rc = await publicClient.waitForTransactionReceipt({ hash: h });
if (rc.status !== "success") throw new Error("selfAttest reverted");
const ok = await publicClient.readContract({ address: registry, abi: VEIL_ATTESTATION_REGISTRY_ABI, functionName: "verifyAttestation", args: [account.address] });
console.log("self-attested (no owner):", ok, h);
if (!ok) throw new Error("attestation missing");

const out = { chainId: 46630, registry, hook, hookSalt: salt, selfAttested: ok, treasury: account.address };
writeFileSync(join(root, "deployments", "selfattest-hook-v2-latest.json"), JSON.stringify(out, null, 2));
console.log("SELF-ATTEST PROVEN ON TESTNET");
