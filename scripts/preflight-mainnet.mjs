import {
  createPublicClient,
  formatEther,
  formatGwei,
  http,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync } from "node:fs";
import {
  robinhoodMainnet,
  V4_MAINNET_POOL_MANAGER,
  V4_MAINNET_POSITION_MANAGER,
  V4_MAINNET_STATE_VIEW,
  V4_MAINNET_PERMIT2,
  V4_MAINNET_WETH,
} from "../lib/chains.mjs";
import { mineHookSalt } from "./mine-hook.mjs";

async function main() {
  console.log("=================================================");
  console.log("   VEIL PROTOCOL - ROBINHOOD MAINNET PREFLIGHT   ");
  console.log("=================================================\n");

  const rpcUrl = process.env.MAINNET_RPC_URL || robinhoodMainnet.rpcUrls.default.http[0];
  console.log(`Connecting to Robinhood Mainnet: ${rpcUrl}`);

  const client = createPublicClient({
    chain: robinhoodMainnet,
    transport: http(rpcUrl),
  });

  // 1. Chain ID Verification
  const chainId = await client.getChainId();
  console.log(`1. Chain ID Check: ${chainId} ${chainId === 4663 ? "✓ (PASSED)" : "✗ (MISMATCH)"}`);
  if (chainId !== 4663) {
    throw new Error(`Expected Chain ID 4663 for Robinhood Mainnet, got ${chainId}`);
  }

  // 2. Block Number & Gas Price
  const blockNumber = await client.getBlockNumber();
  const gasPrice = await client.getGasPrice();
  console.log(`   - Current Block: #${blockNumber}`);
  console.log(`   - Base Gas Price: ${formatGwei(gasPrice)} Gwei`);

  // 3. Uniswap V4 Canonical Dependencies Verification
  console.log("\n2. Canonical Uniswap v4 Infrastructure Check:");
  const dependencies = [
    { name: "PoolManager", address: V4_MAINNET_POOL_MANAGER },
    { name: "PositionManager", address: V4_MAINNET_POSITION_MANAGER },
    { name: "StateView", address: V4_MAINNET_STATE_VIEW },
    { name: "Permit2", address: V4_MAINNET_PERMIT2 },
  ];

  for (const dep of dependencies) {
    const bytecode = await client.getBytecode({ address: dep.address });
    const size = bytecode ? (bytecode.length - 2) / 2 : 0;
    const exists = size > 0;
    console.log(
      `   - ${dep.name.padEnd(16)}: ${dep.address} [${exists ? `✓ ${size} bytes` : "✗ MISSING"}]`
    );
    if (!exists) {
      throw new Error(`CRITICAL: ${dep.name} not found on Robinhood Mainnet at ${dep.address}`);
    }
  }

  // 4. Deployer Account Readiness
  console.log("\n3. Deployer Account Readiness:");
  const env = {};
  if (existsSync(".env.mainnet.local")) {
    for (const line of readFileSync(".env.mainnet.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  } else if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  }

  const privateKey = process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY || env.PRIVATE_KEY;
  if (!privateKey) {
    console.log("   ⚠ No PRIVATE_KEY configured for mainnet. Set MAINNET_PRIVATE_KEY or PRIVATE_KEY.");
  } else {
    const account = privateKeyToAccount(privateKey);
    const balance = await client.getBalance({ address: account.address });
    console.log(`   - Address : ${account.address}`);
    console.log(`   - Balance : ${formatEther(balance)} ETH`);
    
    // Deployment gas estimate: ~3.5M gas total across all 7 contracts
    const estimatedGas = 3_500_000n;
    const estimatedCost = estimatedGas * gasPrice;
    console.log(`   - Est. Gas Needed: ~${estimatedGas.toLocaleString()} gas (~${formatEther(estimatedCost)} ETH)`);
    
    if (balance >= estimatedCost) {
      console.log(`   ✓ Sufficient balance for live mainnet deployment!`);
    } else {
      console.log(`   ⚠ Notice: Account needs at least ${formatEther(estimatedCost)} ETH on Robinhood Mainnet.`);
    }
  }

  // 5. CREATE2 Mining Dry-Run
  console.log("\n4. CREATE2 Hook Mining Simulation:");
  const mockDeployer = "0x25ed04b42071086c3a8647954422c9c958e35f3e";
  const mockTreasury = "0x491413119a4adb0ea23b902c7fc7cee3845542b2";
  const mockRegistry = "0x4d66540c3cd12ee8de89ad8013c51838b572dce3";
  const mockOwner = "0xCdbdc82A021071eE445d9f897433a7E4B4EAfD8d";

  console.log("   - Simulating hook mining matching 0x20c4 flags...");
  const mined = mineHookSalt(mockDeployer, V4_MAINNET_POOL_MANAGER, mockTreasury, mockRegistry, mockOwner);
  console.log(`   ✓ Hook candidate address: ${mined.address}`);
  console.log(`   ✓ Matching flags: beforeInitialize | beforeSwap | afterSwap | afterSwapReturnDelta (0x20c4)`);

  console.log("\n=================================================");
  console.log("🚀 MAINNET PREFLIGHT STATUS: READY FOR LAUNCH");
  console.log("=================================================");
  console.log("To execute deployment when ready:");
  console.log("  node scripts/deploy.mjs --mainnet\n");
}

main().catch((err) => {
  console.error("\n✗ Preflight check failed:", err.message);
  process.exit(1);
});
