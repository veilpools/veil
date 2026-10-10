import { decodeEventLog, type Address, type Hash, type Hex, type PublicClient } from "viem";
import { VEIL_ZK_ROUTER_ABI } from "./veil-artifact";
import { calculateSlippageBound } from "./router-client";
import {
  ETH_ZERO_ADDRESS,
  TESTNET_ROUTER_HOOK_DATA,
  TESTNET_ROUTER_POOL_KEY,
  TESTNET_ROUTER_SQRT_PRICE_LIMIT,
  TESTNET_ROUTER_SQRT_PRICE_LIMIT_ETH_IN,
  parseSlippagePercent,
} from "./router-swap";
import {
  TESTNET_BOW_V3_ENTRYPOINT,
  TESTNET_BOW_V3_ETH_DENOMINATION,
  TESTNET_BOW_V3_VEIL_DENOMINATION,
  TESTNET_BOW_V3_VEIL_TOKEN,
} from "./privacy-pools";

// ---------------------------------------------------------------------------
// VeilZkRouter full-flow wiring (Robinhood Testnet 46630).
//
// Atomic relay -> swap -> deposit in ONE transaction via executeFullZkFlow.
// QUOTE-SOURCE DECISION: executeFullZkFlow returns only the deposit
// commitment, never the swap output, so the swap output cannot be read from
// a simulation result. The live quote is instead bracketed with free
// eth_call simulations of the EXACT calldata (no tx): minSwapOut = 0 proves
// viability, then rising minSwapOut probes find the greatest proven lower
// bound of amountOut (a probe succeeds iff amountOut >= minSwapOut). The
// bound is multiplied by the user's slippage setting, exactly like the
// router-swap quote-via-simulation pattern (simulate exact calldata with
// minOut 0, derive minOut from live quote x slippage). Every revert fails
// closed with a short human message via mapZkRouterError; this module never
// sends transactions (simulation only, the UI sends after revalidateWallet).
// ---------------------------------------------------------------------------

export const TESTNET_ZK_ROUTER_CHAIN_ID = 46630;

// Live router from deployments/zkrouter-46630.json (deployed, unwired until
// this task). Same env-override pattern as lib/router-swap.ts.
export const TESTNET_ZK_ROUTER_ADDRESS =
  (process.env.NEXT_PUBLIC_TESTNET_VEIL_ZK_ROUTER as Address | undefined) ||
  ("0x80b18d51fb6087b65cf8511b78b264d90fee585c" as Address);

// Fresh suite entrypoint (deployments/suite-v3-testnet-latest.json).
export const TESTNET_ZK_ROUTER_ENTRYPOINT = TESTNET_BOW_V3_ENTRYPOINT;

// Live multi-note router from deployments/zkrouter-multi-46630.json.
// Same env-override pattern as the single-flow router above.
export const TESTNET_ZK_ROUTER_MULTI_ADDRESS =
  (process.env.NEXT_PUBLIC_TESTNET_VEIL_ZK_ROUTER_MULTI as Address | undefined) ||
  ("0xc009197da4c4e7134ab8d8969d9442a5c8afb220" as Address);

// Zero address shared by the shielded-swap resolvers below. Declared
// before use so a future edit cannot introduce a TDZ slip (audit F-07).
export const ZK_ETH_ZERO_ADDRESS = ETH_ZERO_ADDRESS;

/** Shielded-swap direction: source asset determines the swap leg. */
export type ZkShieldedSwapDirection = "ETH_TO_VEIL" | "VEIL_TO_ETH";

/**
 * Bind the shielded-swap direction from the source note asset.
 * ETH notes swap ETH -> VEIL (zeroForOne true); VEIL notes swap
 * VEIL -> ETH (zeroForOne false). Anything else fails closed.
 */
export function resolveZkShieldedSwapAssets(args: {
  sourceAsset: string;
  veilToken?: Address;
}): {
  withdrawAsset: Address;
  depositAsset: Address;
  zeroForOne: boolean;
  direction: ZkShieldedSwapDirection;
} {
  const source = args.sourceAsset.toLowerCase();
  const veil = (args.veilToken ?? TESTNET_BOW_V3_VEIL_TOKEN).toLowerCase();
  const ethZero = (ZK_ETH_ZERO_ADDRESS as string).toLowerCase();
  if (source === ethZero) {
    return {
      withdrawAsset: ZK_ETH_ZERO_ADDRESS as Address,
      depositAsset: (args.veilToken ?? TESTNET_BOW_V3_VEIL_TOKEN) as Address,
      zeroForOne: true,
      direction: "ETH_TO_VEIL",
    };
  }
  if (source === veil) {
    return {
      withdrawAsset: (args.veilToken ?? TESTNET_BOW_V3_VEIL_TOKEN) as Address,
      depositAsset: ZK_ETH_ZERO_ADDRESS as Address,
      zeroForOne: false,
      direction: "VEIL_TO_ETH",
    };
  }
  throw new Error(
    "Unsupported shielded-swap source asset: only 0xbow ETH notes and VEIL notes can be swapped. No transaction was sent."
  );
}

