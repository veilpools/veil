import {
  decodeEventLog,
  keccak256,
  concatHex,
  toHex,
  type Address,
  type Hash,
  type PublicClient,
} from "viem";
import { VEIL_SHIELD_ROUTER_ABI } from "./veil-artifact";
import {
  calculateSlippageBound,
  type PoolKey,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
} from "./router-client";
import {
  TESTNET_CHAIN_ID,
  TESTNET_ROUTER_ADDRESS,
  TESTNET_LEGACY_ETH_POOL,
  TESTNET_VEIL_TOKEN,
  ETH_ZERO_ADDRESS,
  TESTNET_ROUTER_POOL_KEY,
  UINT128_MAX,
  parseSlippagePercent,
} from "./router-swap";
import type { ShieldedNote } from "./note";

// ---------------------------------------------------------------------------
// Task 4 (testnet end-to-end UI): VeilShieldRouter.shieldedSwap (§7 #5 #6).
//
// Alur: saldo shielded A -> withdraw ke router -> swap A->B di pool v4
//       -> deposit ke pool B (newCommitment) tanpa alamat publik muncul.
//
// Relayer fallback (§7 #6): bila relayer offline atau user memilih self-relay,
// relayerFee = 0 dan msg.sender adalah wallet user sendiri yang membayar gas.
// ---------------------------------------------------------------------------

export interface ShieldedSwapExecutionParams {
  poolSource: Address;
  proof: `0x${string}`;
  root: `0x${string}`;
  nullifierHash: `0x${string}`;
  relayerFee: bigint;
  key: PoolKey;
  zeroForOne: boolean;
  minAmountOut: bigint;
  sqrtPriceLimitX96: bigint;
  newCommitment: `0x${string}`;
  poolDestination: Address;
  hookData: `0x${string}`;
}

export interface BuildShieldedSwapArgs {
  note: ShieldedNote;
  proof: `0x${string}`;
  root: `0x${string}`;
  poolSource?: Address;
  poolDestination?: Address;
  poolKey?: PoolKey;
  zeroForOne?: boolean;
  quotedAmountOut: bigint;
  slippagePercent: number;
  relayerFee?: bigint;
  newCommitment: `0x${string}`;
  hookData?: `0x${string}`;
  sqrtPriceLimitX96?: bigint;
}

/**
 * Builds the typed ShieldedSwapParams struct for VeilShieldRouter.shieldedSwap.
 * Verifies bounds: minAmountOut <= uint128, relayerFee >= 0, slippage applied.
 */
export function buildShieldedSwapParams(args: BuildShieldedSwapArgs): ShieldedSwapExecutionParams {
  const slippagePct = parseSlippagePercent(String(args.slippagePercent));
  const minOut = calculateSlippageBound(args.quotedAmountOut, slippagePct);

  if (minOut < 0n) {
    throw new Error("minAmountOut cannot be negative.");
  }
  if (minOut > UINT128_MAX) {
    throw new Error("minAmountOut exceeds uint128 capacity.");
  }

  const relayerFee = args.relayerFee ?? 0n;
  if (relayerFee < 0n) {
    throw new Error("relayerFee cannot be negative.");
  }
  if (relayerFee >= args.note.denomination) {
    throw new Error("relayerFee cannot exceed or equal the note denomination.");
  }

  const zeroForOne = args.zeroForOne ?? true;
  const defaultSqrtLimit = zeroForOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n;

  return {
    poolSource: args.poolSource ?? TESTNET_LEGACY_ETH_POOL,
    proof: args.proof,
    root: args.root,
    nullifierHash: args.note.nullifierHash,
    relayerFee,
    key: args.poolKey ?? TESTNET_ROUTER_POOL_KEY,
    zeroForOne,
    minAmountOut: minOut,
    sqrtPriceLimitX96: args.sqrtPriceLimitX96 ?? defaultSqrtLimit,
    newCommitment: args.newCommitment,
    poolDestination: args.poolDestination ?? TESTNET_LEGACY_ETH_POOL,
    hookData: args.hookData ?? "0x",
  };
}

