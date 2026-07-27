import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const shared = { bundle: true, sourcemap: true, target: "es2022" };

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await Promise.all([
  build({ ...shared, entryPoints: ["src/background.ts"], format: "esm", outfile: "dist/background.js" }),
  build({ ...shared, entryPoints: ["src/content.ts"], format: "iife", outfile: "dist/content.js" }),
  build({ ...shared, entryPoints: ["src/popup.ts"], format: "esm", outfile: "dist/popup.js" }),
]);
await cp("public", "dist", { recursive: true });
