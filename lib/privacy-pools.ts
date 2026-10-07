import type { Address } from "viem";

// 0xbow Privacy Pools TESTNET 46630 address book.
// Sourced from deployments/privacy-pools-testnet-latest.json (audited v1.2.1 suite).
// Same env-override pattern as lib/contracts.ts. TESTNET ONLY — do not use for mainnet.
export const TESTNET_CHAIN_ID = 46630 as const;

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
    ("0xdd0fb7fc7f1398fd1398a594f7a0ce934caa7ea0" as Address),
  pool:
    (process.env.NEXT_PUBLIC_TESTNET_PRIVACY_POOL as Address | undefined) ||
    ("0x2bea7094f77e3f9a21397c688de8ef105d4848bc" as Address),
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

export function getTestnetPoolAddress(): Address {
  return TESTNET_0XBOW.pool;
}

export function getTestnetEntrypointAddress(): Address {
  return TESTNET_0XBOW.entrypointProxy;
}
