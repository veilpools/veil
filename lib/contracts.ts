import {
  SHIELDED_POOL_ABI,
  SHIELDED_VERIFIER_MOCK_ABI,
  VEIL_HOOK_ABI,
  VEIL_SHIELD_ROUTER_ABI,
  VEIL_TREASURY_ABI,
  VEIL_ATTESTATION_REGISTRY_ABI,
  VEIL_CREATE2_DEPLOYER_ABI,
} from "./veil-artifact";

export const CONTRACT_ABIS = {
  ShieldedPool: SHIELDED_POOL_ABI,
  ShieldedVerifierMock: SHIELDED_VERIFIER_MOCK_ABI,
  VeilHook: VEIL_HOOK_ABI,
  VeilShieldRouter: VEIL_SHIELD_ROUTER_ABI,
  VeilTreasury: VEIL_TREASURY_ABI,
  VeilAttestationRegistry: VEIL_ATTESTATION_REGISTRY_ABI,
  VeilCreate2Deployer: VEIL_CREATE2_DEPLOYER_ABI,
} as const;

// Live Robinhood Mainnet 4663 deployments (deployments/mainnet-latest.json).
// Fresh suite owned by the current deployer. Env vars override these defaults.
export const CONTRACT_ADDRESSES = {
  router: process.env.NEXT_PUBLIC_VEIL_SHIELD_ROUTER || "0x01a05f87c2c227a1b382cbc2e7e63b186538c86d",
  hook: process.env.NEXT_PUBLIC_VEIL_HOOK || "0x9df0b52bf290a13e11c73c56c4c533e3887760c4",
  poolEth: process.env.NEXT_PUBLIC_PRIVACY_POOL_ETH || "0xdd0fb7fc7f1398fd1398a594f7a0ce934caa7ea0",
  treasury: process.env.NEXT_PUBLIC_VEIL_TREASURY || "0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34",
  registry: process.env.NEXT_PUBLIC_VEIL_ATTESTATION_REGISTRY || "0xa7f7e7887a4fa00cc934abe39cdd470cfdc9a855",
  verifier: process.env.NEXT_PUBLIC_SHIELDED_VERIFIER || "0x797e2aa1f3225ab38bfc6441a3f4b44e95158cda",
  deployer: process.env.NEXT_PUBLIC_VEIL_CREATE2_DEPLOYER || "0xe4c3615db1bdeaf7b82b5568bd73f20f5666f008",
  // Temporary VeilToken (mainnet 0xe0e11ec0d62eda12de796d025d6334fadfe5ab2a).
  // Empty until set via NEXT_PUBLIC_VEIL_TOKEN; UI shows "—" and disables VEIL.
  token: process.env.NEXT_PUBLIC_VEIL_TOKEN || "0xe0e11ec0d62eda12de796d025d6334fadfe5ab2a",
} as const;
