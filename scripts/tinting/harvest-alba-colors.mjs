#!/usr/bin/env node
/**
 * Harvest de la carta COMPLETA de colores de Alba (3.132 páginas) + las 8 fotos
 * de ambiente por color.
 *
 * Por qué no alcanza la home: `/es/paletas-de-colores` sólo pinta 384 swatches
 * (8 familias x 48) — es una selección editorial. El universo real está en
 * `/es/sitemap.xml`: 3.132 URLs `/es/paletas-de-colores/<slug>-<ccid>`, de las
 * cuales ~2.848 traen el código de fórmula en el nombre ("14YR 10/434").
 *
 * El buscador del sitio (`POST /bin/api/colorSearch`) devuelve hex + colección
 * pero está topeado en 3 resultados y robots.txt lo tiene `Disallow: /bin/api/*`,
 * así que la ruta correcta es sitemap + página de detalle (ambas permitidas).
 *
 * TRAMPA MEDIDA: ante una URL que no resuelve, AEM contesta **HTTP 200** con un
 * `<title>Not Found | Alba</title>` y —peor— con el `data-item-*` de OTRO color.
 * Por eso cada respuesta se valida contra el ccid de la URL: sin ese chequeo el
 * harvest guarda hex equivocados y no hay forma de notarlo después.
 *
 * Uso:
 *   node harvest-alba-colors.mjs                 # delay 1200ms (~65 min)
 *   DELAY_MS=10000 node harvest-alba-colors.mjs  # respeta Crawl-delay: 10 (~8.7 h)
 *   LIMIT=25 node harvest-alba-colors.mjs        # prueba corta
 *
 * Es reanudable: guarda cada color en out/colors.json y saltea los ya bajados.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://www.alba.com.ar';
const SITEMAP = `${ORIGIN}/es/sitemap.xml`;
/**
 * Los dos scripts escriben acá. `out/` está en el .gitignore raíz (regla global),
 * así que la data generada NO se commitea: es regenerable y son 3,3 MB. Se puede
 * mover con OUT_DIR=/otra/ruta.
 */
const OUT_DIR = process.env.OUT_DIR
  ? resolve(process.env.OUT_DIR)
  : join(dirname(fileURLToPath(import.meta.url)), 'out');
const OUT_JSON = join(OUT_DIR, 'colors.json');
const OUT_CSV = join(OUT_DIR, 'colors.csv');
const OUT_CSV_IMAGES = join(OUT_DIR, 'colors-con-fotos.csv');

const DELAY_MS = Number(process.env.DELAY_MS ?? 1200);
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const OFFSET = Number(process.env.OFFSET ?? 0);
const MAX_RETRIES = 4;

// Las 8 fotos que publica Alba por color. El id del CDN NO es el ccid: hay que
// leerlo de la página (medido: ccid 1671375 -> msp 52181).
const ROOMS = [
  'Hallway',
  'Bedroom',
  'Childrensroom',
  'Livingroom',
  'Kitchen',
  'DiningRoom',
  'Bathroom',
  'Homeoffice',
];
const IMG_BASE = 'https://msp.images.akzonobel.com/glb/dh/inspirational-images';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&');

async function get(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) minimalart-tinting-harvest/1.0',
      'Accept-Language': 'es-AR,es;q=0.9',
    },
  });
  return { status: res.status, text: await res.text() };
}

/** Un solo atributo del HTML, sin traer un parser de DOM al script. */
const attr = (html, name) => {
  const m = html.match(new RegExp(`${name}="([^"]*)"`));
  return m ? decodeEntities(m[1]) : null;
};

/**
 * `<title>` = "Nombre - CODIGO - Familia - Encontrar productos de este color | Alba".
 * La familia se saca por resta (el nombre puede tener guiones propios) y viene ya
 * en castellano — a diferencia del JSON de la home, que la trae en inglés.
 */
function parseFamily(title, name) {
  const withoutSuffix = title.replace(/\s*-\s*Encontrar productos de este color \| Alba\s*$/, '');
  if (!name || !withoutSuffix.startsWith(name)) return null;
  const rest = withoutSuffix.slice(name.length).replace(/^\s*-\s*/, '').trim();
  return rest || null;
}

function extract(html, ccid) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
  const cleanTitle = title ? decodeEntities(title).trim() : '';
  if (/Not Found/i.test(cleanTitle)) return { ok: false, reason: 'not-found-page' };

  const name = attr(html, 'data-item-name');
  const hex = attr(html, 'data-item-hex');
  const id = attr(html, 'data-item-id');
  if (!name || !hex) return { ok: false, reason: 'sin data-item-*' };
  // La página de error trae los datos de otro color: sin este chequeo el hex se
  // mezcla entre colores y no hay forma de notarlo después.
  if (id !== ccid) return { ok: false, reason: `ccid no coincide (pagina ${id})` };

  const mspIds = [...new Set([...html.matchAll(/inspirational-images\/[A-Za-z]+-(\d+)\.png/g)].map((m) => m[1]))];
  const codeMatch = name.match(/(\d{2}[A-Z]{2})\s+(\d{2}\/\d{3})\s*$/);

  return {
    ok: true,
    color: {
      ccid,
      name,
      // El nombre publicado es "Nombre * - 14YR 10/434": el código es el codFormula.
      display_name: name.replace(/\s*\*\s*-/, ' -'),
      code: codeMatch ? `${codeMatch[1]} ${codeMatch[2]}` : null,
      hex: hex.toUpperCase(),
      family: parseFamily(cleanTitle, name),
      // El asterisco lo pone Alba en el nombre; anotarlo aparte para no perderlo
      // si después decidimos limpiarlo del nombre visible.
      starred: /\*/.test(name),
      msp_id: mspIds.length === 1 ? mspIds[0] : null,
      images:
        mspIds.length === 1
          ? Object.fromEntries(ROOMS.map((room) => [room, `${IMG_BASE}/${room}-${mspIds[0]}.png`]))
          : {},
    },
  };
}

