// Generates a fresh deployer key and swaps it into the gitignored env files.
// Prints ONLY the new address. The key is never printed or committed.
import fs from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const fresh = generatePrivateKey();
const addr = privateKeyToAccount(fresh).address;

for (const f of [".env.mainnet.local", ".env.local"]) {
  const lines = fs.readFileSync(f, "utf8").split("\n");
  const updated = lines.map((l) =>
    /^\s*PRIVATE_KEY\s*=/.test(l) ? `PRIVATE_KEY=${fresh.slice(2)}` : l
  );
  if (updated.join("\n") === lines.join("\n")) throw new Error(`No PRIVATE_KEY line in ${f}`);
  fs.writeFileSync(f, updated.join("\n"));
  console.log(`Rotated key in ${f}`);
}
console.log(`NEW_DEPLOYER=${addr}`);
