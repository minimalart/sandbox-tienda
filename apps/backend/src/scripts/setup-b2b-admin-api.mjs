/**
 * Deja operativo el canal mayorista vía la API admin HTTP (no requiere acceso
 * directo a la DB). Lee la key del storefront .env.local (MEDUSA_ADMIN_API_KEY).
 *
 *   node src/scripts/setup-b2b-admin-api.mjs <step>
 *   step: linkkeys | products | pricelist | all   (default: all)
 *
 * Idempotente.
 */
import fs from 'node:fs';
import path from 'node:path';

const STEP = process.argv[2] || 'all';

/**
 * ÚNICO consumidor de `WHOLESALE_DISCOUNT` que NO pasa por
 * `modules/corporate/settings.ts`, y no es un olvido: este script corre con
 * `node` pelado contra la API admin HTTP, sin contenedor de Medusa y sin
 * conexión a la base, así que no puede resolver la precedencia DB > env.
 *
 * CONSECUENCIA A TENER PRESENTE: si alguien edita el descuento en el admin
 * (Corporativos → Lista mayorista), este script sigue usando el del entorno y
 * los dos caminos pueden divergir. Para la ruta que sí ve la base está
 * `create-wholesale-price-list.ts`, que hace lo mismo por `medusa exec`.
 */
const DISCOUNT = Number(process.env.WHOLESALE_DISCOUNT ?? '0.2');

// ── credenciales desde el .env.local del storefront ──────────────────────────
const sfEnvPath = path.resolve(process.cwd(), '../storefront/.env.local');
const env = fs.readFileSync(sfEnvPath, 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
};
const BASE = (get('NEXT_PUBLIC_MEDUSA_BACKEND_URL') || '').replace(/\/+$/, '');
const KEY = get('MEDUSA_ADMIN_API_KEY');
if (!BASE || !KEY) throw new Error('Falta NEXT_PUBLIC_MEDUSA_BACKEND_URL o MEDUSA_ADMIN_API_KEY en storefront/.env.local');
const AUTH = 'Basic ' + Buffer.from(`${KEY}:`).toString('base64');

