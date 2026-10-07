// scripts/verify-shield-artifacts.mjs
// Veil equivalent of kentir scripts/verify-shield-artifacts.mjs:
// snarkjs zkey export verificationkey + solidityverifier consistency
// against public/shield-artifacts. Normalizes CRLF/LF and JSON whitespace.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifactsDir = join(root, "public", "shield-artifacts", "v1.2.1");
const sourceDir = join(root, "vendor", "0xbow-privacy-pools-core-v1.2.1", "contracts-src", "contracts", "verifiers");
const snarkjs = join(root, "node_modules", "snarkjs", "cli.js");
const temporaryDir = mkdtempSync(join(tmpdir(), "veil-shield-verify-"));
const norm = (s) => s.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
try {
  for (const name of ["commitment", "withdraw"]) {
    const exportedVkey = join(temporaryDir, `${name}.vkey`);
    const generatedVerifier = join(temporaryDir, `${name}.sol`);
    execFileSync(process.execPath, [snarkjs, "zkey", "export", "verificationkey", join(artifactsDir, `${name}.zkey`), exportedVkey], { stdio: "ignore" });
    execFileSync(process.execPath, [snarkjs, "zkey", "export", "solidityverifier", join(artifactsDir, `${name}.zkey`), generatedVerifier], { stdio: "ignore" });
    const a = JSON.stringify(JSON.parse(readFileSync(exportedVkey, "utf8")));
    const b = JSON.stringify(JSON.parse(readFileSync(join(artifactsDir, `${name}.vkey`), "utf8")));
    if (a !== b) throw new Error(`Verification key does not match ${name}.zkey`);
    const checkedIn = join(sourceDir, name === "withdraw" ? "WithdrawalVerifier.sol" : "CommitmentVerifier.sol");
    if (norm(readFileSync(generatedVerifier, "utf8")) !== norm(readFileSync(checkedIn, "utf8"))) {
      throw new Error(`Solidity verifier source is stale for ${name}.zkey (modulo line endings)`);
    }
    console.log(`✓ ${name}: vkey export matches, solidity verifier matches (line-ending normalized)`);
  }
  console.log("All exported keys and Solidity verifiers match public/shield-artifacts.");
} finally {
  rmSync(temporaryDir, { recursive: true, force: true });
}
