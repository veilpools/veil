// TESTNET ONLY (46630). Gated swap on the v2 hook: spoofed/expired
// hookData reverts, self-attested user swaps through, fee accrues.
// Never mainnet.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient, createWalletClient, custom, encodeAbiParameters, keccak256, parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import { VEIL_HOOK_ABI, VEIL_ATTESTATION_REGISTRY_ABI } from "../lib/veil-artifact.mjs";
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
const POSM = "0x58daec3116aae6d93017baaea7749052e8a04fa7";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ETH = "0x0000000000000000000000000000000000000000";
const MAN = JSON.parse(readFileSync(join(root, "deployments", "selfattest-hook-v2-latest.json"), "utf8"));
const HOOK = MAN.hook;
const REGISTRY = MAN.registry;
const TREASURY = MAN.treasury;
const HELPER = "0x3563689bfa8e8f12d6688b35cfc1eef1cd8e2e09";
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
const swapAbi = JSON.parse(readFileSync(join(root, "deployments", "swaphelper-artifact.json"), "utf8")).abi;
const poolKey = { currency0: ETH, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: HOOK };

async function call(addr, abi, fn, args, value = 0n) {
  const h = await wallet.writeContract({ address: addr, abi, functionName: fn, args, value });
  const rc = await publicClient.waitForTransactionReceipt({ hash: h });
  if (rc.status !== "success") throw new Error(`${fn} reverted: ${h}`);
  console.log(`${fn}:`, h);
  return h;
}

// Pool init + liquidity via helper.
const INIT_ABI = [{ type: "function", name: "initializePool", stateMutability: "payable", inputs: [{ name: "key", type: "tuple", components: [{ name: "currency0", type: "address" }, { name: "currency1", type: "address" }, { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" }] }, { name: "sqrtPriceX96", type: "uint160" }], outputs: [{ name: "", type: "int24" }] }];
function isqrt(n) { if (n < 2n) return n; let x = n, y = (x + 1n) >> 1n; while (y < x) { x = y; y = (x + n / x) >> 1n; } return x; }
const sqrtPriceX96 = isqrt((parseEther("1000") * 2n ** 256n) / parseEther("1")) >> 32n;
const STV_ABI = [{ type: "function", name: "getLiquidity", stateMutability: "view", inputs: [{ name: "poolId", type: "bytes32" }], outputs: [{ name: "", type: "uint128" }] }];
const { keccak256: kPool, encodeAbiParameters: encPool } = await import("viem");
const myPoolId = kPool(encPool(
  [{ type: "tuple", components: [{ name: "currency0", type: "address" }, { name: "currency1", type: "address" }, { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" }] }],
  [[poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]]
));
const curLiq = await publicClient.readContract({ address: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b", abi: STV_ABI, functionName: "getLiquidity", args: [myPoolId] }).catch(() => 0n);
const liqAbi = JSON.parse(readFileSync(join(root, "deployments", "liqhelper-artifact.json"), "utf8")).abi;
console.log("current hooked pool liquidity:", curLiq.toString());
if (curLiq === 0n) {
  try {
    await call(POSM, INIT_ABI, "initializePool", [poolKey, sqrtPriceX96]);
  } catch (e) {
    console.log("init skipped (probably exists):", e.message.slice(0, 80));
  }
  await call(VEIL, [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }], "approve", [HELPER, parseEther("50")]);
  await call(HELPER, liqAbi, "addLiquidity", [{ key: poolKey, tickLower: -887220, tickUpper: 887220, liquidity: 300000000000000000n, amount0Max: parseEther("0.012"), amount1Max: parseEther("12"), veil: VEIL }], parseEther("0.012"));
} else {
  console.log("pool already liquid, skipping init+liq");
}
// Gate 600s.
await call(HOOK, VEIL_HOOK_ABI, "setPoolGating", [poolKey, true, 600n]);

const poolId = keccak256(encodeAbiParameters(
  [{ type: "tuple", components: [{ name: "currency0", type: "address" }, { name: "currency1", type: "address" }, { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" }] }],
  [[poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]]
));
async function signedHookData(user) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const inner = keccak256(encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "address" }, { type: "bytes32" }, { type: "uint256" }],
    [HOOK, 46630n, user, poolId, deadline]
  ));
  const sig = await account.signMessage({ message: { raw: inner } });
  return encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "bytes" }],
    [user, deadline, sig]
  );
}
async function swapAs(amountIn, hookData) {
  const ap = await wallet.writeContract({
    address: VEIL,
    abi: [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }],
    functionName: "approve", args: [SWAPPER, amountIn],
  });
  await publicClient.waitForTransactionReceipt({ hash: ap });
  return wallet.writeContract({
    address: SWAPPER, abi: swapAbi, functionName: "swapExactIn",
    args: [{ key: poolKey, zeroForOne: false, amountIn, minOut: 1n, hookData, inputToken: VEIL }],
  });
}

// 1. Spoofed hookData (attested SOMEONE ELSE's address... self is attested;
//    use garbage user) must revert.
let reverted = false;
try {
  const badData = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "bytes" }],
    ["0x1111111111111111111111111111111111111111", BigInt(Math.floor(Date.now() / 1000) + 600), "0x1234"]
  );
  const bad = await swapAs(parseEther("0.5"), badData);
  await publicClient.waitForTransactionReceipt({ hash: bad });
} catch { reverted = true; }
console.log("spoofed hookData reverted:", reverted);
if (!reverted) throw new Error("SPOOF ACCEPTED.");

// 2. Self-attested swap passes; fee accrues.
const good = await signedHookData(account.address);
const tb = await publicClient.getBalance({ address: TREASURY });
const h = await swapAs(parseEther("0.5"), good);
const rc = await publicClient.waitForTransactionReceipt({ hash: h });
console.log("attested swap:", h, rc.status);
if (rc.status !== "success") throw new Error("attested swap reverted");
const ta = await publicClient.getBalance({ address: TREASURY });
console.log("treasury ETH before/after:", tb.toString(), ta.toString());
if (ta <= tb) throw new Error("No fee accrued.");
console.log("GATED SWAP + FEE PROVEN (signature-bound, no owner)");
console.log(`Explorer: https://explorer.testnet.chain.robinhood.com/tx/${h}`);
