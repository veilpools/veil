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
// Env vars override these defaults; there are no stale fallbacks.
export const CONTRACT_ADDRESSES = {
  router: process.env.NEXT_PUBLIC_VEIL_SHIELD_ROUTER || "0xdce5cf65038f092c283449fda44e23d8820d717f",
  hook: process.env.NEXT_PUBLIC_VEIL_HOOK || "0x5b2e52fe4f54327d8272327d12e47cba834360c4",
  poolEth: process.env.NEXT_PUBLIC_PRIVACY_POOL_ETH || "0x3c4700360e23aa2d4671605f35e0fa1d354bc41b",
  treasury: process.env.NEXT_PUBLIC_VEIL_TREASURY || "0x1b631ab61b99b364e3a880bd43adfe1b665bce16",
  registry: process.env.NEXT_PUBLIC_VEIL_ATTESTATION_REGISTRY || "0x411fb0c695152ea02ef48b96940c2b2fef656b7c",
  verifier: process.env.NEXT_PUBLIC_SHIELDED_VERIFIER || "0x12b20b346342d2fc5272f0f708bcd5abaac480fb",
  deployer: process.env.NEXT_PUBLIC_VEIL_CREATE2_DEPLOYER || "0x3d1613651c366ce53fd64bada154d1b951b9233f",
} as const;
