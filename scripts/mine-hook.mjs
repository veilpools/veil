import {
  encodeAbiParameters,
  encodePacked,
  keccak256,
  numberToHex,
  parseAbiParameters,
  concatHex,
} from "viem";
import { VEIL_HOOK_BYTECODE } from "../lib/veil-artifact.mjs";

// Wanted Uniswap v4 permissions:
// beforeInitialize (1 << 13) = 0x2000
// beforeSwap (1 << 7)       = 0x0080
// afterSwap (1 << 6)        = 0x0040
// afterSwapReturnDelta (1 << 2) = 0x0004
// Total: 0x20C4
export const WANTED_FLAGS = 0x20c4n;
export const PERMISSION_MASK = (1n << 14n) - 1n; // 0x3FFF

export function mineHookSalt(
  deployerAddress,
  managerAddress,
  treasuryAddress,
  registryAddress,
  ownerAddress,
  maxIterations = 2_000_000
) {
  const constructorArgs = encodeAbiParameters(
    parseAbiParameters("address _manager, address _treasury, address _registry, address _owner"),
    [managerAddress, treasuryAddress, registryAddress, ownerAddress]
  );
  const initCode = concatHex([VEIL_HOOK_BYTECODE, constructorArgs]);
  const initCodeHash = keccak256(initCode);

  console.log(`Mining hook salt with deployer ${deployerAddress}...`);
  console.log(`Target permission bits: 0x${WANTED_FLAGS.toString(16)} (mask: 0x${PERMISSION_MASK.toString(16)})`);

  for (let i = 0; i < maxIterations; i++) {
    const salt = numberToHex(BigInt(i), { size: 32 });
    const candidate = keccak256(
      encodePacked(["bytes1", "address", "bytes32", "bytes32"], ["0xff", deployerAddress, salt, initCodeHash])
    );
    const candidateAddress = `0x${candidate.slice(-40)}`;

    if ((BigInt(candidateAddress) & PERMISSION_MASK) === WANTED_FLAGS) {
      console.log(`✓ Match found at iteration ${i}!`);
      console.log(`  Salt:    ${salt}`);
      console.log(`  Address: ${candidateAddress}`);
      return { salt, address: candidateAddress, initCode };
    }
  }

  throw new Error(`Failed to mine hook salt within ${maxIterations} iterations.`);
}

// Allow direct CLI execution: node scripts/mine-hook.mjs <deployer> <manager> <treasury> <registry> <owner>
if (process.argv[1]?.endsWith("mine-hook.mjs")) {
  const [
    deployer = "0xefcb390b33d5edc90f0bf1039f94e53fb18c7346",
    manager = "0x8366a39CC670B4001A1121B8F6A443A643e40951",
    treasury = "0xCdbdc82A021071eE445d9f897433a7E4B4EAfD8d",
    registry = "0x1111111111111111111111111111111111111111",
    owner = "0xCdbdc82A021071eE445d9f897433a7E4B4EAfD8d",
  ] = process.argv.slice(2);

  const result = mineHookSalt(deployer, manager, treasury, registry, owner);
  console.log("Hook mining verification succeeded:", result.address);
}
