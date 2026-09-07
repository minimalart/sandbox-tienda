#!/usr/bin/env node
/**
 * ¿Cuáles de los 2.848 códigos de Alba existen realmente en Zeus?
 *
 * La carta de colores es data nuestra (Zeus no expone colores ni fórmulas), pero
 * una fórmula que Zeus no reconoce se descubre recién cuando un cliente elige el
 * color y la cotización devuelve 409. Este script lo mide ANTES de importar.
 *
 * Tres modos, en orden:
 *
 *   MODE=bases   Baja las bases y los colores ya cargados del admin de Medusa.
 *                → out/bases.json, out/known-colors.json
 *   MODE=probe   Por cada código nuevo prueba UNA base por letra y corta en el
 *                primer 200: responde "¿existe en Zeus?" con ~2-3 llamadas por
 *                color en vez de 42.  → out/probe.json
 *   MODE=sweep   Para los que existen, barre las 42 combinaciones
 *                (línea, letra) y emite el CSV de fórmulas.
 *                → out/sweep.json, out/formulas.csv
 *
 * El probe SUBESTIMA: la fórmula se resuelve por (línea, letra) pero Zeus tiene
 * agujeros por ARTÍCULO (~6% medido), así que un color puede fallar en la base
 * representativa de su letra y andar en otra de la misma letra. El sweep es el
 * que manda; el probe sólo evita barrer 2.848 códigos que no existen.
 *
 * Semántica de Zeus que este script asume (medida, ver la memoria del proyecto):
 * - `codFormula` va SIN ESPACIOS ("00NN16/000"); con espacio devuelve 409.
 * - 409 "no existe" = esa fórmula no aplica a esa base. NO es un error: es el
 *   resultado negativo. No hay forma de distinguirlo de "el color no existe".
 * - `lista` y `cantidad` son ENTEROS (1.0 → 400).
 * - Timeout real de una cotización: hasta 6 s.
 *
 * Uso (por defecto cotiza `VIA=admin`, que no necesita credenciales de Zeus:
 * alcanza con `MEDUSA_ADMIN_API_KEY` en el .env.local del storefront):
 *
 *   MODE=bases node scripts/tinting/zeus-coverage.mjs
 *   MODE=probe node scripts/tinting/zeus-coverage.mjs
 *   MODE=sweep node scripts/tinting/zeus-coverage.mjs
 *
 * Con `VIA=zeus ZEUS_JWT=…` pega directo a la API del ERP: la mitad de llamadas,
 * pero hay que sacar el JWT de la config del ERP.
 *
 * Los secretos SÓLO por variable de entorno o por el .env.local: nada de
 * pegarlos en el script, y nunca por argumento (queda en el historial del shell
 * y en la lista de procesos).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Mismo directorio que el harvest: éste LEE su colors.json. Ver OUT_DIR allá. */
const OUT = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : join(HERE, 'out');

const MODE = process.env.MODE ?? 'probe';
/**
 * Por dónde se cotiza:
 *
 * - `admin` (default): `POST /admin/erp/tinting/price-probe`, que usa las
 *   credenciales de Zeus ya guardadas en la config del ERP. **No hace falta
 *   ninguna credencial nueva.** La contra: ese endpoint cotiza cantidad 1 y 2
 *   para poder comparar, así que son DOS llamadas a Zeus por cada probe.
 * - `zeus`: directo contra la API con `ZEUS_JWT`. La mitad de llamadas.
 */
const VIA = process.env.VIA ?? 'admin';
const ZEUS_BASE = (process.env.ZEUS_BASE_URL ?? 'https://api.zeuserp.tech/api-ecommerce').replace(/\/+$/, '');
const ZEUS_JWT = process.env.ZEUS_JWT ?? '';
const LISTA = Number(process.env.LISTA ?? 1);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);
const COLLECTION = process.env.COLLECTION ?? 'ALBAHYO';
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;

/**
 * Credenciales del admin: por defecto del .env.local del storefront, igual que
 * `apps/backend/src/scripts/setup-b2b-admin-api.mjs`. Nunca se imprimen.
 */
const ENV_FILE = process.env.ENV_FILE ?? join(HERE, '..', '..', 'apps', 'storefront', '.env.local');

