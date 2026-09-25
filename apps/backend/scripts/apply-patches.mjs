#!/usr/bin/env node

// Aplica los patches de `apps/backend/patches/` sobre node_modules cuando el
// install NO fue de pnpm.
//
// Los patches se declaran en `pnpm.patchedDependencies` del manifest de la RAÍZ,
// y eso sólo lo lee pnpm. DigitalOcean buildea apps/backend con el buildpack de
// Node corriendo `npm ci`: nunca ve ese manifest, así que el admin de producción
// salía con el dashboard de Medusa SIN parchear. Todo lo que el patch hace en el
// modal de fulfillment (DESDEELSUR-61, 78, 80) se veía en dev y en ningún deploy.
// Es el mismo hueco que cierra `neutralize-loyalty-subscriber.mjs` para el
// plugin de loyalty.
//
// Por eso el patch vive acá y no en `patches/` de la raíz: con `source_dir` en
// apps/backend, es lo único que el build de DO tiene garantizado. El manifest de
// la raíz apunta a este mismo archivo, así que hay UNA sola copia.
//
// Dos modos, igual que el de loyalty:
//   (sin flags)  aplica lo que falte (lo usa `postinstall`)
//   --verify     no escribe; falla si algún patch no está aplicado (lo usa `build`)
//
// Bajo pnpm el patch ya viene aplicado y esto es un no-op. El --verify en el
// build hace que un deploy con el dashboard sin parchear ABORTE en vez de salir
// con la UI vieja en silencio.
//
// El nombre del archivo lleva paquete y versión (`@scope__name@x.y.z.patch`,
// la convención de pnpm). Si la versión instalada no coincide, falla: un patch
// escrito para otra versión no se aplica "a ojo".

import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const TAG = '[apply-patches]';

/** `@medusajs__dashboard@2.18.0.patch` → `{ name: '@medusajs/dashboard', version: '2.18.0' }`. */
export function parsePatchFileName(fileName) {
  const match = /^(.+)@(\d+\.\d+\.\d+[^@]*)\.patch$/.exec(fileName);
  if (!match) return null;
  return { name: match[1].replace('__', '/'), version: match[2] };
}

/**
 * Parte un diff unificado (el formato de `git diff`, que es el que genera pnpm)
 * en archivos y hunks. Cada hunk guarda las líneas de antes y de después
 * completas, contexto incluido: con eso se ubica en el archivo sin depender del
 * número de línea.
 */
export function parseUnifiedDiff(text) {
  const files = [];
  let file = null;
  let hunk = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      file = { path: null, hunks: [] };
      files.push(file);
      hunk = null;
      continue;
    }
    if (!file) continue;
    if (line.startsWith('+++ ')) {
      file.path = line.slice(4).replace(/^b\//, '');
      continue;
    }
    if (line.startsWith('--- ') && !hunk) continue;
    const header = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/.exec(line);
    if (header) {
      hunk = { oldStart: Number(header[1]), before: [], after: [] };
      file.hunks.push(hunk);
      continue;
    }
    if (!hunk) continue;
    if (line.startsWith(' ')) {
      hunk.before.push(line.slice(1));
      hunk.after.push(line.slice(1));
    } else if (line.startsWith('-')) {
      hunk.before.push(line.slice(1));
    } else if (line.startsWith('+')) {
      hunk.after.push(line.slice(1));
    }
    // `\ No newline at end of file` y el vacío del final no aportan líneas.
  }
  return files.filter((f) => f.path && f.hunks.length > 0);
}

/** Índice de `block` dentro de `lines` más cercano a `near`, o -1. */
function findBlock(lines, block, near) {
  const fits = (at) => {
    if (at < 0 || at + block.length > lines.length) return false;
    for (let i = 0; i < block.length; i++) if (lines[at + i] !== block[i]) return false;
    return true;
  };
  if (fits(near)) return near;
  for (let delta = 1; delta < lines.length; delta++) {
    if (fits(near - delta)) return near - delta;
    if (fits(near + delta)) return near + delta;
    if (near - delta < 0 && near + delta >= lines.length) break;
  }
  return -1;
}

/**
 * Qué hay que hacer con un archivo: `applied` (ya tiene el patch), `patched`
 * (el contenido nuevo) o `conflict` (ni lo viejo ni lo nuevo: el paquete cambió
 * o el patch está a medias, y no se adivina).
 */
