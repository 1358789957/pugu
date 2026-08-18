import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.(ts|js|mjs|cjs|json)$/.test(specifier)) {
    const parent = fileURLToPath(context.parentURL);
    const ts = join(dirname(parent), `${specifier}.ts`);
    if (existsSync(ts)) {
      return { shortCircuit: true, url: pathToFileURL(ts).href };
    }
  }
  return nextResolve(specifier, context);
}
