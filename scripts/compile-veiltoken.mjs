// Compiles VeilToken WITHOUT viaIR so Blockscout standard-json verification
// reproduces the exact bytecode. Writes deployments/veiltoken-artifact.json.
import { readFileSync, writeFileSync } from "node:fs";
import solc from "solc";

const sources = {
  "VeilToken.sol": { content: readFileSync("contracts/VeilToken.sol", "utf8") },
};

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const out = JSON.parse(
  solc.compile(JSON.stringify(input), {
    import(path) {
      if (path.startsWith("@openzeppelin/")) {
        try {
          return { contents: readFileSync(`node_modules/${path}`, "utf8") };
        } catch {
          return { error: `Unable to resolve ${path}` };
        }
      }
      const local = path.replace(/^\.\//, "");
      if (sources[local]) return { contents: sources[local].content };
      return { error: `Unable to resolve ${path}` };
    },
  })
);

const errors = (out.errors ?? []).filter((e) => e.severity === "error");
if (errors.length > 0) {
  for (const e of errors) console.error(e.formattedMessage);
  process.exit(1);
}

const c = out.contracts["VeilToken.sol"]["VeilToken"];
writeFileSync(
  "deployments/veiltoken-artifact.json",
  JSON.stringify({ abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` }, null, 2)
);
console.log("VeilToken compiled without viaIR, artifact written.");
