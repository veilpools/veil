// Read-only: probe an address on mainnet 4663. No keys used.
import { rpcCall } from "../../../scripts/rpc-helper.mjs";

const ADDR = "0x1d3743FF07C44212Fc6BcCf5a6dA2de861B16e47";
const [bal, nonce, code] = await Promise.all([
  rpcCall(4663, "eth_getBalance", [ADDR, "latest"]),
  rpcCall(4663, "eth_getTransactionCount", [ADDR, "latest"]),
  rpcCall(4663, "eth_getCode", [ADDR, "latest"]),
]);
console.log("address:", ADDR);
console.log("balance wei:", BigInt(bal).toString());
console.log("nonce:", BigInt(nonce).toString());
console.log("is contract:", code !== "0x", "code bytes:", (code.length - 2) / 2);
