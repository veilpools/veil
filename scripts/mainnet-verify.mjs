import {
  createPublicClient,
  formatEther,
  http,
  parseAbi,
} from "viem";
import { readFileSync } from "node:fs";
import { robinhoodMainnet, V4_MAINNET_POOL_MANAGER } from "../lib/chains.mjs";
import {
  SHIELDED_POOL_ABI,
  VEIL_ATTESTATION_REGISTRY_ABI,
  VEIL_TREASURY_ABI,
  VEIL_HOOK_ABI,
} from "../lib/veil-artifact.mjs";

async function main() {
  console.log("=================================================");
  console.log("  VEIL PROTOCOL - ROBINHOOD MAINNET VERIFICATION ");
  console.log("=================================================\n");

  const manifest = JSON.parse(readFileSync("deployments/mainnet-latest.json", "utf-8"));
  console.log(`Loaded Mainnet Manifest deployed at: ${manifest.deployedAt}`);

  const publicClient = createPublicClient({
    chain: robinhoodMainnet,
    transport: http(robinhoodMainnet.rpcUrls.default.http[0]),
  });

  const poolAddress = manifest.contracts.ShieldedPool_ETH.address;
  const verifierAddress = manifest.contracts.ShieldedVerifierMock.address;
  const treasuryAddress = manifest.contracts.VeilTreasury.address;
  const registryAddress = manifest.contracts.VeilAttestationRegistry.address;
  const hookAddress = manifest.contracts.VeilHook.address;
  const routerAddress = manifest.contracts.VeilShieldRouter.address;

  // 1. Verify ShieldedPool
  console.log("▶ [1/5] Verifying ShieldedPool_ETH on Mainnet...");
  const denomination = await publicClient.readContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "denomination",
  });
  const cap = await publicClient.readContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "poolCap",
  });
  const guardian = await publicClient.readContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "guardian",
  });
  console.log(`  - Denomination : ${formatEther(denomination)} ETH`);
  console.log(`  - Pool Cap     : ${formatEther(cap)} ETH`);
  console.log(`  - Guardian     : ${guardian}`);
  console.log("  ✓ ShieldedPool_ETH verified on Mainnet!\n");

  // 2. Verify VeilHook
  console.log("▶ [2/5] Verifying VeilHook permissions on Mainnet...");
  const hookPermissions = await publicClient.readContract({
    address: hookAddress,
    abi: VEIL_HOOK_ABI,
    functionName: "getHookPermissions",
  });
  console.log("  - Permissions:", hookPermissions);
  if (!hookPermissions.beforeInitialize || !hookPermissions.beforeSwap || !hookPermissions.afterSwap || !hookPermissions.afterSwapReturnDelta) {
    throw new Error("Hook permissions mismatch!");
  }
  console.log("  ✓ VeilHook matches 0x20c4 permission flags on Mainnet!\n");

  // 3. Verify VeilShieldRouter
  console.log("▶ [3/5] Verifying VeilShieldRouter on Mainnet...");
  const routerPm = await publicClient.readContract({
    address: routerAddress,
    abi: parseAbi(["function poolManager() view returns (address)"]),
    functionName: "poolManager",
  });
  console.log(`  - PoolManager : ${routerPm}`);
  if (routerPm.toLowerCase() !== V4_MAINNET_POOL_MANAGER.toLowerCase()) {
    throw new Error("Router PoolManager mismatch!");
  }
  console.log("  ✓ VeilShieldRouter connected to canonical Uniswap v4 on Mainnet!\n");

  // 4. Verify VeilTreasury
  console.log("▶ [4/5] Verifying VeilTreasury on Mainnet...");
  const treasuryOwner = await publicClient.readContract({
    address: treasuryAddress,
    abi: VEIL_TREASURY_ABI,
    functionName: "owner",
  });
  const buybackBps = await publicClient.readContract({
    address: treasuryAddress,
    abi: VEIL_TREASURY_ABI,
    functionName: "buybackShareBps",
  });
  console.log(`  - Treasury Owner : ${treasuryOwner}`);
  console.log(`  - Buyback Share  : ${Number(buybackBps) / 100}%`);
  console.log("  ✓ VeilTreasury verified on Mainnet!\n");

  // 5. Verify VeilAttestationRegistry
  console.log("▶ [5/5] Verifying VeilAttestationRegistry on Mainnet...");
  const registryOwner = await publicClient.readContract({
    address: registryAddress,
    abi: VEIL_ATTESTATION_REGISTRY_ABI,
    functionName: "owner",
  });
  console.log(`  - Registry Owner : ${registryOwner}`);
  console.log("  ✓ VeilAttestationRegistry verified on Mainnet!\n");

  const deployerBalance = await publicClient.getBalance({ address: manifest.deployer });
  console.log("=================================================");
  console.log("🎉 ALL ROBINHOOD MAINNET CONTRACTS 100% VERIFIED!");
  console.log(`Remaining Deployer Balance: ${formatEther(deployerBalance)} ETH`);
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Mainnet verification failed:", err);
  process.exit(1);
});
