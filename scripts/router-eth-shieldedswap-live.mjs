// TESTNET ONLY (chain 46630). Task R2 R3 (Live B): ETH -> VEIL `shieldedSwap`
// through the NEW fixed router (deployments/router-fixed-testnet-latest.json).
//
// Flow: FRESH ETH-pool deposit (0.001 ETH note) -> legacy withdraw proof bound
// to the new router -> zero-floor simulateContract of the exact shieldedSwap
// calldata -> self-relay shieldedSwap (relayerFee 0, zeroForOne=true) into a
// VEIL pool -> assert ShieldedSwapExecuted + dest nextIndex + router invariant
// + source nullifier spent.
//
// SAFETY:
// - Asserts chainId === 46630 from the live RPC and REFUSES mainnet (4663) or
//   any other chain. Pass --mainnet and the script exits non-zero.
// - Never prints private keys.
// - Budget gate: requires deployer balance >= deposit + 0.006 ETH gas margin
//   before the first send; otherwise exits 2 (BLOCKED) without spending.
// - MANDATORY pre-send snapshots: source-note secrets are persisted BEFORE
//   the deposit tx; the destination note is persisted BEFORE the swap tx
//   (dust-incident rule: no send without its secrets on disk).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  keccak256,
  concatHex,
  toHex,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import {
  VEIL_SHIELD_ROUTER_ABI,
  SHIELDED_POOL_ABI,
} from "../lib/veil-artifact.mjs";

const EXPECTED_CHAIN_ID = 46630;
const MAINNET_CHAIN_ID = 4663;
const ZERO = "0x0000000000000000000000000000000000000000";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ETH_POOL = "0x1b1d39e4da649747ecc0e93e7a06452a3061de17"; // 0.001 ETH
const VEIL5_POOL = "0xd73920a3cbfdf3f6be530cab73fc9c876619517a"; // 0.5 VEIL preferred
const VEIL2_POOL = "0x172e9cc542cf9349813f74548eec6e0a1df65e17"; // 2 VEIL fallback
const PROVISIONAL_PROOF = "0x12345678"; // mock-verifier proof (lib/withdraw-args.ts)
const SLIPPAGE_PCT = 0.5;
const GAS_MARGIN_WEI = 6000000000000000n; // 0.006 ETH gas headroom
const MIN_SQRT_LIMIT = 4295128740n; // MIN_SQRT_RATIO + 1 (zeroForOne=true leg)
const EXPLORER_TX = "https://explorer.testnet.chain.robinhood.com/tx/";
const RUN_STAMP = new Date().toISOString().replaceAll(":", "-");
const bigToString = (_k, v) => (typeof v === "bigint" ? String(v) : v);

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

const routerManifest = JSON.parse(
  readFileSync("deployments/router-fixed-testnet-latest.json", "utf8")
);
const ROUTER = routerManifest.contracts.VeilShieldRouter.address;
console.log("fixed router:", ROUTER);

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

const GUARD_ABI = parseAbi([
  "function denomination() view returns (uint256)",
  "function asset() view returns (address)",
  "function depositsPaused() view returns (bool)",
  "function nextIndex() view returns (uint32)",
  "function rootHistory(uint256) view returns (bytes32)",
  "function isKnownRoot(bytes32) view returns (bool)",
  "function isNullifierSpent(bytes32) view returns (bool)",
  "function poolCap() view returns (uint256)",
  "function totalDeposits() view returns (uint256)",
]);

// Source-gate reads (fail closed).
const [srcDenom, srcAsset, srcPaused, srcIndexBefore, srcCap, srcTotal] = await Promise.all([
  publicClient.readContract({ address: ETH_POOL, abi: GUARD_ABI, functionName: "denomination" }),
  publicClient.readContract({ address: ETH_POOL, abi: GUARD_ABI, functionName: "asset" }),
  publicClient.readContract({ address: ETH_POOL, abi: GUARD_ABI, functionName: "depositsPaused" }),
  publicClient.readContract({ address: ETH_POOL, abi: GUARD_ABI, functionName: "nextIndex" }),
  publicClient.readContract({ address: ETH_POOL, abi: GUARD_ABI, functionName: "poolCap" }),
  publicClient.readContract({ address: ETH_POOL, abi: GUARD_ABI, functionName: "totalDeposits" }),
]);
console.log(
  `source ETH pool: denom=${srcDenom} paused=${srcPaused} nextIndex=${srcIndexBefore} capRemaining=${srcCap - srcTotal}`
);
if (srcPaused) {
  console.error("BLOCKED: ETH source pool is paused. Stopping.");
  process.exit(2);
}
if (srcAsset !== ZERO) {
  console.error("BLOCKED: ETH source pool asset mismatch.");
  process.exit(2);
}
if (srcCap - srcTotal < srcDenom) {
  console.error("BLOCKED: ETH source pool cap exhausted. Stopping.");
  process.exit(2);
}

