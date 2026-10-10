import type { Address } from "viem";

// 0xbow Privacy Pools TESTNET 46630 address book.
// Sourced from deployments/privacy-pools-testnet-latest.json (audited v1.2.1 suite).
// Same env-override pattern as lib/contracts.ts. TESTNET ONLY — do not use for mainnet.
export const TESTNET_CHAIN_ID = 46630 as const;
export const MAINNET_CHAIN_ID = 4663 as const;

// 0xbow Privacy Pools MAINNET 4663 address book.
// Populated by `pnpm migrate:mainnet` (NEXT_PUBLIC_0XBOW_* env). Empty until
// migration runs — UI treats empty as "mainnet 0xbow pending migration".
export const MAINNET_0XBOW = {
  entrypoint:
    (process.env.NEXT_PUBLIC_0XBOW_ENTRYPOINT as Address | undefined) || ("" as Address),
  poolEth:
    (process.env.NEXT_PUBLIC_0XBOW_POOL_ETH as Address | undefined) || ("" as Address),
  poolVeil:
    (process.env.NEXT_PUBLIC_0XBOW_POOL_VEIL as Address | undefined) || ("" as Address),
} as const;

export const TESTNET_0XBOW = {
  withdrawalVerifier:
    (process.env.NEXT_PUBLIC_TESTNET_WITHDRAWAL_VERIFIER as Address | undefined) ||
    ("0xeea9d0f7ee0958c6d59f25162be4e69ba60a0f71" as Address),
  commitmentVerifier:
    (process.env.NEXT_PUBLIC_TESTNET_COMMITMENT_VERIFIER as Address | undefined) ||
    ("0xe4c3615db1bdeaf7b82b5568bd73f20f5666f008" as Address),
  entrypointImplementation:
    (process.env.NEXT_PUBLIC_TESTNET_ENTRYPOINT_IMPL as Address | undefined) ||
    ("0x797e2aa1f3225ab38bfc6441a3f4b44e95158cda" as Address),
  entrypointProxy:
    (process.env.NEXT_PUBLIC_TESTNET_ENTRYPOINT_PROXY as Address | undefined) ||
    ("0xb68c3d25e5e9902363e8e10d5c0a471e65be8152" as Address),
  pool:
    (process.env.NEXT_PUBLIC_TESTNET_PRIVACY_POOL as Address | undefined) ||
    ("0xea48e6a7ae296ebbd7d58792091b8087032d3aa4" as Address),
  poseidonT3:
    (process.env.NEXT_PUBLIC_TESTNET_POSEIDON_T3 as Address | undefined) ||
    ("0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34" as Address),
  poseidonT4:
    (process.env.NEXT_PUBLIC_TESTNET_POSEIDON_T4 as Address | undefined) ||
    ("0xa7f7e7887a4fa00cc934abe39cdd470cfdc9a855" as Address),
} as const;

export const TESTNET_0XBOW_META = {
  chainId: TESTNET_CHAIN_ID,
  protocol: "0xbow-privacy-pools-core-v1.2.1",
  poolDeploymentBlock: 129954000n,
  entrypointDeploymentBlock: 129953774n,
  denominationWei: 1000000000000000n,
  associationRoot:
    "21888242871839275222246405745257275088548364400416034343698204186575808495616",
} as const;

function isHexAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** True when every testnet 0xbow address is a valid non-zero hex address. */
export function isTestnetBowConfigured(): boolean {
  return Object.values(TESTNET_0XBOW).every(
    (addr) => isHexAddress(addr) && addr !== "0x0000000000000000000000000000000000000000"
  );
}

/** True when the mainnet 0xbow suite finished migration (env populated). */
export function isMainnetBowConfigured(): boolean {
  return Object.values(MAINNET_0XBOW).every(
    (addr) => isHexAddress(addr) && addr !== "0x0000000000000000000000000000000000000000"
  );
}

export interface BowSuite {
  entrypoint: Address;
  poolEth: Address;
  poolVeil: Address | "";
}

