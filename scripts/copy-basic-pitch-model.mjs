import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/@spotify/basic-pitch/model");
const dest = join(root, "public/basic-pitch");

if (!existsSync(src)) {
  console.warn("skip copy-basic-pitch-model: package not installed");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
