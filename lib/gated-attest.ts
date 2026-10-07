import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  toBytes,
  type Address,
  type Hash,
  type PublicClient,
} from "viem";
import {
  VEIL_ATTESTATION_REGISTRY_ABI,
  VEIL_HOOK_ABI,
} from "./veil-artifact";

// ---------------------------------------------------------------------------
// Task 3 (testnet end-to-end UI): permissionless self-attestation +
// gated-pool swap via the trade page on Robinhood Testnet (chain 46630).
//
// ADDRESS RECONCILIATION (verified onchain 2026-10-07 via eth_call, see the
// Task-3 report): lib/contracts.ts TESTNET_* still points at the ORIGINAL
// testnet suite (registry 0x4d66…2dce3 / hook 0xc0bd…30c4 — smaller bytecode,
// operator NOT attested there). The proven self-attest + gated-swap path
// lives on the v2 suite from scripts/selfattest-hook-v2.mjs +
// scripts/gated-swap-v2.mjs (deployments/selfattest-hook-v2-latest.json):
// hook.registry() returns the v2 registry onchain, the operator is attested
// there, and the ETH/VEIL pool below reports isPoolGated = true with a live
// launch window. The UI below uses the v2 suite ONLY and reads every claim
// live from chain (fail closed).
// ---------------------------------------------------------------------------

export const GATED_TESTNET_CHAIN_ID = 46630;

export const GATED_REGISTRY_ADDRESS =
  "0x0a9bc900d7831d9e2589fb44f6b0754d3f572f36" as Address;
export const GATED_HOOK_ADDRESS =
  "0xbebfc3048c7ced099337abe46e56189fa63420c4" as Address;
export const GATED_VEIL_TOKEN =
  "0x019086f63407fadf0ccb89516e465baef5031aa9" as Address;
export const GATED_ETH_ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;
// TestnetSwapHelper from scripts/gated-swap-v2.mjs (proven swapExactIn path).
export const GATED_SWAPPER_ADDRESS =
  "0x14c27b66fba1b561a920bd03970ae20c53608dff" as Address;

// Proven gated poolKey, verbatim from scripts/gated-swap-v2.mjs:
// { currency0: ETH, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: v2 }.
export const GATED_POOL_KEY = {
  currency0: GATED_ETH_ZERO_ADDRESS,
  currency1: GATED_VEIL_TOKEN,
  fee: 3000,
  tickSpacing: 60,
  hooks: GATED_HOOK_ADDRESS,
} as const;

// PoolId for the gated pool above, verified onchain 2026-10-07. The
// buildGatedPoolId() builder must reproduce this exact value (pinned test).
export const GATED_POOL_ID =
  "0x837b0a31b5577f02f98e51829cab48f6e5b190546e168772523dd1c5c409419c" as Hash;

export const GATED_EXPLORER_TX_BASE =
  "https://explorer.testnet.chain.robinhood.com/tx/";
export const GATED_EXPLORER_ADDRESS_BASE =
  "https://explorer.testnet.chain.robinhood.com/address/";

// Proven-script mirrors: self-attest deadline = now + 3600s
// (scripts/selfattest-hook-v2.mjs deadline1), hookData deadline = now + 600s
// (scripts/gated-swap-v2.mjs signedHookData), gated demo amount 0.5 VEIL,
// swapExactIn minOut = 1n (verbatim from swapAs).
export const SELF_ATTEST_DEADLINE_TTL_SECONDS = 3600;
export const GATED_HOOKDATA_TTL_SECONDS = 600;
export const PROVEN_GATED_VEIL_AMOUNT_IN = "0.5";
export const GATED_SWAP_MIN_OUT = 1n;

export function buildGatedPoolKey(): typeof GATED_POOL_KEY {
  return {
    currency0: GATED_POOL_KEY.currency0,
    currency1: GATED_POOL_KEY.currency1,
    fee: GATED_POOL_KEY.fee,
    tickSpacing: GATED_POOL_KEY.tickSpacing,
    hooks: GATED_POOL_KEY.hooks,
  };
}