async function api(method, p, body) {
  const r = await fetch(BASE + p, {
    method,
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let json;
  try { json = txt ? JSON.parse(txt) : {}; } catch { json = { raw: txt }; }
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${txt.slice(0, 300)}`);
  return json;
}

const log = (...a) => console.log('[b2b]', ...a);

async function getWholesaleSC() {
  const { sales_channels } = await api('GET', '/admin/sales-channels?limit=100');
  const sc = sales_channels.find((s) => /wholesale|mayorista/i.test(s.name));
  if (!sc) throw new Error('No existe un sales channel Wholesale/Mayorista');
  return sc;
}

async function linkKeys(scId) {
  const { api_keys } = await api('GET', '/admin/api-keys?type=publishable&limit=100');
  for (const k of api_keys) {
    try {
      await api('POST', `/admin/api-keys/${k.id}/sales-channels`, { add: [scId] });
      log(`SC vinculado a publishable key "${k.title}"`);
    } catch (e) {
      log(`key "${k.title}": ${String(e.message).slice(0, 120)}`);
    }
  }
}

async function allProductIds() {
  const ids = [];
  let offset = 0;
  const limit = 200;
  for (;;) {
    const { products, count } = await api('GET', `/admin/products?limit=${limit}&offset=${offset}&fields=id`);
    ids.push(...products.map((p) => p.id));
    offset += limit;
    if (offset >= count || products.length === 0) break;
  }
  return ids;
}

async function addProductsToSC(scId) {
  const ids = await allProductIds();
  log(`Productos totales: ${ids.length}. Vinculando al SC…`);
  const batch = 200;
  for (let i = 0; i < ids.length; i += batch) {
    const chunk = ids.slice(i, i + batch);
    await api('POST', `/admin/sales-channels/${scId}/products`, { add: chunk });
    log(`  ${Math.min(i + batch, ids.length)}/${ids.length}`);
  }
  log('Productos vinculados al SC Wholesale.');
}

async function wholesaleGroupIds() {
  // Grupos vinculados a empresas (companies) — son los que usa el flujo B2B.
  const ids = new Set();
  try {
    const { companies } = await api('GET', '/admin/companies?limit=200');
    for (const c of companies ?? []) if (c.customer_group_id) ids.add(c.customer_group_id);
  } catch (e) { log(`companies: ${String(e.message).slice(0, 100)}`); }
  // Fallback: grupos cuyo nombre sugiere mayorista.
  if (!ids.size) {
    try {
      const { customer_groups } = await api('GET', '/admin/customer-groups?limit=200');
      for (const g of customer_groups ?? []) if (/mayorista|wholesale|b2b/i.test(g.name)) ids.add(g.id);
    } catch (e) { log(`customer-groups: ${String(e.message).slice(0, 100)}`); }
  }
  return [...ids];
}

async function createPriceList() {
  const existing = await api('GET', '/admin/price-lists?limit=100');
  for (const p of existing.price_lists ?? []) {
    if (p.title === 'Mayorista -20%') {
      await api('DELETE', `/admin/price-lists/${p.id}`);
      log(`Price list previa borrada (${p.id}) para recrearla.`);
    }
  }
  const { regions } = await api('GET', '/admin/regions?fields=id,currency_code');
  const currency = regions[0]?.currency_code || 'ars';

  // Precios actuales por variante.
  const prices = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const { products, count } = await api(
      'GET',
      `/admin/products?limit=${limit}&offset=${offset}&fields=id,variants.id,variants.prices.amount,variants.prices.currency_code`,
    );
    for (const p of products) {
      for (const v of p.variants ?? []) {
        const base = (v.prices ?? []).find((pr) => pr.currency_code === currency);
        if (base?.amount == null) continue;
        prices.push({ variant_id: v.id, currency_code: currency, amount: Math.round(base.amount * (1 - DISCOUNT) * 100) / 100 });
      }
    }
    offset += limit;
    if (offset >= count || products.length === 0) break;
  }
  log(`Precios calculados (-${Math.round(DISCOUNT * 100)}%): ${prices.length} variantes.`);

  const groupIds = await wholesaleGroupIds();
  const status = groupIds.length ? 'active' : 'draft';

  // Crear la price list (sin precios) y luego cargarlos en lotes.
  const { price_list } = await api('POST', '/admin/price-lists', {
    title: 'Mayorista -20%',
    description: `Precios mayoristas: -${Math.round(DISCOUNT * 100)}% sobre el precio actual.`,
    type: 'override',
    status,
    ...(groupIds.length ? { rules: { 'customer.groups.id': groupIds } } : {}),
  });
  log(`Price list creada (${status}) id=${price_list.id}, grupos=${groupIds.length}`);

  const batch = 200;
  for (let i = 0; i < prices.length; i += batch) {
    const chunk = prices.slice(i, i + batch);
    await api('POST', `/admin/price-lists/${price_list.id}/prices/batch`, { create: chunk });
    log(`  precios ${Math.min(i + batch, prices.length)}/${prices.length}`);
  }
  log('Price list cargada.');
  if (!groupIds.length) log('Sin grupos mayoristas → quedó en DRAFT. Vinculá un customer group a una empresa y activala.');
}

(async () => {
  log(`Backend: ${BASE} | step: ${STEP}`);
  const sc = await getWholesaleSC();
  log(`Wholesale SC: ${sc.id} (${sc.name})`);
  if (STEP === 'linkkeys' || STEP === 'all') await linkKeys(sc.id);
  if (STEP === 'products' || STEP === 'all') await addProductsToSC(sc.id);
  if (STEP === 'pricelist' || STEP === 'all') await createPriceList();
  log('Listo.');
})().catch((e) => {
  console.error('[b2b] ERROR:', e.message);
  process.exit(1);
});
