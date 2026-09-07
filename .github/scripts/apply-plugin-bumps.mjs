#!/usr/bin/env node
// apply-plugin-bumps.mjs — the mutating half of plugin-upgrade.yml.
//
// CANONICAL COPY lives in minimalart/minimalart-version-checker at
// scripts/plugin-upgrade/apply-plugin-bumps.mjs and is VENDORED into each store
// repo at .github/scripts/apply-plugin-bumps.mjs. Edit the canonical copy.
//
// Reads the dispatch payload from $PLUGINS_JSON, rewrites the canonical places
// for each plugin, and hands the workflow a branch name, a commit message and a
// PR body. Mutates the working tree only; never runs git, pnpm, or gh.
//
// WHICH PLACES. PLAYBOOK-plugin-lifecycle.md §2 lists 7 canonical places for a
// plugin's version. A store consumes from GitHub Packages and vendors no
// `packages/plugins/`, so places 1-3 (the plugin's own package.json,
// mercatto-plugin.json, CHANGELOG) live in the boilerplate and not here. That
// leaves:
//
//   4. apps/backend/package.json                        dependencies[pkg]
//   5. apps/backend/src/admin/lib/extension-versions.ts <id>: 'X.Y.Z'
//   6. packages/project-catalog/src/catalog.json        extensions[i].version
//   7. apps/backend/src/lib/platform/catalog.json       byte-identical mirror of 6
//
// Place 5 is usually a NO-OP for an npm-consumed plugin: that file comments the
// entry out on migration (`// blog: moved to @minimalart/mercatto-plugin-blog`)
// because the version now comes from the package. We only touch it when an
// ACTIVE entry exists, and never resurrect a commented one.
//
// WHY SURGICAL TEXT EDITS AND NOT JSON.stringify. catalog.json keeps one
// extension per line (`{ "id": "blog", "name": ..., "version": "1.0.1", ... },`)
// and does not round-trip through JSON.stringify(x, null, 2) — reserializing it
// turns a one-line version bump into a whole-file reformat and destroys the
// byte-identity that place 7 depends on. So we parse only to VALIDATE and then
// replace the exact substring.
//
// REFUSALS. An upgrade is not an install. If a requested plugin has no
// dependency entry in apps/backend/package.json, adopting it needs the folder
// purge and the 5 barrel edits from PRD §7.1 — far beyond a version bump — so
// we fail the whole job loudly rather than open a PR that half-installs it.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PATHS = {
  backendPkg: "apps/backend/package.json",
  extensionVersions: "apps/backend/src/admin/lib/extension-versions.ts",
  catalog: "packages/project-catalog/src/catalog.json",
  catalogMirror: "apps/backend/src/lib/platform/catalog.json",
};

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function die(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- input ----------

function parsePlugins(raw) {
  if (!raw || !raw.trim()) die("PLUGINS_JSON is empty");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    die(`PLUGINS_JSON is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    die("PLUGINS_JSON must be a non-empty array");
  }
  const seen = new Set();
  return parsed.map((p, i) => {
    const at = `plugins[${i}]`;
    if (!p || typeof p !== "object") die(`${at} is not an object`);
    const { id, version, packageName } = p;
    if (typeof id !== "string" || !ID_RE.test(id)) die(`${at}.id invalid: ${JSON.stringify(id)}`);
    if (typeof version !== "string" || !SEMVER_RE.test(version)) {
      die(`${at}.version is not a plain semver: ${JSON.stringify(version)}`);
    }
    // The package name is fully determined by the id. Accepting a caller-
    // supplied name that disagrees would let a dispatch point a store's
    // dependency at an unrelated package, so we pin it instead of trusting it.
    const expected = `@minimalart/mercatto-plugin-${id}`;
    if (packageName !== undefined && packageName !== expected) {
      die(`${at}.packageName ${JSON.stringify(packageName)} does not match id ${id} (expected ${expected})`);
    }
    if (seen.has(id)) die(`${at}.id duplicated: ${id}`);
    seen.add(id);
    return { id, version, packageName: expected };
  });
}

// ---------- place 4: apps/backend/package.json ----------

// Surgical: replace the value of the dependency's own key. Package names are
// unique object keys, so the match is unambiguous and nothing else reformats.
function bumpBackendDep(text, plugin) {
  const re = new RegExp(`(${escapeRe(JSON.stringify(plugin.packageName))}\\s*:\\s*)"([^"]+)"`);
  const m = text.match(re);
  if (!m) return { text, before: null, changed: false };
  const before = m[2];
  // Only a registry range may be rewritten. `workspace:*`, `link:`, `file:` and
  // friends mean the package resolves from inside the monorepo, and replacing
  // one with "^X.Y.Z" would quietly cut that linkage and point the build at the
  // registry instead. The boilerplate vendors packages/plugins/, so this is a
  // live possibility there even though every range is plain semver today.
  if (!/^[\^~>=<]*\d/.test(before)) {
    die(
      `${PATHS.backendPkg} pins ${plugin.packageName} as "${before}", which is not a ` +
        `registry range. Rewriting it to a version would break that linkage — ` +
        `bump it wherever it actually resolves from instead.`,
    );
  }
  const target = `^${plugin.version}`;
  if (before === target) return { text, before, changed: false };
  return { text: text.replace(re, `$1${JSON.stringify(target)}`), before, changed: true };
}