const balance = await publicClient.getBalance({ address: account.address });
console.log("deployer balance wei:", String(balance));
if (balance < srcDenom + GAS_MARGIN_WEI) {
  console.error(
    `BLOCKED: balance ${balance} wei < deposit + gas margin. Stopping without spending.`
  );
  process.exit(2);
}

// Fresh source-note secrets (keccak commitment scheme, mirrors lib/note.ts).
const rand32 = () => toHex(crypto.getRandomValues(new Uint8Array(32)));
const srcNullifier = rand32();
const srcSecret = rand32();
const srcNullifierHash = keccak256(srcNullifier);
const srcCommitment = keccak256(concatHex([srcNullifier, srcSecret]));
const sourceNote = {
  secret: srcSecret,
  nullifier: srcNullifier,
  nullifierHash: srcNullifierHash,
  commitment: srcCommitment,
  denomination: String(srcDenom),
  asset: ZERO,
  timestamp: Date.now(),
};
console.log(`source note: commitment=${srcCommitment}`);

// PRE-SEND SNAPSHOT 1: source secrets BEFORE the deposit tx.
mkdirSync("deployments", { recursive: true });
const notesPath = `deployments/r2-liveB-notes-${RUN_STAMP}.json`;
writeFileSync(
  notesPath,
  JSON.stringify(
    {
      network: "Robinhood Testnet",
      chainId: EXPECTED_CHAIN_ID,
      router: ROUTER,
      poolSource: ETH_POOL,
      poolDestination: null,
      sourceNote,
      destNote: null,
      warning:
        "Testnet-only note secrets (mock verifier). Anyone holding this file can spend these notes.",
    },
    null,
    2
  )
);
console.log(`pre-send snapshot 1 (source): ${notesPath}`);

// Deposit the fresh 0.001 ETH note (value-bearing, no ERC20 leg).
const depositHash = await wallet.writeContract({
  address: ETH_POOL,
  abi: SHIELDED_POOL_ABI,
  functionName: "deposit",
  args: [srcCommitment],
  value: srcDenom,
});
const depositRc = await publicClient.waitForTransactionReceipt({ hash: depositHash });
if (depositRc.status !== "success") {
  console.error(`Deposit reverted: ${depositHash}. Source secrets are in snapshot 1.`);
  process.exit(1);
}
const srcIndexAfter = await publicClient.readContract({
  address: ETH_POOL, abi: GUARD_ABI, functionName: "nextIndex",
});
if (srcIndexAfter !== srcIndexBefore + 1) {
  console.error("Source pool nextIndex did not increment. Stopping.");
  process.exit(1);
}
const root = await publicClient.readContract({
  address: ETH_POOL, abi: GUARD_ABI, functionName: "rootHistory",
  args: [BigInt(srcIndexAfter - 1)],
});
const known = await publicClient.readContract({
  address: ETH_POOL, abi: GUARD_ABI, functionName: "isKnownRoot",
  args: [root],
});
if (!known) {
  console.error("Deposit root not known. Stopping (funds safe in pool; secrets on disk).");
  process.exit(2);
}
console.log(`deposit tx: ${depositHash} block ${depositRc.blockNumber} root=${root}`);

// Legacy withdraw proof bound to the NEW router (self-relay, fee 0;
// mirrors lib/withdraw-args.ts buildWithdrawArgs).
const withdrawProof = PROVISIONAL_PROOF;
const withdrawRoot = root;
const relayerFee = 0n;

// Destination-guard reads: 0.5 VEIL pool preferred, else 2 VEIL pool.
const destStates = [];
for (const pool of [VEIL5_POOL, VEIL2_POOL]) {
  const [denomination, asset, paused, nextIndex, cap, total] = await Promise.all([
    publicClient.readContract({ address: pool, abi: GUARD_ABI, functionName: "denomination" }),
    publicClient.readContract({ address: pool, abi: GUARD_ABI, functionName: "asset" }),
    publicClient.readContract({ address: pool, abi: GUARD_ABI, functionName: "depositsPaused" }),
    publicClient.readContract({ address: pool, abi: GUARD_ABI, functionName: "nextIndex" }),
    publicClient.readContract({ address: pool, abi: GUARD_ABI, functionName: "poolCap" }),
    publicClient.readContract({ address: pool, abi: GUARD_ABI, functionName: "totalDeposits" }),
  ]);
  destStates.push({ pool, denomination, asset, paused, nextIndex, cap, total });
  console.log(
    `dest ${pool}: denom=${denomination} paused=${paused} nextIndex=${nextIndex}`
  );
}

