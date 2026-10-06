// Prints ONLY derived addresses from env keys. Never prints keys.
import fs from "node:fs";
import { privateKeyToAccount } from "viem/accounts";

for (const f of [".env.mainnet.local", ".env.local"]) {
  try {
    const txt = fs.readFileSync(f, "utf8");
    const lines = txt.split("\n").filter((l) => /PRIVATE_KEY/.test(l) && !l.trim().startsWith("#"));
    for (const l of lines) {
      const name = l.split("=")[0].trim();
      let k = l.slice(l.indexOf("=") + 1).trim().replace(/['"]/g, "");
      try {
        console.log(f, name, "->", privateKeyToAccount(k.startsWith("0x") ? k : `0x${k}`).address);
      } catch {
        console.log(f, name, "-> unparseable");
      }
    }
  } catch {
    console.log(f, "missing");
  }
}
