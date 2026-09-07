#!/usr/bin/env node
/**
 * Copia imágenes de producto de OTRA instancia Medusa a ésta, cruzando por SKU.
 *
 * PARA QUÉ. Una tienda nueva que arranca con el catálogo de un ERP ya poblado en
 * otra instancia hereda el problema de las fotos: el catalog sync sólo baja las
 * que el ERP sirve, y si el ERP contesta 500 o no tiene la foto, el producto se
 * publica sin imagen. Si otra instancia del mismo ERP ya las tiene bajadas, esto
 * las trae. Medido en desdeelsur: 405 de 874 productos sin imagen se resolvieron
 * así; los otros 469 no existen en ningún origen.
 *
 * NO ES UN REEMPLAZO DEL SYNC. Es una operación puntual de puesta a punto. Una
 * imagen puesta por acá NO se sobrescribe nunca —`planProductImages` saltea todo
 * producto que ya tenga foto—, así que si el ERP algún día sirve una mejor, no
 * va a entrar. Correr esto es decidir que la foto del origen es la buena.
 *
 * LO QUE SE COPIA ES EL ARCHIVO, no la URL. Cada imagen se baja y se vuelve a
 * subir por `POST /admin/uploads`, así queda en el bucket de ESTA instancia.
 * Apuntar el producto a la URL del bucket ajeno dejaría la tienda dependiendo de
 * la infraestructura de otro cliente.
 *
 * EL CRUCE ES POR SKU Y SE VALIDA. El origen puede ser una instancia con varios
 * demos y miles de productos, así que un SKU corto ("129") puede existir en más
 * de uno. Un SKU que resuelve a imágenes distintas se descarta y se reporta; NO
 * se elige una. El reporte también trae el título de las dos puntas para poder
 * revisar a ojo antes de escribir.
 *
 * Uso:
 *   # 1. Preview: no escribe nada, deja el plan en out/plan.json
 *   SOURCE_URL=https://back-otra.example SOURCE_PK=pk_… \
 *   MEDUSA_ADMIN_URL=https://back-esta.example MEDUSA_ADMIN_TOKEN=… \
 *     node scripts/catalog/copy-product-images.mjs
 *
 *   # 2. Un lote chico para ver el resultado en la tienda
 *   APPLY=1 LIMIT=10 node scripts/catalog/copy-product-images.mjs
 *
 *   # 3. Todo
 *   APPLY=1 node scripts/catalog/copy-product-images.mjs
 *
 * Es reanudable: `out/copied.json` guarda lo hecho cada 25 y se saltea al volver.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** `out/` está en el .gitignore raíz: la data generada no se commitea. */
const OUT = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : join(HERE, 'out');
const PLAN_JSON = join(OUT, 'plan.json');
const COPIED_JSON = join(OUT, 'copied.json');

/** Instancia ORIGEN: se lee por su API pública de store, no hace falta admin. */
const SOURCE_URL = (process.env.SOURCE_URL ?? '').replace(/\/+$/, '');
const SOURCE_PK = process.env.SOURCE_PK ?? '';

/** Instancia DESTINO: acá sí hace falta admin, porque se sube y se escribe. */
const ADMIN_URL = (process.env.MEDUSA_ADMIN_URL ?? '').replace(/\/+$/, '');
const ADMIN_TOKEN = process.env.MEDUSA_ADMIN_TOKEN ?? '';

/** Sin esto no escribe: el default es preview, igual que los imports del ERP. */
const APPLY = process.env.APPLY === '1' || process.env.APPLY === 'true';
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
/** Pausa entre productos, para no castigar el bucket del origen. */
const DELAY_MS = Number(process.env.DELAY_MS ?? 150);
const PAGE = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const die = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

if (!SOURCE_URL || !SOURCE_PK) die('Faltan SOURCE_URL y SOURCE_PK (la instancia de la que se copia).');
if (!ADMIN_URL || !ADMIN_TOKEN) die('Faltan MEDUSA_ADMIN_URL y MEDUSA_ADMIN_TOKEN (la instancia destino).');

/**
 * `fields=*variants.sku` NO expande los SKUs: vuelven vacíos y el cruce da CERO
 * sin un solo error. Hay que pedir `*variants` entero. Es la trampa que más
 * tiempo costó la primera vez, en las dos instancias.
 */
const VARIANT_FIELDS = '*variants';

async function getJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url.split('?')[0]}`);
  return res.json();
}

/** Todas las páginas de un listado de productos. */
async function listAll(base, path, headers, fields) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${base}${path}?limit=${PAGE}&offset=${offset}&fields=${fields}`;
    const data = await getJson(url, headers);
    const products = data.products ?? [];
    out.push(...products);
    if (!products.length || out.length >= (data.count ?? 0)) break;
  }
  return out;
}

const skusOf = (product) =>
  (product.variants ?? []).map((v) => (v.sku ?? '').trim()).filter(Boolean);

const hasImage = (product) => Boolean(product.thumbnail) || (product.images ?? []).length > 0;

