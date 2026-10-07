import { defineChain } from "viem";

export const robinhoodMainnet = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
        (process.env.NEXT_PUBLIC_RPC_URL && !process.env.NEXT_PUBLIC_RPC_URL.includes("testnet")
          ? process.env.NEXT_PUBLIC_RPC_URL
          : "https://rpc.mainnet.chain.robinhood.com"),
      ],
    },
    public: {
      http: ["https://rpc.mainnet.chain.robinhood.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://explorer.mainnet.chain.robinhood.com",
    },
  },
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_TESTNET_RPC_URL ||
        (process.env.NEXT_PUBLIC_RPC_URL && !process.env.NEXT_PUBLIC_RPC_URL.includes("mainnet")
          ? process.env.NEXT_PUBLIC_RPC_URL
          : "https://rpc.testnet.chain.robinhood.com"),
      ],
    },
    public: {
      http: ["https://rpc.testnet.chain.robinhood.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
});

// App network selection. Set NEXT_PUBLIC_CHAIN_ID=46630 to run the whole
// app (wallet, balances, contracts, trade) against Robinhood Testnet.
export const APP_CHAIN_ID =
  process.env.NEXT_PUBLIC_CHAIN_ID === "46630" ? 46630 : 4663;

export const appChain = APP_CHAIN_ID === 46630 ? robinhoodTestnet : robinhoodMainnet;

export function isTestnetMode(): boolean {
  return APP_CHAIN_ID === 46630;
}

export function explorerTxUrl(hash: string): string {
  return `${appChain.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${appChain.blockExplorers.default.url}/address/${address}`;
}

export const V4_MAINNET_POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951" as const;
export const V4_MAINNET_POSITION_MANAGER = "0x58daec3116aae6d93017baaea7749052e8a04fa7" as const;
export const V4_MAINNET_STATE_VIEW = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b" as const;
export const V4_MAINNET_PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
export const V4_MAINNET_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const;