/**
 * Fixed destination for the shielded-swap tab.
 * VEIL -> 0.001 ETH note (fixed denomination); ETH -> 0.001 VEIL note
 * (fixed denomination). These are the 0xbow pools' immutable
 * DEPOSIT_DENOMINATION — NOT the entrypoint minimumDeposit anti-dust floor
 * (currently 0.0001). Confusing the two bricks every flow with
 * InvalidDenomination. Fails closed when called with an unknown asset.
 */
export function resolveZkShieldedSwapDeposit(args: {
  withdrawAsset: string;
  ethDenomination?: bigint;
  veilMinimum?: bigint | null;
}): bigint {
  const withdraw = args.withdrawAsset.toLowerCase();
  const ethZero = (ZK_ETH_ZERO_ADDRESS as string).toLowerCase();
  const veil = TESTNET_BOW_V3_VEIL_TOKEN.toLowerCase();
  if (withdraw === veil) {
    return args.ethDenomination ?? TESTNET_BOW_V3_ETH_DENOMINATION;
  }
  if (withdraw === ethZero) {
    // Fixed 0.001 — the veilMinimum arg is intentionally ignored for the
    // deposit value (it is only the entrypoint anti-dust floor).
    return TESTNET_BOW_V3_VEIL_DENOMINATION;
  }
  throw new Error(
    "Unsupported shielded-swap source asset: only 0xbow ETH notes and VEIL notes can be swapped. No transaction was sent."
  );
}

/** Minimal StateView ABI for the pre-prove viability read (slot0 only). */
export const ZK_V4_STATE_VIEW_ABI = [
  {
    type: "function",
    name: "getSlot0",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
  },
] as const;

/** Default 5% safety haircut: estimates must clear the note after fees + impact. */
export const ZK_VIABILITY_HAIRCUT_BPS = 500;

/**
 * Optimistic v4 exact-input estimate from slot0 only (ignores concentrated
 * impact, then applies a haircut). Used ONLY to fail fast before minutes of
 * proving: when even this optimistic number cannot fund the fixed note, the
 * real swap cannot either. Never used to approve a flow (bracketing does).
 */
export function estimateV4SwapOut(args: {
  sqrtPriceX96: bigint;
  amountIn: bigint;
  zeroForOne: boolean;
  haircutBps?: number;
}): bigint {
  if (args.amountIn <= 0n || args.sqrtPriceX96 <= 0n) return 0n;
  const Q192 = 2n ** 192n;
  const priceX192 = args.sqrtPriceX96 * args.sqrtPriceX96;
  const gross = args.zeroForOne
    ? (args.amountIn * priceX192) / Q192
    : (args.amountIn * Q192) / priceX192;
  const haircut = BigInt(args.haircutBps ?? ZK_VIABILITY_HAIRCUT_BPS);
  if (haircut < 0n || haircut > 10000n) throw new Error("Haircut must be 0-10000 bps.");
  return (gross * (10000n - haircut)) / 10000n;
}


export const TESTNET_ZK_EXPLORER_TX_BASE =
  "https://explorer.testnet.chain.robinhood.com/tx/";

// Shared v4 ETH/VEIL pool key (verbatim from lib/router-swap.ts, the only
// pool the ZK swap leg runs against). Re-exported under a ZK name so call
// sites never import the paused-route router module for pool truth.
export const ZK_POOL_KEY = {
  currency0: TESTNET_ROUTER_POOL_KEY.currency0,
  currency1: TESTNET_ROUTER_POOL_KEY.currency1,
  fee: TESTNET_ROUTER_POOL_KEY.fee,
  tickSpacing: TESTNET_ROUTER_POOL_KEY.tickSpacing,
  hooks: TESTNET_ROUTER_POOL_KEY.hooks,
} as const;

export const ZK_SQRT_PRICE_LIMIT = TESTNET_ROUTER_SQRT_PRICE_LIMIT;
export const ZK_SQRT_PRICE_LIMIT_ETH_IN = TESTNET_ROUTER_SQRT_PRICE_LIMIT_ETH_IN;
export const ZK_HOOK_DATA = TESTNET_ROUTER_HOOK_DATA;

/** Upper bound on free quote simulations per flow (fail closed past it). */
export const ZK_FLOW_MAX_PROBES = 24;

export interface ZkWithdrawalStruct {
  processooor: Address;
  data: Hex;
}

export interface ZkWithdrawProofStruct {
  pA: [bigint, bigint];
  pB: [[bigint, bigint], [bigint, bigint]];
  pC: [bigint, bigint];
  pubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
}

export interface ZkSwapLegStruct {
  key: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
  zeroForOne: boolean;
  sqrtPriceLimitX96: bigint;
  hookData: Hex;
}

export interface ZkFlowBase {
  withdrawal: ZkWithdrawalStruct;
  proof: ZkWithdrawProofStruct;
  scope: bigint;
  withdrawAsset: Address;
  depositAsset: Address;
  depositValue: bigint;
  precommitment: bigint;
  zeroForOne?: boolean;
}

export interface FullZkFlowArgs extends ZkFlowBase {
  recipient: Address;
  swapLeg: ZkSwapLegStruct;
  minSwapOut: bigint;
}

export interface BuildFullZkFlowInput extends ZkFlowBase {
  quotedSwapOut: bigint;
  slippagePercent: number;
  recipient?: Address;
}

