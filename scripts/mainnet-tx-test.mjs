import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  keccak256,
  parseEther,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { robinhoodMainnet } from "../lib/chains.mjs";
import {
  VEIL_ATTESTATION_REGISTRY_ABI,
  VEIL_TREASURY_ABI,
  VEIL_HOOK_ABI,
} from "../lib/veil-artifact.mjs";

async function main() {
  console.log("=================================================");
  console.log("  VEIL PROTOCOL - LIVE MAINNET ON-CHAIN TX TEST  ");
  console.log("=================================================\n");

  const manifest = JSON.parse(readFileSync("deployments/mainnet-latest.json", "utf-8"));
  const rpcUrl = robinhoodMainnet.rpcUrls.default.http[0];

  const privateKey = process.env.PRIVATE_KEY || "0xf5c33329c4bcc3b612af9a5e1134816782188d1107f54c58a48c236bf744995f";
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: robinhoodMainnet,
    transport: http(rpcUrl),
  });

  const wallet = createWalletClient({
    account,
    chain: robinhoodMainnet,
    transport: http(rpcUrl),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Operator Address : ${account.address}`);
  console.log(`Mainnet Balance  : ${formatEther(balance)} ETH\n`);

  const registryAddress = manifest.contracts.VeilAttestationRegistry.address;
  const treasuryAddress = manifest.contracts.VeilTreasury.address;

  // 1. Execute Real On-Chain Attestation Registration on Mainnet
  console.log("▶ [1/2] Executing live on-chain attestation registration on Mainnet...");
  const testProofRoot = keccak256(toHex("veil-mainnet-launch-attestation-001"));
  const testUser = "0x382F64fc4742c1fF82A5aFbcAc46dBaE2ea64459"; // Clean recipient

  const tx1 = await wallet.writeContract({
    address: registryAddress,
    abi: VEIL_ATTESTATION_REGISTRY_ABI,
    functionName: "registerAttestation",
    args: [testUser, testProofRoot],
  });
  console.log(`  - Submitted Tx: ${tx1}`);
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 });
  console.log(`  ✓ Confirmed in Mainnet block ${receipt1.blockNumber} (gas: ${receipt1.gasUsed})`);

  const isAttested = await publicClient.readContract({
    address: registryAddress,
    abi: VEIL_ATTESTATION_REGISTRY_ABI,
    functionName: "verifyAttestation",
    args: [testUser],
  });
  console.log(`  ✓ On-chain verifyAttestation(${testUser}): ${isAttested}\n`);

  // 2. Execute Real On-Chain Fee Deposit to VeilTreasury on Mainnet
  console.log("▶ [2/2] Executing live on-chain protocol fee transfer to VeilTreasury...");
  const feeAmount = 1000000000000n; // 0.000001 ETH
  const tx2 = await wallet.sendTransaction({
    to: treasuryAddress,
    value: feeAmount,
  });
  console.log(`  - Submitted Tx: ${tx2}`);
  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: tx2 });
  console.log(`  ✓ Confirmed in Mainnet block ${receipt2.blockNumber} (gas: ${receipt2.gasUsed})`);

  const totalFeeReceived = await publicClient.readContract({
    address: treasuryAddress,
    abi: VEIL_TREASURY_ABI,
    functionName: "totalFeeReceived",
  });
  console.log(`  ✓ On-chain VeilTreasury totalFeeReceived: ${totalFeeReceived} wei\n`);

  const balanceAfter = await publicClient.getBalance({ address: account.address });
  console.log("=================================================");
  console.log("🎉 LIVE MAINNET ON-CHAIN TRANSACTIONS CONFIRMED!");
  console.log(`Remaining Deployer Balance: ${formatEther(balanceAfter)} ETH`);
  console.log("=================================================");
  console.log("\nVerified On-Chain Transactions on Robinhood Mainnet Blockscout:");
  console.log(`1. Attestation Registration : https://explorer.mainnet.chain.robinhood.com/tx/${tx1}`);
  console.log(`2. Treasury Fee Receipt     : https://explorer.mainnet.chain.robinhood.com/tx/${tx2}`);
}

main().catch((err) => {
  console.error("Mainnet Tx Test failed:", err);
  process.exit(1);
});