// ---------- places 6 + 7: the catalog and its mirror ----------

function bumpCatalogEntry(text, plugin, expectedCurrent) {
  const lines = text.split("\n");
  const needle = `"id": ${JSON.stringify(plugin.id)}`;
  const hits = [];
  lines.forEach((line, idx) => {
    if (line.includes(needle)) hits.push(idx);
  });
  if (hits.length === 0) {
    die(`catalog.json has no entry with id "${plugin.id}" — refusing to invent one`);
  }
  if (hits.length > 1) {
    die(`catalog.json has ${hits.length} entries with id "${plugin.id}" — refusing to guess`);
  }
  const idx = hits[0];
  const line = lines[idx];
  const verRe = /("version"\s*:\s*)"([^"]+)"/;
  const m = line.match(verRe);
  if (!m) die(`catalog.json entry "${plugin.id}" has no "version" field`);
  const before = m[2];
  // Cross-check against the parsed view. If these disagree we matched the wrong
  // line and must not write anything.
  if (expectedCurrent !== null && before !== expectedCurrent) {
    die(
      `catalog.json line for "${plugin.id}" says version ${before} but the parsed ` +
        `entry says ${expectedCurrent} — bailing out rather than editing blind`,
    );
  }
  if (before === plugin.version) return { text, before, changed: false };
  lines[idx] = line.replace(verRe, `$1${JSON.stringify(plugin.version)}`);
  return { text: lines.join("\n"), before, changed: true };
}

// ---------- place 5: extension-versions.ts ----------

// Only an ACTIVE entry gets touched. Quoted (`'ai-assistant': '1.2.3',`) and
// bare (`andreani: '1.4.0',`) keys both occur; a commented-out line is left
// exactly as it is, because for an npm-consumed plugin that comment IS the
// correct state.
function bumpExtensionVersion(text, plugin) {
  const id = escapeRe(plugin.id);
  const re = new RegExp(`^(\\s*)(?:'${id}'|"${id}"|${id})(\\s*:\\s*)'([^']+)'`, "m");
  const m = text.match(re);
  if (!m) return { text, before: null, changed: false };
  const before = m[3];
  if (before === plugin.version) return { text, before, changed: false };
  const replaced = text.replace(re, (full) => full.replace(`'${before}'`, `'${plugin.version}'`));
  return { text: replaced, before, changed: true };
}

// ---------- main ----------