/** Chain-aware 0xbow suite selector. Returns null when the suite is absent. */
export function getBowSuite(chainId: number | null): BowSuite | null {
  if (chainId === TESTNET_CHAIN_ID && isTestnetBowConfigured()) {
    return { entrypoint: TESTNET_0XBOW.entrypointProxy, poolEth: TESTNET_0XBOW.pool, poolVeil: "" };
  }
  if (chainId === MAINNET_CHAIN_ID && isMainnetBowConfigured()) {
    return {
      entrypoint: MAINNET_0XBOW.entrypoint,
      poolEth: MAINNET_0XBOW.poolEth,
      poolVeil: MAINNET_0XBOW.poolVeil,
    };
  }
  return null;
}

export function getTestnetPoolAddress(): Address {
  return TESTNET_0XBOW.pool;
}

export function getTestnetEntrypointAddress(): Address {
  return TESTNET_0XBOW.entrypointProxy;
}

// 0xbow Privacy Pools TESTNET 46630 fresh suite v3.
// Sourced from deployments/suite-v3-testnet-latest.json (entrypoint proxy
// with ETH + VEIL pools, maxRelayFeeBPS 100). Full-ZK cutover: every NEW
// deposit and every 0xbow relay-withdraw goes through this suite.
// Same env-override pattern as TESTNET_0XBOW above. TESTNET ONLY.
export const TESTNET_BOW_V3_ENTRYPOINT =
  (process.env.NEXT_PUBLIC_BOW_V3_ENTRYPOINT as Address | undefined) ||
  ("0xb68c3d25e5e9902363e8e10d5c0a471e65be8152" as Address);
export const TESTNET_BOW_V3_ETH_POOL =
  (process.env.NEXT_PUBLIC_BOW_V3_ETH_POOL as Address | undefined) ||
  ("0xea48e6a7ae296ebbd7d58792091b8087032d3aa4" as Address);
export const TESTNET_BOW_V3_VEIL_POOL =
  (process.env.NEXT_PUBLIC_BOW_V3_VEIL_POOL as Address | undefined) ||
  ("0xae2c219e462ca1b80473375bcbcad2b025cae610" as Address);
export const TESTNET_BOW_V3_VEIL_TOKEN =
  (process.env.NEXT_PUBLIC_BOW_V3_VEIL_TOKEN as Address | undefined) ||
  ("0x019086f63407fadf0ccb89516e465baef5031aa9" as Address);
// 0xbow NATIVE_ASSET sentinel for the ETH pool (NOT address(0)).
export const TESTNET_BOW_V3_NATIVE_ASSET =
  (process.env.NEXT_PUBLIC_BOW_V3_NATIVE_ASSET as Address | undefined) ||
  ("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address);
// ETH-pool registration minimum (parseEther("0.001") at deploy).
export const TESTNET_BOW_V3_ETH_DENOMINATION = 1000000000000000n;
// VEIL-pool FIXED denomination: identical 0.001 constant in the audited
// contracts. This is the exact deposit value, NOT the entrypoint
// minimumDeposit anti-dust floor (currently 0.0001) — confusing the two
// reverts every flow with InvalidDenomination.
export const TESTNET_BOW_V3_VEIL_DENOMINATION = 1000000000000000n;
// VEIL-pool FIXED denomination (0xbow DEPOSIT_DENOMINATION constant, both
// pools). This is the exact deposit value, NOT the entrypoint minimumDeposit
// anti-dust floor — confusing the two reverts every flow with
// InvalidDenomination.

/** True when every v3 suite address is a valid non-zero hex address. */
export function isTestnetBowV3Configured(): boolean {
  return [TESTNET_BOW_V3_ENTRYPOINT, TESTNET_BOW_V3_ETH_POOL, TESTNET_BOW_V3_VEIL_POOL].every(
    (addr) => isHexAddress(addr) && addr !== "0x0000000000000000000000000000000000000000"
  );
}
