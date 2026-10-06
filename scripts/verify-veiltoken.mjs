// Submits Blockscout standard-json verification for VeilToken.
// Usage: node scripts/verify-veiltoken.mjs --testnet | --mainnet
import https from "node:https";
import fs from "node:fs";
import { encodeAbiParameters, parseAbiParameters } from "viem";

const useMainnet = process.argv.includes("--mainnet");
const explorerHost = useMainnet
  ? "explorer.mainnet.chain.robinhood.com"
  : "explorer.testnet.chain.robinhood.com";
const manifest = JSON.parse(
  fs.readFileSync(`deployments/veiltoken-${useMainnet ? "mainnet" : "testnet"}-latest.json`, "utf8")
);

function collectOZ(path, sources) {
  if (sources[path]) return;
  const full = `node_modules/${path}`;
  const content = fs.readFileSync(full, "utf8");
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

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"] } },
  },
};

const constructorArgs = encodeAbiParameters(
  parseAbiParameters("string, string, uint256"),
  [manifest.args.name, manifest.args.symbol, BigInt(manifest.args.supply)]
).slice(2);

function apiPost(path, body, contentType = "application/json") {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "172.66.147.70",
        port: 443,
        path,
        method: "POST",
        headers: {
          Host: explorerHost,
          "Content-Type": contentType,
          "Content-Length": Buffer.byteLength(data),
          "User-Agent": "Mozilla/5.0",
        },
        servername: explorerHost,
        timeout: 30000,
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, body: d.slice(0, 500) }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

const form = new URLSearchParams({
  module: "contract",
  action: "verifysourcecode",
  contractaddress: manifest.address,
  sourceCode: JSON.stringify(input),
  codeformat: "solidity-standard-json-input",
  contractname: "VeilToken.sol:VeilToken",
  compilerversion: "v0.8.37+commit.f401782d",
  optimizationUsed: "1",
  runs: "200",
  evmversion: "cancun",
  licenseType: "3",
  constructorArguements: constructorArgs,
});
console.log("Submitting verification for", manifest.address);
const r = await apiPost("/api", form.toString(), "application/x-www-form-urlencoded");
console.log("Response:", r.status, r.body);