/** PoolId = keccak256(abi.encode(poolKey)) — mirrors gated-swap-v2.mjs. */
export function buildGatedPoolId(
  key: typeof GATED_POOL_KEY = GATED_POOL_KEY
): Hash {
  const keyTuple: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  } = {
    currency0: key.currency0,
    currency1: key.currency1,
    fee: key.fee,
    tickSpacing: key.tickSpacing,
    hooks: key.hooks,
  };
  return keccak256(
    encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "currency0", type: "address" },
            { name: "currency1", type: "address" },
            { name: "fee", type: "uint24" },
            { name: "tickSpacing", type: "int24" },
            { name: "hooks", type: "address" },
          ],
        },
      ],
      [keyTuple]
    )
  );
}

export interface SelfAttestMessage {
  registry: Address;
  chainId: bigint;
  user: Address;
  proofRoot: Hash;
  nonce: bigint;
  deadline: bigint;
}

/**
 * EIP-191 struct hash for registry.selfAttest — mirrors
 * contracts/VeilAttestationRegistry.sol + scripts/selfattest-hook-v2.mjs
 * inner1 exactly: keccak(abi.encode(registry, chain, user, root, nonce,
 * deadline)). The wallet signs this raw hash (personal_sign, no gas).
 */
export function buildSelfAttestInnerHash(msg: SelfAttestMessage): Hash {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [msg.registry, msg.chainId, msg.user, msg.proofRoot, msg.nonce, msg.deadline]
    )
  );
}

export interface GatedHookMessage {
  hook: Address;
  chainId: bigint;
  user: Address;
  poolId: Hash;
  deadline: bigint;
}

/**
 * EIP-191 struct hash bound into gated hookData — mirrors
 * contracts/VeilHook.sol + scripts/gated-swap-v2.mjs signedHookData exactly:
 * keccak(abi.encode(hook, chain, user, poolId, deadline)). The signature must
 * come from `user`, so hookData cannot be spoofed or moved across pools.
 */
export function buildGatedHookInnerHash(msg: GatedHookMessage): Hash {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        { type: "uint256" },
      ],
      [msg.hook, msg.chainId, msg.user, msg.poolId, msg.deadline]
    )
  );
}

/** hookData = abi.encode(user, deadline, signature) — verbatim script shape. */
export function encodeGatedHookData(args: {
  user: Address;
  deadline: bigint;
  signature: Hash;
}): `0x${string}` {
  return encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "bytes" }],
    [args.user, args.deadline, args.signature]
  );
}

/** Fresh random 32-byte proof root (permissionless: any root is accepted). */
export function buildSelfAttestProofRoot(): Hash {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as Hash;
}