/** "bermellón" -> "bermellon": el sitio resuelve las dos formas, y tener la
 * alternativa cubre cualquier slug del sitemap que no exista tildado. */
const deaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

async function fetchColor(url) {
  const ccid = url.match(/-(\d{6,})$/)[1];
  // OJO: `new URL().pathname` YA viene percent-encoded. Sin este `decodeURI` el
  // `encodeURI` de abajo encodea el `%` y "bermell%C3%B3n" sale
  // "bermell%25C3%25B3n" -> 404 en las 872 URLs con tilde del sitemap.
  const path = decodeURI(new URL(url).pathname);
  const variants = [path, deaccent(path)].filter((p, i, a) => a.indexOf(p) === i);
  let lastReason = 'sin intentos';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const variant = variants[(attempt - 1) % variants.length];
    const { status, text } = await get(ORIGIN + encodeURI(variant));
    if (status === 200) {
      const parsed = extract(text, ccid);
      if (parsed.ok) return { ok: true, color: parsed.color, attempts: attempt };
      lastReason = parsed.reason;
    } else {
      lastReason = `HTTP ${status}`;
    }
    if (attempt < MAX_RETRIES) await sleep(DELAY_MS * attempt * 2);
  }
  return { ok: false, ccid, url, reason: lastReason };
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('bajando sitemap…');
  const { text: xml } = await get(SITEMAP);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => decodeEntities(m[1]))
    .filter((u) => /\/es\/paletas-de-colores\/.+-\d{6,}$/.test(u));
  console.log(`${urls.length} páginas de color en el sitemap`);

  const state = existsSync(OUT_JSON)
    ? JSON.parse(readFileSync(OUT_JSON, 'utf8'))
    : { colors: {}, failures: {} };

  const pending = urls
    .filter((u) => !state.colors[u.match(/-(\d{6,})$/)[1]])
    .slice(OFFSET, OFFSET + LIMIT);
  console.log(`${pending.length} por bajar (${Object.keys(state.colors).length} ya en cache), delay ${DELAY_MS}ms`);

  let done = 0;
  for (const url of pending) {
    const result = await fetchColor(url);
    if (result.ok) {
      state.colors[result.color.ccid] = result.color;
      delete state.failures[result.color.ccid];
    } else {
      state.failures[result.ccid] = result;
      console.warn(`  FALLA ${result.ccid}: ${result.reason}`);
    }
    done += 1;
    if (done % 25 === 0 || done === pending.length) {
      writeFileSync(OUT_JSON, JSON.stringify(state, null, 1));
      console.log(`  ${done}/${pending.length} (fallas: ${Object.keys(state.failures).length})`);
    }
    await sleep(DELAY_MS);
  }
  writeFileSync(OUT_JSON, JSON.stringify(state, null, 1));

  // CSV listo para POST /admin/erp/tinting/import (kind: colors). Sólo los que
  // tienen código de fórmula: el resto (esmaltes "Esm Std", Albalux) no se entona.
  const colors = Object.values(state.colors);
  const tintable = colors
    .filter((c) => c.code)
    .sort((a, b) => (a.family || '').localeCompare(b.family || '') || a.name.localeCompare(b.name));

  const row = (color, index) => [color.code, color.display_name, 'ALBAHYO', color.hex, color.family, index + 1];
  const toCsv = (header, rows) => [header.join(','), ...rows].join('\r\n');

  writeFileSync(
    OUT_CSV,
    toCsv(
      ['codigo', 'nombre', 'carta', 'hex', 'familia', 'rank'],
      tintable.map((color, index) => row(color, index).map(csvCell).join(','))
    ),
    'utf8'
  );

  // Segundo CSV con las fotos, separado a propósito: cada fila suma ~800 bytes de
  // URLs y el POST del admin tira 413 arriba de ~100 KB, así que este va en tandas
  // de ~100 filas mientras el otro entra en tandas de ~500. La carta se puede
  // cargar primero sin fotos —el import distingue columna ausente de vacía, así
  // que no se pisan— y las fotos después.
  writeFileSync(
    OUT_CSV_IMAGES,
    toCsv(
      ['codigo', 'nombre', 'carta', 'hex', 'familia', 'rank', 'imagenes'],
      tintable.map((color, index) =>
        [
          ...row(color, index),
          Object.entries(color.images)
            .map(([room, url]) => `${room}=${url}`)
            .join('|'),
        ]
          .map(csvCell)
          .join(',')
      )
    ),
    'utf8'
  );

  console.log('\n--- resumen ---');
  console.log(`colores bajados : ${colors.length}`);
  console.log(`con codFormula  : ${tintable.length}`);
  console.log(`sin código      : ${colors.length - tintable.length}`);
  console.log(`con 8 fotos     : ${colors.filter((c) => Object.keys(c.images).length === 8).length}`);
  console.log(`sin fotos       : ${colors.filter((c) => !Object.keys(c.images).length).length}`);
  console.log(`fallas          : ${Object.keys(state.failures).length}`);
  console.log(`\n${OUT_JSON}\n${OUT_CSV}\n${OUT_CSV_IMAGES}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
