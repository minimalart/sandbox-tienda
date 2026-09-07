#!/usr/bin/env node
// check.mjs — Validates that every plugin declared in a Medusa boilerplate's
// project-catalog is consistent across the 7 canonical places from
// PLAYBOOK-plugin-lifecycle.md §2. Optionally auto-fixes with `--fix`.
//
// The 7 places (source of truth = plugin's own package.json):
//
//   1. packages/plugins/plugin-<id>/package.json                      "version"
//   2. packages/plugins/plugin-<id>/mercatto-plugin.json               "version"
//   3. packages/plugins/plugin-<id>/CHANGELOG.md                       (must have entry for the target version — this script does NOT auto-write)
//   4. apps/backend/package.json                                       dependencies["@minimalart/mercatto-plugin-<id>"] = "^X.Y.Z"
//   5. apps/backend/src/admin/lib/extension-versions.ts                <id>: 'X.Y.Z'
//   6. packages/project-catalog/src/catalog.json                       extensions[i].version + type + packageName
//   7. apps/backend/src/lib/platform/catalog.json                      byte-identical mirror of file #6
//
// Usage:
//   node scripts/plugin-consistency/check.mjs [--boilerplate <path>] [--fix]
//                                             [--json] [--only <id>]
//
//   --boilerplate <path>   default: ../../../medusa-b2c-boilerplate
//   --fix                  rewrite files 1, 2, 4, 5, 6, 7 to match #1. NEVER
//                          rewrites CHANGELOG (#3) — that stays human-owned.
//                          If a bump is needed, the "publish" skill covers it.
//   --json                 machine-readable output (for CI)
//   --only <id>            restrict to a single plugin id
//   --strict-changelog     also fail if a plugin's package.json version has
//                          no entry in its CHANGELOG (default: warn)
//
// Exit codes:
//   0 — all plugins consistent (or all fixed cleanly with --fix)
//   1 — inconsistencies found (or fix failed)
//   2 — invalid arguments / boilerplate path missing critical files
//
// Designed to run in three modes:
//   - Manual (from a dev laptop) to inspect state
//   - Pre-push hook in the boilerplate repo (see companion install snippet)
//   - CI job on the boilerplate (see .github/workflows sample in the doc)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- CLI ----------