/**
 * Generates secrets for the newly created destination shielded note.
 */
export function generateNewShieldedNoteSecrets(denomination: bigint, asset: Address = ETH_ZERO_ADDRESS): {
  nullifier: `0x${string}`;
  secret: `0x${string}`;
  nullifierHash: `0x${string}`;
  commitment: `0x${string}`;
  newNote: ShieldedNote;
} {
  const rand32 = (): `0x${string}` =>
    toHex(crypto.getRandomValues(new Uint8Array(32)));
  const nullifier = rand32();
  const secret = rand32();
  const nullifierHash = keccak256(nullifier);
  const commitment = keccak256(concatHex([nullifier, secret]));

  const newNote: ShieldedNote = {
    nullifier,
    secret,
    nullifierHash,
    commitment,
    denomination,
    asset,
    timestamp: Date.now(),
  };

  return {
    nullifier,
    secret,
    nullifierHash,
    commitment,
    newNote,
  };
}

export interface ShieldedSwapExecutedEvent {
  relayer: Address;
  poolSource: Address;
  poolDestination: Address;
  nullifierHash: Hash;
  newCommitment: Hash;
  amountOut: bigint;
}

/**
 * Searches receipt logs for the ShieldedSwapExecuted event matching the nullifierHash.
 */
export function findShieldedSwapExecuted(
  logs: Array<{ topics: string[]; data: string; address?: string }>,
  targetNullifierHash: Hash
): ShieldedSwapExecutedEvent | null {
  const targetLower = targetNullifierHash.toLowerCase();
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: VEIL_SHIELD_ROUTER_ABI,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (
        decoded.eventName === "ShieldedSwapExecuted" &&
        decoded.args &&
        "nullifierHash" in decoded.args
      ) {
        const eventNullifier = String(decoded.args.nullifierHash).toLowerCase();
        if (eventNullifier === targetLower) {
          return {
            relayer: decoded.args.relayer as Address,
            poolSource: decoded.args.poolSource as Address,
            poolDestination: decoded.args.poolDestination as Address,
            nullifierHash: decoded.args.nullifierHash as Hash,
            newCommitment: decoded.args.newCommitment as Hash,
            amountOut: BigInt(decoded.args.amountOut as string | number | bigint),
          };
        }
      }
    } catch {
      // Ignore unparseable or irrelevant event logs
    }
  }
  return null;
}

/**
 * Maps router errors to plain English messages for user guidance (§7 #2).
 */
export function mapShieldedSwapError(error: unknown, slippagePercent?: number): string {
  if (!error) return "Unknown error during shielded swap.";
  const msg = error instanceof Error ? error.message : String(error);

  if (/SlippageExceeded/i.test(msg)) {
    return (
      `Shielded swap reverted: SlippageExceeded. Output fell below the ${
        slippagePercent !== undefined ? `${slippagePercent}%` : "configured"
      } slippage limit. Increase slippage and retry.`
    );
  }
  if (/NonZeroBalanceInvariantFailed/i.test(msg)) {
    return (
      "Shielded swap reverted: NonZeroBalanceInvariantFailed. Router zero-balance invariant failed; funds were safely rolled back."
    );
  }
  if (/InsufficientOutputForDenomination/i.test(msg)) {
    return (
      "Shielded swap reverted: InsufficientOutputForDenomination. The swap output could not fund a full destination note."
    );
  }
  if (/InvalidShieldedPool/i.test(msg)) {
    return "Shielded swap reverted: InvalidShieldedPool. The specified pool is not whitelisted by the router.";
  }
  if (/NullifierAlreadySpent/i.test(msg)) {
    return "Shielded swap rejected: The selected note nullifier has already been spent onchain.";
  }
  if (/User rejected|denied|UserDenied/i.test(msg)) {
    return "Transaction signature rejected in wallet. No transaction was submitted.";
  }
  return `Shielded swap failed: ${msg.slice(0, 160)}`;
}