async function buildPlan() {
  console.log('Leyendo el catálogo destino…');
  const target = await listAll(
    ADMIN_URL,
    '/admin/products',
    { authorization: `Bearer ${ADMIN_TOKEN}` },
    `id,title,status,thumbnail,*images,${VARIANT_FIELDS}`
  );
  console.log('Leyendo el catálogo origen…');
  const source = await listAll(
    SOURCE_URL,
    '/store/products',
    { 'x-publishable-api-key': SOURCE_PK },
    `id,title,thumbnail,${VARIANT_FIELDS}`
  );

  const bySku = new Map();
  for (const p of source) {
    for (const sku of skusOf(p)) {
      if (!bySku.has(sku)) bySku.set(sku, []);
      bySku.get(sku).push(p);
    }
  }

  const missing = target.filter((p) => !hasImage(p));
  const plan = [];
  const report = { ambiguous: [], source_has_no_image: [], not_in_source: [] };

  for (const p of missing) {
    const candidates = skusOf(p).flatMap((sku) => bySku.get(sku) ?? []);
    if (!candidates.length) {
      report.not_in_source.push({ sku: skusOf(p)[0] ?? null, title: p.title });
      continue;
    }
    const urls = [...new Set(candidates.map((c) => c.thumbnail).filter(Boolean))];
    if (!urls.length) {
      report.source_has_no_image.push({ sku: skusOf(p)[0] ?? null, title: p.title });
      continue;
    }
    if (urls.length > 1) {
      // Dos productos distintos del origen comparten el SKU: no se adivina.
      report.ambiguous.push({ sku: skusOf(p)[0] ?? null, title: p.title, urls });
      continue;
    }
    plan.push({
      product_id: p.id,
      sku: skusOf(p)[0],
      target_title: p.title,
      source_title: candidates[0].title,
      url: urls[0],
    });
  }

  return { plan, report, counts: { target: target.length, source: source.length, missing: missing.length } };
}

/** `POST /admin/uploads` — multipart, campo `files`. Deja el archivo en ESTE bucket. */
async function upload(filename, bytes, contentType) {
  const form = new FormData();
  form.append('files', new Blob([bytes], { type: contentType }), filename);
  const res = await fetch(`${ADMIN_URL}/admin/uploads`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    body: form,
  });
  if (!res.ok) throw new Error(`upload HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const data = await res.json();
  const url = (data.files ?? [data.file]).filter(Boolean)[0]?.url;
  if (!url) throw new Error('el upload no devolvió URL');
  return url;
}

async function setImage(productId, url) {
  const res = await fetch(`${ADMIN_URL}/admin/products/${productId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ images: [{ url }], thumbnail: url }),
  });
  if (!res.ok) throw new Error(`update HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
}

const EXT_BY_TYPE = { 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
const filenameFor = (sku, contentType) => {
  const slug = sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'articulo';
  return `copia-${slug}${EXT_BY_TYPE[contentType] ?? '.jpg'}`;
};

async function apply(plan) {
  const copied = existsSync(COPIED_JSON) ? JSON.parse(readFileSync(COPIED_JSON, 'utf8')) : {};
  let ok = 0;
  let failed = 0;
  let bytesTotal = 0;

  for (const [index, item] of plan.entries()) {
    if (copied[item.product_id]) continue;
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`origen HTTP ${res.status}`);
      const contentType = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0];
      const bytes = new Uint8Array(await res.arrayBuffer());
      const url = await upload(filenameFor(item.sku, contentType), bytes, contentType);
      await setImage(item.product_id, url);
      copied[item.product_id] = { sku: item.sku, url, bytes: bytes.length };
      bytesTotal += bytes.length;
      ok += 1;
    } catch (error) {
      failed += 1;
      console.error(`   ✖ ${item.sku}: ${String(error.message).slice(0, 110)}`);
    }
    if ((index + 1) % 25 === 0) {
      writeFileSync(COPIED_JSON, JSON.stringify(copied, null, 2));
      console.log(`   ${index + 1}/${plan.length}  ok=${ok} fallidas=${failed}`);
    }
    await sleep(DELAY_MS);
  }

  writeFileSync(COPIED_JSON, JSON.stringify(copied, null, 2));
  return { ok, failed, megabytes: bytesTotal / 1024 / 1024 };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { plan, report, counts } = await buildPlan();
  writeFileSync(PLAN_JSON, JSON.stringify({ plan, report }, null, 2));

  console.log('');
  console.log(`Destino: ${counts.target} productos, ${counts.missing} sin imagen.`);
  console.log(`Origen : ${counts.source} productos.`);
  console.log('');
  console.log(`  copiables (match único con foto) : ${plan.length}`);
  console.log(`  el origen tampoco tiene foto     : ${report.source_has_no_image.length}`);
  console.log(`  SKU ambiguo en el origen         : ${report.ambiguous.length}`);
  console.log(`  SKU inexistente en el origen     : ${report.not_in_source.length}`);
  console.log(`\nPlan completo en ${PLAN_JSON}`);

  const sample = plan.slice(0, 8);
  if (sample.length) {
    console.log('\nMuestra — revisá que los títulos sean el mismo artículo:');
    for (const item of sample) {
      console.log(`  ${item.sku.padStart(7)}  ${item.target_title.slice(0, 34).padEnd(34)} ← ${item.source_title.slice(0, 34)}`);
    }
  }

  if (!APPLY) {
    console.log('\nPreview. Para escribir: APPLY=1 (probá primero con LIMIT=10).');
    return;
  }

  const slice = Number.isFinite(LIMIT) ? plan.slice(0, LIMIT) : plan;
  console.log(`\nCopiando ${slice.length}…`);
  const result = await apply(slice);
  console.log(`\nListo: ok=${result.ok} fallidas=${result.failed} — ${result.megabytes.toFixed(1)} MB.`);
}

main().catch((error) => die(error.stack ?? String(error)));
