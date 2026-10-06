// Read-only: balance of deployer at recent mainnet blocks. No keys used.
import { rpcCall } from "../../../scripts/rpc-helper.mjs";

const ADDR = "0xCdbdc82A021071eE445d9f897433a7E4B4EAfD8d";
const now = BigInt(await rpcCall(4663, "eth_blockNumber", []));
console.log("head:", now.toString());
for (const back of [0n, 500n, 2000n, 8000n, 30000n]) {
  const b = now - back;
  if (b < 0n) continue;
  const hex = `0x${b.toString(16)}`;
  try {
    const bal = await rpcCall(4663, "eth_getBalance", [ADDR, hex]);
    console.log(`block ${b} (-${back}): ${bal} wei`);
  } catch (e) {
    console.log(`block ${b}: RPC fail ${e.message}`);
  }
}
