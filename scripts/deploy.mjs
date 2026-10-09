import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  formatEther,
  http,
  parseAbi,
  parseAbiParameters,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  robinhoodMainnet,
  robinhoodTestnet,
  V4_MAINNET_POOL_MANAGER,
  V4_MAINNET_POSITION_MANAGER,
  V4_MAINNET_STATE_VIEW,
  V4_MAINNET_PERMIT2,
  V4_MAINNET_WETH,
} from "../lib/chains.mjs";
import {
  SHIELDED_VERIFIER_MOCK_ABI,
  SHIELDED_VERIFIER_MOCK_BYTECODE,
  SHIELDED_POOL_ABI,
  SHIELDED_POOL_BYTECODE,
  VEIL_TREASURY_ABI,
  VEIL_TREASURY_BYTECODE,
  VEIL_ATTESTATION_REGISTRY_ABI,
  VEIL_ATTESTATION_REGISTRY_BYTECODE,
  VEIL_SHIELD_ROUTER_ABI,
  VEIL_SHIELD_ROUTER_BYTECODE,
  VEIL_CREATE2_DEPLOYER_ABI,
  VEIL_CREATE2_DEPLOYER_BYTECODE,
} from "../lib/veil-artifact.mjs";
import { mineHookSalt } from "./mine-hook.mjs";

const isMainnet = process.argv.includes("--mainnet");
const isTestnet = process.argv.includes("--testnet");
if (isMainnet) {
  console.error(
    "REFUSING --mainnet: the legacy Mock suite must not be redeployed. " +
      "Mainnet uses the 0xbow migration instead: pnpm migrate:mainnet:dry, then pnpm migrate:mainnet once funded. " +
      "See docs/MAINNET_RUNBOOK.md §3."
  );
  process.exit(1);
}
const chain = isMainnet ? robinhoodMainnet : robinhoodTestnet;
const networkName = isMainnet ? "mainnet" : "testnet";

console.log(`=== Deploying Veil Protocol to ${chain.name} (Chain ID: ${chain.id}) ===`);

const env = {};
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$|^'|'$/g, "");
  }
}

const privateKey = process.env.PRIVATE_KEY || env.PRIVATE_KEY;
const defaultRpc = chain.rpcUrls.default.http[0];
const rpcUrl = isMainnet
  ? (process.env.MAINNET_RPC_URL || (env.NEXT_PUBLIC_CHAIN_ID === "4663" ? env.NEXT_PUBLIC_RPC_URL : defaultRpc))
  : (process.env.RPC_URL || env.NEXT_PUBLIC_RPC_URL || defaultRpc);

const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

