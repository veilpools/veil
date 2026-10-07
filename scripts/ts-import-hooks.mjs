// Shared ESM resolve hook so Node scripts can import the REAL TypeScript
// builders in lib/*.ts verbatim (Node 24 type stripping handles syntax;
// this hook only resolves extensionless relative imports like
// "./shielded-swap" -> "./shielded-swap.ts").
//
// TESTNET scripts only. Usage at the top of a script (before any .ts import):
//   import { register } from "node:module";
//   register("./ts-import-hooks.mjs", import.meta.url);
//   const ui = await import("../lib/shielded-swap-ui.ts");
// Only extensionless relative imports issued FROM a .ts module are remapped;
// everything else delegates to the default resolver.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      context.parentURL.endsWith(".ts")
    ) {
      const parentPath = fileURLToPath(context.parentURL);
      const base = path.resolve(path.dirname(parentPath), specifier);
      if (!path.extname(base)) {
        for (const ext of [".ts", ".mjs", ".js"]) {
          if (existsSync(base + ext)) {
            return { url: pathToFileURL(base + ext).href, shortCircuit: true };
          }
        }
      }
    }
    throw err;
  }
}
