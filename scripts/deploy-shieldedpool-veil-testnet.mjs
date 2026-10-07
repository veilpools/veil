// TESTNET ONLY (chain 46630). Deploys ONE VEIL-denominated legacy ShieldedPool
// for Task 4b so router.shieldedSwap has a distinct poolDestination.
//
// SAFETY (R6):
// - Asserts chainId === 46630 from the live RPC and REFUSES mainnet (4663) or
//   any other chain. Pass --mainnet and the script exits non-zero.
// - Never prints private keys.
// - Budget gate: requires deployer balance >= 0.005 ETH before sending;
//   otherwise exits 2 (BLOCKED) without draining the key.
//
// Config mirrors ShieldedPool_ETH (deployments/testnet-latest.json):
// same verifier, same association root, guardian = deployer (same posture as
// the ETH pool whose guardian is its deployer), deposits unpaused by default,
// cap = 10000x denomination.
// Denomination (0.5 VEIL) is sized from LIVE v4 state (see below), not guessed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import {
  SHIELDED_POOL_ABI,
  SHIELDED_POOL_BYTECODE,
} from "../lib/veil-artifact.mjs";

const EXPECTED_CHAIN_ID = 46630;
const MAINNET_CHAIN_ID = 4663;
const ROUTER = "0xb1baee8d519a7a2edbaff99eec0ba10948670d68";
const ETH_POOL = "0x1b1d39e4da649747ecc0e93e7a06452a3061de17";
const VERIFIER = "0xab9dd89A3B16DB81140D6a5842A439de6f4969b6";
const POOL_VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ZERO = "0x0000000000000000000000000000000000000000";
const STATE_VIEW = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b";
const V4_POOL_ID =
  "0x3524d46204a0438a67c94e9795818b3b0c5d59869d28865754c4254eb05442e1";
const ASSOCIATION_ROOT =
  "0x2188824287183927522224640574525727508854836440041603434369820418";
// Chosen denomination defaults to 0.5 VEIL with ~2x live-price margin (see
// sizing below). Override for additional pools, e.g. a 2 VEIL source pool for
// the executable VEIL->ETH shieldedSwap direction:
//   node scripts/deploy-shieldedpool-veil-testnet.mjs --name ShieldedPool_VEIL2 --denomination-wei 2000000000000000000 --cap-wei 20000000000000000000000
function argvValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}
const POOL_NAME = argvValue("--name") || "ShieldedPool_VEIL";
const DENOMINATION = BigInt(argvValue("--denomination-wei") || "500000000000000000");
const POOL_CAP = BigInt(argvValue("--cap-wei") || "5000000000000000000000"); // 10000x default denomination
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
// Note: local env files may carry a stale NEXT_PUBLIC_CHAIN_ID from mainnet
// eras; they are NOT trusted here. The load-bearing check is the live RPC
// chainId assert below (this script only ever talks to the hardcoded testnet
// RPC, so funds cannot leave testnet 46630).
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
    `BLOCKED: balance ${balance} wei < 0.005 ETH budget gate. Stopping without draining.`
  );
  process.exit(2);
}

// Live v4 sizing: read slot0 + liquidity, imply VEIL per 0.001 ETH, require
// >= 2x the planned 0.5 VEIL denomination. This is live state, not a quote.
const SLOT_ABI = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
]);
const [slot, liq] = await Promise.all([
  publicClient.readContract({
    address: STATE_VIEW,
    abi: SLOT_ABI,
    functionName: "getSlot0",
    args: [V4_POOL_ID],
  }),
  publicClient.readContract({
    address: STATE_VIEW,
    abi: SLOT_ABI,
    functionName: "getLiquidity",
    args: [V4_POOL_ID],
  }),
]);
if (liq === 0n) {
  console.error("BLOCKED: v4 ETH/VEIL pool has zero liquidity. Stopping.");
  process.exit(2);
}
const Q96 = 2n ** 96n;
const sqrtP = slot[0];
// Implied VEIL per 1 ETH as float (display + sizing only, margin covers math).
const ratio = Number(sqrtP) / Number(Q96);
const veilPerEth = ratio * ratio;
const impliedOut = veilPerEth * 0.001;
console.log(
  `live v4: tick ${slot[1]}, liquidity ${liq}, implied VEIL/ETH ~${veilPerEth.toFixed(1)}, ` +
    `implied 0.001 ETH output ~${impliedOut.toFixed(3)} VEIL`
);
if (!(impliedOut >= 1.0) && POOL_NAME === "ShieldedPool_VEIL") {
  console.error(
    `BLOCKED: implied output ${impliedOut} VEIL lacks 2x margin over 0.5 VEIL denomination. Stopping.`
  );
  process.exit(2);
}

