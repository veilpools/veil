// TESTNET ONLY (46630). Initializes a v4 ETH/VEIL pool + liquidity.
// Pattern: sCRITV4Launcher (initializePool + Permit2 + modifyLiquidities).
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  parseEther,
  parseAbi,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
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

const PM = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const POSM = "0x58daec3116aae6d93017baaea7749052e8a04fa7";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const STATE_VIEW = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ETH = "0x0000000000000000000000000000000000000000";

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

const poolKey = { currency0: ETH, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: ETH };
const tuple = {
  type: "tuple",
  components: [
    { name: "currency0", type: "address" },
    { name: "currency1", type: "address" },
    { name: "fee", type: "uint24" },
    { name: "tickSpacing", type: "int24" },
    { name: "hooks", type: "address" },
  ],
};
const poolId = "0x3524d46204a0438a67c94e9795818b3b0c5d59869d28865754c4254eb05442e1";

const SLOT_ABI = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
]);
const PM_ABI = parseAbi([
  "function initializePool((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,uint160 sqrtPriceX96) payable returns (int24)",
  "function modifyLiquidities(bytes unlockData,uint256 deadline) payable",
  "function multicall(bytes[] data) payable returns (bytes[] results)",
]);

const slot = await publicClient.readContract({
  address: STATE_VIEW,
  abi: SLOT_ABI,
  functionName: "getSlot0",
  args: [poolId],
});
const liq = await publicClient.readContract({
  address: STATE_VIEW,
  abi: SLOT_ABI,
  functionName: "getLiquidity",
  args: [poolId],
});

console.log("Pool Key:", poolKey);
console.log("Pool ID:", poolId);
console.log("Slot0 sqrtPriceX96:", slot[0].toString(), "tick:", slot[1]);
console.log("Active Liquidity:", liq.toString());
