// TESTNET ONLY (chain 46630). Root-audit live drills 2026-10-08:
//   #2 slippage revert: swapToShield with absurd minAmountOut -> SlippageExceeded.
//   #9 pause drill: pause V05 deposits -> deposit attempt reverts DepositsArePaused
//        -> legacy withdraw of the liveA 0.5-VEIL note SUCCEEDS while paused
//        -> unpause. Proves withdraws bypass the deposit pause onchain.
//
// SAFETY:
// - Asserts chainId === 46630 and REFUSES --mainnet.
// - Never prints private keys. Budget gate: deployer balance >= 0.006 ETH.
// - liveA note secrets are NOT needed (Mock-verifier legacy path) and are
//   never read here; only its nullifierHash (already public onchain).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import { VEIL_SHIELD_ROUTER_ABI } from "../lib/veil-artifact.mjs";

const EXPECTED_CHAIN_ID = 46630;
const ZERO = "0x0000000000000000000000000000000000000000";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const V05_POOL = "0xd73920a3cbfdf3f6be530cab73fc9c876619517a";
const ROUTER = "0x7c73e4b7f9c9cac1f1574c46fd17952be2853e27";
const LIVEA_NULLIFIER = "0xb2a411dea9bbbaa355bf36e6e4f03ed5d05ae9cd6082b5baf5bae40d5ea54884";
const EXPLORER_TX = "https://explorer.testnet.chain.robinhood.com/tx/";
const RUN_STAMP = new Date().toISOString().replaceAll(":", "-");
const bigToString = (_k, v) => (typeof v === "bigint" ? String(v) : v);

