import { execSync } from "child_process";

const envVars = [
  { key: "NEXT_PUBLIC_CHAIN_ID", value: "4663" },
  { key: "NEXT_PUBLIC_RPC_URL", value: "https://rpc.mainnet.chain.robinhood.com" },
  { key: "NEXT_PUBLIC_V4_POOL_MANAGER", value: "0x8366a39CC670B4001A1121B8F6A443A643e40951" },
  { key: "NEXT_PUBLIC_V4_POSITION_MANAGER", value: "0x58daec3116aae6d93017baaea7749052e8a04fa7" },
  { key: "NEXT_PUBLIC_V4_STATE_VIEW", value: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b" },
  { key: "NEXT_PUBLIC_V4_PERMIT2", value: "0x000000000022D473030F116dDEE9F6B43aC78BA3" },
  { key: "NEXT_PUBLIC_WETH", value: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" },
  { key: "NEXT_PUBLIC_VEIL_CREATE2_DEPLOYER", value: "0xe4c3615db1bdeaf7b82b5568bd73f20f5666f008" },
  { key: "NEXT_PUBLIC_SHIELDED_VERIFIER", value: "0x797e2aa1f3225ab38bfc6441a3f4b44e95158cda" },
  { key: "NEXT_PUBLIC_PRIVACY_POOL_ETH", value: "0xdd0fb7fc7f1398fd1398a594f7a0ce934caa7ea0" },
  { key: "NEXT_PUBLIC_VEIL_TREASURY", value: "0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34" },
  { key: "NEXT_PUBLIC_VEIL_ATTESTATION_REGISTRY", value: "0xa7f7e7887a4fa00cc934abe39cdd470cfdc9a855" },
  { key: "NEXT_PUBLIC_VEIL_HOOK", value: "0x9df0b52bf290a13e11c73c56c4c533e3887760c4" },
  { key: "NEXT_PUBLIC_VEIL_SHIELD_ROUTER", value: "0x01a05f87c2c227a1b382cbc2e7e63b186538c86d" },
  { key: "NEXT_PUBLIC_VEIL_TOKEN", value: "0xe0e11ec0d62eda12de796d025d6334fadfe5ab2a" },
];

console.log(`Setting up ${envVars.length} environment variables on Vercel (Production, Preview, Development)...`);

for (const { key, value } of envVars) {
  process.stdout.write(`Adding ${key}... `);
  try {
    execSync(`npx vercel env add ${key} production,preview,development --value "${value}" --yes --force`, {
      stdio: "pipe",
    });
    console.log("✓ Done");
  } catch (err) {
    console.error(`✗ Error adding ${key}:`, err.message);
  }
}

console.log("\nAll environment variables have been set successfully on Vercel!");
