import { createPublicClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet, robinhoodMainnet } from "../lib/chains.mjs";

const privateKey = "0xf5c33329c4bcc3b612af9a5e1134816782188d1107f54c58a48c236bf744995f";
const account = privateKeyToAccount(privateKey);
console.log("Account Address:", account.address);

const testnetClient = createPublicClient({ chain: robinhoodTestnet, transport: http(robinhoodTestnet.rpcUrls.default.http[0]) });
const mainnetClient = createPublicClient({ chain: robinhoodMainnet, transport: http(robinhoodMainnet.rpcUrls.default.http[0]) });

async function check() {
  try {
    const testnetBal = await testnetClient.getBalance({ address: account.address });
    console.log(`Robinhood Testnet (46630) Balance: ${formatEther(testnetBal)} ETH`);
    const testnetBlock = await testnetClient.getBlockNumber();
    console.log(`Current Testnet Block: ${testnetBlock}`);
  } catch (e) {
    console.error("Testnet check failed:", e.message);
  }

  try {
    const mainnetBal = await mainnetClient.getBalance({ address: account.address });
    console.log(`Robinhood Mainnet (4663) Balance: ${formatEther(mainnetBal)} ETH`);
    const mainnetBlock = await mainnetClient.getBlockNumber();
    console.log(`Current Mainnet Block: ${mainnetBlock}`);
  } catch (e) {
    console.error("Mainnet check failed:", e.message);
  }
}

check();
