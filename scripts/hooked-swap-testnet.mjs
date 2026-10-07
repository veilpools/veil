// TESTNET ONLY (46630). Attested swap through the hooked pool + fee assert.
// Assumes pool initialized + liquid. Never mainnet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, custom, encodeAbiParameters, parseEther, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import { VEIL_ATTESTATION_REGISTRY_ABI } from "../lib/veil-artifact.mjs";
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

const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ETH = "0x0000000000000000000000000000000000000000";
const MAN = JSON.parse(readFileSync(join(root, "deployments", "hook-gating-testnet-latest.json"), "utf8"));
const HOOK = MAN.hook;
const REGISTRY = MAN.registry;
const TREASURY = MAN.treasury;
const SWAPPER = "0x14c27b66fba1b561a920bd03970ae20c53608dff";

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
const swapArt = JSON.parse(readFileSync(join(root, "deployments", "swaphelper-artifact.json"), "utf8"));
const poolKey = { currency0: ETH, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: HOOK };

const APPROVE_ABI = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }];
async function swapAs(amountIn, hookData) {
  const ap = await wallet.writeContract({ address: VEIL, abi: APPROVE_ABI, functionName: "approve", args: [SWAPPER, amountIn] });
  const aprc = await publicClient.waitForTransactionReceipt({ hash: ap });
  if (aprc.status !== "success") throw new Error("approve reverted");
  return wallet.writeContract({
    address: SWAPPER, abi: swapArt.abi, functionName: "swapExactIn",
    args: [{ key: poolKey, zeroForOne: false, amountIn, minOut: 1n, hookData, inputToken: VEIL }],
  });
}

let reverted = false;
try {
  const bad = await swapAs(parseEther("1"), "0x");
  await publicClient.waitForTransactionReceipt({ hash: bad });
} catch {
  reverted = true;
}
console.log("ungated swap reverted:", reverted);
if (!reverted) throw new Error("Gating NOT enforced.");

const hookData = encodeAbiParameters([{ name: "u", type: "address" }], [account.address]);
const tb = await publicClient.getBalance({ address: TREASURY });
const h = await swapAs(parseEther("1"), hookData);
const rc = await publicClient.waitForTransactionReceipt({ hash: h });
console.log("attested swap:", h, rc.status);
if (rc.status !== "success") throw new Error("attested swap reverted");
const ta = await publicClient.getBalance({ address: TREASURY });
console.log("treasury ETH before/after:", tb.toString(), ta.toString());
if (ta <= tb) throw new Error("No protocol fee accrued.");
console.log("HOOK GATING + FEE PROVEN ON TESTNET");
console.log(`Explorer: https://explorer.testnet.chain.robinhood.com/tx/${h}`);