const fromEnvFile = (key) => {
  try {
    const match = readFileSync(ENV_FILE, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
};

const ADMIN_BASE = (
  process.env.MEDUSA_ADMIN_URL || fromEnvFile('NEXT_PUBLIC_MEDUSA_BACKEND_URL')
).replace(/\/+$/, '');
const ADMIN_TOKEN = process.env.MEDUSA_ADMIN_TOKEN || fromEnvFile('MEDUSA_ADMIN_API_KEY');

/** Medusa v2 autentica las API keys secretas por Basic, con la key como usuario. */
function adminHeaders() {
  if (!ADMIN_BASE || !ADMIN_TOKEN) {
    throw new Error(
      `Faltan credenciales del admin. Agregá MEDUSA_ADMIN_API_KEY=sk_... a ${ENV_FILE}, ` +
        'o exportá MEDUSA_ADMIN_URL y MEDUSA_ADMIN_TOKEN.'
    );
  }
  return {
    Authorization: ADMIN_TOKEN.startsWith('sk_')
      ? 'Basic ' + Buffer.from(`${ADMIN_TOKEN}:`).toString('base64')
      : `Bearer ${ADMIN_TOKEN}`,
  };
}

const file = (name) => join(OUT, name);
const readJson = (name, fallback) =>
  existsSync(file(name)) ? JSON.parse(readFileSync(file(name), 'utf8')) : fallback;
const writeJson = (name, data) => writeFileSync(file(name), JSON.stringify(data, null, 1));

/** Lo único que Zeus acepta: el código sin ningún espacio. */
const normalizeFormula = (code) => code.replace(/\s+/g, '').toUpperCase();

// ---------------------------------------------------------------- MODE=bases

async function fetchBases() {
  const base = ADMIN_BASE;
  const headers = adminHeaders();

  const bases = [];
  const colors = [];
  for (let offset = 0; ; offset += 500) {
    const res = await fetch(`${base}/admin/erp/tinting?limit=500&offset=${offset}`, { headers });
    if (!res.ok) throw new Error(`GET /admin/erp/tinting → ${res.status} ${await res.text()}`);
    const body = await res.json();
    bases.push(...body.bases.items);
    colors.push(...body.colors.items);
    console.log(`  offset ${offset}: ${body.bases.items.length} bases, ${body.colors.items.length} colores`);
    if (offset + 500 >= Math.max(body.bases.count, body.colors.count)) break;
  }

  writeJson('bases.json', bases);
  writeJson('known-colors.json', colors);

  const combos = new Map();
  for (const b of bases) {
    if (!b.confirmed || !b.active) continue;
    combos.set(`${b.product_line}::${b.base_letter ?? ''}`, true);
  }
  console.log(`\n${bases.length} bases (${bases.filter((b) => b.confirmed).length} confirmadas)`);
  console.log(`${combos.size} combinaciones (línea, letra)`);
  console.log(`${colors.length} colores ya cargados`);
}

// ------------------------------------------------------------ Zeus quoting

let zeusCalls = 0;

/**
 * Cotiza un par (base, fórmula) por donde diga `VIA`. Devuelve `{hit:true,total}`
 * si el ERP la reconoce, `{hit:false}` si contesta "no existe", y TIRA si el
 * problema es de red, de auth o de config: eso se reintenta, no se anota como
 * miss. Confundir las dos cosas es lo que arruina un barrido — un blip de red
 * quedaría registrado como "esta fórmula no existe" para siempre.
 */
const quote = (articleCode, formulaCode) =>
  VIA === 'admin'
    ? quoteViaAdmin(articleCode, formulaCode)
    : quoteViaZeus(articleCode, formulaCode);

/**
 * `POST /admin/erp/tinting/price-probe`. El endpoint ya traduce el 409 de Zeus a
 * un 422 (`ErpTintingFormulaNotFoundError`) y los problemas de conexión a 424,
 * así que acá el mapeo es directo.
 */
async function quoteViaAdmin(articleCode, formulaCode, attempt = 1) {
  const headers = adminHeaders();

  zeusCalls += 2; // el endpoint cotiza cantidad 1 y 2
  let res;
  try {
    res = await fetch(`${ADMIN_BASE}/admin/erp/tinting/price-probe`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_code: articleCode,
        formula_code: formulaCode,
        list_index: LISTA,
      }),
      // Más largo que contra Zeus directo: son dos cotizaciones encadenadas de
      // hasta 6 s cada una, más el salto por el backend.
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (attempt >= 3) throw new Error(`red: ${error.message}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return quoteViaAdmin(articleCode, formulaCode, attempt + 1);
  }

  const text = await res.text();
  if (res.status === 422) return { hit: false };
  if (res.status === 401 || res.status === 403) {
    throw new Error(`auth ${res.status}: revisá MEDUSA_ADMIN_API_KEY`);
  }
  // 400 = la extensión ERP no está configurada o no cotiza entonados. No es un
  // miss ni un blip: reintentarlo 12.000 veces no lo va a arreglar.
  if (res.status === 400) throw new Error(`config del ERP: ${text.slice(0, 200)}`);
  if (res.status === 424 || res.status >= 500) {
    if (attempt >= 3) throw new Error(`ERP degradado ${res.status}: ${text.slice(0, 160)}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return quoteViaAdmin(articleCode, formulaCode, attempt + 1);
  }
  if (!res.ok) throw new Error(`admin ${res.status}: ${text.slice(0, 200)}`);

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`respuesta no-JSON: ${text.slice(0, 120)}`);
  }
  const total = Number(body?.raw?.quantity_1?.total);
  // `total: 0.0` con 200 es una LISTA sin precio, no una fórmula inexistente.
  return { hit: Number.isFinite(total), total };
}