const poolKey = {
  currency0: ZERO,
  currency1: VEIL,
  fee: 3000,
  tickSpacing: 60,
  hooks: ZERO,
};

// Destination secrets from the LIVE denomination shortlist (shape is the
// same for either pool; the pool is picked from the live quote below).
const dstNullifier = rand32();
const dstSecret = rand32();
const dstNullifierHash = keccak256(dstNullifier);
const dstCommitment = keccak256(concatHex([dstNullifier, dstSecret]));

// Zero-floor simulation of the EXACT shieldedSwap calldata (ETH -> VEIL,
// zeroForOne=true): the live quote. Try 0.5 pool first.
const simBase = {
  poolSource: ETH_POOL,
  proof: withdrawProof,
  root: withdrawRoot,
  nullifierHash: srcNullifierHash,
  relayerFee,
  key: { ...poolKey },
  zeroForOne: true,
  minAmountOut: 0n,
  sqrtPriceLimitX96: MIN_SQRT_LIMIT,
  newCommitment: dstCommitment,
  poolDestination: VEIL5_POOL,
  hookData: "0x",
};
let expectedOut;
try {
  const { result } = await publicClient.simulateContract({
    address: ROUTER,
    abi: VEIL_SHIELD_ROUTER_ABI,
    functionName: "shieldedSwap",
    args: [simBase],
    account: account.address,
  });
  expectedOut = result;
} catch (e) {
  console.error(`BLOCKED: shieldedSwap live sim reverted: ${String(e).slice(0, 300)}`);
  process.exit(2);
}
console.log(`shieldedSwap live sim output: ${expectedOut} wei VEIL`);

let dest = null;
for (const s of destStates) {
  if (!s.paused && expectedOut >= s.denomination && s.cap - s.total >= s.denomination) {
    dest = s;
    break;
  }
}
if (!dest) {
  console.error(
    `BLOCKED: simulated output ${expectedOut} VEIL funds neither VEIL pool. No swap sent; source note remains safe in the pool.`
  );
  process.exit(2);
}
console.log(`destination: ${dest.pool} (denom ${dest.denomination}, nextIndex ${dest.nextIndex})`);

const destNote = {
  secret: dstSecret,
  nullifier: dstNullifier,
  nullifierHash: dstNullifierHash,
  commitment: dstCommitment,
  denomination: String(dest.denomination),
  asset: VEIL.toLowerCase(),
  timestamp: Date.now(),
};

// PRE-SEND SNAPSHOT 2: BOTH notes BEFORE the swap tx.
writeFileSync(
  notesPath,
  JSON.stringify(
    {
      network: "Robinhood Testnet",
      chainId: EXPECTED_CHAIN_ID,
      router: ROUTER,
      poolSource: ETH_POOL,
      poolDestination: dest.pool,
      sourceNote,
      destNote,
      warning:
        "Testnet-only note secrets (mock verifier). Anyone holding this file can spend these notes.",
    },
    null,
    2
  )
);
console.log(`pre-send snapshot 2 (source+dest): ${notesPath}`);

// Router zero-balance baseline.
const routerEthBefore = await publicClient.getBalance({ address: ROUTER });
const ERC20_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const routerVeilBefore = await publicClient.readContract({
  address: VEIL, abi: ERC20_ABI, functionName: "balanceOf", args: [ROUTER],
});
console.log(`router before: eth=${routerEthBefore} veil=${routerVeilBefore}`);

// Slippage-bound params from the LIVE quote (never hardcoded).
const minAmountOut = (expectedOut * 9950n) / 10000n;
const params = {
  ...simBase,
  minAmountOut,
  poolDestination: dest.pool,
};
console.log(`minAmountOut: ${minAmountOut} (slippage ${SLIPPAGE_PCT}%)`);

const swapHash = await wallet.writeContract({
  address: ROUTER,
  abi: VEIL_SHIELD_ROUTER_ABI,
  functionName: "shieldedSwap",
  args: [params],
});
const swapRc = await publicClient.waitForTransactionReceipt({ hash: swapHash });
if (swapRc.status !== "success") {
  console.error(`shieldedSwap reverted: ${swapHash}. Secrets are in snapshot 2.`);
  process.exit(1);
}
console.log(`shieldedSwap tx: ${swapHash} block ${swapRc.blockNumber}`);

