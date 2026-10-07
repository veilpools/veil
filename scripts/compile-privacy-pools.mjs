import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const require = createRequire(import.meta.url);

// Pin solc to 0.8.28 to match vendor (pragma 0.8.28 exact) and kentir.
// veil package.json ships solc 0.8.37 which rejects exact 0.8.28 sources,
// so prefer kentir's pinned solc without modifying veil package.json.
let solc;
const candidates = [
  "D:\\Project\\wealthypeople\\kentir\\node_modules\\solc",
  "solc",
];
let loadedFrom = "";
for (const name of candidates) {
  try {
    const mod = require(name);
    const v = mod.version();
    if (v.startsWith("0.8.28")) {
      solc = mod;
      loadedFrom = name;
      break;
    }
  } catch {}
}
if (!solc) {
  const local = require("solc");
  throw new Error(
    `Pinned solc 0.8.28 required (vendor pragma 0.8.28 exact); loaded ${local.version()} from veil. ` +
      `Install kentir deps or provide solc 0.8.28.`
  );
}

const sources = [
  "vendor/0xbow-privacy-pools-core-v1.2.1/contracts-src/contracts/Entrypoint.sol",
  "node_modules/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol",
  "vendor/0xbow-privacy-pools-core-v1.2.1/contracts-src/contracts/implementations/PrivacyPoolSimple.sol",
  "contracts/VeilTestnetPrivacyPool.sol",
  "contracts/VeilTestnetPrivacyPoolERC20.sol",
  "vendor/0xbow-privacy-pools-core-v1.2.1/contracts-src/contracts/verifiers/WithdrawalVerifier.sol",
  "vendor/0xbow-privacy-pools-core-v1.2.1/contracts-src/contracts/verifiers/CommitmentVerifier.sol",
];
const remappings = [
  "contracts/=vendor/0xbow-privacy-pools-core-v1.2.1/contracts-src/contracts/",
  "interfaces/=vendor/0xbow-privacy-pools-core-v1.2.1/contracts-src/interfaces/",
  "@oz/=node_modules/@openzeppelin/contracts/",
  "@oz-upgradeable/=node_modules/@openzeppelin/contracts-upgradeable/",
  "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/",
  "lean-imt/=node_modules/@zk-kit/lean-imt.sol/",
  "poseidon-solidity/=node_modules/poseidon-solidity/",
  "poseidon/=node_modules/poseidon-solidity/",
];
const input = {
  language: "Solidity",
  sources: Object.fromEntries(sources.map((path) => [path, { content: readFileSync(join(root, path), "utf8") }])),
  settings: {
    remappings,
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.bytecode.linkReferences", "metadata"] } },
  },
};
const KENTIR_ROOT = "D:\\Project\\wealthypeople\\kentir";
const output = JSON.parse(
  solc.compile(JSON.stringify(input), {
    import(path) {
      const sourcePath = path.replaceAll("\\", "/");
      const remapping = remappings.find((item) => sourcePath.startsWith(item.split("=")[0]));
      const candidates = [];
      if (remapping) {
        candidates.push(join(root, remapping.split("=")[1], sourcePath.slice(remapping.split("=")[0].length)));
        // Fallback to kentir for deps veil does not install (e.g. contracts-upgradeable).
        // package.json must not be modified, so resolve read-only from kentir.
        candidates.push(join(KENTIR_ROOT, remapping.split("=")[1], sourcePath.slice(remapping.split("=")[0].length)));
      } else {
        candidates.push(join(root, sourcePath));
      }
      // Bare node_modules imports (e.g. @oz-upgradeable/...) also try kentir.
      if (sourcePath.startsWith("node_modules/")) {
        candidates.push(join(KENTIR_ROOT, sourcePath));
      }
      for (const resolved of candidates) {
        try {
          return { contents: readFileSync(resolved, "utf8") };
        } catch {}
      }
      return { error: `Unable to resolve Solidity import: ${path}` };
    },
  })
);
const errors = (output.errors ?? []).filter((entry) => entry.severity === "error");
if (errors.length) {
  console.error(errors.map((entry) => entry.formattedMessage).join("\n"));
  process.exit(1);
}
const outDir = join(root, "artifacts/privacy-pools-testnet");
mkdirSync(outDir, { recursive: true });
const wanted = new Set([
  "WithdrawalVerifier",
  "CommitmentVerifier",
  "Entrypoint",
  "ERC1967Proxy",
  "VeilTestnetPrivacyPool",
  "VeilTestnetPrivacyPoolERC20",
  "PrivacyPoolSimple",
  "PoseidonT3",
  "PoseidonT4",
]);
for (const [sourceName, contracts] of Object.entries(output.contracts ?? {})) {
  for (const [contractName, artifact] of Object.entries(contracts)) {
    if (!artifact.evm.bytecode.object) continue;
    const outputName = sourceName.endsWith("/WithdrawalVerifier.sol")
      ? "WithdrawalVerifier"
      : sourceName.endsWith("/CommitmentVerifier.sol")
        ? "CommitmentVerifier"
        : contractName;
    if (!wanted.has(outputName)) continue;
    const path = join(outDir, `${outputName}.json`);
    writeFileSync(
      path,
      JSON.stringify(
        {
          contractName,
          outputName,
          sourceName,
          abi: artifact.abi,
          bytecode: `0x${artifact.evm.bytecode.object}`,
          linkReferences: artifact.evm.bytecode.linkReferences,
          metadata: artifact.metadata,
        },
        null,
        2
      ) + "\n"
    );
  }
}
console.log(`Compiled pinned privacy pool contracts with solc ${solc.version()} (from ${loadedFrom}) into ${outDir}`);