async function quoteViaZeus(articleCode, formulaCode, attempt = 1) {
  if (!ZEUS_JWT) throw new Error('Falta ZEUS_JWT (o usá VIA=admin).');
  const url =
    `${ZEUS_BASE}/articulos/formulaTintometrico` +
    `?codBase=${encodeURIComponent(articleCode)}` +
    `&codFormula=${encodeURIComponent(normalizeFormula(formulaCode))}` +
    `&lista=${LISTA}&cantidad=1`;

  zeusCalls += 1;
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${ZEUS_JWT}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (attempt >= 3) throw new Error(`red: ${error.message}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return quoteViaZeus(articleCode, formulaCode, attempt + 1);
  }

  const text = await res.text();
  if (res.status === 409 || /no existe/i.test(text)) return { hit: false };
  if (res.status === 401 || res.status === 403) throw new Error(`auth ${res.status}: revisá ZEUS_JWT`);
  if (res.status >= 500) {
    if (attempt >= 3) throw new Error(`Zeus ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return quoteViaZeus(articleCode, formulaCode, attempt + 1);
  }
  if (!res.ok) throw new Error(`Zeus ${res.status}: ${text.slice(0, 200)}`);

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`respuesta no-JSON: ${text.slice(0, 120)}`);
  }
  const total = Number(body?.total);
  // `total: 0.0` con 200 es una LISTA sin precio, no una fórmula inexistente.
  return { hit: Number.isFinite(total), total };
}