const { values: args, positionals } = parseArgs({
  options: {
    boilerplate: { type: "string" },
    fix: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    only: { type: "string" },
    "strict-changelog": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: true,
});

if (args.help) {
  printHelp();
  process.exit(0);
}

const boilerplatePath = resolve(
  args.boilerplate || join(__dirname, "..", "..", "..", "medusa-b2c-boilerplate"),
);

if (!existsSync(boilerplatePath)) {
  logError(
    `Boilerplate path not found: ${boilerplatePath}\n` +
      `Pass --boilerplate <path> to point at the medusa-b2c-boilerplate repo.`,
  );
  process.exit(2);
}

// Canonical paths inside the boilerplate.
const paths = {
  catalog: join(boilerplatePath, "packages/project-catalog/src/catalog.json"),
  catalogMirror: join(boilerplatePath, "apps/backend/src/lib/platform/catalog.json"),
  backendPkg: join(boilerplatePath, "apps/backend/package.json"),
  extensionVersions: join(
    boilerplatePath,
    "apps/backend/src/admin/lib/extension-versions.ts",
  ),
  pluginDir: (id) => join(boilerplatePath, `packages/plugins/plugin-${id}`),
  pluginPkg: (id) => join(paths.pluginDir(id), "package.json"),
  pluginManifest: (id) => join(paths.pluginDir(id), "mercatto-plugin.json"),
  pluginChangelog: (id) => join(paths.pluginDir(id), "CHANGELOG.md"),
};

for (const critical of ["catalog", "backendPkg"]) {
  if (!existsSync(paths[critical])) {
    logError(`Missing critical file: ${paths[critical]}`);
    process.exit(2);
  }
}

// ---------- Load data ----------

const catalogRaw = readFileSync(paths.catalog, "utf-8");
const catalog = JSON.parse(catalogRaw);
const catalogMirror = existsSync(paths.catalogMirror) ? readJson(paths.catalogMirror) : null;
const backendPkgRaw = readFileSync(paths.backendPkg, "utf-8");
const backendPkg = JSON.parse(backendPkgRaw);
const extensionVersionsRaw = existsSync(paths.extensionVersions)
  ? readFileSync(paths.extensionVersions, "utf-8")
  : null;

// Format-preserving in-memory raw copies. Fixes MUTATE these; a final
// pass writes them back so the boilerplate keeps its style (compact
// per-line JSON, custom indentation, trailing commas in TS, etc.).
let catalogRawWorking = catalogRaw;
let backendPkgRawWorking = backendPkgRaw;

function replaceInCatalog(pattern, replacement) {
  const next = catalogRawWorking.replace(pattern, replacement);
  if (next === catalogRawWorking) {
    throw new Error(`Fix pattern did not match in catalog.json: ${pattern}`);
  }
  catalogRawWorking = next;
}
function replaceInBackendPkg(pattern, replacement) {
  const next = backendPkgRawWorking.replace(pattern, replacement);
  if (next === backendPkgRawWorking) {
    throw new Error(`Fix pattern did not match in backend package.json: ${pattern}`);
  }
  backendPkgRawWorking = next;
}

// Pick the plugin catalog entries. Schema v2 puts a `type: "plugin"` on the
// item; anything with the plugin-<id> directory ALSO counts as a plugin
// candidate even if the catalog still labels it "extension" (this is the
// migración-incompleta case).
const catalogEntries = Array.isArray(catalog.extensions) ? catalog.extensions : [];
const pluginIdsWithDir = catalogEntries
  .map((e) => e.id)
  .filter((id) => existsSync(paths.pluginDir(id)));
const pluginIdsDeclared = catalogEntries
  .filter((e) => e.type === "plugin")
  .map((e) => e.id);

const universe = new Set([...pluginIdsWithDir, ...pluginIdsDeclared]);
const targetIds = args.only ? [args.only] : [...universe].sort();

// ---------- Check each plugin ----------

/**
 * @type {Array<{
 *   id: string,
 *   truth: string | null,      // plugin package.json version (source of truth)
 *   findings: Array<{ where: string, expected: string | null, actual: string | null, fixable: boolean }>,
 *   fixed: string[],
 * }>}
 */
const report = [];

for (const id of targetIds) {
  const finding = { id, truth: null, findings: [], fixed: [] };

  // (1) plugin package.json version — SOURCE OF TRUTH
  const pluginPkgPath = paths.pluginPkg(id);
  if (!existsSync(pluginPkgPath)) {
    finding.findings.push({
      where: "packages/plugins/plugin-*/package.json",
      expected: "<file exists>",
      actual: "<missing>",
      fixable: false,
    });
    report.push(finding);
    continue;
  }
  const pluginPkg = readJson(pluginPkgPath);
  finding.truth = String(pluginPkg.version || "");
  if (!finding.truth) {
    finding.findings.push({
      where: `packages/plugins/plugin-${id}/package.json`,
      expected: "<semver>",
      actual: "<empty>",
      fixable: false,
    });
    report.push(finding);
    continue;
  }

  // (2) plugin's own mercatto-plugin.json manifest
  const manifestPath = paths.pluginManifest(id);
  if (existsSync(manifestPath)) {
    const manifestRawSrc = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestRawSrc);
    if (manifest.version !== finding.truth) {
      finding.findings.push({
        where: `packages/plugins/plugin-${id}/mercatto-plugin.json`,
        expected: finding.truth,
        actual: String(manifest.version || "<missing>"),
        fixable: true,
        applyFix: () => {
          // Format-preserving: replace only the version value.
          const cur = readFileSync(manifestPath, "utf-8");
          const next = cur.replace(
            /("version"\s*:\s*")([^"]+)(")/,
            `$1${finding.truth}$3`,
          );
          if (next !== cur) writeFileSync(manifestPath, next);
          finding.fixed.push(manifestPath);
        },
      });
    }
  }

  // (3) CHANGELOG entry for this version (warn only unless --strict-changelog)
  const changelogPath = paths.pluginChangelog(id);
  if (existsSync(changelogPath)) {
    const cl = readFileSync(changelogPath, "utf-8");
    const versionHeaderRe = new RegExp(
      `^##\\s+\\[?${escapeRegex(finding.truth)}\\]?\\b`,
      "m",
    );
    if (!versionHeaderRe.test(cl)) {
      finding.findings.push({
        where: `packages/plugins/plugin-${id}/CHANGELOG.md`,
        expected: `entry for [${finding.truth}]`,
        actual: "<missing>",
        fixable: false,
      });
    }
  } else if (args["strict-changelog"]) {
    finding.findings.push({
      where: `packages/plugins/plugin-${id}/CHANGELOG.md`,
      expected: "<file exists>",
      actual: "<missing>",
      fixable: false,
    });
  }

  // (4) apps/backend/package.json dependency range
  const dep = `@minimalart/mercatto-plugin-${id}`;
  const range = backendPkg.dependencies?.[dep] || backendPkg.devDependencies?.[dep] || null;
  if (!range) {
    finding.findings.push({
      where: `apps/backend/package.json (${dep})`,
      expected: `^${finding.truth}`,
      actual: "<absent>",
      fixable: false, // adding a new dependency needs review (position, category)
    });
  } else {
    // Compare only the numeric portion. `^` prefix is expected.
    const cleaned = range.replace(/^[^0-9]+/, "");
    if (cleaned !== finding.truth) {
      finding.findings.push({
        where: `apps/backend/package.json (${dep})`,
        expected: `^${finding.truth}`,
        actual: range,
        fixable: true,
        applyFix: () => {
          // Format-preserving: replace only the value between quotes for
          // this exact dep line.
          const lineRe = new RegExp(
            `("${escapeRegex(dep)}"\\s*:\\s*")([^"]+)(")`,
          );
          replaceInBackendPkg(lineRe, (_, k, _v, q) => `${k}^${finding.truth}${q}`);
        },
      });
    }
  }

  // (5) apps/backend/src/admin/lib/extension-versions.ts
  //
  // This file is intentionally used ONLY for in-tree extensions. Plugins
  // that migrated to npm are marked with a `// <id>: moved to @minimalart/
  // mercatto-plugin-<id>` comment. So we differentiate three cases:
  //
  //   - The current catalog says type='extension' → the id MUST appear as
  //     a live key with the right version.
  //   - The current catalog says type='plugin' and the file has a `moved
  //     to` marker → OK, migration acknowledged.
  //   - type='plugin' but neither a key nor a marker → warn: someone
  //     migrated but forgot to leave the "moved to" annotation. Manual.
  //
  // The migración-incompleta case (dir exists, type still "extension"
  // in catalog) DOESN'T trigger a live-key error since the type fix
  // in step (6) below cascades.
  if (extensionVersionsRaw) {
    const entryRe = new RegExp(
      `(['"\`]?${escapeRegex(id)}['"\`]?\\s*:\\s*)(['"\`])([^'"\`]*?)(\\2)`,
      "m",
    );
    const movedRe = new RegExp(
      `//\\s*${escapeRegex(id)}\\s*:\\s*moved to`,
      "i",
    );
    const catalogEntryForCheck = catalogEntries.find((e) => e.id === id);
    const declaredExtension = catalogEntryForCheck?.type === "extension";
    const m = entryRe.exec(extensionVersionsRaw);
    const hasMovedMarker = movedRe.test(extensionVersionsRaw);

    if (declaredExtension) {
      if (!m) {
        finding.findings.push({
          where: "apps/backend/src/admin/lib/extension-versions.ts",
          expected: `${id}: '${finding.truth}'`,
          actual: "<absent>",
          fixable: false,
        });
      } else if (m[3] !== finding.truth) {
        finding.findings.push({
          where: "apps/backend/src/admin/lib/extension-versions.ts",
          expected: `${id}: '${finding.truth}'`,
          actual: `${id}: '${m[3]}'`,
          fixable: true,
          applyFix: () => {
            const cur = readFileSync(paths.extensionVersions, "utf-8");
            const next = cur.replace(
              entryRe,
              (_, k, q, _v, qc) => `${k}${q}${finding.truth}${qc}`,
            );
            if (next !== cur) writeFileSync(paths.extensionVersions, next);
          },
        });
      }
    } else {
      // catalog says type=plugin (post-migration). Live key means the map
      // still lists it, which is a leftover from before the migration.
      if (m) {
        finding.findings.push({
          where: "apps/backend/src/admin/lib/extension-versions.ts",
          expected: `// ${id}: moved to @minimalart/mercatto-plugin-${id}`,
          actual: `${id}: '${m[3]}' (live key — should be commented out as 'moved to')`,
          fixable: false,
        });
      } else if (!hasMovedMarker) {
        // Neither key nor marker — mildly weird. Not blocking.
        finding.findings.push({
          where: "apps/backend/src/admin/lib/extension-versions.ts",
          expected: `// ${id}: moved to @minimalart/mercatto-plugin-${id}`,
          actual: "<no marker and no key>",
          fixable: false,
        });
      }
    }
  }

  // (6) catalog.json entry — all fixes MUST preserve the file's compact
  // "one entry per line" formatting. We operate on the raw text with
  // substring replacements scoped to the target id's line.
  const catalogEntry = catalogEntries.find((e) => e.id === id);
  if (!catalogEntry) {
    finding.findings.push({
      where: "packages/project-catalog/src/catalog.json",
      expected: `entry with id="${id}", type="plugin", version="${finding.truth}", packageName="${dep}"`,
      actual: "<absent>",
      fixable: false,
    });
  } else {
    // Locate the raw JSON object substring for this id inside catalogRaw.
    // Assumes each entry is on a single line — matches the current file
    // format ("{ \"id\": \"...\", ..., \"type\": \"...\" }").
    const findLineRe = () =>
      new RegExp(`\\{[^\\n]*"id"\\s*:\\s*"${escapeRegex(id)}"[^\\n]*\\}`, "m");

    if (catalogEntry.type !== "plugin") {
      finding.findings.push({
        where: `catalog.json → ${id}.type`,
        expected: "plugin",
        actual: String(catalogEntry.type),
        fixable: true,
        applyFix: () => {
          replaceInCatalog(findLineRe(), (line) => {
            // Replace "type": "<x>" → "type": "plugin".
            let next = line.replace(/("type"\s*:\s*")([^"]*)(")/, `$1plugin$3`);
            // If packageName is absent, insert it right after type.
            if (!/"packageName"\s*:/.test(next)) {
              next = next.replace(
                /("type"\s*:\s*"plugin")/,
                `$1, "packageName": "${dep}"`,
              );
            }
            return next;
          });
        },
      });
    }
    if (catalogEntry.packageName !== dep && catalogEntry.type === "plugin") {
      // Only report as separate finding when type was already plugin;
      // the type-fix above already inserts the packageName in the
      // migration-incompleta case.
      finding.findings.push({
        where: `catalog.json → ${id}.packageName`,
        expected: dep,
        actual: String(catalogEntry.packageName || "<missing>"),
        fixable: true,
        applyFix: () => {
          replaceInCatalog(findLineRe(), (line) => {
            if (/"packageName"\s*:/.test(line)) {
              return line.replace(
                /("packageName"\s*:\s*")([^"]*)(")/,
                `$1${dep}$3`,
              );
            }
            // Insert after "type": "plugin".
            return line.replace(
              /("type"\s*:\s*"plugin")/,
              `$1, "packageName": "${dep}"`,
            );
          });
        },
      });
    }
    if (catalogEntry.version !== finding.truth) {
      finding.findings.push({
        where: `catalog.json → ${id}.version`,
        expected: finding.truth,
        actual: String(catalogEntry.version || "<missing>"),
        fixable: true,
        applyFix: () => {
          replaceInCatalog(findLineRe(), (line) =>
            line.replace(/("version"\s*:\s*")([^"]*)(")/, `$1${finding.truth}$3`),
          );
        },
      });
    }
  }

  report.push(finding);
}

// (7) mirror catalog — check AFTER we know what the main catalog needs.
let mirrorMismatch = false;
if (catalogMirror) {
  const canonMain = JSON.stringify(catalog);
  const canonMirror = JSON.stringify(catalogMirror);
  if (canonMain !== canonMirror) {
    mirrorMismatch = true;
  }
}

// ---------- Apply fixes ----------

if (args.fix) {
  let anyWrite = false;

  // Fix pass: per-plugin, in-place. Each applyFix mutates the
  // format-preserving raw copies (catalogRawWorking, backendPkgRawWorking)
  // or writes directly (extension-versions.ts, mercatto-plugin.json).
  for (const finding of report) {
    for (const item of finding.findings) {
      if (item.fixable && typeof item.applyFix === "function") {
        item.applyFix();
        anyWrite = true;
      }
    }
  }

  // Persist raw catalog + backendPkg if they changed.
  if (catalogRawWorking !== catalogRaw) {
    writeFileSync(paths.catalog, catalogRawWorking);
    anyWrite = true;
  }
  if (backendPkgRawWorking !== backendPkgRaw) {
    writeFileSync(paths.backendPkg, backendPkgRawWorking);
    anyWrite = true;
  }

  // Mirror always follows the main catalog byte-for-byte.
  if (existsSync(paths.catalogMirror)) {
    const currentMirror = readFileSync(paths.catalogMirror, "utf-8");
    if (currentMirror !== catalogRawWorking) {
      writeFileSync(paths.catalogMirror, catalogRawWorking);
      anyWrite = true;
    }
  }

  if (!anyWrite) {
    log("Nothing to fix.");
  }
}

// ---------- Output ----------

const failingReport = report.filter(
  (r) => r.findings.length > 0 || (args.fix && r.fixed.length > 0),
);

if (args.json) {
  const out = {
    boilerplatePath,
    total: report.length,
    ok: report.filter((r) => r.findings.length === 0).length,
    failing: report.length - report.filter((r) => r.findings.length === 0).length,
    mirrorMismatch,
    plugins: report.map((r) => ({
      id: r.id,
      truth: r.truth,
      ok: r.findings.length === 0,
      findings: r.findings.map(({ where, expected, actual, fixable }) => ({
        where,
        expected,
        actual,
        fixable,
      })),
    })),
  };
  console.log(JSON.stringify(out, null, 2));
} else {
  printHumanReport(report, mirrorMismatch);
}

// Exit code.
const remaining = report.some((r) => r.findings.length > 0);
if (remaining && !args.fix) process.exit(1);
if (args.fix) {
  // After fix, re-check any remaining unfixables.
  const stillBroken = report.some((r) =>
    r.findings.some((f) => !f.fixable),
  );
  process.exit(stillBroken ? 1 : 0);
}

// ---------- helpers ----------

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function log(msg) {
  if (!args.json) console.log(msg);
}
function logError(msg) {
  console.error(`\x1b[31m${msg}\x1b[0m`);
}

function printHumanReport(rows, mirrorMismatch) {
  const ok = rows.filter((r) => r.findings.length === 0);
  const bad = rows.filter((r) => r.findings.length > 0);

  console.log(`\n\x1b[1mPlugin consistency check\x1b[0m`);
  console.log(`Boilerplate: ${boilerplatePath}`);
  console.log(
    `Plugins scanned: ${rows.length} · \x1b[32m${ok.length} consistent\x1b[0m` +
      (bad.length ? ` · \x1b[31m${bad.length} with issues\x1b[0m` : ""),
  );
  if (mirrorMismatch) {
    console.log(
      `\x1b[33m⚠  catalog.json mirror (apps/backend/src/lib/platform/catalog.json)\n` +
        `   differs from the source (packages/project-catalog/src/catalog.json).\n` +
        `   Run with --fix to sync.\x1b[0m`,
    );
  }
  if (bad.length === 0) {
    console.log(`\n\x1b[32m✓ All good.\x1b[0m`);
    return;
  }
  for (const r of bad) {
    console.log(`\n  \x1b[1m${r.id}\x1b[0m  \x1b[2m(truth: ${r.truth || "?"})\x1b[0m`);
    for (const f of r.findings) {
      const fixTag = f.fixable ? "\x1b[36m[fixable]\x1b[0m" : "\x1b[31m[manual]\x1b[0m";
      console.log(`    ${fixTag} ${f.where}`);
      console.log(`      expected: \x1b[32m${f.expected}\x1b[0m`);
      console.log(`      actual:   \x1b[31m${f.actual}\x1b[0m`);
    }
  }
  console.log("");
  const fixableCount = bad.reduce(
    (n, r) => n + r.findings.filter((f) => f.fixable).length,
    0,
  );
  const manualCount = bad.reduce(
    (n, r) => n + r.findings.filter((f) => !f.fixable).length,
    0,
  );
  console.log(
    `${fixableCount} fixable auto (run with --fix), ${manualCount} require manual editing.\n`,
  );
}

function printHelp() {
  console.log(`
check.mjs — plugin catalog consistency across the 7 canonical places.

Usage:
  node scripts/plugin-consistency/check.mjs [options]

Options:
  --boilerplate <path>    Boilerplate root. Default: ../../../medusa-b2c-boilerplate
  --fix                   Auto-fix fixable items. Never edits CHANGELOG.
  --json                  Machine-readable JSON output.
  --only <id>             Restrict to a single plugin id.
  --strict-changelog      Fail if a plugin's version has no CHANGELOG entry.
  -h, --help              Show this help.

Exit codes:
  0 — clean (or --fix worked without leaving unfixable issues)
  1 — inconsistencies
  2 — bad arguments / missing boilerplate

Fix policy:
  The source of truth is packages/plugins/plugin-<id>/package.json.
  All other places are rewritten to match. CHANGELOG entries stay human-
  curated — this script never invents changelog notes.
`);
}
