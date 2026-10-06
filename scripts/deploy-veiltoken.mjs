// Deploys the temporary VeilToken (fixed supply, self-burn) to Robinhood Chain.
// Usage: node scripts/deploy-veiltoken.mjs --testnet | --mainnet
// Reads PRIVATE_KEY from .env.mainnet.local / .env.local. Transport goes
// through scripts/rpc-helper.mjs (IP bypass), never direct RPC.
import { createPublicClient, createWalletClient, custom } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodMainnet, robinhoodTestnet } from "../lib/chains.mjs";
import { rpcRequest } from "./rpc-helper.mjs";
import fs from "node:fs";

// Non-viaIR build from scripts/compile-veiltoken.mjs (verifiable on Blockscout).
const { abi: VEIL_TOKEN_ABI, bytecode: VEIL_TOKEN_BYTECODE } = JSON.parse(
  fs.readFileSync("deployments/veiltoken-artifact.json", "utf8")
);

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

const useMainnet = process.argv.includes("--mainnet");
const chainId = useMainnet ? 4663 : 46630;
const chain = useMainnet ? robinhoodMainnet : robinhoodTestnet;

const key = process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!key) throw new Error("Missing MAINNET_PRIVATE_KEY or PRIVATE_KEY in env");

const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(chainId, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const publicClient = createPublicClient({ chain, transport });
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const wallet = createWalletClient({ account, chain, transport });

const NAME = "Veil";
const SYMBOL = "VEIL";
const SUPPLY = 1000000000n * 1000000000000000000n;

const hash = await wallet.deployContract({
  abi: VEIL_TOKEN_ABI,
  bytecode: VEIL_TOKEN_BYTECODE,
  args: [NAME, SYMBOL, SUPPLY],
});
console.log("Deploy hash:", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("Deployed at:", receipt.contractAddress, "status:", receipt.status);
if (receipt.status !== "success" || !receipt.contractAddress) {
  throw new Error("VeilToken deployment reverted");
}

const record = {
  network: useMainnet ? "robinhood-mainnet" : "robinhood-testnet",
  chainId,
  contract: "VeilToken",
  address: receipt.contractAddress,
  tx: hash,
  blockNumber: Number(receipt.blockNumber),
  args: { name: NAME, symbol: SYMBOL, supply: SUPPLY.toString() },
  deployer: account.address,
  temporary: true,
  note: "Temporary protocol token for end-to-end testing. Canonical token launches on Pons.",
};
fs.writeFileSync(
  `deployments/veiltoken-${useMainnet ? "mainnet" : "testnet"}-latest.json`,
  JSON.stringify(record, null, 2)
);
console.log("Manifest written.");