/** Pool simple: N en vuelo, sin esperar barreras entre items. */
async function pool(items, worker, { onProgress } = {}) {
  const results = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
      done += 1;
      if (onProgress && done % 25 === 0) onProgress(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
  return results;
}

// ---------------------------------------------------------------- MODE=probe

/** Una base por letra: la confirmada más chica, para que el resultado sea estable. */
function representativeBases(bases) {
  const byLetter = new Map();
  for (const b of bases) {
    if (!b.confirmed || !b.active) continue;
    const letter = b.base_letter ?? '(única)';
    const current = byLetter.get(letter);
    if (!current || (b.size_liters ?? 99) < (current.size_liters ?? 99)) byLetter.set(letter, b);
  }
  return [...byLetter.values()];
}

async function probe() {
  const harvest = readJson('colors.json', null);
  if (!harvest) throw new Error('Falta out/colors.json: corré primero harvest-alba-colors.mjs.');
  const bases = readJson('bases.json', null);
  if (!bases) throw new Error('Falta out/bases.json: corré MODE=bases.');

  const known = new Set(
    readJson('known-colors.json', []).map((c) => normalizeFormula(c.code))
  );
  const reps = representativeBases(bases);
  console.log(`bases representativas: ${reps.map((b) => `${b.base_letter ?? 'única'}=${b.article_code}`).join(' ')}`);

  const state = readJson('probe.json', { results: {}, errors: {} });
  const candidates = Object.values(harvest.colors)
    .filter((c) => c.code)
    .filter((c) => !state.results[c.code])
    .slice(0, LIMIT);

  const nuevos = candidates.filter((c) => !known.has(normalizeFormula(c.code))).length;
  console.log(`${candidates.length} códigos por probar (${nuevos} no están cargados todavía)`);

  await pool(
    candidates,
    async (color) => {
      const tried = [];
      for (const base of reps) {
        let result;
        try {
          result = await quote(base.article_code, color.code);
        } catch (error) {
          state.errors[color.code] = String(error.message);
          return;
        }
        tried.push({ article: base.article_code, letter: base.base_letter, hit: result.hit });
        if (result.hit) {
          state.results[color.code] = {
            exists: true,
            via: { article: base.article_code, letter: base.base_letter },
            total: result.total,
            already_loaded: known.has(normalizeFormula(color.code)),
          };
          delete state.errors[color.code];
          return;
        }
      }
      state.results[color.code] = {
        exists: false,
        tried,
        already_loaded: known.has(normalizeFormula(color.code)),
      };
      delete state.errors[color.code];
    },
    {
      onProgress: (done, total) => {
        writeJson('probe.json', state);
        const hits = Object.values(state.results).filter((r) => r.exists).length;
        console.log(`  ${done}/${total} · existen ${hits} · errores ${Object.keys(state.errors).length} · ${zeusCalls} llamadas`);
      },
    }
  );
  writeJson('probe.json', state);

  const results = Object.entries(state.results);
  const exists = results.filter(([, r]) => r.exists);
  console.log('\n--- resumen probe ---');
  console.log(`códigos probados : ${results.length}`);
  console.log(`existen en Zeus  : ${exists.length}`);
  console.log(`no existen       : ${results.length - exists.length}`);
  console.log(`nuevos utilizables: ${exists.filter(([, r]) => !r.already_loaded).length}`);
  console.log(`errores          : ${Object.keys(state.errors).length}`);
  console.log(`llamadas a Zeus  : ${zeusCalls}`);
}

// ---------------------------------------------------------------- MODE=sweep

async function sweep() {
  const harvest = readJson('colors.json', null);
  const bases = readJson('bases.json', null);
  const probeState = readJson('probe.json', null);
  if (!harvest || !bases || !probeState) {
    throw new Error('Faltan out/colors.json, out/bases.json o out/probe.json.');
  }

  // Una base por (línea, letra): es la granularidad a la que la tabla de
  // fórmulas keyea. Dentro del combo, la más chica.
  const combos = new Map();
  for (const b of bases) {
    if (!b.confirmed || !b.active) continue;
    const key = `${b.product_line}::${b.base_letter ?? ''}`;
    const current = combos.get(key);
    if (!current || (b.size_liters ?? 99) < (current.size_liters ?? 99)) combos.set(key, b);
  }
  const comboList = [...combos.values()];

  const codes = Object.values(harvest.colors)
    .filter((c) => c.code && probeState.results[c.code]?.exists)
    .slice(0, LIMIT);
  console.log(`${codes.length} colores x ${comboList.length} combos = ${codes.length * comboList.length} llamadas`);

  const state = readJson('sweep.json', { hits: {}, errors: {} });
  const jobs = [];
  for (const color of codes) {
    for (const base of comboList) {
      const key = `${color.code}::${base.product_line}::${base.base_letter ?? ''}`;
      if (state.hits[key] !== undefined) continue;
      jobs.push({ color, base, key });
    }
  }
  console.log(`${jobs.length} pendientes (el resto ya estaba en sweep.json)`);

  await pool(
    jobs,
    async ({ color, base, key }) => {
      try {
        const result = await quote(base.article_code, color.code);
        state.hits[key] = result.hit;
        delete state.errors[key];
      } catch (error) {
        state.errors[key] = String(error.message);
      }
    },
    {
      onProgress: (done, total) => {
        writeJson('sweep.json', state);
        const hits = Object.values(state.hits).filter(Boolean).length;
        console.log(`  ${done}/${total} · fórmulas ${hits} · errores ${Object.keys(state.errors).length}`);
      },
    }
  );
  writeJson('sweep.json', state);

  const rows = Object.entries(state.hits)
    .filter(([, hit]) => hit)
    .map(([key]) => {
      const [colorCode, productLine, letter] = key.split('::');
      return { colorCode, productLine, letter };
    })
    .sort((a, b) => a.productLine.localeCompare(b.productLine) || a.colorCode.localeCompare(b.colorCode));

  const csvCell = (v) => (/[",;\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const csv = [
    'color,carta,linea,letra,formula',
    ...rows.map((r) => [r.colorCode, COLLECTION, r.productLine, r.letter, r.colorCode].map(csvCell).join(',')),
  ].join('\r\n');
  writeFileSync(file('formulas.csv'), csv, 'utf8');

  console.log('\n--- resumen sweep ---');
  console.log(`fórmulas encontradas : ${rows.length}`);
  console.log(`colores con al menos 1: ${new Set(rows.map((r) => r.colorCode)).size}`);
  console.log(`errores              : ${Object.keys(state.errors).length}`);
  console.log(`llamadas a Zeus      : ${zeusCalls}`);
  console.log(`\n${file('formulas.csv')}`);
}

// ----------------------------------------------------------------------- main

mkdirSync(OUT, { recursive: true });
const modes = { bases: fetchBases, probe, sweep };
if (!modes[MODE]) {
  console.error(`MODE inválido: ${MODE}. Usá bases | probe | sweep.`);
  process.exit(1);
}
modes[MODE]().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
