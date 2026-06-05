import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const watch = process.argv.includes("--watch");
const outdir = "dist";

const esmEntries = {
  "background/service-worker": "background/service-worker.ts",
  "popup/popup": "popup/popup.ts",
};
const iifeEntries = {
  "content/google": "content/google.ts",
  "content/facebook": "content/facebook.ts",
  "content/trustpilot": "content/trustpilot.ts",
};

const common = { bundle: true, target: "chrome111", sourcemap: true, logLevel: "info" };

async function copyStatic() {
  await cp("manifest.json", `${outdir}/manifest.json`);
  await cp("popup/index.html", `${outdir}/popup/index.html`);
  if (existsSync("assets")) await cp("assets", `${outdir}/assets`, { recursive: true });
}

await rm(outdir, { recursive: true, force: true });
await mkdir(`${outdir}/popup`, { recursive: true });
await mkdir(`${outdir}/content`, { recursive: true });
await mkdir(`${outdir}/background`, { recursive: true });

const esmOpts  = { ...common, entryPoints: esmEntries,  outdir, format: "esm" };
const iifeOpts = { ...common, entryPoints: iifeEntries, outdir, format: "iife" };

if (watch) {
  const c1 = await esbuild.context(esmOpts);
  const c2 = await esbuild.context(iifeOpts);
  await c1.watch(); await c2.watch();
  await copyStatic();
  console.log("[build] watching…");
} else {
  await esbuild.build(esmOpts);
  await esbuild.build(iifeOpts);
  await copyStatic();
  console.log("[build] done → dist/  (content=iife, sw/popup=esm)");
}