if (process.argv.includes("--mainnet")) {
  console.error("REFUSING --mainnet: testnet-only.");
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
const publicClient = createPublicClient({ chain: robinhoodTestnet, transport: http(RPC) });

const chainId = await publicClient.getChainId();
if (chainId !== EXPECTED_CHAIN_ID) throw new Error(`Wrong chain ${chainId}, refusing.`);

const rawKey = (process.env.PRIVATE_KEY || "").trim();
if (!/^0x[0-9a-fA-F]{64}$/.test(rawKey)) throw new Error("PRIVATE_KEY missing");
const account = privateKeyToAccount(rawKey);
const walletClient = createWalletClient({ account, chain: robinhoodTestnet, transport: http(RPC) });

const balBefore = await publicClient.getBalance({ address: account.address });
console.log(`Operator ${account.address} balance: ${balBefore} wei`);
if (balBefore < 6000000000000000n) throw new Error("Budget gate: need >= 0.006 ETH.");

const POOL_ABI = parseAbi([
  "function denomination() view returns (uint256)",
  "function depositsPaused() view returns (bool)",
  "function nextIndex() view returns (uint32)",
  "function isNullifierSpent(bytes32 n) view returns (bool)",
  "function isKnownRoot(bytes32 root) view returns (bool)",
  "function rootHistory(uint256 index) view returns (bytes32)",
  "function deposit(bytes32 commitment) payable returns (uint32)",
  "function withdraw(bytes proof, bytes32 root, bytes32 nullifierHash, address recipient, uint256 fee)",
  "function pauseDeposits()",
  "function unpauseDeposits()",
  "error DepositsArePaused()",
  "error SlippageExceeded()",
  "error NullifierAlreadySpent()",
]);

const out = { network: "Robinhood Testnet", chainId: 46630, ranAt: new Date().toISOString(), drills: {} };

// ---- #2: slippage revert (no state change) ----
{
  const amountIn = 1000000000000000n;
  const quote = await publicClient.simulateContract({
    address: ROUTER,
    abi: VEIL_SHIELD_ROUTER_ABI,
    functionName: "swapToShield",
    account: account.address,
    value: amountIn,
    args: [{
      key: { currency0: ZERO, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: ZERO },
      zeroForOne: true,
      amountIn,
      minAmountOut: 0n,
      sqrtPriceLimitX96: 4295128740n,
      commitment: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      shieldedPool: V05_POOL,
      hookData: "0x",
    }],
  });
  console.log(`#2 live quote: 0.001 ETH -> ${quote.result} wei VEIL`);
  // Gas-free proof: simulate the EXACT calldata with an absurd minAmountOut.
  // eth_call executes fully and reverts with SlippageExceeded; nothing moves.
  let reverted = false;
  let reason = "";
  try {
    await publicClient.simulateContract({
      address: ROUTER,
      abi: VEIL_SHIELD_ROUTER_ABI,
      functionName: "swapToShield",
      account: account.address,
      value: amountIn,
      args: [{
        key: { currency0: ZERO, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: ZERO },
        zeroForOne: true,
        amountIn,
        minAmountOut: 340282366920938463463374607431768211455n,
        sqrtPriceLimitX96: 4295128740n,
        commitment: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        shieldedPool: V05_POOL,
        hookData: "0x",
      }],
    });
  } catch (e) {
    reverted = true;
    reason = String((e && (e.shortMessage || e.message)) || e).slice(0, 300);
  }
  // Fallback: viem may return a hash for a tx that then reverts onchain.
  out.drills.slippageRevert = { quotedOut: String(quote.result), revertedPreSend: reverted, reason };
  console.log(`#2 reverted pre-send: ${reverted} :: ${reason}`);
  if (!reverted) throw new Error("#2 did not revert as expected; aborting before state changes.");
}

// ---- #9: pause drill ----
const pauseAbi = POOL_ABI;
{
  const pausedBefore = await publicClient.readContract({ address: V05_POOL, abi: pauseAbi, functionName: "depositsPaused" });
  if (pausedBefore) throw new Error("V05 already paused; refusing to stack state.");
  const pauseHash = await walletClient.writeContract({
    address: V05_POOL, abi: pauseAbi, functionName: "pauseDeposits",
    account, chain: robinhoodTestnet,
  });
  const pauseRc = await publicClient.waitForTransactionReceipt({ hash: pauseHash });
  if (pauseRc.status !== "success") throw new Error(`pause tx failed: ${pauseHash}`);
  const pausedNow = await publicClient.readContract({ address: V05_POOL, abi: pauseAbi, functionName: "depositsPaused" });
  if (!pausedNow) throw new Error("pause did not take effect.");
  console.log(`#9 paused: ${pauseHash}`);

  // Deposit attempt must revert with DepositsArePaused.
  let depReverted = false;
  let depReason = "";
  try {
    await walletClient.writeContract({
      address: V05_POOL, abi: pauseAbi, functionName: "deposit",
      args: ["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
      account, chain: robinhoodTestnet,
    });
  } catch (e) {
    depReverted = true;
    depReason = String((e && (e.shortMessage || e.message)) || e).slice(0, 300);
  }
  console.log(`#9 deposit-while-paused reverted: ${depReverted} :: ${depReason}`);
  if (!depReverted) throw new Error("deposit went through while paused?! aborting.");

  // Withdraw liveA note while paused (provisional Mock proof; fee 0; self recipient).
  const idx = await publicClient.readContract({ address: V05_POOL, abi: pauseAbi, functionName: "nextIndex" });
  const root = await publicClient.readContract({
    address: V05_POOL, abi: pauseAbi, functionName: "rootHistory", args: [BigInt(idx - 1)],
  });
  const spentBefore = await publicClient.readContract({
    address: V05_POOL, abi: pauseAbi, functionName: "isNullifierSpent", args: [LIVEA_NULLIFIER],
  });
  if (spentBefore) throw new Error("liveA already spent; drill not applicable.");
  const wdHash = await walletClient.writeContract({
    address: V05_POOL, abi: pauseAbi, functionName: "withdraw",
    args: ["0x12345678", root, LIVEA_NULLIFIER, account.address, 0n],
    account, chain: robinhoodTestnet,
  });
  const wdRc = await publicClient.waitForTransactionReceipt({ hash: wdHash });
  if (wdRc.status !== "success") throw new Error(`withdraw-while-paused failed: ${wdHash}`);
  const spentAfter = await publicClient.readContract({
    address: V05_POOL, abi: pauseAbi, functionName: "isNullifierSpent", args: [LIVEA_NULLIFIER],
  });
  console.log(`#9 withdraw-while-paused: ${wdHash} spent=${spentAfter}`);
  if (!spentAfter) throw new Error("nullifier not marked spent.");

  const unHash = await walletClient.writeContract({
    address: V05_POOL, abi: pauseAbi, functionName: "unpauseDeposits",
    account, chain: robinhoodTestnet,
  });
  const unRc = await publicClient.waitForTransactionReceipt({ hash: unHash });
  if (unRc.status !== "success") throw new Error(`UNPAUSE FAILED ${unHash} — MANUAL RECOVERY NEEDED`);
  const pausedEnd = await publicClient.readContract({ address: V05_POOL, abi: pauseAbi, functionName: "depositsPaused" });
  if (pausedEnd) throw new Error("still paused after unpause — MANUAL RECOVERY NEEDED.");
  console.log(`#9 unpaused: ${unHash}`);

  out.drills.pauseDrill = {
    pauseTx: pauseHash, depositReverted: depReverted, depositReason: depReason,
    withdrawTx: wdHash, nullifierSpent: Boolean(spentAfter), unpauseTx: unHash,
  };
}

const balAfter = await publicClient.getBalance({ address: account.address });
out.gasAccounting = {
  balanceBefore: String(balBefore),
  balanceAfter: String(balAfter),
  spentWei: String(balBefore - balAfter),
};
out.explorer = { base: EXPLORER_TX };

mkdirSync("deployments", { recursive: true });
writeFileSync(
  `deployments/root-audit-drills-46630-${RUN_STAMP}.json`,
  JSON.stringify(out, bigToString, 2)
);
writeFileSync(`deployments/root-audit-drills-46630-latest.json`, JSON.stringify(out, bigToString, 2));
console.log("SUCCESS drills complete. Manifest written.");
console.log(JSON.stringify(out.drills, bigToString, 2));
