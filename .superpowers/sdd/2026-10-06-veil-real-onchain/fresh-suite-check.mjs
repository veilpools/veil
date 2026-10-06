// Read-only health check of the fresh mainnet suite. No keys, no gas.
import { keccak256 } from "viem";
import { rpcCall } from "../../../scripts/rpc-helper.mjs";

const POOL = "0xdd0fb7fc7f1398fd1398a594f7a0ce934caa7ea0";
const TREASURY = "0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34";
const HOOK = "0x9df0b52bf290a13e11c73c56c4c533e3887760c4";
const TOKEN = "0xe0e11ec0d62eda12de796d025d6334fadfe5ab2a";

const sel = (sig) => `0x${keccak256(new TextEncoder().encode(sig)).slice(2, 10)}`;
async function read(to, sig) {
  // rpc-helper rpcCall already unwraps the JSON-RPC envelope (or throws).
  return rpcCall(4663, "eth_call", [{ to, data: sel(sig) }, "latest"]);
}

const show = (label, hex, fmt) => {
  if (fmt === "addr") console.log(label, `0x${hex.slice(-40)}`);
  else if (fmt === "bool") console.log(label, hex !== `0x${"0".repeat(64)}`);
  else console.log(label, BigInt(hex).toString());
};

show("pool nextIndex:", await read(POOL, "nextIndex()"));
show("pool totalDeposits wei:", await read(POOL, "totalDeposits()"));
show("pool denomination wei:", await read(POOL, "denomination()"));
show("pool cap wei:", await read(POOL, "poolCap()"));
show("pool depositsPaused:", await read(POOL, "depositsPaused()"), "bool");
show("pool guardian:", await read(POOL, "guardian()"), "addr");
show("treasury totalBurned wei:", await read(TREASURY, "totalBurned()"));
show("treasury totalFeeReceived wei:", await read(TREASURY, "totalFeeReceived()"));
show("treasury veilToken:", await read(TREASURY, "veilToken()"), "addr");
show("treasury buybackShareBps:", await read(TREASURY, "buybackShareBps()"));
show("token totalSupply wei:", await read(TOKEN, "totalSupply()"));
show("hook owner:", await read(HOOK, "owner()"), "addr");