/** Pure builder for the exact-input v4 swap leg on the shared pool. */
export function buildZkSwapLeg(args: { zeroForOne: boolean }): ZkSwapLegStruct {
  return {
    key: {
      currency0: ZK_POOL_KEY.currency0 as Address,
      currency1: ZK_POOL_KEY.currency1 as Address,
      fee: ZK_POOL_KEY.fee,
      tickSpacing: ZK_POOL_KEY.tickSpacing,
      hooks: ZK_POOL_KEY.hooks as Address,
    },
    zeroForOne: args.zeroForOne,
    sqrtPriceLimitX96: args.zeroForOne ? ZK_SQRT_PRICE_LIMIT_ETH_IN : ZK_SQRT_PRICE_LIMIT,
    hookData: ZK_HOOK_DATA as Hex,
  };
}

/**
 * Derive minSwapOut from the live quoted swap output and the user's slippage
 * percent. minSwapOut guards ONLY the post-swap amountOut (never the relay
 * leg, which always yields the fixed 0xbow denomination).
 */
export function deriveZkMinSwapOut(quotedSwapOut: bigint, slippagePercent: number): bigint {
  if (quotedSwapOut <= 0n) {
    throw new Error("Live swap quote must be greater than zero before deriving minSwapOut.");
  }
  const parsed = parseSlippagePercent(String(slippagePercent));
  return calculateSlippageBound(quotedSwapOut, parsed);
}

function checkSwapLegBinding(
  swapLeg: ZkSwapLegStruct,
  withdrawAsset: Address,
  depositAsset: Address
): void {
  const input = swapLeg.zeroForOne ? swapLeg.key.currency0 : swapLeg.key.currency1;
  const output = swapLeg.zeroForOne ? swapLeg.key.currency1 : swapLeg.key.currency0;
  if (
    input.toLowerCase() !== withdrawAsset.toLowerCase() ||
    output.toLowerCase() !== depositAsset.toLowerCase()
  ) {
    throw new Error(
      "InvalidSwapLeg: the swap leg direction does not match the withdraw and deposit assets."
    );
  }
}

/**
 * Pure builder for executeFullZkFlow params. minSwapOut is ALWAYS derived
 * from the live quote and slippage, never hardcoded. Fails closed on any
 * mismatch (recipient, assets, zero values).
 */
export function buildFullZkFlowArgs(input: BuildFullZkFlowInput): FullZkFlowArgs {
  const zeroForOne = input.zeroForOne ?? false;
  const recipient = input.recipient ?? TESTNET_ZK_ROUTER_ADDRESS;
  if (recipient.toLowerCase() !== TESTNET_ZK_ROUTER_ADDRESS.toLowerCase()) {
    throw new Error(
      `RecipientMismatch: the relay recipient must equal the ZK router (${TESTNET_ZK_ROUTER_ADDRESS}) so the relay exit chains into the swap input.`
    );
  }
  if (input.withdrawal.processooor.toLowerCase() !== TESTNET_ZK_ROUTER_ENTRYPOINT.toLowerCase()) {
    throw new Error(
      `Invalid withdrawal: processooor must be the fresh suite entrypoint (${TESTNET_ZK_ROUTER_ENTRYPOINT}).`
    );
  }
  if (input.depositValue <= 0n) throw new Error("Deposit value must be greater than zero.");
  if (input.precommitment === 0n) throw new Error("InvalidPrecommitment: precommitment must be non-zero.");
  const swapLeg = buildZkSwapLeg({ zeroForOne });
  checkSwapLegBinding(swapLeg, input.withdrawAsset, input.depositAsset);
  const minSwapOut = deriveZkMinSwapOut(input.quotedSwapOut, input.slippagePercent);
  return {
    withdrawal: input.withdrawal,
    proof: input.proof,
    scope: input.scope,
    withdrawAsset: input.withdrawAsset,
    depositAsset: input.depositAsset,
    depositValue: input.depositValue,
    precommitment: input.precommitment,
    zeroForOne,
    recipient,
    swapLeg,
    minSwapOut,
  };
}

type FullZkFlowCallArgs = readonly [
  ZkWithdrawalStruct,
  ZkWithdrawProofStruct,
  bigint,
  Address,
  Address,
  Address,
  bigint,
  bigint,
  ZkSwapLegStruct,
  bigint
];

function toCallArgs(args: FullZkFlowArgs): FullZkFlowCallArgs {
  return [
    args.withdrawal,
    args.proof,
    args.scope,
    args.recipient,
    args.withdrawAsset,
    args.depositAsset,
    args.depositValue,
    args.precommitment,
    args.swapLeg,
    args.minSwapOut,
  ];
}

/** Read-only eth_call of the exact calldata (no tx). Returns simulated commitment. */
export async function simulateFullZkFlow(
  client: PublicClient,
  params: { account: Address; args: FullZkFlowArgs }
): Promise<bigint> {
  const { result } = (await client.simulateContract({
    address: TESTNET_ZK_ROUTER_ADDRESS,
    abi: VEIL_ZK_ROUTER_ABI,
    functionName: "executeFullZkFlow",
    args: toCallArgs(params.args) as never,
    account: params.account,
  })) as unknown as { result: bigint };
  return result as bigint;
}

