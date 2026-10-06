// Read-only: full details of one mainnet tx. No keys used.
import { rpcCall } from "../../../scripts/rpc-helper.mjs";

const HASH = "0x1d3743FF07C44212Fc6BcCf5a6dA2de861B16e47";

const tx = await rpcCall(4663, "eth_getTransactionByHash", [HASH]);
if (!tx) {
  console.log("Transaction not found on mainnet 4663.");
  process.exit(0);
}
console.log("from:", tx.from);
console.log("to:", tx.to ?? "(contract creation)");
console.log("value wei:", BigInt(tx.value).toString());
console.log("nonce:", BigInt(tx.nonce).toString());
console.log("input bytes:", (tx.input.length - 2) / 2);
console.log("input head:", tx.input.slice(0, 74));
const blk = await rpcCall(4663, "eth_getBlockByNumber", [tx.blockNumber, false]);
console.log("block:", BigInt(tx.blockNumber).toString(), new Date(Number(blk.timestamp) * 1000).toISOString());
const rc = await rpcCall(4663, "eth_getTransactionReceipt", [HASH]);
console.log("receipt status:", rc?.status, "gas used:", rc ? BigInt(rc.gasUsed).toString() : "n/a");