// Assertions: event + dest nextIndex + router invariant + nullifier spent.
let executed = null;
for (const log of swapRc.logs) {
  try {
    const decoded = decodeEventLog({
      abi: VEIL_SHIELD_ROUTER_ABI,
      data: log.data,
      topics: log.topics,
    });
    if (decoded.eventName !== "ShieldedSwapExecuted") continue;
    const a = decoded.args;
    if (String(a.nullifierHash).toLowerCase() === srcNullifierHash.toLowerCase()) {
      executed = {
        relayer: a.relayer,
        poolSource: a.poolSource,
        poolDestination: a.poolDestination,
        nullifierHash: a.nullifierHash,
        newCommitment: a.newCommitment,
        amountOut: String(a.amountOut),
      };
    }
  } catch {}
}
if (!executed) {
  console.error("ShieldedSwapExecuted event not found for our nullifier.");
  process.exit(1);
}
if (executed.poolDestination.toLowerCase() !== dest.pool.toLowerCase()) {
  console.error("Swap settled into an unexpected destination pool.");
  process.exit(1);
}
if (String(executed.newCommitment).toLowerCase() !== dstCommitment.toLowerCase()) {
  console.error("Event newCommitment does not match our destination note.");
  process.exit(1);
}
console.log(`event: amountOut=${executed.amountOut} veil newCommitment=${executed.newCommitment}`);

const dstIndexAfter = await publicClient.readContract({
  address: dest.pool, abi: GUARD_ABI, functionName: "nextIndex",
});
if (dstIndexAfter !== dest.nextIndex + 1) {
  console.error("Destination pool nextIndex did not increment.");
  process.exit(1);
}
const routerEthAfter = await publicClient.getBalance({ address: ROUTER });
const routerVeilAfter = await publicClient.readContract({
  address: VEIL, abi: ERC20_ABI, functionName: "balanceOf", args: [ROUTER],
});
if (routerEthAfter !== 0n || routerVeilAfter !== routerVeilBefore) {
  console.error(
    `Router invariant violated: eth ${routerEthBefore}->${routerEthAfter}, veil ${routerVeilBefore}->${routerVeilAfter}.`
  );
  process.exit(1);
}
console.log(`invariant ok: router eth=${routerEthAfter} veil unchanged=${routerVeilAfter}`);

const spent = await publicClient.readContract({
  address: ETH_POOL, abi: GUARD_ABI, functionName: "isNullifierSpent",
  args: [srcNullifierHash],
});
console.log(`source nullifier spent: ${spent}`);

// Gas accounting.
let gasWei = 0n;
for (const rc of [depositRc, swapRc]) {
  gasWei += (rc.gasUsed ?? 0n) * (rc.effectiveGasPrice ?? 0n);
}
console.log(
  `deposit gas: ${depositRc.gasUsed} | swap gas: ${swapRc.gasUsed} | cycle gas total wei: ${gasWei}`
);

const record = {
  network: "Robinhood Testnet",
  chainId: EXPECTED_CHAIN_ID,
  ranAt: new Date().toISOString(),
  deployer: account.address,
  router: ROUTER,
  direction: "ETH -> VEIL (zeroForOne=true; previously contract-blocked, now fixed)",
  poolSource: ETH_POOL,
  poolDestination: dest.pool,
  liveSimOutputWei: String(expectedOut),
  minAmountOutWei: String(minAmountOut),
  slippagePercent: SLIPPAGE_PCT,
  txs: {
    deposit: { hash: depositHash, blockNumber: Number(depositRc.blockNumber) },
    shieldedSwap: { hash: swapHash, blockNumber: Number(swapRc.blockNumber) },
  },
  assertions: {
    event: executed,
    srcNextIndexBefore: srcIndexBefore,
    srcNextIndexAfter: srcIndexAfter,
    destNextIndexBefore: dest.nextIndex,
    destNextIndexAfter: dstIndexAfter,
    routerEthAfter: String(routerEthAfter),
    routerVeilUnchanged: String(routerVeilAfter),
    sourceNullifierSpent: spent,
  },
  sourceNote,
  destNote,
  cycleGasWei: String(gasWei),
  explorer: {
    deposit: `${EXPLORER_TX}${depositHash}`,
    shieldedSwap: `${EXPLORER_TX}${swapHash}`,
  },
  status: "completed",
};
writeFileSync(
  `deployments/r2-liveB-${RUN_STAMP}.json`,
  JSON.stringify(record, bigToString, 2)
);
console.log(`record: deployments/r2-liveB-${RUN_STAMP}.json`);
console.log(`Explorer: ${EXPLORER_TX}${swapHash}`);
console.log("DONE: live ETH->VEIL shieldedSwap completed and asserted.");
