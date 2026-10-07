// TESTNET ONLY (chain 46630). Task 4b R3 (executable direction): ONE full
// shieldedSwap cycle VEIL -> ETH with the DEPLOYER testnet key, reusing the
// UI builder code verbatim:
//
//   deposit 2 VEIL note -> legacy withdraw proof -> router.shieldedSwap
//   (self-relay, relayerFee 0, zeroForOne=false) -> assert
//   ShieldedSwapExecuted + dest pool nextIndex + router zero-balance invariant.
//
// WHY THIS DIRECTION: the ETH -> VEIL direction is unexecutable against the
// deployed VeilShieldRouter (proven onchain 2026-10-07: the zero-floor
// simulation of the exact shieldedSwap calldata reverts with
// "eth settle failed" — _settleCurrency sends native ETH to the PoolManager
// with a bare call, but canonical v4 PoolManager has no receive/fallback;
// only settle{value} works, which the router does not use). The VEIL -> ETH
// direction settles ERC20 via safeTransfer (the proven swapToShield pattern)
// and exercises the identical router path: withdraw -> swap -> deposit ->
// event -> invariants. This IS the §7 #5 proof (private -> private,
// self-relayed, no addresses linked).
//
// Reused UI builders (imported, never reimplemented):
// buildSelfRelayShieldedSwapArgs, selectShieldedSwapRelayPath,
// generateNewShieldedNoteSecrets, findShieldedSwapExecuted (lib/shielded-swap*),
// buildWithdrawArgs, createShieldedNote, quoteSwapToShieldOutput (T2 route check).
//
// SAFETY (R6): chainId === 46630 asserted live, mainnet refused, no keys
// printed, 0.005 ETH budget gate (else exit 2 BLOCKED), zero-floor simulation
// of the exact calldata before every send.
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";

register("./ts-import-hooks.mjs", import.meta.url);

const EXPECTED_CHAIN_ID = 46630;
const MAINNET_CHAIN_ID = 4663;
const ROUTER = "0xb1baee8d519a7a2edbaff99eec0ba10948670d68";
const ETH_POOL = "0x1b1d39e4da649747ecc0e93e7a06452a3061de17";
const POOL_VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ZERO = "0x0000000000000000000000000000000000000000";
const SLIPPAGE = 0.5;
const MIN_BALANCE_WEI = 5000000000000000n; // 0.005 ETH budget gate
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

const ui = await import("../lib/shielded-swap-ui.ts");
const core = await import("../lib/shielded-swap.ts");
const withdrawLib = await import("../lib/withdraw-args.ts");
const noteLib = await import("../lib/note.ts");
const routerSwap = await import("../lib/router-swap.ts");
const artifact = await import("../lib/veil-artifact.ts");
const ROUTER_ABI = artifact.VEIL_SHIELD_ROUTER_ABI;
const POOL_ABI = artifact.SHIELDED_POOL_ABI;

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

// Source pool = 2 VEIL pool from the Task 4b deploy manifest.
const veil2Manifest = JSON.parse(
  readFileSync("deployments/shieldedpool-veil2-testnet-latest.json", "utf8")
);
const VEIL2_POOL = veil2Manifest.contracts.ShieldedPool_VEIL2.address;
console.log("VEIL2 source pool:", VEIL2_POOL);

const GUARD_ABI = parseAbi([
  "function denomination() view returns (uint256)",
  "function asset() view returns (address)",
  "function depositsPaused() view returns (bool)",
  "function nextIndex() view returns (uint32)",
  "function rootHistory(uint256) view returns (bytes32)",
  "function isKnownRoot(bytes32) view returns (bool)",
  "function isNullifierSpent(bytes32) view returns (bool)",
]);
const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