const GATED_SWAPPER_ABI = [
  {
    type: "function",
    name: "swapExactIn",
    stateMutability: "payable",
    inputs: [
      {
        name: "s",
        type: "tuple",
        components: [
          {
            name: "key",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "amountIn", type: "uint128" },
          { name: "minOut", type: "uint128" },
          { name: "hookData", type: "bytes" },
          { name: "inputToken", type: "address" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint128" }],
  },
] as const;

const VEIL_ERC20_MIN_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export interface AttestationStatus {
  attested: boolean;
  nonce: bigint;
}

export async function readAttestationStatus(
  client: PublicClient,
  user: Address,
  registry: Address = GATED_REGISTRY_ADDRESS
): Promise<AttestationStatus> {
  const [attested, nonce] = await Promise.all([
    client.readContract({
      address: registry,
      abi: VEIL_ATTESTATION_REGISTRY_ABI,
      functionName: "verifyAttestation",
      args: [user],
    }),
    client.readContract({
      address: registry,
      abi: VEIL_ATTESTATION_REGISTRY_ABI,
      functionName: "attestationNonce",
      args: [user],
    }),
  ]);
  return { attested, nonce };
}

export interface GatingConfig {
  poolId: Hash;
  gated: boolean;
  duration: bigint;
  launchTime: bigint;
  /** Active now per chain head: gated && (permanent || within window). */
  active: boolean;
  /** Null when permanent (duration 0) or inactive. Else unix seconds. */
  windowEndsAt: bigint | null;
}

export function isGatingActive(args: {
  gated: boolean;
  duration: bigint;
  launchTime: bigint;
  nowSeconds: bigint;
}): boolean {
  if (!args.gated) return false;
  if (args.duration === 0n) return true;
  return args.nowSeconds < args.launchTime + args.duration;
}

export async function readGatingConfig(
  client: PublicClient,
  poolId: Hash = GATED_POOL_ID,
  hook: Address = GATED_HOOK_ADDRESS
): Promise<GatingConfig> {
  const [gated, duration, launchTime, block] = await Promise.all([
    client.readContract({
      address: hook,
      abi: VEIL_HOOK_ABI,
      functionName: "isPoolGated",
      args: [poolId],
    }),
    client.readContract({
      address: hook,
      abi: VEIL_HOOK_ABI,
      functionName: "poolGatingDuration",
      args: [poolId],
    }),
    client.readContract({
      address: hook,
      abi: VEIL_HOOK_ABI,
      functionName: "poolLaunchTime",
      args: [poolId],
    }),
    client.getBlock({ blockTag: "latest" }),
  ]);
  const nowSeconds = block.timestamp;
  const active = isGatingActive({ gated, duration, launchTime, nowSeconds });
  const windowEndsAt =
    gated && duration > 0n ? launchTime + duration : null;
  return { poolId, gated, duration, launchTime, active, windowEndsAt };
}

// Revert selectors for the hook's gating errors (keccak(name)[:4]).
function errorSelector(signature: string): `0x${string}` {
  return keccak256(toBytes(signature)).slice(0, 10) as `0x${string}`;
}
export const GATING_REVERT_SELECTORS = {
  GatingActiveUserNotAttested: errorSelector("GatingActiveUserNotAttested()"),
  Expired: errorSelector("Expired()"),
  InvalidSignature: errorSelector("InvalidSignature()"),
} as const;

export type GatedSimReason =
  | "GatingActiveUserNotAttested"
  | "Expired"
  | "InvalidSignature"
  | "Unknown";

function findHexData(error: unknown, depth = 0, seen = new Set<unknown>()): string | null {
  if (!error || depth > 6 || typeof error !== "object") return null;
  if (seen.has(error)) return null;
  seen.add(error);
  const record = error as Record<string, unknown>;
  for (const key of ["data", "revertData"]) {
    const value = record[key];
    if (typeof value === "string" && /^0x[0-9a-fA-F]{8}[0-9a-fA-F]*$/.test(value)) {
      return value.toLowerCase();
    }
  }
  if (typeof record.message === "string") {
    const m = record.message.match(/0x[0-9a-fA-F]{8}[0-9a-fA-F]*/);
    if (m) return m[0].toLowerCase();
  }
  for (const key of ["cause", "error", "errors"]) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const found = findHexData(item, depth + 1, seen);
        if (found) return found;
      }
    } else if (nested && typeof nested === "object") {
      const found = findHexData(nested, depth + 1, seen);
      if (found) return found;
    }
  }
  return null;
}

export function decodeGatingRevert(error: unknown): GatedSimReason {
  const data = findHexData(error);
  if (data) {
    // The v4 PoolManager wraps hook reverts in WrappedError, so the gating
    // selector sits NESTED inside the revert blob (verified live 2026-10-07:
    // 0x90bfb865…bc7aea4f…, see tests/fixtures/gated-simulation.json).
    // Precedence is positional: when a blob contains several known selectors
    // (nested multi-error data), the innermost (last-appearing) selector wins
    // as the most specific match, not a fixed GatingActive-first order (M-4).
    const candidates = [
      {
        reason: "GatingActiveUserNotAttested",
        selector: GATING_REVERT_SELECTORS.GatingActiveUserNotAttested,
      },
      { reason: "Expired", selector: GATING_REVERT_SELECTORS.Expired },
      {
        reason: "InvalidSignature",
        selector: GATING_REVERT_SELECTORS.InvalidSignature,
      },
    ] as const;
    let best: GatedSimReason | null = null;
    let bestIndex = -1;
    for (const candidate of candidates) {
      const index = data.indexOf(candidate.selector.slice(2).toLowerCase());
      if (index !== -1 && index > bestIndex) {
        bestIndex = index;
        best = candidate.reason;
      }
    }
    if (best) return best;
    const selector = data.slice(0, 10);
    if (selector === GATING_REVERT_SELECTORS.GatingActiveUserNotAttested)
      return "GatingActiveUserNotAttested";
    if (selector === GATING_REVERT_SELECTORS.Expired) return "Expired";
    if (selector === GATING_REVERT_SELECTORS.InvalidSignature) return "InvalidSignature";
    return "Unknown";
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (/GatingActiveUserNotAttested/i.test(msg)) return "GatingActiveUserNotAttested";
  if (/expired/i.test(msg)) return "Expired";
  if (/invalid signature/i.test(msg)) return "InvalidSignature";
  return "Unknown";
}

export interface GatedSimCallArgs {
  from: Address;
  amountIn: bigint;
  hookData: `0x${string}`;
  minOut?: bigint;
}

export function buildGatedSwapCalldata(args: GatedSimCallArgs): `0x${string}` {
  if (args.amountIn <= 0n) throw new Error("VEIL input amount must be greater than zero.");
  return encodeFunctionData({
    abi: GATED_SWAPPER_ABI,
    functionName: "swapExactIn",
    args: [
      {
        key: {
          currency0: GATED_POOL_KEY.currency0,
          currency1: GATED_POOL_KEY.currency1,
          fee: GATED_POOL_KEY.fee,
          tickSpacing: GATED_POOL_KEY.tickSpacing,
          hooks: GATED_POOL_KEY.hooks,
        },
        // zeroForOne=false: VEIL (currency1) in -> ETH (currency0) out,
        // verbatim from scripts/gated-swap-v2.mjs swapAs.
        zeroForOne: false,
        amountIn: args.amountIn,
        minOut: args.minOut ?? GATED_SWAP_MIN_OUT,
        hookData: args.hookData,
        inputToken: GATED_VEIL_TOKEN,
      },
    ],
  });
}

export type GatedSimResult =
  | { ok: true; returnData: `0x${string}` }
  | { ok: false; reason: GatedSimReason; message: string };

/**
 * Transaction args for TestnetSwapHelper.swapExactIn (wallet write path).
 * Same proven shape as the gas-free simulation: VEIL in, ETH out, minOut 1n.
 */
export function buildGatedSwapTxArgs(args: GatedSimCallArgs) {
  if (args.amountIn <= 0n) throw new Error("VEIL input amount must be greater than zero.");
  return [
    {
      key: {
        currency0: GATED_POOL_KEY.currency0,
        currency1: GATED_POOL_KEY.currency1,
        fee: GATED_POOL_KEY.fee,
        tickSpacing: GATED_POOL_KEY.tickSpacing,
        hooks: GATED_POOL_KEY.hooks,
      },
      zeroForOne: false,
      amountIn: args.amountIn,
      minOut: args.minOut ?? GATED_SWAP_MIN_OUT,
      hookData: args.hookData,
      inputToken: GATED_VEIL_TOKEN,
    },
  ] as const;
}

/**
 * R4 gas-free demonstration: a RAW eth_call of the exact gated-swap calldata
 * (no transaction, no gas) WITH a state override that virtually funds the
 * sender with test VEIL and approves the swapper. The override is required
 * because TestnetSwapHelper.swapExactIn pulls VEIL via transferFrom BEFORE
 * PoolManager.unlock reaches the hook's gating check — without it, an
 * unfunded simulation reverts on allowance and never exercises the gate.
 * With it, the REAL hook logic runs: pre-attest the call reverts with
 * GatingActiveUserNotAttested (wrapped in the manager's WrappedError);
 * post-attest the same call succeeds. Overrides change nothing onchain.
 *
 * Live transcripts (zero-gas eth_call request/response for both legs,
 * head 130555038): tests/fixtures/gated-simulation.json.
 */
export async function simulateGatedSwapCall(
  client: PublicClient,
  args: GatedSimCallArgs
): Promise<GatedSimResult> {
  const data = buildGatedSwapCalldata(args);
  const override = buildFundedSimOverride(args.from, args.amountIn);
  try {
    const returnData = (await client.request({
      method: "eth_call",
      params: [
        { from: args.from, to: GATED_SWAPPER_ADDRESS, data },
        "latest",
        override,
      ],
    })) as `0x${string}`;
    return { ok: true, returnData };
  } catch (error: unknown) {
    const reason = decodeGatingRevert(error);
    return { ok: false, reason, message: describeGatedSimRevert(reason, error) };
  }
}

/**
 * Virtual funding for gas-free simulation: classic OpenZeppelin ERC20 slots
 * (_balances at 0, _allowances at 1 — layout verified onchain 2026-10-07 via
 * eth_getStorageAt against balanceOf/allowance). Grants `from` exactly
 * `amount` of test VEIL plus the same approval, virtually and ephemerally.
 */
export function buildVeilBalanceSlot(user: Address): Hash {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      [user, 0n]
    )
  );
}