function findErrorName(error: unknown, depth = 0): string | null {
  if (!error || typeof error !== "object" || depth > 4) return null;
  const record = error as Record<string, unknown>;
  if (typeof record.errorName === "string") return record.errorName;
  const nested = record.cause ?? record.error;
  if (nested && typeof nested === "object") return findErrorName(nested, depth + 1);
  return null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    const nested = error.cause instanceof Error ? ` ${error.cause.message}` : "";
    return `${error.message}${nested}`;
  }
  return String(error);
}

export function isZkUserRejection(error: unknown): boolean {
  return /user rejected|user denied|rejected the request|action_rejected/i.test(messageOf(error));
}

/**
 * Map any ZK quote/execution failure to an honest English message.
 * Short human sentences, never raw dumps (mirrors mapRouterSwapError).
 */
export function mapZkRouterError(error: unknown, slippagePercent?: number): string {
  if (isZkUserRejection(error))
    return "Transaction cancelled in your wallet. No transaction was sent.";
  const msg = messageOf(error);
  if (/Status:\s*429|rate limited/i.test(msg))
    return "Too many read requests at once — wait a few seconds and try again. Rate guard only, no funds moved.";
  const name = findErrorName(error);
  const slip =
    slippagePercent !== undefined && Number.isFinite(slippagePercent)
      ? ` Your slippage setting is ${slippagePercent}%.`
      : "";
  if (name === "SlippageExceeded" || /SlippageExceeded/i.test(msg))
    return (
      "Full-ZK flow reverted: the live swap output moved below your slippage bound (SlippageExceeded)." +
      slip +
      " Try again or raise slippage in Execution Settings."
    );
  if (name === "AtomicityViolation" || /AtomicityViolation/i.test(msg))
    return "Full-ZK flow reverted: the atomic relay-swap-deposit sequence was interrupted (AtomicityViolation). The whole transaction reverts, no funds moved.";
  if (name === "RecipientMismatch" || /RecipientMismatch/i.test(msg))
    return `Full-ZK flow reverted: the relay recipient must equal the ZK router (${TESTNET_ZK_ROUTER_ADDRESS}) so the relay exit chains into the swap. Rebuild the flow and try again.`;
  if (name === "InvalidSwapLeg" || /InvalidSwapLeg/i.test(msg))
    return "Full-ZK flow reverted: the swap leg direction does not match the withdraw and deposit assets (InvalidSwapLeg). No transaction was sent.";
  if (name === "InvalidDenomination" || /InvalidDenomination/i.test(msg))
    return "Full-ZK flow reverted: a deposit amount does not equal the pool fixed 0.001 denomination (InvalidDenomination). 0xbow pools accept exactly 0.001 per note — refresh the quote so amounts re-derive live. No transaction was sent.";
  if (name === "InsufficientOutputForDenomination" || /InsufficientOutputForDenomination/i.test(msg))
    return "Full-ZK flow reverted: the live swap output is below the deposit amount (InsufficientOutputForDenomination). Pick a smaller deposit or try again later. No transaction was sent.";
  if (name === "InvalidPrecommitment" || /InvalidPrecommitment/i.test(msg))
    return "Full-ZK flow reverted: the deposit precommitment must be non-zero (InvalidPrecommitment). Regenerate the note and try again.";
  if (name === "NonZeroBalanceInvariantFailed" || /NonZeroBalanceInvariantFailed/i.test(msg))
    return "Router safety invariant failed: the router would retain dust after settlement (NonZeroBalanceInvariantFailed). Aborted with no funds moved. Try again later.";
  if (name === "IncorrectASPRoot" || /IncorrectASPRoot/i.test(msg))
    return (
      "Full-ZK flow reverted: the Association root moved onchain while proving (a new deposit was published). " +
      "This proof can no longer be relayed — refresh the quote to re-prove against the fresh root." +
      slip
    );
  if (name === "OnlyPoolManager" || /OnlyPoolManager/i.test(msg))
    return "Full-ZK flow hit an unexpected swap-callback state (OnlyPoolManager). Aborted with no funds moved. Try again later.";
  if (name === "EthReceiveNotInFlow" || /EthReceiveNotInFlow/i.test(msg))
    return "Full-ZK flow hit an unexpected native-asset state (EthReceiveNotInFlow). Aborted with no funds moved.";
  if (name === "EmptyWithdrawals" || /EmptyWithdrawals/i.test(msg))
    return "Full-ZK flow reverted: no source notes were provided (EmptyWithdrawals). Select at least one 0xbow note. No transaction was sent.";
  if (name === "TooManyWithdrawals" || /TooManyWithdrawals/i.test(msg))
    return "Full-ZK flow reverted: too many source notes in one batch (TooManyWithdrawals, max 8). Split into smaller batches. No transaction was sent.";
  if (name === "ArrayLengthMismatch" || /ArrayLengthMismatch/i.test(msg))
    return "Full-ZK flow reverted: withdrawal, proof and scope counts must match (ArrayLengthMismatch). Rebuild the flow and try again.";
  if (/insufficient funds for gas/i.test(msg)) {
    const funds = /have (\d+) want (\d+)/i.exec(msg);
    const toEth = (w: string): string => {
      try {
        const v = BigInt(w);
        const whole = v / 1000000000000000000n;
        const frac = (v % 1000000000000000000n)
          .toString()
          .padStart(18, "0")
          .slice(0, 6)
          .replace(/0+$/, "");
        return frac ? `${whole}.${frac}` : `${whole}`;
      } catch {
        return w;
      }
    };
    const amounts =
      funds && funds.length === 3
        ? ` Wallet has ${toEth(funds[1])} ETH but ${toEth(funds[2])} ETH + gas is needed.`
        : "";
    return `Not enough testnet ETH.${amounts} Fund at the faucet — no transaction was sent.`;
  }
  if (error instanceof Error && error.message) {
    const m = error.message;
    return m.length > 320 ? `${m.slice(0, 320).trimEnd()}…` : m;
  }
  return "Full-ZK flow failed before execution. Check your wallet, testnet connection, and note, then try again.";
}

