// TESTNET ONLY (chain 46630). Task R2 R2 (Live A): ETH -> VEIL `swapToShield`
// through the NEW fixed router (deployments/router-fixed-testnet-latest.json).
//
// Flow: live-quote sizing (zero-floor simulateContract of the exact calldata
// against the new router) -> fresh note secrets snapshotted to disk BEFORE the
// send -> swapToShield{value} -> assert SwapToShieldExecuted + dest nextIndex
// + router zero-balance invariant.
//
// SAFETY:
// - Asserts chainId === 46630 from the live RPC and REFUSES mainnet (4663) or
//   any other chain. Pass --mainnet and the script exits non-zero.
// - Never prints private keys.
// - Budget gate: requires deployer balance >= amountIn + 0.004 ETH gas margin
//   before sending; otherwise exits 2 (BLOCKED) without spending.
// - Note secrets are persisted BEFORE the tx is sent (dust-incident rule).
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
import { VEIL_SHIELD_ROUTER_ABI } from "../lib/veil-artifact.mjs";

const EXPECTED_CHAIN_ID = 46630;
const MAINNET_CHAIN_ID = 4663;
const ZERO = "0x0000000000000000000000000000000000000000";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const VEIL5_POOL = "0xd73920a3cbfdf3f6be530cab73fc9c876619517a"; // 0.5 VEIL, nextIndex 0
const VEIL2_POOL = "0x172e9cc542cf9349813f74548eec6e0a1df65e17"; // 2 VEIL fallback
const AMOUNT_IN = 1000000000000000n; // 0.001 ETH candidate input
const SLIPPAGE_PCT = 0.5;
const GAS_MARGIN_WEI = 4000000000000000n; // 0.004 ETH gas headroom
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

const balance = await publicClient.getBalance({ address: account.address });
console.log("deployer balance wei:", String(balance));
if (balance < AMOUNT_IN + GAS_MARGIN_WEI) {
  console.error(
    `BLOCKED: balance ${balance} wei < amountIn + gas margin. Stopping without spending.`
  );
  process.exit(2);
}

// Destination-guard reads (fail closed): need an unpaused VEIL pool whose
// denomination the live quote can fund. 0.5 pool preferred (unused nextIndex 0).
const GUARD_ABI = parseAbi([
  "function denomination() view returns (uint256)",
  "function asset() view returns (address)",
  "function depositsPaused() view returns (bool)",
  "function nextIndex() view returns (uint32)",
  "function poolCap() view returns (uint256)",
  "function totalDeposits() view returns (uint256)",
]);
const destCandidates = [VEIL5_POOL, VEIL2_POOL];
const destStates = [];
for (const pool of destCandidates) {
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
    `dest ${pool}: denom=${denomination} paused=${paused} nextIndex=${nextIndex} capRemaining=${cap - total}`
  );
}

const poolKey = {
  currency0: ZERO,
  currency1: VEIL,
  fee: 3000,
  tickSpacing: 60,
  hooks: ZERO,
};

// Live quote: zero-floor simulation of the EXACT swapToShield calldata
// (zeroForOne=true: ETH in -> VEIL out) against the NEW router. The 0.5-pool
// commitment shape is identical for either dest, so one sim sizes the input.
const rand32 = () =>
  toHex(crypto.getRandomValues(new Uint8Array(32)));
const quoteNullifier = rand32();
const quoteSecret = rand32();
const quoteCommitment = keccak256(concatHex([quoteNullifier, quoteSecret]));
const simArgs = {
  key: { ...poolKey },
  zeroForOne: true,
  amountIn: AMOUNT_IN,
  minAmountOut: 0n,
  sqrtPriceLimitX96: MIN_SQRT_LIMIT,
  commitment: quoteCommitment,
  shieldedPool: VEIL5_POOL,
  hookData: "0x",
};
let quotedOut;
try {
  const { result } = await publicClient.simulateContract({
    address: ROUTER,
    abi: VEIL_SHIELD_ROUTER_ABI,
    functionName: "swapToShield",
    args: [simArgs],
    account: account.address,
    value: AMOUNT_IN,
  });
  quotedOut = result;
} catch (e) {
  console.error(`BLOCKED: live quote simulation reverted: ${String(e).slice(0, 300)}`);
  process.exit(2);
}
console.log(`live quote: 0.001 ETH -> ${quotedOut} wei VEIL`);

// Pick destination from the LIVE quote: 0.5 pool preferred, else 2 VEIL pool.
let dest = null;
for (const s of destStates) {
  if (!s.paused && quotedOut >= s.denomination && s.cap - s.total >= s.denomination) {
    dest = s;
    break;
  }
}
if (!dest) {
  console.error(
    `BLOCKED: live quote ${quotedOut} VEIL funds neither VEIL pool denomination. No tx sent.`
  );
  process.exit(2);
}
console.log(`destination: ${dest.pool} (denom ${dest.denomination}, nextIndex ${dest.nextIndex})`);

// Fresh note secrets for the real deposit (never the quote throwaway).
const nullifier = rand32();
const secret = rand32();
const nullifierHash = keccak256(nullifier);
const commitment = keccak256(concatHex([nullifier, secret]));
const note = {
  secret,
  nullifier,
  nullifierHash,
  commitment,
  denomination: String(dest.denomination),
  asset: VEIL.toLowerCase(),
  timestamp: Date.now(),
};