export function buildVeilAllowanceSlot(owner: Address, spender: Address): Hash {
  const inner = keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      [owner, 1n]
    )
  );
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }],
      [spender, inner]
    )
  );
}

function toWord(value: bigint): Hash {
  return `0x${value.toString(16).padStart(64, "0")}` as Hash;
}

export function buildFundedSimOverride(
  from: Address,
  amount: bigint
): Record<Address, { stateDiff: Record<Hash, Hash> }> {
  const funded = toWord(amount);
  return {
    [GATED_VEIL_TOKEN]: {
      stateDiff: {
        [buildVeilBalanceSlot(from)]: funded,
        [buildVeilAllowanceSlot(from, GATED_SWAPPER_ADDRESS)]: funded,
      },
    },
  };
}

export function describeGatedSimRevert(reason: GatedSimReason, error?: unknown): string {
  const detail =
    error instanceof Error && error.message
      ? ` Node said: ${error.message.slice(0, 160)}`
      : "";
  switch (reason) {
    case "GatingActiveUserNotAttested":
      return "Simulation reverted with GatingActiveUserNotAttested: pool gating is active and this address is not attested in the registry. Self-attest above, then re-run the simulation — no gas was spent.";
    case "Expired":
      return "Simulation reverted with Expired: the signed hookData deadline passed before simulation. Sign a fresh message and try again — no gas was spent.";
    case "InvalidSignature":
      return "Simulation reverted with InvalidSignature: the hookData signature did not come from the stated user address. Sign with the connected wallet and try again — no gas was spent.";
    case "Unknown":
      return `Simulation reverted with an unrecognized reason — no gas was spent. It may be a downstream pool or RPC issue rather than the gating check.${detail}`;
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    const nested = error.cause instanceof Error ? ` ${error.cause.message}` : "";
    return `${error.message}${nested}`;
  }
  return String(error);
}

