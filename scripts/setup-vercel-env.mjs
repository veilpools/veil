import { execSync } from "child_process";

const envVars = [
  { key: "NEXT_PUBLIC_CHAIN_ID", value: "4663" },
  { key: "NEXT_PUBLIC_RPC_URL", value: "https://rpc.mainnet.chain.robinhood.com" },
  { key: "NEXT_PUBLIC_V4_POOL_MANAGER", value: "0x8366a39CC670B4001A1121B8F6A443A643e40951" },
  { key: "NEXT_PUBLIC_V4_POSITION_MANAGER", value: "0x58daec3116aae6d93017baaea7749052e8a04fa7" },
  { key: "NEXT_PUBLIC_V4_STATE_VIEW", value: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b" },
  { key: "NEXT_PUBLIC_V4_PERMIT2", value: "0x000000000022D473030F116dDEE9F6B43aC78BA3" },
  { key: "NEXT_PUBLIC_WETH", value: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" },
  { key: "NEXT_PUBLIC_VEIL_CREATE2_DEPLOYER", value: "0x3d1613651c366ce53fd64bada154d1b951b9233f" },
  { key: "NEXT_PUBLIC_SHIELDED_VERIFIER", value: "0x12b20b346342d2fc5272f0f708bcd5abaac480fb" },
  { key: "NEXT_PUBLIC_PRIVACY_POOL_ETH", value: "0x3c4700360e23aa2d4671605f35e0fa1d354bc41b" },
  { key: "NEXT_PUBLIC_VEIL_TREASURY", value: "0x1b631ab61b99b364e3a880bd43adfe1b665bce16" },
  { key: "NEXT_PUBLIC_VEIL_ATTESTATION_REGISTRY", value: "0x411fb0c695152ea02ef48b96940c2b2fef656b7c" },
  { key: "NEXT_PUBLIC_VEIL_HOOK", value: "0x5b2e52fe4f54327d8272327d12e47cba834360c4" },
  { key: "NEXT_PUBLIC_VEIL_SHIELD_ROUTER", value: "0xdce5cf65038f092c283449fda44e23d8820d717f" },
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
