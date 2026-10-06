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
      http: [process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.mainnet.chain.robinhood.com"],
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
      http: [process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.chain.robinhood.com"],
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

export const V4_MAINNET_POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
export const V4_MAINNET_POSITION_MANAGER = "0x58daec3116aae6d93017baaea7749052e8a04fa7";
export const V4_MAINNET_STATE_VIEW = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b";
export const V4_MAINNET_PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
export const V4_MAINNET_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