async function main() {
  if (!privateKey) {
    console.log("No PRIVATE_KEY provided. Running in simulation / plan verification mode.");
    console.log("Network:", chain.name);
    console.log("RPC:", rpcUrl);
    console.log("Uniswap V4 PoolManager:", V4_MAINNET_POOL_MANAGER);
    console.log("Ready to execute deployment once private key is configured.");
    return;
  }

  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  console.log("Deployer Address:", account.address);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer Balance: ${formatEther(balance)} ETH`);
  if (balance === 0n) throw new Error("Deployer balance is zero.");

  const deploymentId = new Date().toISOString().replaceAll(":", "-");
  const manifestPath = `deployments/robinhood-${networkName}-${deploymentId}.json`;
  mkdirSync("deployments", { recursive: true });

  const manifest = {
    network: chain.name,
    chainId: chain.id,
    deployedAt: new Date().toISOString(),
    deployer: account.address,
    contracts: {},
    status: "in_progress",
  };

  const deploy = async (name, abi, bytecode, args = []) => {
    console.log(`Deploying ${name}...`);
    const hash = await wallet.deployContract({ abi, bytecode, args });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success" || !receipt.contractAddress) {
      throw new Error(`${name} deployment failed: ${hash}`);
    }
    console.log(`✓ ${name}: ${receipt.contractAddress} (tx: ${hash})`);
    manifest.contracts[name] = {
      address: receipt.contractAddress,
      tx: hash,
      blockNumber: Number(receipt.blockNumber),
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return receipt.contractAddress;
  };

  // 1. Deploy Create2 Deployer
  const create2Deployer = await deploy("VeilCreate2Deployer", VEIL_CREATE2_DEPLOYER_ABI, VEIL_CREATE2_DEPLOYER_BYTECODE);

  // 2. Deploy Mock Verifier
  const verifier = await deploy("ShieldedVerifierMock", SHIELDED_VERIFIER_MOCK_ABI, SHIELDED_VERIFIER_MOCK_BYTECODE);

  // 3. Deploy ShieldedPool for ETH (0.001 ETH denomination, 10 ETH cap)
  const denomination = parseEther("0.001");
  const cap = parseEther("10");
  const associationRoot = "0x2188824287183927522224640574525727508854836440041603434369820418";
  const pool = await deploy("ShieldedPool_ETH", SHIELDED_POOL_ABI, SHIELDED_POOL_BYTECODE, [
    "0x0000000000000000000000000000000000000000",
    verifier,
    denomination,
    cap,
    associationRoot,
    account.address,
  ]);

  // 4. Deploy VeilTreasury
  const treasury = await deploy("VeilTreasury", VEIL_TREASURY_ABI, VEIL_TREASURY_BYTECODE, [
    account.address,
    "0x0000000000000000000000000000000000000000",
  ]);

  // 5. Deploy VeilAttestationRegistry
  const registry = await deploy(
    "VeilAttestationRegistry",
    VEIL_ATTESTATION_REGISTRY_ABI,
    VEIL_ATTESTATION_REGISTRY_BYTECODE,
    [account.address]
  );

  // 6. Mine & Deploy VeilHook via CREATE2
  const poolManagerAddress = V4_MAINNET_POOL_MANAGER;
  const { salt, address: hookAddress, initCode } = mineHookSalt(
    create2Deployer,
    poolManagerAddress,
    treasury,
    registry,
    account.address
  );
  console.log(`Deploying mined VeilHook to ${hookAddress}...`);
  const create2Abi = parseAbi(["function deploy(bytes32 salt, bytes initCode) returns (address deployed)"]);
  const hookTx = await wallet.writeContract({
    address: create2Deployer,
    abi: create2Abi,
    functionName: "deploy",
    args: [salt, initCode],
  });
  const hookReceipt = await publicClient.waitForTransactionReceipt({ hash: hookTx });
  console.log(`✓ VeilHook deployed at ${hookAddress} (tx: ${hookTx})`);
  manifest.contracts["VeilHook"] = {
    address: hookAddress,
    tx: hookTx,
    blockNumber: Number(hookReceipt.blockNumber),
    salt,
  };

  // 7. Deploy VeilShieldRouter
  const router = await deploy("VeilShieldRouter", VEIL_SHIELD_ROUTER_ABI, VEIL_SHIELD_ROUTER_BYTECODE, [
    poolManagerAddress,
  ]);

  manifest.status = "completed";
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  writeFileSync(`deployments/${networkName}-latest.json`, JSON.stringify(manifest, null, 2));
  console.log(`\n🎉 Deployment Complete! Manifest written to ${manifestPath}`);

  // Write env output
  const updatedEnv = `NEXT_PUBLIC_CHAIN_ID=${chain.id}
NEXT_PUBLIC_RPC_URL=${rpcUrl}
PRIVATE_KEY=${privateKey}
DEPLOYER_ADDRESS=${account.address}

# Canonical Uniswap V4 Dependencies on Robinhood Chain
NEXT_PUBLIC_V4_POOL_MANAGER=${poolManagerAddress}
NEXT_PUBLIC_V4_POSITION_MANAGER=${V4_MAINNET_POSITION_MANAGER}
NEXT_PUBLIC_V4_STATE_VIEW=${V4_MAINNET_STATE_VIEW}
NEXT_PUBLIC_V4_PERMIT2=${V4_MAINNET_PERMIT2}
NEXT_PUBLIC_WETH=${V4_MAINNET_WETH}

# Live Veil Protocol Deployments
NEXT_PUBLIC_VEIL_CREATE2_DEPLOYER=${create2Deployer}
NEXT_PUBLIC_SHIELDED_VERIFIER=${verifier}
NEXT_PUBLIC_PRIVACY_POOL_ETH=${pool}
NEXT_PUBLIC_VEIL_TREASURY=${treasury}
NEXT_PUBLIC_VEIL_ATTESTATION_REGISTRY=${registry}
NEXT_PUBLIC_VEIL_HOOK=${hookAddress}
NEXT_PUBLIC_VEIL_SHIELD_ROUTER=${router}
`;

  if (isMainnet) {
    writeFileSync(".env.mainnet.local", updatedEnv);
    writeFileSync(".env.local", updatedEnv);
    console.log("✓ Updated .env.local and .env.mainnet.local with live mainnet deployed addresses");
  } else {
    writeFileSync(".env.local", updatedEnv);
    console.log("✓ Updated .env.local with live deployed addresses");
  }
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