export function planFile(content, hunks) {
  const lines = content.split('\n');
  const states = hunks.map((hunk) => {
    const near = hunk.oldStart - 1;
    if (findBlock(lines, hunk.after, near) !== -1) return 'applied';
    if (findBlock(lines, hunk.before, near) !== -1) return 'pending';
    return 'conflict';
  });

  if (states.every((s) => s === 'applied')) return { status: 'applied' };
  if (states.some((s) => s !== 'pending')) {
    return { status: 'conflict', hunks: states.map((s, i) => `#${i + 1} ${s}`).join(', ') };
  }

  // De abajo hacia arriba: aplicar un hunk no corre las líneas de los anteriores.
  const order = hunks.map((hunk, i) => i).sort((a, b) => hunks[b].oldStart - hunks[a].oldStart);
  for (const i of order) {
    const hunk = hunks[i];
    const at = findBlock(lines, hunk.before, hunk.oldStart - 1);
    if (at === -1) return { status: 'conflict', hunks: `#${i + 1} se perdió al aplicar los demás` };
    lines.splice(at, hunk.before.length, ...hunk.after);
  }
  return { status: 'patched', content: lines.join('\n') };
}

export function run({ backendRoot, verifyOnly }) {
  const patchesDir = join(backendRoot, 'patches');
  const patchFiles = existsSync(patchesDir) ? readdirSync(patchesDir).filter((f) => f.endsWith('.patch')) : [];
  if (patchFiles.length === 0) {
    console.log(`${TAG} no hay patches en ${patchesDir}: nada que hacer.`);
    return 0;
  }

  let failures = 0;
  const fail = (message) => {
    console.error(`${TAG} ${message}`);
    failures++;
  };

  for (const patchFile of patchFiles) {
    const target = parsePatchFileName(patchFile);
    if (!target) {
      fail(`${patchFile}: el nombre no sigue la convención @scope__name@x.y.z.patch.`);
      continue;
    }
    const pkgRoot = join(backendRoot, 'node_modules', ...target.name.split('/'));
    const pkgJson = join(pkgRoot, 'package.json');
    if (!existsSync(pkgJson)) {
      fail(`${patchFile}: ${target.name} no está instalado en ${pkgRoot}.`);
      continue;
    }
    const installed = JSON.parse(readFileSync(pkgJson, 'utf8')).version;
    if (installed !== target.version) {
      fail(
        `${patchFile}: está escrito para ${target.name}@${target.version} y hay instalado ${installed}. ` +
          'Regenerar el patch para la versión nueva en vez de aplicarlo a ojo.',
      );
      continue;
    }

    const files = parseUnifiedDiff(readFileSync(join(patchesDir, patchFile), 'utf8'));
    if (files.length === 0) {
      fail(`${patchFile}: no encontré ningún hunk. ¿Está vacío o no es un diff unificado?`);
      continue;
    }

    for (const file of files) {
      const path = join(pkgRoot, file.path);
      if (!existsSync(path)) {
        fail(`${patchFile}: ${target.name} no tiene ${file.path}.`);
        continue;
      }
      const plan = planFile(readFileSync(path, 'utf8'), file.hunks);
      if (plan.status === 'applied') {
        console.log(`${TAG} ${target.name}/${file.path}: ya aplicado.`);
        continue;
      }
      if (plan.status === 'conflict') {
        fail(`${patchFile}: ${file.path} no coincide ni con el original ni con el parcheado (${plan.hunks}).`);
        continue;
      }
      if (verifyOnly) {
        fail(
          `${target.name}/${file.path} NO ESTÁ PARCHEADO. El postinstall no corrió o no aplicó, y el ` +
            'admin saldría con la UI de Medusa sin los cambios del patch. Correr: node ./scripts/apply-patches.mjs',
        );
        continue;
      }
      // Bajo pnpm los archivos son hard links al store global: se borra antes de
      // escribir para no corromper la copia compartida (igual que el de loyalty).
      const { nlink } = statSync(path);
      rmSync(path);
      writeFileSync(path, plan.content, 'utf8');
      console.log(
        `${TAG} ${target.name}/${file.path}: parcheado` + (nlink > 1 ? ` (se rompió un hard link, nlink ${nlink}).` : '.'),
      );
    }
  }

  return failures === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(run({ backendRoot: join(import.meta.dirname, '..'), verifyOnly: process.argv.includes('--verify') }));
}
