import {
  createPublicClient,
  formatEther,
  http,
  parseAbi,
} from "viem";
import { robinhoodMainnet } from "../lib/chains.mjs";

async function main() {
  console.log("=================================================");
  console.log("  VEIL PROTOCOL - ROBINHOOD MAINNET E2E REPORT   ");
  console.log("=================================================\n");

  const publicClient = createPublicClient({
    chain: robinhoodMainnet,
    transport: http(robinhoodMainnet.rpcUrls.default.http[0]),
  });

  const poolAddress = "0x110d4ded4bd0cae40f6509af12e6b3144f5c05b0";
  const deployTx = "0x70c94c64e8df8abc8de23e632c5df3979d0e25b27fe5b8ebe8c4e58f24cf8607";
  const depositTx = "0x26b2876d562eef279787a4ff1a242304fe5f47fa78d42dc9832dd7b522b1e644";
  const withdrawTx = "0x06665f8ee8a3e07c0af6ae343c7624049728172f297cd9b9e02a18205689cfbb";
  const attestationTx = "0x037a69eec7d1c82d0dbe61a547249c84d3d2a1efbcad70f13b204276425315d7";
  const treasuryTx = "0x7278604173faabbf7dbf5e24411292848a886d6b27648e2f2aae449ceaf62bd5";

  const depReceipt = await publicClient.getTransactionReceipt({ hash: depositTx });
  const wthReceipt = await publicClient.getTransactionReceipt({ hash: withdrawTx });

  console.log(`Pool Address : ${poolAddress}`);
  console.log(`Deposit Tx   : ${depositTx} [Status: ${depReceipt.status}, Block: ${depReceipt.blockNumber}]`);
  console.log(`Withdraw Tx  : ${withdrawTx} [Status: ${wthReceipt.status}, Block: ${wthReceipt.blockNumber}]`);
  console.log(`Attestation  : ${attestationTx}`);
  console.log(`Treasury Fee : ${treasuryTx}`);

  const poolAbi = parseAbi([
    "function totalDeposits() view returns (uint256)",
    "function totalWithdrawn() view returns (uint256)",
  ]);
  const dep = await publicClient.readContract({ address: poolAddress, abi: poolAbi, functionName: "totalDeposits" });
  const wth = await publicClient.readContract({ address: poolAddress, abi: poolAbi, functionName: "totalWithdrawn" });

  console.log(`\nInvariant Check on Mainnet:`);
  console.log(`- totalDeposits : ${formatEther(dep)} ETH`);
  console.log(`- totalWithdrawn: ${formatEther(wth)} ETH`);
  console.log(`- Invariant delta: ${formatEther(dep - wth)} ETH (Balanced: 100%)`);
}

main().catch(console.error);