// R2 live gate: read both pools onchain; need 2 unpaused.
const pools = [VEIL2_POOL, ETH_POOL];
const guards = [];
for (const pool of pools) {
  const [denomination, asset, paused, nextIndex] = await Promise.all([
    publicClient.readContract({ address: pool, abi: GUARD_ABI, functionName: "denomination" }),
    publicClient.readContract({ address: pool, abi: GUARD_ABI, functionName: "asset" }),
    publicClient.readContract({ address: pool, abi: GUARD_ABI, functionName: "depositsPaused" }),
    publicClient.readContract({ address: pool, abi: GUARD_ABI, functionName: "nextIndex" }),
  ]);
  guards.push({ pool, denomination, asset, paused, nextIndex });
  console.log(
    `pool ${pool}: denom=${denomination} asset=${asset} paused=${paused} nextIndex=${nextIndex}`
  );
}
if (guards.some((g) => g.paused)) {
  console.error("BLOCKED: a pool is paused. Stopping.");
  process.exit(2);
}
const src = guards[0];
const dst = guards[1];
if (src.asset.toLowerCase() !== POOL_VEIL.toLowerCase() || dst.asset !== ZERO) {
  console.error("BLOCKED: pool asset mismatch (source must be pool VEIL, dest ETH).");
  process.exit(2);
}

