// TESTNET ONLY (chain 46630). Task R2 R1: deploy the FIXED VeilShieldRouter
// (R1 `_settleCurrency` fix: native settlement via PoolManager.settle{value},
// compiled artifact in lib/veil-artifact.mjs) with the local deployer key.
//
// Faithful equivalent of the repo deploy path (scripts/deploy.mjs step 7):
// same ABI + bytecode + constructor arg (PoolManager), same chain. Only the
// router is deployed (full-suite redeploy would waste testnet funds and is
// out of scope); the deviation is documented in the R2 report.
//
// SAFETY:
// - Asserts chainId === 46630 from the live RPC and REFUSES mainnet (4663) or
//   any other chain. Pass --mainnet and the script exits non-zero.
// - Never prints private keys.
// - Budget gate: requires deployer balance >= 0.005 ETH before sending;
//   otherwise exits 2 (BLOCKED) without spending.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import {
  VEIL_SHIELD_ROUTER_ABI,
  VEIL_SHIELD_ROUTER_BYTECODE,
} from "../lib/veil-artifact.mjs";

const EXPECTED_CHAIN_ID = 46630;
const MAINNET_CHAIN_ID = 4663;
const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const MIN_BALANCE_WEI = 5000000000000000n; // 0.005 ETH budget gate
const EXPLORER_TX = "https://explorer.testnet.chain.robinhood.com/tx/";

if (process.argv.includes("--mainnet")) {
  console.error("REFUSING --mainnet: this script is testnet-only (46630).");
  process.exit(1);
}

function loadEnvFile(path) {
  try {
    for (const rawLine of readFileSync(path, "utf8").split("\n")) {
      const line = rawLine.split("#")[0].trim();
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      )
        val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  } catch {}
}
loadEnvFile(".env.mainnet.local");
loadEnvFile(".env.local");
if ((process.env.NEXT_PUBLIC_CHAIN_ID || "").trim() !== String(EXPECTED_CHAIN_ID)) {
  console.warn(
    "warning: env NEXT_PUBLIC_CHAIN_ID is not 46630; relying on the live RPC chainId assert."
  );
}

const RPC = "https://robinhood-sepolia-rpc.publicnode.com";
const publicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(RPC),
});

const chainId = await publicClient.getChainId();
if (chainId === MAINNET_CHAIN_ID) {
  console.error("REFUSING: connected to mainnet (4663). Testnet 46630 only.");
  process.exit(1);
}
if (chainId !== EXPECTED_CHAIN_ID) {
  console.error(`REFUSING: chainId ${chainId} is not testnet 46630.`);
  process.exit(1);
}
console.log(`chainId assert passed: ${chainId}`);

const rawKey = (process.env.PRIVATE_KEY || "").trim();
if (!rawKey) {
  console.error("Missing PRIVATE_KEY in local env files. Stopping.");
  process.exit(1);
}
const account = privateKeyToAccount(
  rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
);
const wallet = createWalletClient({
  account,
  chain: robinhoodTestnet,
  transport: http(RPC),
});
console.log("deployer:", account.address);

const balance = await publicClient.getBalance({ address: account.address });
console.log("deployer balance wei:", String(balance));
if (balance < MIN_BALANCE_WEI) {
  console.error(
    `BLOCKED: balance ${balance} wei < 0.005 ETH budget gate. Stopping without spending.`
  );
  process.exit(2);
}

// Sanity: the PoolManager we pass must be a contract on this chain.
const pmCode = await publicClient.getBytecode({ address: POOL_MANAGER });
if (!pmCode || pmCode === "0x") {
  console.error(`BLOCKED: PoolManager ${POOL_MANAGER} has no code on 46630.`);
  process.exit(2);
}
console.log("PoolManager code present on 46630.");

const hash = await wallet.deployContract({
  abi: VEIL_SHIELD_ROUTER_ABI,
  bytecode: VEIL_SHIELD_ROUTER_BYTECODE,
  args: [POOL_MANAGER],
});
console.log("deploy tx:", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  console.error(`Router deployment failed in tx ${hash}`);
  process.exit(1);
}
const router = receipt.contractAddress;
console.log(`VeilShieldRouter (fixed): ${router} (block ${receipt.blockNumber})`);

// Post-deploy verification reads (fail closed).
const VERIFY_ABI = parseAbi([
  "function poolManager() view returns (address)",
]);
const onchainPm = await publicClient.readContract({
  address: router,
  abi: VERIFY_ABI,
  functionName: "poolManager",
});
if (onchainPm.toLowerCase() !== POOL_MANAGER.toLowerCase()) {
  throw new Error("poolManager mismatch after deploy");
}
const routerCode = await publicClient.getBytecode({ address: router });
if (!routerCode || routerCode === "0x" || routerCode.length < 100) {
  throw new Error("router has no code after deploy");
}
console.log(`verified: poolManager=${onchainPm} codeLen=${routerCode.length}`);

const gasUsed = receipt.gasUsed ?? 0n;
const gasPrice = receipt.effectiveGasPrice ?? (await publicClient.getGasPrice());
console.log(`deploy gas: ${gasUsed} @ ${gasPrice} wei = ${gasUsed * gasPrice} wei`);

mkdirSync("deployments", { recursive: true });
const manifest = {
  network: "Robinhood Testnet",
  chainId: EXPECTED_CHAIN_ID,
  deployedAt: new Date().toISOString(),
  deployer: account.address,
  task: "R2-R1: fixed router (R1 _settleCurrency via PoolManager.settle{value})",
  deployPath:
    "Faithful equivalent of scripts/deploy.mjs step 7 (same ABI/bytecode/constructor arg); router-only, full-suite redeploy out of scope.",
  contracts: {
    VeilShieldRouter: {
      address: router,
      tx: hash,
      blockNumber: Number(receipt.blockNumber),
      args: {
        poolManager: POOL_MANAGER,
      },
      gasUsed: String(gasUsed),
      gasPriceWei: String(gasPrice),
    },
  },
  status: "completed",
  explorer: `${EXPLORER_TX}${hash}`,
};
const stamp = new Date().toISOString().replaceAll(":", "-");
writeFileSync(
  `deployments/router-fixed-testnet-${stamp}.json`,
  JSON.stringify(manifest, null, 2)
);
writeFileSync(
  "deployments/router-fixed-testnet-latest.json",
  JSON.stringify(manifest, null, 2)
);
console.log("manifest: deployments/router-fixed-testnet-latest.json");
console.log(`router: ${router}`);
console.log(`Explorer: ${EXPLORER_TX}${hash}`);