const plugins = parsePlugins(process.env.PLUGINS_JSON || "");
const baseBranch = process.env.BASE_BRANCH || "main";
const requestedBy = (process.env.REQUESTED_BY || "").trim() || "unknown";
const usedFallbackToken = String(process.env.USED_FALLBACK_TOKEN || "") === "true";
const runId = process.env.GITHUB_RUN_ID || "local";
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
const repository = process.env.GITHUB_REPOSITORY || "unknown/unknown";

for (const [key, p] of Object.entries(PATHS)) {
  // extension-versions.ts is optional: a store that migrated every extension to
  // a plugin may not carry it at all.
  if (key !== "extensionVersions" && !existsSync(p)) {
    die(`${p} not found — is this a Mercatto store repo checkout?`);
  }
}

// Mirror integrity is a precondition, not something we repair silently.
const catalogRaw = readFileSync(PATHS.catalog, "utf8");
const mirrorRaw = readFileSync(PATHS.catalogMirror, "utf8");
if (catalogRaw !== mirrorRaw) {
  die(
    `${PATHS.catalog} and ${PATHS.catalogMirror} already differ before we touch ` +
      `anything. Place 7 must be a byte-identical mirror of place 6 — fix that ` +
      `drift first (scripts/plugin-consistency/check.mjs --fix).`,
  );
}

let catalogParsed;
try {
  catalogParsed = JSON.parse(catalogRaw);
} catch (err) {
  die(`${PATHS.catalog} is not valid JSON: ${err.message}`);
}
const catalogById = new Map(
  (Array.isArray(catalogParsed.extensions) ? catalogParsed.extensions : []).map((e) => [e.id, e]),
);

let backendPkgText = readFileSync(PATHS.backendPkg, "utf8");
let catalogText = catalogRaw;
let extVersionsText = existsSync(PATHS.extensionVersions)
  ? readFileSync(PATHS.extensionVersions, "utf8")
  : null;

const applied = [];
const noops = [];

for (const plugin of plugins) {
  const entry = catalogById.get(plugin.id);
  if (!entry) {
    die(`catalog.json declares no extension with id "${plugin.id}" — nothing to upgrade`);
  }

  // A base extension is not a plugin: its code is vendored in the store, so
  // moving its version means a boilerplate sync, not a dependency bump. Caught
  // here because the drift table only offers checkboxes on plugin rows, so
  // reaching this branch means the catalog and the UI disagree.
  if (entry.type !== "plugin") {
    die(
      `catalog.json entry "${plugin.id}" has type "${entry.type ?? "extension"}", not ` +
        `"plugin". Upgrading a base extension is a boilerplate sync, not a version ` +
        `bump — use scripts/sync-boilerplate/ for that.`,
    );
  }

  // An upgrade presupposes the store already consumes the plugin.
  const dep = bumpBackendDep(backendPkgText, plugin);
  if (dep.before === null) {
    die(
      `${PATHS.backendPkg} has no dependency on ${plugin.packageName}. That makes ` +
        `this an INSTALL, not an upgrade: it needs the folder purge and the 5 ` +
        `barrel edits from PRD-sistema-versiones-y-updates §7.1. Refusing to open ` +
        `a PR that half-installs "${plugin.id}".`,
    );
  }

  const cat = bumpCatalogEntry(catalogText, plugin, entry.version ?? null);
  const ext = extVersionsText
    ? bumpExtensionVersion(extVersionsText, plugin)
    : { changed: false, before: null };

  if (!dep.changed && !cat.changed && !ext.changed) {
    noops.push({ ...plugin, from: dep.before });
    continue;
  }

  backendPkgText = dep.text;
  catalogText = cat.text;
  if (ext.changed) extVersionsText = ext.text;

  applied.push({
    ...plugin,
    depFrom: dep.before,
    catalogFrom: cat.before,
    extFrom: ext.changed ? ext.before : null,
  });
}

