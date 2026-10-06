// Read-only: mainnet block timestamps to convert block distance to time.
import { rpcCall } from "../../../scripts/rpc-helper.mjs";

const head = BigInt(await rpcCall(4663, "eth_blockNumber", []));
for (const b of [head, head - 2000n]) {
  const blk = await rpcCall(4663, "eth_getBlockByNumber", [`0x${b.toString(16)}`, false]);
  console.log(b.toString(), new Date(Number(blk.timestamp) * 1000).toISOString());
}