function resolveBase(
  base: ZkFlowBase,
  minSwapOut: bigint
): FullZkFlowArgs {
  const zeroForOne = base.zeroForOne ?? false;
  if (base.withdrawal.processooor.toLowerCase() !== TESTNET_ZK_ROUTER_ENTRYPOINT.toLowerCase()) {
    throw new Error(
      `Invalid withdrawal: processooor must be the fresh suite entrypoint (${TESTNET_ZK_ROUTER_ENTRYPOINT}).`
    );
  }
  if (base.depositValue <= 0n) throw new Error("Deposit value must be greater than zero.");
  if (base.precommitment === 0n) throw new Error("InvalidPrecommitment: precommitment must be non-zero.");
  const swapLeg = buildZkSwapLeg({ zeroForOne });
  checkSwapLegBinding(swapLeg, base.withdrawAsset, base.depositAsset);
  return {
    ...base,
    zeroForOne,
    recipient: TESTNET_ZK_ROUTER_ADDRESS,
    swapLeg,
    minSwapOut,
  };
}

async function probeSucceeds(
  client: PublicClient,
  account: Address,
  args: FullZkFlowArgs
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    await simulateFullZkFlow(client, { account, args });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Bracket the live swap output with free exact-calldata simulations (no tx).
 * Returns the greatest proven lower bound of amountOut plus the probe count.
 * Fails closed on any unexpected revert or when the probe budget is spent.
 */
export async function discoverZkSwapOut(
  client: PublicClient,
  params: { account: Address; base: ZkFlowBase; maxProbes?: number }
): Promise<{ floor: bigint; probes: number }> {
  const maxProbes = params.maxProbes ?? ZK_FLOW_MAX_PROBES;
  let probes = 0;
  const runProbe = async (minSwapOut: bigint) => {
    if (probes >= maxProbes) {
      throw new Error(
        `Could not bracket the live swap output within ${maxProbes} free simulations. No transaction was sent.`
      );
    }
    probes += 1;
    return probeSucceeds(client, params.account, resolveBase(params.base, minSwapOut));
  };

  // 1. Zero-floor preflight: the exact calldata must succeed with no guard.
  const preflight = await runProbe(0n);
  if (!preflight.ok) throw new Error(mapZkRouterError(preflight.error));

  // 2. Deposit-cover probe: the flow must at least cover the deposit.
  const cover = await runProbe(params.base.depositValue);
  if (!cover.ok) {
    const name = findErrorName(cover.error);
    if (
      name === "SlippageExceeded" ||
      name === "InsufficientOutputForDenomination" ||
      /SlippageExceeded|InsufficientOutputForDenomination/i.test(messageOf(cover.error))
    ) {
      throw new Error(
        "Full-ZK flow reverted: the live swap output is below the deposit amount (InsufficientOutputForDenomination). Pick a smaller deposit or try again later. No transaction was sent."
      );
    }
    throw new Error(mapZkRouterError(cover.error));
  }
  let floor = params.base.depositValue;

  // 3. Exponential ceiling: double until a probe fails with SlippageExceeded.
  let ceiling = params.base.depositValue * 2n;
  const UINT256_CAP = (1n << 200n);
  for (;;) {
    if (ceiling > UINT256_CAP) {
      throw new Error(
        "Could not bracket the live swap output: it exceeds the probe range. No transaction was sent."
      );
    }
    const probe = await runProbe(ceiling);
    if (!probe.ok) {
      const name = findErrorName(probe.error);
      if (name === "SlippageExceeded" || /SlippageExceeded/i.test(messageOf(probe.error))) break;
      throw new Error(mapZkRouterError(probe.error));
    }
    floor = ceiling;
    ceiling *= 2n;
  }

  // 4. Bisect the bracket with the remaining budget; the residual is
  // absorbed by the user's slippage bound (floor stays a proven lower bound).
  while (probes < maxProbes && ceiling - floor > 1n) {
    const mid = (floor + ceiling) / 2n;
    if (mid === floor || mid === ceiling) break;
    const probe = await runProbe(mid);
    if (probe.ok) {
      floor = mid;
    } else {
      const name = findErrorName(probe.error);
      if (name === "SlippageExceeded" || /SlippageExceeded/i.test(messageOf(probe.error))) {
        ceiling = mid;
      } else {
        throw new Error(mapZkRouterError(probe.error));
      }
    }
  }
  return { floor, probes };
}

export interface ZkQuoteResult {
  args: FullZkFlowArgs;
  quotedSwapOut: bigint;
  minSwapOut: bigint;
  probes: number;
}

/**
 * Quote-then-execute builder: zero-min preflight, live bracket, slippage
 * derivation, then a final exact-calldata simulation with the derived min
 * (pre-send check). Simulation only — the caller sends after revalidateWallet.
 */
export async function quoteAndBuildFullZkFlow(
  client: PublicClient,
  params: { account: Address; base: ZkFlowBase; slippagePercent: number; maxProbes?: number }
): Promise<ZkQuoteResult> {
  const { floor, probes } = await discoverZkSwapOut(client, {
    account: params.account,
    base: params.base,
    maxProbes: params.maxProbes,
  });
  const minSwapOut = deriveZkMinSwapOut(floor, params.slippagePercent);
  const args = resolveBase(params.base, minSwapOut);
  try {
    await simulateFullZkFlow(client, { account: params.account, args });
  } catch (error) {
    throw new Error(mapZkRouterError(error, params.slippagePercent));
  }
  return { args, quotedSwapOut: floor, minSwapOut, probes: probes + 1 };
}

export interface FullZkFlowExecuted {
  relayer: Address;
  recipient: Address;
  scope: bigint;
  amountIn: bigint;
  amountOut: bigint;
  commitment: bigint;
  txHash: Hash;
}

/**
 * Assert the FullZkFlowExecuted event for our commitment exists in the mined
 * receipt logs. Returns null when absent (caller fails closed).
 */
export function findFullZkFlowExecuted(
  logs: readonly {
    data: `0x${string}`;
    topics: readonly `0x${string}`[];
  }[],
  commitment: bigint,
  relayer?: Address
): Omit<FullZkFlowExecuted, "txHash"> | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: VEIL_ZK_ROUTER_ABI,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName !== "FullZkFlowExecuted") continue;
      const evt = decoded.args as unknown as FullZkFlowExecuted;
      if (BigInt(evt.commitment) === commitment) {
        if (relayer && evt.relayer.toLowerCase() !== relayer.toLowerCase()) continue;
        return {
          relayer: evt.relayer,
          recipient: evt.recipient,
          scope: evt.scope,
          amountIn: evt.amountIn,
          amountOut: evt.amountOut,
          commitment: evt.commitment,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export interface ZkMultiFlowBase {
  withdrawals: ZkWithdrawalStruct[];
  proofs: ZkWithdrawProofStruct[];
  scopes: bigint[];
  withdrawAsset: Address;
  depositAsset: Address;
  depositValue: bigint;
  precommitment: bigint;
  zeroForOne?: boolean;
}

export interface MultiFullZkFlowArgs extends ZkMultiFlowBase {
  recipient: Address;
  swapLeg: ZkSwapLegStruct;
  minSwapOut: bigint;
}

export interface BuildMultiFullZkFlowInput extends ZkMultiFlowBase {
  quotedSwapOut: bigint;
  slippagePercent: number;
  recipient?: Address;
}

function checkMultiBatchLengths(
  withdrawals: unknown[],
  proofs: unknown[],
  scopes: unknown[]
): void {
  const count = withdrawals.length;
  if (count === 0) {
    const err = new Error("Full-ZK flow reverted: empty batch (EmptyWithdrawals).") as Error & {
      errorName: string;
    };
    err.errorName = "EmptyWithdrawals";
    throw err;
  }
  if (proofs.length !== count || scopes.length !== count) {
    const err = new Error("Full-ZK flow reverted: length mismatch (ArrayLengthMismatch).") as Error & {
      errorName: string;
    };
    err.errorName = "ArrayLengthMismatch";
    throw err;
  }
  if (count > 8) {
    const err = new Error("Full-ZK flow reverted: too many withdrawals (TooManyWithdrawals).") as Error & {
      errorName: string;
    };
    err.errorName = "TooManyWithdrawals";
    throw err;
  }
}

function checkMultiEntrypoint(withdrawals: ZkWithdrawalStruct[]): void {
  for (const w of withdrawals) {
    if (w.processooor.toLowerCase() !== TESTNET_ZK_ROUTER_ENTRYPOINT.toLowerCase()) {
      throw new Error(
        `Invalid withdrawal: processooor must be the fresh suite entrypoint (${TESTNET_ZK_ROUTER_ENTRYPOINT}).`
      );
    }
  }
}

/**
 * Pure builder for executeMultiFullZkFlow params. minSwapOut is ALWAYS derived
 * from the live quote and slippage, never hardcoded. Fails closed on any
 * mismatch (recipient, assets, zero values, batch shape).
 */
export function buildMultiFullZkFlowArgs(input: BuildMultiFullZkFlowInput): MultiFullZkFlowArgs {
  const zeroForOne = input.zeroForOne ?? false;
  const recipient = input.recipient ?? TESTNET_ZK_ROUTER_MULTI_ADDRESS;
  if (recipient.toLowerCase() !== TESTNET_ZK_ROUTER_MULTI_ADDRESS.toLowerCase()) {
    throw new Error(
      `RecipientMismatch: the relay recipient must equal the multi-note ZK router (${TESTNET_ZK_ROUTER_MULTI_ADDRESS}) so the relay exits chain into the swap input.`
    );
  }
  checkMultiBatchLengths(input.withdrawals, input.proofs, input.scopes);
  checkMultiEntrypoint(input.withdrawals);
  if (input.depositValue <= 0n) throw new Error("Deposit value must be greater than zero.");
  if (input.precommitment === 0n) throw new Error("InvalidPrecommitment: precommitment must be non-zero.");
  const swapLeg = buildZkSwapLeg({ zeroForOne });
  checkSwapLegBinding(swapLeg, input.withdrawAsset, input.depositAsset);
  const minSwapOut = deriveZkMinSwapOut(input.quotedSwapOut, input.slippagePercent);
  return {
    withdrawals: input.withdrawals,
    proofs: input.proofs,
    scopes: input.scopes,
    withdrawAsset: input.withdrawAsset,
    depositAsset: input.depositAsset,
    depositValue: input.depositValue,
    precommitment: input.precommitment,
    zeroForOne,
    recipient,
    swapLeg,
    minSwapOut,
  };
}

type MultiFullZkFlowCallArgs = readonly [
  ZkWithdrawalStruct[],
  ZkWithdrawProofStruct[],
  bigint[],
  Address,
  Address,
  Address,
  bigint,
  bigint,
  ZkSwapLegStruct,
  bigint
];

function toMultiCallArgs(args: MultiFullZkFlowArgs): MultiFullZkFlowCallArgs {
  return [
    args.withdrawals,
    args.proofs,
    args.scopes,
    args.recipient,
    args.withdrawAsset,
    args.depositAsset,
    args.depositValue,
    args.precommitment,
    args.swapLeg,
    args.minSwapOut,
  ];
}

/** Read-only eth_call of the exact multi-note calldata (no tx). */
export async function simulateMultiFullZkFlow(
  client: PublicClient,
  params: { account: Address; args: MultiFullZkFlowArgs }
): Promise<bigint> {
  const { result } = (await client.simulateContract({
    address: TESTNET_ZK_ROUTER_MULTI_ADDRESS,
    abi: VEIL_ZK_ROUTER_ABI,
    functionName: "executeMultiFullZkFlow",
    args: toMultiCallArgs(params.args) as never,
    account: params.account,
  })) as unknown as { result: bigint };
  return result as bigint;
}

function resolveMultiBase(base: ZkMultiFlowBase, minSwapOut: bigint): MultiFullZkFlowArgs {
  const zeroForOne = base.zeroForOne ?? false;
  checkMultiBatchLengths(base.withdrawals, base.proofs, base.scopes);
  checkMultiEntrypoint(base.withdrawals);
  if (base.depositValue <= 0n) throw new Error("Deposit value must be greater than zero.");
  if (base.precommitment === 0n) throw new Error("InvalidPrecommitment: precommitment must be non-zero.");
  const swapLeg = buildZkSwapLeg({ zeroForOne });
  checkSwapLegBinding(swapLeg, base.withdrawAsset, base.depositAsset);
  return {
    ...base,
    zeroForOne,
    recipient: TESTNET_ZK_ROUTER_MULTI_ADDRESS,
    swapLeg,
    minSwapOut,
  };
}

async function probeMultiSucceeds(
  client: PublicClient,
  account: Address,
  args: MultiFullZkFlowArgs
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    await simulateMultiFullZkFlow(client, { account, args });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Bracket the live multi-note swap output with free exact-calldata
 * simulations (no tx). Mirrors discoverZkSwapOut for the batched entry
 * point. Fails closed on any unexpected revert or spent probe budget.
 */
export async function discoverZkMultiSwapOut(
  client: PublicClient,
  params: { account: Address; base: ZkMultiFlowBase; maxProbes?: number }
): Promise<{ floor: bigint; probes: number }> {
  const maxProbes = params.maxProbes ?? ZK_FLOW_MAX_PROBES;
  let probes = 0;
  const runProbe = async (minSwapOut: bigint) => {
    if (probes >= maxProbes) {
      throw new Error(
        `Could not bracket the live swap output within ${maxProbes} free simulations. No transaction was sent.`
      );
    }
    probes += 1;
    return probeMultiSucceeds(client, params.account, resolveMultiBase(params.base, minSwapOut));
  };
  const preflight = await runProbe(0n);
  if (!preflight.ok) throw new Error(mapZkRouterError(preflight.error));
  const cover = await runProbe(params.base.depositValue);
  if (!cover.ok) {
    const name = findErrorName(cover.error);
    if (
      name === "SlippageExceeded" ||
      name === "InsufficientOutputForDenomination" ||
      /SlippageExceeded|InsufficientOutputForDenomination/i.test(messageOf(cover.error))
    ) {
      throw new Error(
        "Full-ZK flow reverted: the live swap output is below the deposit amount (InsufficientOutputForDenomination). Pick a smaller deposit or try again later. No transaction was sent."
      );
    }
    throw new Error(mapZkRouterError(cover.error));
  }
  let floor = params.base.depositValue;
  let ceiling = params.base.depositValue * 2n;
  const UINT256_CAP = 1n << 200n;
  for (;;) {
    if (ceiling > UINT256_CAP) {
      throw new Error(
        "Could not bracket the live swap output: it exceeds the probe range. No transaction was sent."
      );
    }
    const probe = await runProbe(ceiling);
    if (!probe.ok) {
      const name = findErrorName(probe.error);
      if (name === "SlippageExceeded" || /SlippageExceeded/i.test(messageOf(probe.error))) break;
      throw new Error(mapZkRouterError(probe.error));
    }
    floor = ceiling;
    ceiling *= 2n;
  }
  while (probes < maxProbes && ceiling - floor > 1n) {
    const mid = (floor + ceiling) / 2n;
    if (mid === floor || mid === ceiling) break;
    const probe = await runProbe(mid);
    if (probe.ok) {
      floor = mid;
    } else {
      const name = findErrorName(probe.error);
      if (name === "SlippageExceeded" || /SlippageExceeded/i.test(messageOf(probe.error))) {
        ceiling = mid;
      } else {
        throw new Error(mapZkRouterError(probe.error));
      }
    }
  }
  return { floor, probes };
}

export interface ZkMultiQuoteResult {
  args: MultiFullZkFlowArgs;
  quotedSwapOut: bigint;
  minSwapOut: bigint;
  probes: number;
}

/**
 * Multi-note quote-then-execute builder: zero-min preflight, live bracket,
 * slippage derivation, then a final exact-calldata simulation with the
 * derived min (pre-send check). Simulation only.
 */
export async function quoteAndBuildMultiFullZkFlow(
  client: PublicClient,
  params: { account: Address; base: ZkMultiFlowBase; slippagePercent: number; maxProbes?: number }
): Promise<ZkMultiQuoteResult> {
  const { floor, probes } = await discoverZkMultiSwapOut(client, {
    account: params.account,
    base: params.base,
    maxProbes: params.maxProbes,
  });
  const minSwapOut = deriveZkMinSwapOut(floor, params.slippagePercent);
  const args = resolveMultiBase(params.base, minSwapOut);
  try {
    await simulateMultiFullZkFlow(client, { account: params.account, args });
  } catch (error) {
    throw new Error(mapZkRouterError(error, params.slippagePercent));
  }
  return { args, quotedSwapOut: floor, minSwapOut, probes: probes + 1 };
}

/**
 * Shipped Shielded Swap pre-send sequence (single source of truth for the
 * page's execute handler): revalidateWallet -> pre-send simulate of the
 * EXACT calldata -> wallet writeContract. Simulation only until the final
 * write; any sim/revalidate failure throws before any transaction is sent.
 * Test-friendly: callers inject the real testnet public client, the real
 * wallet client, and a revalidate callback (the page passes
 * `() => revalidateWallet(...)`; tests pass recording doubles).
 */
export async function runShieldedSwapPreSendSequence(params: {
  flowKind: "single" | "multi";
  account: Address;
  publicClient: PublicClient;
  walletClient: { writeContract: (req: never) => Promise<Hash> };
  revalidate: () => Promise<unknown>;
  singleArgs?: FullZkFlowArgs;
  multiArgs?: MultiFullZkFlowArgs;
}): Promise<Hash> {
  console.log("[trace-exec] revalidate start");
  await params.revalidate();
  console.log("[trace-exec] revalidate done");
  if (params.flowKind === "multi") {
    if (!params.multiArgs) throw new Error("Refresh the live quote first. No transaction was sent.");
    await simulateMultiFullZkFlow(params.publicClient, {
      account: params.account,
      args: params.multiArgs,
    });
    return params.walletClient.writeContract({
      address: TESTNET_ZK_ROUTER_MULTI_ADDRESS,
      abi: VEIL_ZK_ROUTER_ABI,
      functionName: "executeMultiFullZkFlow",
      args: [
        params.multiArgs.withdrawals,
        params.multiArgs.proofs,
        params.multiArgs.scopes,
        params.multiArgs.recipient,
        params.multiArgs.withdrawAsset,
        params.multiArgs.depositAsset,
        params.multiArgs.depositValue,
        params.multiArgs.precommitment,
        params.multiArgs.swapLeg,
        params.multiArgs.minSwapOut,
      ],
    } as never);
  }
  if (!params.singleArgs) throw new Error("Refresh the live quote first. No transaction was sent.");
  console.log("[trace-exec] simulate start");
  await simulateFullZkFlow(params.publicClient, {
    account: params.account,
    args: params.singleArgs,
  });
  console.log("[trace-exec] simulate done, requesting wallet signature");
  return params.walletClient.writeContract({
    address: TESTNET_ZK_ROUTER_ADDRESS,
    abi: VEIL_ZK_ROUTER_ABI,
    functionName: "executeFullZkFlow",
    args: [
      params.singleArgs.withdrawal,
      params.singleArgs.proof,
      params.singleArgs.scope,
      params.singleArgs.recipient,
      params.singleArgs.withdrawAsset,
      params.singleArgs.depositAsset,
      params.singleArgs.depositValue,
      params.singleArgs.precommitment,
      params.singleArgs.swapLeg,
      params.singleArgs.minSwapOut,
    ],
  } as never);
}

/**
 * Single source of truth for whether the ZK Execute button stays disabled.
 * Disabled until a fresh live quote exists; when disconnected it stays
 * enabled so it can open the wallet modal.
 */
export function isZkExecuteDisabled(args: {
  isExecuting: boolean;
  connected: boolean;
  noteValid: boolean;
  isQuoting: boolean;
  hasQuote: boolean;
}): boolean {
  if (args.isExecuting) return true;
  if (!args.connected) return false;
  if (!args.noteValid) return true;
  if (args.isQuoting) return true;
  if (!args.hasQuote) return true;
  return false;
}

export { explorerTxUrl } from "./chains";