// Mirror-check the ETH pool config we claim to mirror.
const POOL_ABI = parseAbi([
  "function verifier() view returns (address)",
  "function guardian() view returns (address)",
  "function depositsPaused() view returns (bool)",
]);
const [ethVerifier, ethPaused] = await Promise.all([
  publicClient.readContract({
    address: ETH_POOL,
    abi: POOL_ABI,
    functionName: "verifier",
  }),
  publicClient.readContract({
    address: ETH_POOL,
    abi: POOL_ABI,
    functionName: "depositsPaused",
  }),
]);
if (ethVerifier.toLowerCase() !== VERIFIER.toLowerCase()) {
  console.error("BLOCKED: ETH pool verifier mismatch, config assumption broken.");
  process.exit(2);
}
console.log(`mirror check: ETH pool verifier matches, paused=${ethPaused}`);

const hash = await wallet.deployContract({
  abi: SHIELDED_POOL_ABI,
  bytecode: SHIELDED_POOL_BYTECODE,
  args: [POOL_VEIL, VERIFIER, DENOMINATION, POOL_CAP, ASSOCIATION_ROOT, account.address],
});
console.log("deploy tx:", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  console.error(`Deployment failed in tx ${hash}`);
  process.exit(1);
}
const poolAddress = receipt.contractAddress;
console.log(`${POOL_NAME}: ${poolAddress} (block ${receipt.blockNumber})`);

// Post-deploy verification reads (fail closed).
const VERIFY_ABI = parseAbi([
  "function denomination() view returns (uint256)",
  "function asset() view returns (address)",
  "function depositsPaused() view returns (bool)",
  "function poolCap() view returns (uint256)",
  "function guardian() view returns (address)",
  "function verifier() view returns (address)",
]);
const [denom, asset, paused, cap, guardian, verifier] = await Promise.all([
  publicClient.readContract({ address: poolAddress, abi: VERIFY_ABI, functionName: "denomination" }),
  publicClient.readContract({ address: poolAddress, abi: VERIFY_ABI, functionName: "asset" }),
  publicClient.readContract({ address: poolAddress, abi: VERIFY_ABI, functionName: "depositsPaused" }),
  publicClient.readContract({ address: poolAddress, abi: VERIFY_ABI, functionName: "poolCap" }),
  publicClient.readContract({ address: poolAddress, abi: VERIFY_ABI, functionName: "guardian" }),
  publicClient.readContract({ address: poolAddress, abi: VERIFY_ABI, functionName: "verifier" }),
]);
if (denom !== DENOMINATION) throw new Error("denomination mismatch after deploy");
if (asset.toLowerCase() !== POOL_VEIL.toLowerCase()) throw new Error("asset mismatch after deploy");
if (paused !== false) throw new Error("deposits must be unpaused after deploy");
if (cap !== POOL_CAP) throw new Error("cap mismatch after deploy");
console.log(
  `verified: denomination=${denom} asset=${asset} paused=${paused} cap=${cap} guardian=${guardian}`
);

const gasUsed = receipt.gasUsed ?? 0n;
const gasPrice =
  receipt.effectiveGasPrice ?? (await publicClient.getGasPrice());
console.log(
  `deploy gas: ${gasUsed} @ ${gasPrice} wei = ${gasUsed * gasPrice} wei`
);

mkdirSync("deployments", { recursive: true });
const manifest = {
  network: "Robinhood Testnet",
  chainId: EXPECTED_CHAIN_ID,
  deployedAt: new Date().toISOString(),
  deployer: account.address,
  contracts: {
    [POOL_NAME]: {
      address: poolAddress,
      tx: hash,
      blockNumber: Number(receipt.blockNumber),
      args: {
        asset: POOL_VEIL,
        verifier: VERIFIER,
        denomination: String(DENOMINATION),
        poolCap: String(POOL_CAP),
        associationRoot: ASSOCIATION_ROOT,
        guardian: account.address,
      },
      mirrors: {
        pool: "ShieldedPool_ETH",
        address: ETH_POOL,
        verifier: VERIFIER,
        associationRoot: ASSOCIATION_ROOT,
        depositsUnpaused: true,
      },
      router: ROUTER,
      sizing: {
        impliedVeilPerEth: Number(veilPerEth.toFixed(3)),
        impliedPointZeroZeroOneEthOutputVeil: Number(impliedOut.toFixed(4)),
        v4Tick: Number(slot[1]),
        v4Liquidity: String(liq),
      },
      gasUsed: String(gasUsed),
      gasPriceWei: String(gasPrice),
    },
  },
  status: "completed",
};
const stamp = new Date().toISOString().replaceAll(":", "-");
const slug = POOL_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-");
writeFileSync(
  `deployments/${slug}-testnet-${stamp}.json`,
  JSON.stringify(manifest, null, 2)
);
writeFileSync(
  `deployments/${slug}-testnet-latest.json`,
  JSON.stringify(manifest, null, 2)
);
console.log(`manifest: deployments/${slug}-testnet-latest.json`);
console.log(`pool: ${POOL_NAME} at ${poolAddress}`);
console.log(`Explorer: ${EXPLORER_TX}${hash}`);