export function isUserRejection(error: unknown): boolean {
  return /user rejected|user denied|rejected the request|action_rejected/i.test(
    messageOf(error)
  );
}

/** Honest English errors for self-attest failures (fail closed, no alert). */
export function mapSelfAttestError(error: unknown): string {
  if (isUserRejection(error))
    return "Attestation cancelled in your wallet. No transaction was sent.";
  const reason = decodeGatingRevert(error);
  if (reason === "Expired")
    return "Attestation reverted: the signature deadline passed (Expired). Sign again — the app always uses a fresh deadline. No attestation was recorded.";
  if (reason === "InvalidSignature")
    return "Attestation reverted: the signature did not verify (InvalidSignature). Sign the message with the connected wallet and retry.";
  const msg = messageOf(error);
  if (/already attested/i.test(msg)) return msg;
  if (error instanceof Error && error.message) return error.message;
  return "Self-attestation failed before execution. Check your wallet and testnet connection, then try again.";
}

/** Honest English errors for gated-swap execution failures. */
export function mapGatedSwapError(error: unknown): string {
  if (isUserRejection(error))
    return "Transaction cancelled in your wallet. No transaction was sent.";
  const reason = decodeGatingRevert(error);
  if (reason === "GatingActiveUserNotAttested")
    return "Swap reverted: pool gating is active and this address is not attested (GatingActiveUserNotAttested). Self-attest first — executing again without attesting only burns gas.";
  if (reason === "Expired")
    return "Swap reverted: the hookData signature expired (Expired) between signing and sending. Sign again and retry quickly.";
  if (reason === "InvalidSignature")
    return "Swap reverted: the hookData signature is invalid (InvalidSignature). It must be the connected wallet's own signature over this pool. Re-sign and retry.";
  const msg = messageOf(error);
  if (/insufficient allowance|ERC20InsufficientAllowance|exceeds allowance/i.test(msg))
    return "The gated swapper is not approved to spend this VEIL yet. Approve VEIL for the swapper during execution, then retry.";
  if (/insufficient balance|ERC20InsufficientBalance/i.test(msg))
    return `Insufficient test VEIL balance. The gated route needs test VEIL (${GATED_VEIL_TOKEN}) already in your wallet — there is no onchain faucet. Fund test VEIL and try again.`;
  if (error instanceof Error && error.message) return error.message;
  return "Gated swap failed before execution. Check your wallet, testnet connection, and VEIL balance, then try again.";
}

