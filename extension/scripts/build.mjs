import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const shared = { bundle: true, sourcemap: true, target: "es2022" };

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await Promise.all([
  build({ ...shared, entryPoints: ["src/background.ts"], format: "esm", outfile: "dist/background.js" }),
  build({ ...shared, entryPoints: ["src/content.ts"], format: "iife", outfile: "dist/content.js" }),
  build({ ...shared, entryPoints: ["src/popup.ts"], format: "esm", outfile: "dist/popup.js" }),
  build({ ...shared, entryPoints: ["src/offscreen.ts"], format: "esm", outfile: "dist/offscreen.js" }),
]);
await Promise.all([
  cp("public", "dist", { recursive: true }),
  mkdir("dist/ort", { recursive: true }).then(() => Promise.all([
    cp("node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs", "dist/ort/ort-wasm-simd-threaded.jsep.mjs"),
    cp("node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm", "dist/ort/ort-wasm-simd-threaded.jsep.wasm"),
  ])),
]);