const out = process.env.GITHUB_OUTPUT;
const emit = (line) => {
  if (out) appendFileSync(out, `${line}\n`);
  else console.log(`[output] ${line}`);
};

if (applied.length === 0) {
  console.log(`Nothing to do — ${noops.length} plugin(s) already at target:`);
  for (const n of noops) console.log(`  - ${n.id} @ ${n.version}`);
  emit("changed=false");
  process.exit(0);
}

writeFileSync(PATHS.backendPkg, backendPkgText);
writeFileSync(PATHS.catalog, catalogText);
// Place 7 is written from the SAME string, which is what keeps it byte-identical.
writeFileSync(PATHS.catalogMirror, catalogText);
if (extVersionsText !== null) writeFileSync(PATHS.extensionVersions, extVersionsText);

const single = applied.length === 1 ? applied[0] : null;
const branch = single
  ? `plugin/upgrade-${single.id}-${single.version}`
  : `plugin/upgrade-${applied.length}-plugins-${runId}`;
const subject = single
  ? `chore(plugin): upgrade ${single.id} to ${single.version}`
  : `chore(plugin): upgrade ${applied.length} plugins from master`;

const bulletFor = (a) =>
  `- \`${a.id}\` ${a.depFrom} -> ^${a.version}` +
  (a.catalogFrom && a.catalogFrom !== a.version ? ` (catalog ${a.catalogFrom} -> ${a.version})` : "") +
  (a.extFrom ? ` (extension-versions ${a.extFrom} -> ${a.version})` : "");

const bullets = applied.map(bulletFor).join("\n");
const noopNote =
  noops.length > 0
    ? `\nAlready at target, left alone: ${noops.map((n) => `\`${n.id}\``).join(", ")}.\n`
    : "";

const tmp = process.env.RUNNER_TEMP || ".";

writeFileSync(
  join(tmp, "commit-message.txt"),
  `${subject}\n\n${bullets}\n${noopNote}\nRequested by ${requestedBy} via the Mercatto version-checker.\n`,
);

writeFileSync(
  join(tmp, "pr-body.md"),
  [
    "Automated plugin upgrade from the Mercatto version-checker.",
    "",
    bullets,
    noopNote,
    `Requested by \`${requestedBy}\` - [run ${runId}](${serverUrl}/${repository}/actions/runs/${runId}) - base \`${baseBranch}\``,
    "",
    "Touched the canonical places for an npm-consumed plugin: `apps/backend/package.json`,",
    "`packages/project-catalog/src/catalog.json` and its byte-identical",
    "`apps/backend/src/lib/platform/catalog.json` mirror" +
      (applied.some((a) => a.extFrom) ? ", `extension-versions.ts`" : "") +
      ", plus `pnpm-lock.yaml`,",
    "regenerated by pnpm on the runner and verified with `pnpm install --frozen-lockfile`.",
    "",
    ...(usedFallbackToken
      ? [
          "> [!WARNING]",
          "> Opened with the default `GITHUB_TOKEN`, so `on: pull_request` workflows did",
          "> **not** fire. No green check here means *nothing ran*, not *nothing failed*.",
          "> Close and reopen this PR (or push an empty commit) to run CI, or set a",
          "> `PLUGIN_UPGRADE_TOKEN` secret on this repo so future runs behave like a",
          "> human-opened PR.",
          "",
        ]
      : []),
    "**Not auto-merged** - needs a human review, per PRD-sistema-versiones-y-updates §5.",
    "",
  ].join("\n"),
);

console.log(`Applied ${applied.length} bump(s):`);
for (const a of applied) console.log(`  ok ${a.id}: ${a.depFrom} -> ^${a.version}`);
if (noops.length) console.log(`Skipped ${noops.length} already-current plugin(s).`);

emit("changed=true");
emit(`branch=${branch}`);
emit(`subject=${subject}`);
