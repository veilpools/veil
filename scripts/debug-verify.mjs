// Compares local build output against explorer creation bytecode.
import https from "node:https";
import fs from "node:fs";
import solc from "solc";
import { encodeAbiParameters, parseAbiParameters } from "viem";

const ADDR = "0x6f79e2af86e316beb999efacf3bab91c66d913fe";

function collectOZ(path, sources) {
  if (sources[path]) return;
  const content = fs.readFileSync(`node_modules/${path}`, "utf8");
  sources[path] = { content };
  for (const m of content.matchAll(/import\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g)) {
    const dep = m[1];
    if (dep.startsWith("@openzeppelin/")) collectOZ(dep, sources);
    else if (dep.startsWith("./") || dep.startsWith("../")) {
      const base = path.split("/").slice(0, -1);
      for (const part of dep.split("/")) {
        if (part === ".") continue;
        else if (part === "..") base.pop();
        else base.push(part);
      }
      collectOZ(base.join("/"), sources);
    }
  }
}

const sources = { "VeilToken.sol": { content: fs.readFileSync("contracts/VeilToken.sol", "utf8") } };
collectOZ("@openzeppelin/contracts/token/ERC20/ERC20.sol", sources);
collectOZ("@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol", sources);
console.log("source files:", Object.keys(sources).join(", "));

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["evm.bytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (out.errors ?? []).filter((e) => e.severity === "error");
if (errs.length) {
  for (const e of errs) console.error(e.formattedMessage);
  process.exit(1);
}
const creation = `0x${out.contracts["VeilToken.sol"]["VeilToken"].evm.bytecode.object}`;
const args = encodeAbiParameters(parseAbiParameters("string, string, uint256"), [
  "Veil",
  "VEIL",
  1000000000n * 10n ** 18n,
]).slice(2);
const localFull = (creation + args).toLowerCase();

const remote = await new Promise((resolve, reject) => {
  const req = https.request(
    {
      hostname: "172.66.147.70",
      port: 443,
      path: `/api/v2/smart-contracts/${ADDR}`,
      method: "GET",
      headers: { Host: "explorer.testnet.chain.robinhood.com", "User-Agent": "Mozilla/5.0" },
      servername: "explorer.testnet.chain.robinhood.com",
      timeout: 20000,
    },
    (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(JSON.parse(d).creation_bytecode.toLowerCase()));
    }
  );
  req.on("error", reject);
  req.end();
});

console.log("local len:", localFull.length, "remote len:", remote.length);
// Compare with metadata hashes masked out (last 106 chars of creation code contain CBOR metadata).
const strip = (s) => s.slice(0, -120);
console.log("prefix match (metadata stripped):", strip(localFull) === strip(remote));
let i = 0;
while (i < Math.min(localFull.length, remote.length) && localFull[i] === remote[i]) i++;
console.log("first diff at char:", i, "local:", localFull.slice(i, i + 20), "remote:", remote.slice(i, i + 20));