// Direction-viability check through the R2 LIVE gate, reusing the T2 quote
// path (2 VEIL -> ETH must fund the 0.001 ETH destination note).
const rand32 = () =>
  `0x${[...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
const liveGate = await ui.readShieldedSwapRouteStatusLive(publicClient, {
  pools: [VEIL2_POOL, ETH_POOL],
  quoteRouteOutput: () =>
    routerSwap.quoteSwapToShieldOutput(publicClient, {
      account: account.address,
      amountIn: src.denomination,
      commitment: rand32(),
    }),
  destDenomination: dst.denomination,
});
console.log(
  `live gate: executable=${liveGate.executable} v4Liquidity=${liveGate.v4Liquidity} ` +
    `routeQuote=${liveGate.routeQuoteOut} reason=${liveGate.reason ?? "ok"}`
);
if (!liveGate.executable) {
  console.error(`BLOCKED by live gate: ${liveGate.reason} Stopping before deposit.`);
  process.exit(2);
}
const t2quote = liveGate.routeQuoteOut;

// Source note (UI path: createShieldedNote with the LIVE source denomination).
const sourceNote = noteLib.createShieldedNote(src.denomination, src.asset);
console.log(
  `source note: commitment=${sourceNote.commitment} nullifierHash=${sourceNote.nullifierHash}`
);

// Approve + deposit the 2 VEIL source note (ERC20 pull, no value).
const approveHash = await wallet.writeContract({
  address: POOL_VEIL,
  abi: ERC20_ABI,
  functionName: "approve",
  args: [VEIL2_POOL, src.denomination],
});
const approveRc = await publicClient.waitForTransactionReceipt({ hash: approveHash });
console.log(`approve tx: ${approveHash} block ${approveRc.blockNumber}`);
const srcIndexBefore = src.nextIndex;
const depositHash = await wallet.writeContract({
  address: VEIL2_POOL,
  abi: POOL_ABI,
  functionName: "deposit",
  args: [sourceNote.commitment],
});
const depositRc = await publicClient.waitForTransactionReceipt({ hash: depositHash });
if (depositRc.status !== "success") {
  console.error(`Deposit reverted: ${depositHash}. Stopping.`);
  process.exit(1);
}
const srcIndexAfter = await publicClient.readContract({
  address: VEIL2_POOL, abi: GUARD_ABI, functionName: "nextIndex",
});
if (srcIndexAfter !== srcIndexBefore + 1) {
  console.error("Source pool nextIndex did not increment. Stopping.");
  process.exit(1);
}
const root = await publicClient.readContract({
  address: VEIL2_POOL, abi: GUARD_ABI, functionName: "rootHistory",
  args: [BigInt(srcIndexAfter - 1)],
});
const known = await publicClient.readContract({
  address: VEIL2_POOL, abi: GUARD_ABI, functionName: "isKnownRoot",
  args: [root],
});
if (!known) {
  console.error("Deposit root not known. Stopping (funds safe in pool).");
  process.exit(2);
}
console.log(`deposit tx: ${depositHash} block ${depositRc.blockNumber} root=${root}`);

// Legacy withdraw proof bound to the router (self-relay, fee 0).
const withdrawArgs = withdrawLib.buildWithdrawArgs(sourceNote, root, ROUTER);

// Destination secrets from the LIVE destination denomination/asset.
const secrets = core.generateNewShieldedNoteSecrets(dst.denomination, dst.asset);
console.log(`dest note: commitment=${secrets.commitment}`);
// Pre-send snapshot: persist BOTH notes before any swap is sent, so the notes
// stay spendable even if the run aborts after broadcasting.
writeFileSync(
  `deployments/shieldedswap-live-4b-rev-notes-${RUN_STAMP}.json`,
  JSON.stringify(
    {
      network: "Robinhood Testnet",
      chainId: EXPECTED_CHAIN_ID,
      poolSource: VEIL2_POOL,
      poolDestination: ETH_POOL,
      sourceNote,
      destNote: secrets.newNote,
      warning:
        "Testnet-only note secrets (mock verifier). Anyone holding this file can spend these notes.",
    },
    bigToString,
    2
  )
);

// Router balances before (zero-balance invariant baseline).
const routerEthBefore = await publicClient.getBalance({ address: ROUTER });
const routerVeilBefore = await publicClient.readContract({
  address: POOL_VEIL, abi: ERC20_ABI, functionName: "balanceOf", args: [ROUTER],
});
console.log(`router before: eth=${routerEthBefore} veil=${routerVeilBefore}`);

// Zero-floor simulation of the EXACT shieldedSwap calldata (VEIL -> ETH,
// zeroForOne=false): the live §7 #5 quote.
const relay = ui.selectShieldedSwapRelayPath();
const simParams = ui.buildSelfRelayShieldedSwapArgs({
  note: sourceNote,
  proof: withdrawArgs.proof,
  root: withdrawArgs.root,
  quotedAmountOut: 0n,
  slippagePercent: 0,
  newCommitment: secrets.commitment,
  poolDestination: ETH_POOL,
  relayerFee: relay.relayerFee,
  zeroForOne: false,
});
const { result: simResult } = await publicClient.simulateContract({
  address: ROUTER,
  abi: ROUTER_ABI,
  functionName: "shieldedSwap",
  args: [{ ...simParams, key: { ...simParams.key } }],
  account: account.address,
});
const expectedOut = simResult;
console.log(`shieldedSwap live sim output: ${expectedOut} wei ETH`);
if (expectedOut < dst.denomination) {
  console.error(
    "BLOCKED: simulated output below destination denomination " +
      "(InsufficientOutputForDenomination). No swap sent; source note remains safe in the pool."
  );
  process.exit(2);
}

// Slippage-bound params from the live quote (never hardcoded).
const params = ui.buildSelfRelayShieldedSwapArgs({
  note: sourceNote,
  proof: withdrawArgs.proof,
  root: withdrawArgs.root,
  quotedAmountOut: expectedOut,
  slippagePercent: SLIPPAGE,
  newCommitment: secrets.commitment,
  poolDestination: ETH_POOL,
  relayerFee: relay.relayerFee,
  zeroForOne: false,
});
console.log(`minAmountOut: ${params.minAmountOut} (slippage ${SLIPPAGE}%)`);

const swapHash = await wallet.writeContract({
  address: ROUTER,
  abi: ROUTER_ABI,
  functionName: "shieldedSwap",
  args: [params],
});
const swapRc = await publicClient.waitForTransactionReceipt({ hash: swapHash });
if (swapRc.status !== "success") {
  console.error(`shieldedSwap reverted: ${swapHash}.`);
  process.exit(1);
}
console.log(`shieldedSwap tx: ${swapHash} block ${swapRc.blockNumber}`);

// Assertions: event + dest nextIndex + router zero-balance invariant.
const executed = core.findShieldedSwapExecuted(
  swapRc.logs,
  sourceNote.nullifierHash
);
if (!executed) {
  console.error("ShieldedSwapExecuted event not found for our nullifier.");
  process.exit(1);
}
if (executed.poolDestination.toLowerCase() !== ETH_POOL.toLowerCase()) {
  console.error("Swap settled into an unexpected destination pool.");
  process.exit(1);
}
if (executed.newCommitment.toLowerCase() !== secrets.commitment.toLowerCase()) {
  console.error("Event newCommitment does not match our destination note.");
  process.exit(1);
}
console.log(
  `event: relayer=${executed.relayer} amountOut=${executed.amountOut} newCommitment=${executed.newCommitment}`
);
const dstIndexAfter = await publicClient.readContract({
  address: ETH_POOL, abi: GUARD_ABI, functionName: "nextIndex",
});
if (dstIndexAfter !== dst.nextIndex + 1) {
  console.error("Destination pool nextIndex did not increment.");
  process.exit(1);
}
const routerEthAfter = await publicClient.getBalance({ address: ROUTER });
const routerVeilAfter = await publicClient.readContract({
  address: POOL_VEIL, abi: ERC20_ABI, functionName: "balanceOf", args: [ROUTER],
});
if (routerEthAfter !== 0n || routerVeilAfter !== routerVeilBefore) {
  console.error(
    `Router invariant violated: eth ${routerEthBefore}->${routerEthAfter}, ` +
      `veil ${routerVeilBefore}->${routerVeilAfter}.`
  );
  process.exit(1);
}
console.log(
  `invariant ok: router eth=${routerEthAfter} veil unchanged=${routerVeilAfter}`
);

const spent = await publicClient.readContract({
  address: VEIL2_POOL, abi: GUARD_ABI, functionName: "isNullifierSpent",
  args: [sourceNote.nullifierHash],
});
console.log(`source nullifier spent: ${spent}`);

// Gas accounting.
let gasWei = 0n;
for (const rc of [approveRc, depositRc, swapRc]) {
  gasWei += (rc.gasUsed ?? 0n) * (rc.effectiveGasPrice ?? 0n);
}
console.log(`cycle gas total wei: ${gasWei}`);

// Cycle record (includes the new ETH note secrets so the note stays
// spendable/withdrawable; testnet only, mock verifier, 0.001 test ETH).
// Secrets are ALSO snapshotted to disk BEFORE the swap is sent (see below);
// a lost secret locks the note (keccak preimage), so persistence precedes sends.
const stamp = RUN_STAMP;
const record = {
  network: "Robinhood Testnet",
  chainId: EXPECTED_CHAIN_ID,
  ranAt: new Date().toISOString(),
  deployer: account.address,
  router: ROUTER,
  direction: "VEIL -> ETH (zeroForOne=false; ETH-input direction is contract-blocked, see report)",
  poolSource: VEIL2_POOL,
  poolDestination: ETH_POOL,
  t2RouteQuoteWei: String(t2quote),
  liveSimOutputWei: String(expectedOut),
  minAmountOutWei: String(params.minAmountOut),
  slippagePercent: SLIPPAGE,
  txs: {
    approve: { hash: approveHash, blockNumber: Number(approveRc.blockNumber) },
    deposit: { hash: depositHash, blockNumber: Number(depositRc.blockNumber) },
    shieldedSwap: { hash: swapHash, blockNumber: Number(swapRc.blockNumber) },
  },
  assertions: {
    event: {
      relayer: executed.relayer,
      nullifierHash: executed.nullifierHash,
      newCommitment: executed.newCommitment,
      amountOut: String(executed.amountOut),
    },
    destNextIndexBefore: dst.nextIndex,
    destNextIndexAfter: dstIndexAfter,
    routerEthAfter: String(routerEthAfter),
    routerVeilUnchanged: String(routerVeilAfter),
    sourceNullifierSpent: spent,
  },
  sourceNote,
  destNote: secrets.newNote,
  cycleGasWei: String(gasWei),
  explorer: {
    approve: `${EXPLORER_TX}${approveHash}`,
    deposit: `${EXPLORER_TX}${depositHash}`,
    shieldedSwap: `${EXPLORER_TX}${swapHash}`,
  },
  status: "completed",
};
writeFileSync(
  `deployments/shieldedswap-live-4b-rev-${stamp}.json`,
  JSON.stringify(record, bigToString, 2)
);
console.log("record: deployments/shieldedswap-live-4b-rev-" + stamp + ".json");
console.log(`Explorer: ${EXPLORER_TX}${swapHash}`);
console.log("DONE: live shieldedSwap cycle (VEIL -> ETH) completed and asserted.");