export function isGatedExecuteDisabled(args: {
  isSwapping: boolean;
  connected: boolean;
  veilInValid: boolean;
  attested: boolean | null;
  isSimulating: boolean;
}): boolean {
  if (args.isSwapping) return true;
  if (!args.connected) return false;
  if (!args.veilInValid) return true;
  // Fail closed: an unattested execution would revert onchain and burn gas,
  // so the button stays disabled until live chain state says attested.
  if (args.attested !== true) return true;
  if (args.isSimulating) return true;
  return false;
}

export async function readVeilBalanceGated(
  client: PublicClient,
  owner: Address
): Promise<bigint> {
  return client.readContract({
    address: GATED_VEIL_TOKEN,
    abi: VEIL_ERC20_MIN_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
}

export async function readVeilAllowanceGated(
  client: PublicClient,
  owner: Address,
  spender: Address = GATED_SWAPPER_ADDRESS
): Promise<bigint> {
  return client.readContract({
    address: GATED_VEIL_TOKEN,
    abi: VEIL_ERC20_MIN_ABI,
    functionName: "allowance",
    args: [owner, spender],
  });
}

export function gatedExplorerTxUrl(hash: string): string {
  return `${GATED_EXPLORER_TX_BASE}${hash}`;
}

export function gatedExplorerAddressUrl(address: string): string {
  return `${GATED_EXPLORER_ADDRESS_BASE}${address}`;
}

export { GATED_SWAPPER_ABI, VEIL_ERC20_MIN_ABI };
