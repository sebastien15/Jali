#!/usr/bin/env node
// Mobile module boundary check (architecture runbook §4, rules 1, 3, 4 and 6).
//
// Scans every .ts/.tsx file under features/ and core/, resolves `@/…` and
// relative imports to a path under mobile/, and fails when:
//   1. features/<A> imports features/<B>/** (B ≠ A) other than B's public
//      entry `@/features/<B>` (features/<B>/index.ts), or B is not listed for
//      A in features/boundaries.json;
//   2. core/** (other than core/navigation, a composition root) imports any
//      features/**;
//   3. core/navigation imports a feature other than through its public entry;
//   4. anything in features/** or core/** imports from app/** (route files).
// mobile/app/** route wrappers are composition roots and are not scanned.
//
// Plain Node, no dependencies. Usage: node scripts/check-module-boundaries.mjs

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(ROOT, "features", "boundaries.json");
const SCANNED = ["features", "core"];
const COMPOSITION_ROOTS = ["core/navigation"];

const toPosix = (p) => p.split(sep).join("/");
const rel = (abs) => toPosix(relative(ROOT, abs));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(abs);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const IMPORT_PATTERNS = [
  /\bfrom\s*["']([^"']+)["']/g, // import … from "x" / export … from "x"
  /\bimport\s*["']([^"']+)["']/g, // import "x"
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, // import("x")
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g, // require("x")
];

function specifiers(src) {
  const code = stripComments(src);
  const found = [];
  for (const re of IMPORT_PATTERNS) {
    for (const m of code.matchAll(re)) {
      const line = code.slice(0, m.index).split("\n").length;
      found.push({ spec: m[1], line });
    }
  }
  return found;
}

/** Resolved path relative to mobile/, without extension or trailing /index; null for packages. */
function resolveSpec(spec, fromFile) {
  let abs;
  if (spec.startsWith("@/")) abs = join(ROOT, spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) abs = resolve(dirname(fromFile), spec);
  else return null;
  return rel(abs)
    .replace(/\.(tsx?|jsx?|mjs|json)$/, "")
    .replace(/\/index$/, "");
}

const featureOf = (p) => (p.match(/^features\/([^/]+)/) || [])[1] ?? null;
const isFeatureEntry = (p) => /^features\/[^/]+$/.test(p);

function loadManifest() {
  if (!existsSync(MANIFEST)) return {};
  const raw = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("$")) continue;
    if (!Array.isArray(v)) throw new Error(`boundaries.json: "${k}" must be an array of feature names`);
    out[k] = v;
  }
  return out;
}

const manifest = loadManifest();
const violations = [];
const report = (file, line, msg) => violations.push(`${rel(file)}:${line}  ${msg}`);

// Every feature folder must be declared in the reviewed manifest.
if (existsSync(join(ROOT, "features"))) {
  for (const name of readdirSync(join(ROOT, "features"))) {
    if (statSync(join(ROOT, "features", name)).isDirectory() && !(name in manifest)) {
      violations.push(`features/${name}  missing from features/boundaries.json`);
    }
  }
}

const files = SCANNED.flatMap((d) => walk(join(ROOT, d)));

for (const file of files) {
  const from = rel(file);
  const fromFeature = featureOf(from);
  const isComposition = COMPOSITION_ROOTS.some((r) => from === r || from.startsWith(`${r}/`));
  const isCore = from.startsWith("core/");

  for (const { spec, line } of specifiers(readFileSync(file, "utf8"))) {
    const target = resolveSpec(spec, file);
    if (target === null) continue;

    if (target === "app" || target.startsWith("app/")) {
      report(file, line, `imports route file "${spec}" (features/core must not import mobile/app/**)`);
      continue;
    }

    const toFeature = featureOf(target);
    if (!toFeature) continue;

    if (fromFeature) {
      if (toFeature === fromFeature) continue;
      if (!isFeatureEntry(target)) {
        report(file, line, `imports "${spec}" — use the public entry "@/features/${toFeature}"`);
      } else if (!(manifest[fromFeature] ?? []).includes(toFeature)) {
        report(file, line, `features/${fromFeature} → features/${toFeature} is not allowed by features/boundaries.json`);
      }
    } else if (isCore && !isComposition) {
      report(file, line, `imports "${spec}" (core/session, service-catalog and notifications must not import features)`);
    } else if (isComposition && !isFeatureEntry(target)) {
      report(file, line, `imports "${spec}" — composition roots use the public entry "@/features/${toFeature}"`);
    }
  }
}

if (violations.length) {
  console.error(`Module boundary check failed (${violations.length} violation${violations.length > 1 ? "s" : ""}):`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`Module boundary check passed (${files.length} files in ${SCANNED.join(", ")}).`);
