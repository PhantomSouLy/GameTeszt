#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules"]);
const sourceExtensions = new Set([".html", ".css", ".js", ".mjs"]);
const errors = [];
const warnings = [];

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

const files = walk(root);
const sourceFiles = files.filter(file => sourceExtensions.has(extname(file).toLowerCase()));
const javascriptFiles = files.filter(file => [".js", ".mjs"].includes(extname(file).toLowerCase()));
const cssFiles = files.filter(file => extname(file).toLowerCase() === ".css");

for (const file of javascriptFiles) {
  const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (check.status !== 0) {
    errors.push(`${relative(root, file)}: JavaScript syntax error\n${check.stderr.trim()}`);
  }
}

try {
  const cssTree = await import("css-tree");
  for (const file of cssFiles) {
    try {
      cssTree.parse(readFileSync(file, "utf8"), { filename: relative(root, file) });
    } catch (error) {
      errors.push(`${relative(root, file)}: CSS syntax error\n${error.message}`);
    }
  }
} catch (error) {
  if (error?.code === "ERR_MODULE_NOT_FOUND") warnings.push("css-tree is not installed; CSS parsing was skipped (run npm install)");
  else errors.push(`CSS validator failed to start: ${error?.message || error}`);
}

const directAssetPattern = /["'`(](assets\/[A-Za-z0-9_@./ ()+-]+?\.(?:png|jpe?g|webp|gif|svg|wav|mp3|ogg|json))(?:\?[^"'`)\s]*)?/gi;
const missingAssets = new Map();

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(directAssetPattern)) {
    const asset = match[1];
    if (asset.includes("${")) continue;
    const assetPath = join(root, asset);
    if (!existsSync(assetPath)) {
      const refs = missingAssets.get(asset) || [];
      refs.push(relative(root, file));
      missingAssets.set(asset, refs);
    } else if (statSync(assetPath).size === 0) {
      errors.push(`${asset}: referenced asset is empty`);
    }
  }
}

for (const [asset, refs] of missingAssets) {
  errors.push(`${asset}: missing asset (referenced by ${[...new Set(refs)].join(", ")})`);
}

const html = readFileSync(join(root, "index.html"), "utf8");
const ids = new Map();
for (const match of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
  ids.set(match[1], (ids.get(match[1]) || 0) + 1);
}
for (const [id, count] of ids) {
  if (count > 1) errors.push(`index.html: duplicate id \"${id}\" (${count} occurrences)`);
}

const main = readFileSync(join(root, "src", "main.js"), "utf8");
const declaredPatchCount = Number(main.match(/const\s+patchCount\s*=\s*(\d+)/)?.[1]);
const actualPatchCount = [...main.matchAll(/await\s+loadScript\(/g)].length;
if (!Number.isFinite(declaredPatchCount)) {
  errors.push("src/main.js: patchCount declaration was not found");
} else if (declaredPatchCount !== actualPatchCount) {
  errors.push(`src/main.js: patchCount=${declaredPatchCount}, but ${actualPatchCount} patches are loaded`);
}

for (const match of main.matchAll(/loadScript\(["']([^"']+)["']/g)) {
  const script = match[1].split("?")[0];
  if (!existsSync(join(root, script))) errors.push(`src/main.js: missing runtime script ${script}`);
}

for (const match of html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["']/gi)) {
  const reference = match[1].split(/[?#]/)[0];
  if (/^(?:https?:|data:|#)/i.test(reference)) continue;
  if (!existsSync(join(root, reference))) errors.push(`index.html: missing local dependency ${reference}`);
}

if (existsSync(join(root, "src", "cherrift_v0562.js")) && !main.includes("cherrift_v0562.js")) {
  warnings.push("src/cherrift_v0562.js exists but is not loaded (v0.5.6.3 supersedes it)");
}

if (/v0\.2\.2/i.test(readFileSync(join(root, "README.md"), "utf8"))) {
  warnings.push("README.md still describes v0.2.2");
}

const wavPath = join(root, "assets", "audio", "click.wav");
if (existsSync(wavPath)) {
  const header = readFileSync(wavPath).subarray(0, 12).toString("ascii");
  if (!header.startsWith("RIFF") || !header.endsWith("WAVE")) {
    errors.push("assets/audio/click.wav: invalid RIFF/WAVE header");
  }
}

console.log(`Validated ${javascriptFiles.length} JavaScript files, ${cssFiles.length} CSS files and ${sourceFiles.length} source files.`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
console.log(errors.length ? `Validation failed with ${errors.length} error(s).` : "Validation passed.");
process.exitCode = errors.length ? 1 : 0;
