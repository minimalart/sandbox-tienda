/**
 * Smoke test del adapter Odoo contra una instancia real (local o remota).
 *
 * Uso:
 *   ODOO_BASE_URL=http://localhost:8069 \
 *   ODOO_DB=mercatto-dev \
 *   ODOO_UID=2 \
 *   ODOO_API_KEY=<key> \
 *   ODOO_SKUS=E-COM07,E-COM08,E-COM11 \
 *   node --experimental-transform-types --import ./test-register.mjs scripts/odoo-smoke-test.ts
 *
 * NO usa el runtime de Medusa — instancia el adapter directamente contra un
 * ctx mínimo. Sirve para verificar que la comunicación JSON-RPC anda antes de
 * cablear el config en la DB y depender del cron.
 */

import { OdooErpAdapter } from '../src/modules/erp/adapters/odoo.ts';
import type { AdapterContext } from '../src/modules/erp/adapters/types.ts';
import type { ErpSalePayload } from '../src/modules/erp/types.ts';
import type { Logger } from '@medusajs/framework/types';

function envOrDie(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`ERROR: falta la variable de entorno ${name}`);
    process.exit(1);
  }
  return value;
}

function envInt(name: string): number {
  const raw = envOrDie(name);
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`ERROR: ${name}=${raw} no es un entero > 0`);
    process.exit(1);
  }
  return n;
}

const baseUrl = envOrDie('ODOO_BASE_URL');
const db = envOrDie('ODOO_DB');
const uid = envInt('ODOO_UID');
const apiKey = envOrDie('ODOO_API_KEY');
const skusRaw = envOrDie('ODOO_SKUS');
const skus = skusRaw.split(',').map((s) => s.trim()).filter(Boolean);

if (skus.length === 0) {
  console.error('ERROR: ODOO_SKUS vacío después de split.');
  process.exit(1);
}

const logger: Logger = {
  info: (msg: unknown) => console.log(`[info]`, msg),
  warn: (msg: unknown) => console.warn(`[warn]`, msg),
  error: (msg: unknown) => console.error(`[error]`, msg),
  debug: (msg: unknown) => console.log(`[debug]`, msg),
} as unknown as Logger;

const ctx: AdapterContext = {
  credentials: { api_key: apiKey },
  settings: {
    odoo: {
      base_url: baseUrl,
      db,
      uid,
      only_published: process.env.ODOO_ONLY_PUBLISHED === '1',
    },
  },
  countryCode: 'AR',
  logger,
};

const adapter = new OdooErpAdapter();

async function main() {
  console.log('=== capabilities ===');
  console.log(JSON.stringify(adapter.getCapabilities(), null, 2));

  console.log('\n=== validateCredentials ===');
  const validation = await adapter.validateCredentials(ctx);
  console.log(JSON.stringify(validation, null, 2));
  if (!validation.ok) {
    console.error('validación falló — abortando');
    process.exit(2);
  }

  console.log(`\n=== getStockBySku ([${skus.join(', ')}]) ===`);
  const stock = await adapter.getStockBySku(skus, ctx);
  const asObject: Record<string, unknown> = {};
  for (const [sku, result] of stock.entries()) {
    asObject[sku] = result;
  }
  console.log(JSON.stringify(asObject, null, 2));

  if (process.env.ODOO_CATALOG_SMOKE === '1') {
    console.log(`\n=== getCatalogChanges (only_published=${process.env.ODOO_ONLY_PUBLISHED === '1'}) ===`);
    const catalog = await adapter.getCatalogChanges(null, ctx);
    console.log(`total rows: ${catalog.length}`);
    const preview = catalog.slice(0, 5).map((row) => ({
      code: row.code,
      title: row.title,
      price_base: row.prices?.[0] ?? null,
      published: row.published,
      category: row.category_code,
    }));
    console.log('primeros 5:');
    console.log(JSON.stringify(preview, null, 2));
  }

  if (process.env.ODOO_SKIP_NOTIFY_SALE === '1') {
    console.log('\n=== notifySale skippeado (ODOO_SKIP_NOTIFY_SALE=1) ===');
    console.log('\n=== OK ===');
    return;
  }

  console.log('\n=== notifySale (payload sintético) ===');
  const nowMs = Date.now();
  const payload: ErpSalePayload = {
    event_key: `smoke-${nowMs}`,
    order_id: `SMOKE-${nowMs}`,
    display_id: 9999,
    created_at: new Date().toISOString(),
    country_code: 'AR',
    currency_code: 'ARS',
    customer: {
      id: null,
      email: `smoke-buyer-${nowMs}@example.com`,
      first_name: 'Smoke',
      last_name: 'Buyer',
      phone: '+541155555555',
      document: { type: 'CUIT', number: '20-99999999-9' },
    },
    items: [
      {
        sku: 'E-COM07',
        title: 'Large Cabinet',
        quantity: 1,
        unit_price: 320,
        total: 320,
      },
      {
        sku: 'E-COM08',
        title: 'Storage Box',
        quantity: 2,
        unit_price: 15.8,
        total: 31.6,
      },
    ],
    totals: {
      subtotal: 351.6,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 351.6,
    },
    payment: {
      provider_id: 'manual',
      captured_amount: 351.6,
      currency_code: 'ARS',
    },
    shipping: {
      method: null,
      address: {
        street: 'Av. Corrientes 1234',
        city: 'CABA',
        province: 'CABA',
        postal_code: 'C1043',
        country_code: 'AR',
      },
    },
  };
  const sale = await adapter.notifySale(payload, ctx);
  console.log(JSON.stringify(sale, null, 2));

  console.log('\n=== OK ===');
}

main().catch((err) => {
  console.error('\n=== ERROR ===');
  console.error(err instanceof Error ? err.stack : err);
  process.exit(3);
});