// MANDATORY pre-send snapshot: persist secrets BEFORE broadcasting.
mkdirSync("deployments", { recursive: true });
writeFileSync(
  `deployments/r2-liveA-notes-${RUN_STAMP}.json`,
  JSON.stringify(
    {
      network: "Robinhood Testnet",
      chainId: EXPECTED_CHAIN_ID,
      router: ROUTER,
      poolDestination: dest.pool,
      note,
      warning:
        "Testnet-only note secrets (mock verifier). Anyone holding this file can spend this note.",
    },
    null,
    2
  )
);
console.log(`pre-send snapshot: deployments/r2-liveA-notes-${RUN_STAMP}.json`);

// Router zero-balance baseline.
const routerEthBefore = await publicClient.getBalance({ address: ROUTER });
const ERC20_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const routerVeilBefore = await publicClient.readContract({
  address: VEIL, abi: ERC20_ABI, functionName: "balanceOf", args: [ROUTER],
});
console.log(`router before: eth=${routerEthBefore} veil=${routerVeilBefore}`);

// Slippage-bound params from the LIVE quote (never hardcoded).
const minAmountOut = (quotedOut * 9950n) / 10000n;
const params = {
  key: { ...poolKey },
  zeroForOne: true,
  amountIn: AMOUNT_IN,
  minAmountOut,
  sqrtPriceLimitX96: MIN_SQRT_LIMIT,
  commitment,
  shieldedPool: dest.pool,
  hookData: "0x",
};
console.log(`minAmountOut: ${minAmountOut} (slippage ${SLIPPAGE_PCT}%)`);

const swapHash = await wallet.writeContract({
  address: ROUTER,
  abi: VEIL_SHIELD_ROUTER_ABI,
  functionName: "swapToShield",
  args: [params],
  value: AMOUNT_IN,
});
const swapRc = await publicClient.waitForTransactionReceipt({ hash: swapHash });
if (swapRc.status !== "success") {
  console.error(`swapToShield reverted: ${swapHash}. Note secrets are in the pre-send snapshot.`);
  process.exit(1);
}
console.log(`swapToShield tx: ${swapHash} block ${swapRc.blockNumber}`);

// Assertions: event + dest nextIndex + router zero-balance invariant.
let executed = null;
for (const log of swapRc.logs) {
  try {
    const decoded = decodeEventLog({
      abi: VEIL_SHIELD_ROUTER_ABI,
      data: log.data,
      topics: log.topics,
    });
    if (decoded.eventName !== "SwapToShieldExecuted") continue;
    const a = decoded.args;
    if (a.commitment.toLowerCase() === commitment.toLowerCase()) {
      executed = {
        swapper: a.swapper,
        shieldedPool: a.shieldedPool,
        commitment: a.commitment,
        amountIn: String(a.amountIn),
        amountOut: String(a.amountOut),
      };
    }
  } catch {}
}
if (!executed) {
  console.error("SwapToShieldExecuted event not found for our commitment.");
  process.exit(1);
}
if (executed.shieldedPool.toLowerCase() !== dest.pool.toLowerCase()) {
  console.error("Swap settled into an unexpected pool.");
  process.exit(1);
}
if (executed.amountIn !== String(AMOUNT_IN)) {
  console.error("Event amountIn mismatch.");
  process.exit(1);
}
console.log(`event: amountOut=${executed.amountOut} veil`);

const destIndexAfter = await publicClient.readContract({
  address: dest.pool, abi: GUARD_ABI, functionName: "nextIndex",
});
if (destIndexAfter !== dest.nextIndex + 1) {
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

const gasWei = (swapRc.gasUsed ?? 0n) * (swapRc.effectiveGasPrice ?? 0n);
console.log(`swap gas: ${swapRc.gasUsed} @ ${swapRc.effectiveGasPrice} = ${gasWei} wei`);

const record = {
  network: "Robinhood Testnet",
  chainId: EXPECTED_CHAIN_ID,
  ranAt: new Date().toISOString(),
  deployer: account.address,
  router: ROUTER,
  direction: "ETH -> VEIL (zeroForOne=true)",
  amountInWei: String(AMOUNT_IN),
  liveQuoteOutWei: String(quotedOut),
  minAmountOutWei: String(minAmountOut),
  slippagePercent: SLIPPAGE_PCT,
  poolDestination: dest.pool,
  txs: {
    swapToShield: { hash: swapHash, blockNumber: Number(swapRc.blockNumber) },
  },
  assertions: {
    event: executed,
    destNextIndexBefore: dest.nextIndex,
    destNextIndexAfter: destIndexAfter,
    routerEthAfter: String(routerEthAfter),
    routerVeilUnchanged: String(routerVeilAfter),
  },
  destNote: note,
  cycleGasWei: String(gasWei),
  explorer: { swapToShield: `${EXPLORER_TX}${swapHash}` },
  status: "completed",
};
writeFileSync(
  `deployments/r2-liveA-${RUN_STAMP}.json`,
  JSON.stringify(record, bigToString, 2)
);
console.log(`record: deployments/r2-liveA-${RUN_STAMP}.json`);
console.log(`Explorer: ${EXPLORER_TX}${swapHash}`);
console.log("DONE: live ETH->VEIL swapToShield completed and asserted.");
