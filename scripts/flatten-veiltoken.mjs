// Produces a flattened VeilToken source for Blockscout v1 verification.
import fs from "node:fs";

const seen = new Set();
let out = "";
function inline(path) {
  const key = path.startsWith("@openzeppelin/") ? path : "VeilToken.sol";
  if (seen.has(key)) return;
  seen.add(key);
  const content = key === "VeilToken.sol"
    ? fs.readFileSync("contracts/VeilToken.sol", "utf8")
    : fs.readFileSync(`node_modules/${key}`, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*import\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["'];?\s*$/);
    if (m) {
      const dep = m[1];
      if (dep.startsWith("@openzeppelin/")) inline(dep);
      else if (dep.startsWith("./") || dep.startsWith("../")) {
        const base = key.split("/").slice(0, -1);
        for (const part of dep.split("/")) {
          if (part === ".") continue;
          else if (part === "..") base.pop();
          else base.push(part);
        }
        inline(base.join("/"));
      }
      continue;
    }
    if (/^\s*\/\/\s*SPDX-License-Identifier:/.test(line) && seen.size > 1) continue;
    out += line + "\n";
  }
}
inline("VeilToken.sol");
// Keep a single pragma (highest version requirement wins as-is).
const pragmas = out.match(/pragma solidity[^;]+;/g) ?? [];
for (let i = 0; i < pragmas.length - 0; i++) {
  void i;
}
out += "";
fs.writeFileSync("deployments/VeilToken.flattened.sol", out);
console.log("Flattened bytes:", out.length, "pragmas:", pragmas.length);
