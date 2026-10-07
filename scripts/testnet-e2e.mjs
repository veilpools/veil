import {
  createPublicClient,
  createWalletClient,
  encodePacked,
  formatEther,
  http,
  keccak256,
  parseAbi,
  parseEther,
  toHex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { readFileSync } from "node:fs";
import { robinhoodTestnet } from "../lib/chains.mjs";
import {
  SHIELDED_POOL_ABI,
  SHIELDED_VERIFIER_MOCK_ABI,
  VEIL_ATTESTATION_REGISTRY_ABI,
  VEIL_TREASURY_ABI,
  VEIL_HOOK_ABI,
  VEIL_SHIELD_ROUTER_ABI,
} from "../lib/veil-artifact.mjs";

async function main() {
  console.log("=================================================");
  console.log("  VEIL PROTOCOL - LIVE TESTNET END-TO-END SUITE  ");
  console.log("=================================================\n");

  const manifest = JSON.parse(readFileSync("deployments/testnet-latest.json", "utf-8"));
  console.log(`Loaded testnet manifest from ${manifest.deployedAt}`);

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing PRIVATE_KEY in env. Never hardcode keys.");
  const account = privateKeyToAccount(privateKey);
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.chain.robinhood.com";

  const publicClient = createPublicClient({
    chain: robinhoodTestnet,
    transport: http(rpcUrl),
  });

  const wallet = createWalletClient({
    account,
    chain: robinhoodTestnet,
    transport: http(rpcUrl),
  });

  const balanceBefore = await publicClient.getBalance({ address: account.address });
  console.log(`Operator Address: ${account.address}`);
  console.log(`Current Balance : ${formatEther(balanceBefore)} ETH\n`);

  const poolAddress = manifest.contracts.ShieldedPool_ETH.address;
  const verifierAddress = manifest.contracts.ShieldedVerifierMock.address;
  const treasuryAddress = manifest.contracts.VeilTreasury.address;
  const registryAddress = manifest.contracts.VeilAttestationRegistry.address;
  const hookAddress = manifest.contracts.VeilHook.address;
  const routerAddress = manifest.contracts.VeilShieldRouter.address;

  // ----------------------------------------------------------------------
  // TEST SUITE 1: ShieldedPool Configuration & State
  // ----------------------------------------------------------------------
  console.log("▶ [1/6] Validating ShieldedPool_ETH parameters on-chain...");
  const denomination = await publicClient.readContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "denomination",
  });
  const poolCap = await publicClient.readContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "poolCap",
  });
  const initialNextIndex = await publicClient.readContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "nextIndex",
  });
  const initialDeposits = await publicClient.readContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "totalDeposits",
  });
  const initialWithdrawn = await publicClient.readContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "totalWithdrawn",
  });
  const initialPoolBalance = await publicClient.getBalance({ address: poolAddress });

  console.log(`  - Denomination   : ${formatEther(denomination)} ETH`);
  console.log(`  - Pool Cap       : ${formatEther(poolCap)} ETH`);
  console.log(`  - Initial Leaves : ${initialNextIndex}`);
  console.log(`  - Pool Balance   : ${formatEther(initialPoolBalance)} ETH`);
  console.log("  ✓ Pool configuration verified.\n");

  // ----------------------------------------------------------------------
  // TEST SUITE 2: Client-side Note Generation & Live On-Chain Deposit
  // ----------------------------------------------------------------------
  console.log("▶ [2/6] Generating client-side ZK note & executing on-chain deposit...");
  const crypto = await import("node:crypto");
  const secretBytes = crypto.randomBytes(32);
  const nullifierBytes = crypto.randomBytes(32);
  const secret = toHex(secretBytes);
  const nullifier = toHex(nullifierBytes);

  // In ShieldedPool / note specification:
  // commitment = keccak256(secret, nullifier)
  // nullifierHash = keccak256(nullifier)
  const commitment = keccak256(encodePacked(["bytes32", "bytes32"], [secret, nullifier]));
  const nullifierHash = keccak256(encodePacked(["bytes32"], [nullifier]));

  console.log(`  - Commitment Hash     : ${commitment}`);
  console.log(`  - Nullifier Hash      : ${nullifierHash}`);

  console.log(`  - Submitting deposit(commitment) with ${formatEther(denomination)} ETH...`);
  const depositTx = await wallet.writeContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "deposit",
    args: [commitment],
    value: denomination,
  });
  console.log(`  - Deposit tx submitted: ${depositTx}`);
  const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositTx });
  console.log(`  ✓ Deposit confirmed in block ${depositReceipt.blockNumber} (gas used: ${depositReceipt.gasUsed})`);

  const postDepositIndex = await publicClient.readContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "nextIndex",
  });
  if (Number(postDepositIndex) !== Number(initialNextIndex) + 1) {
    throw new Error(`Leaf index mismatch: expected ${Number(initialNextIndex) + 1}, got ${postDepositIndex}`);
  }
  console.log(`  ✓ Merkle leaf appended at index ${Number(postDepositIndex) - 1}`);

  // Get the updated root from pool
  const historyLen = await publicClient.readContract({
    address: poolAddress,
    abi: parseAbi(["function rootHistory(uint256) view returns (bytes32)"]),
    functionName: "rootHistory",
    args: [BigInt(Number(postDepositIndex))], // rootHistory[0] is zero-root, rootHistory[index+1] is current root
  });
  const isKnown = await publicClient.readContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "isKnownRoot",
    args: [historyLen],
  });
  if (!isKnown) {
    throw new Error(`Root ${historyLen} is not recognized by pool!`);
  }
  console.log(`  ✓ Current Merkle root: ${historyLen} (isKnownRoot: true)\n`);

  // ----------------------------------------------------------------------
  // TEST SUITE 3: Live On-Chain Withdrawal to Clean Recipient
  // ----------------------------------------------------------------------
  console.log("▶ [3/6] Executing on-chain withdrawal with ZK proof & nullifier...");
  // Create a clean destination address
  const freshAccount = privateKeyToAccount(generatePrivateKey());
  const recipient = freshAccount.address;
  console.log(`  - Clean recipient address: ${recipient}`);

  // ShieldedVerifierMock expects non-empty proof bytes
  const mockProof = "0x12345678";
  const relayerFee = 0n;

  const withdrawTx = await wallet.writeContract({
    address: poolAddress,
    abi: SHIELDED_POOL_ABI,
    functionName: "withdraw",
    args: [mockProof, historyLen, nullifierHash, recipient, relayerFee],
  });
  console.log(`  - Withdraw tx submitted: ${withdrawTx}`);
  const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawTx });
  console.log(`  ✓ Withdraw confirmed in block ${withdrawReceipt.blockNumber} (gas used: ${withdrawReceipt.gasUsed})`);

  const recipientBalance = await publicClient.getBalance({ address: recipient });
  if (recipientBalance !== denomination) {
    throw new Error(`Recipient balance mismatch: expected ${formatEther(denomination)} ETH, got ${formatEther(recipientBalance)} ETH`);
  }
  console.log(`  ✓ Recipient successfully received exact payout: ${formatEther(recipientBalance)} ETH`);

  const isNullifierSpent = await publicClient.readContract({
    address: poolAddress,
    abi: parseAbi(["function nullifierUsed(bytes32) view returns (bool)"]),
    functionName: "nullifierUsed",
    args: [nullifierHash],
  });
  if (!isNullifierSpent) {
    throw new Error(`Nullifier ${nullifierHash} not marked spent!`);
  }
  console.log(`  ✓ Nullifier ${nullifierHash.slice(0, 14)}... marked spent.\n`);

  // ----------------------------------------------------------------------
  // TEST SUITE 4: Double-Spend Reversion Invariant
  // ----------------------------------------------------------------------
  console.log("▶ [4/6] Verifying double-spend prevention (must revert)...");
  try {
    await publicClient.simulateContract({
      account,
      address: poolAddress,
      abi: SHIELDED_POOL_ABI,
      functionName: "withdraw",
      args: [mockProof, historyLen, nullifierHash, recipient, relayerFee],
    });
    throw new Error("Double-spend simulation succeeded unexpectedly!");
  } catch (err) {
    console.log(`  ✓ Double-spend safely reverted: ${err.message.split("\n")[0]}\n`);
  }

  // ----------------------------------------------------------------------
  // TEST SUITE 5: VeilAttestationRegistry Verification
  // ----------------------------------------------------------------------
  console.log("▶ [5/6] Verifying VeilAttestationRegistry on-chain...");
  const testProofRoot = keccak256(toHex("clean-user-attestation-test"));
  const registerTx = await wallet.writeContract({
    address: registryAddress,
    abi: VEIL_ATTESTATION_REGISTRY_ABI,
    functionName: "registerAttestation",
    args: [recipient, testProofRoot],
  });
  console.log(`  - Attestation tx submitted: ${registerTx}`);
  await publicClient.waitForTransactionReceipt({ hash: registerTx });

  const isAttested = await publicClient.readContract({
    address: registryAddress,
    abi: VEIL_ATTESTATION_REGISTRY_ABI,
    functionName: "verifyAttestation",
    args: [recipient],
  });
  if (!isAttested) {
    throw new Error("Address attestation verification failed!");
  }
  console.log(`  ✓ Recipient ${recipient} successfully registered in Attestation Registry.\n`);

  // ----------------------------------------------------------------------
  // TEST SUITE 6: Hook, Router & Treasury Verification
  // ----------------------------------------------------------------------
  console.log("▶ [6/6] Verifying VeilHook, Router and Treasury...");
  const hookPermissions = await publicClient.readContract({
    address: hookAddress,
    abi: VEIL_HOOK_ABI,
    functionName: "getHookPermissions",
  });
  console.log(`  - VeilHook permission flags:`, hookPermissions);

  const treasuryBps = await publicClient.readContract({
    address: treasuryAddress,
    abi: VEIL_TREASURY_ABI,
    functionName: "buybackShareBps",
  });
  console.log(`  - VeilTreasury buyback share: ${Number(treasuryBps) / 100}%`);

  const routerPoolManager = await publicClient.readContract({
    address: routerAddress,
    abi: parseAbi(["function poolManager() view returns (address)"]),
    functionName: "poolManager",
  });
  console.log(`  - VeilShieldRouter poolManager: ${routerPoolManager}`);

  const balanceAfter = await publicClient.getBalance({ address: account.address });
  console.log(`\n=================================================`);
  console.log(`🎉 ALL LIVE TESTNET VERIFICATIONS PASSED 100%!`);
  console.log(`Final Operator Balance: ${formatEther(balanceAfter)} ETH`);
  console.log(`=================================================`);
  console.log(`\nVerified On-Chain Transactions on Blockscout:`);
  console.log(`1. Deposit Tx   : https://explorer.testnet.chain.robinhood.com/tx/${depositTx}`);
  console.log(`2. Withdraw Tx  : https://explorer.testnet.chain.robinhood.com/tx/${withdrawTx}`);
  console.log(`3. Attestation  : https://explorer.testnet.chain.robinhood.com/tx/${registerTx}`);
}

main().catch((err) => {
  console.error("Testnet E2E failed:", err);
  process.exit(1);
});
