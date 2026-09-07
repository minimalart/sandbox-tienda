/**
 * Backfill variant.barcode via the Medusa Admin HTTP API.
 *
 * Counterpart to src/scripts/backfill-barcodes.ts, but instead of needing a
 * reachable DB it talks to the live backend over HTTP using a secret admin API
 * key (Basic auth, same as the storefront's SDK client). Use this to backfill
 * PRODUCTION from your machine, since the DO prod DB blocks direct connections.
 *
 * Reads NEXT_PUBLIC_MEDUSA_BACKEND_URL + MEDUSA_ADMIN_API_KEY from
 * apps/storefront/.env.local (override via env vars of the same name).
 *
 * Sets barcode = ean -> metadata.ean (variant) -> metadata.ean (product) -> sku
 * for every variant whose barcode is empty. Idempotent.
 *
 *   node apps/backend/scripts/backfill-barcodes-admin.mjs           # dry run
 *   node apps/backend/scripts/backfill-barcodes-admin.mjs --apply   # writes
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(__dirname, '..', '..', 'storefront', '.env.local');
const APPLY = process.argv.includes('--apply');
const PAGE = 100;

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnvFile(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trimStart().startsWith('#')) continue;
      out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    /* ignore — fall back to process.env */
  }
  return out;
}

const fileEnv = loadEnvFile(ENV_FILE);
const BASE = (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || fileEnv.NEXT_PUBLIC_MEDUSA_BACKEND_URL || '').replace(/\/$/, '');
const KEY = process.env.MEDUSA_ADMIN_API_KEY || fileEnv.MEDUSA_ADMIN_API_KEY || '';

if (!BASE || !KEY) {
  console.error('Missing NEXT_PUBLIC_MEDUSA_BACKEND_URL or MEDUSA_ADMIN_API_KEY.');
  process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(KEY + ':').toString('base64');

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: AUTH, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json();
}

// ── helpers ────────────────────────────────────────────────────────────────
const normalize = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const out = String(value).trim().replace(/[\s-]+/g, '');
  return out.length > 0 ? out : null;
};

// ── run ──────────────────────────────────────────────────────────────────────
console.log('================================================');
console.log(`Backfilling variant.barcode via ${BASE}`);
console.log(APPLY ? 'MODE: APPLY (writing changes)' : 'MODE: DRY RUN (no changes — pass --apply to write)');
console.log('================================================');

const fields = 'id,metadata,variants.id,variants.sku,variants.barcode,variants.ean,variants.metadata';
let offset = 0;
let total = Infinity;
let scanned = 0;
let updated = 0;
let failed = 0;

while (offset < total) {
  const { products, count } = await api(
    'GET',
    `/admin/products?limit=${PAGE}&offset=${offset}&fields=${encodeURIComponent(fields)}`,
  );
  total = count;

  for (const product of products) {
    const productEan = product.metadata?.ean;
    for (const variant of product.variants ?? []) {
      scanned++;
      if (normalize(variant.barcode)) continue;

      const barcode =
        normalize(variant.ean) ??
        normalize(variant.metadata?.ean) ??
        normalize(productEan) ??
        normalize(variant.sku);
      if (!barcode) continue;

      if (!APPLY) {
        updated++;
        continue;
      }
      try {
        await api('POST', `/admin/products/${product.id}/variants/${variant.id}`, { barcode });
        updated++;
      } catch (err) {
        failed++;
        console.warn(`  ! ${product.id}/${variant.id}: ${err.message}`);
      }
    }
  }

  offset += products.length;
  console.log(`  Progress: ${Math.min(offset, total)}/${total} products — ${updated} variants ${APPLY ? 'updated' : 'to update'}.`);
  if (products.length === 0) break;
}

console.log('================================================');
console.log(`Scanned ${scanned} variants.`);
console.log(`${APPLY ? 'Updated' : 'Would update'}: ${updated} variants.`);
if (failed) console.log(`Failed: ${failed} variants.`);
if (!APPLY) console.log('Re-run with --apply to write the changes.');
