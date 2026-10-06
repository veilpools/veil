// One-time rescue: moves remaining TESTNET balance from the retired
// compromised key to the fresh deployer. Testnet only. The old key is
// already public in git history; it is never written to env.
import { execSync } from "node:child_process";
import { createWalletClient, custom, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../../../lib/chains.mjs";
import { rpcRequest } from "../../../scripts/rpc-helper.mjs";

const NEW = "0x3411988ed697e1c9EBE4194432d6757C2aD3bd08";
const OLD_RAW = execSync("git show 212bfa3:scripts/check-balance.mjs", { cwd: "." })
  .toString()
  .match(/0x[0-9a-f]{64}/)[0];

const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(46630, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const account = privateKeyToAccount(OLD_RAW);
const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport });

const call = (method, params) =>
  rpcRequest(46630, { jsonrpc: "2.0", id: 1, method, params }).then((r) => {
    if (r.error) throw new Error(r.error.message);
    return r.result;
  });
const bal = BigInt(await call("eth_getBalance", [account.address, "latest"]));
const gasPrice = BigInt(await call("eth_gasPrice", []));
const fee = 21000n * gasPrice * 2n;
const send = bal - fee;
console.log("old balance:", formatEther(bal), "sending:", formatEther(send > 0n ? send : 0n));
if (send <= 0n) {
  console.log("Nothing worth rescuing.");
  process.exit(0);
}
const hash = await wallet.sendTransaction({ to: NEW, value: send });
console.log("rescue tx:", hash);
