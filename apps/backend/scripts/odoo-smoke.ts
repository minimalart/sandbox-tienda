/**
 * Smoke test READ-ONLY: instancia el OdooErpAdapter real y llama
 * getCatalogChanges contra la Odoo de EducaBot. Imprime coverage y una muestra.
 * NO escribe nada en Medusa — es solo para corroborar que description_ecommerce
 * (HTML → Markdown) y weight llegan bien al ErpCatalogRow.
 *
 * Uso: node --experimental-transform-types scripts/odoo-research/smoke-adapter.ts
 */
import { OdooErpAdapter } from '../src/modules/erp/adapters/odoo.ts';
import type { AdapterContext } from '../src/modules/erp/adapters/types.ts';
import type { ErpOdooSettings } from '../src/modules/erp/types.ts';

const apiKey = process.env.ODOO_EDUCABOT_API_KEY;
if (!apiKey) {
  console.error('Missing ODOO_EDUCABOT_API_KEY in env.');
  process.exit(1);
}

const settings: ErpOdooSettings = {
  base_url: 'https://tienda.educabot.com',
  db: 'odoo',
  uid: 72,
  api_key: 'unused-here-viaja-por-credentials',
  only_published: true,
};

const ctx: AdapterContext = {
  countryCode: 'AR',
  credentials: { api_key: apiKey },
  settings: { odoo: settings } as unknown as AdapterContext['settings'],
  logger: {
    info: (m: string) => console.log(`[info] ${m}`),
    warn: (m: string) => console.warn(`[warn] ${m}`),
    error: (m: string) => console.error(`[error] ${m}`),
    debug: () => {},
  } as unknown as AdapterContext['logger'],
};

const adapter = new OdooErpAdapter();
console.log('Fetching catalog from tienda.educabot.com …');
const rows = await adapter.getCatalogChanges(null, ctx);

const withDescription = rows.filter((r) => r.description && r.description.trim().length > 0);
const withWeight = rows.filter((r) => r.weight !== null);

console.log('');
console.log(`── Coverage on ${rows.length} rows ──`);
console.log(`  description populated: ${withDescription.length} (${((withDescription.length / rows.length) * 100).toFixed(0)}%)`);
console.log(`  weight populated:      ${withWeight.length} (${((withWeight.length / rows.length) * 100).toFixed(0)}%)`);

console.log('');
console.log('── First 3 rows with description ──');
for (const row of withDescription.slice(0, 3)) {
  console.log('---');
  console.log(`code=${row.code}`);
  console.log(`title=${row.title}`);
  console.log(`weight=${row.weight}`);
  console.log(`description (${row.description!.length} chars):`);
  console.log(row.description!.slice(0, 300) + (row.description!.length > 300 ? '\n…[truncated]' : ''));
}

// Muestra un caso SIN description (para verificar que no rompe)
const withoutDescription = rows.find((r) => !r.description);
if (withoutDescription) {
  console.log('');
  console.log('── Row WITHOUT description (compat check) ──');
  console.log(`code=${withoutDescription.code}  title=${withoutDescription.title}  weight=${withoutDescription.weight}`);
}

// Muestra un caso con Markdown rico (bold o listas) — confirma la conversión.
const withMarkdown = rows.find(
  (r) => r.description && (r.description.includes('**') || r.description.includes('###') || r.description.includes('\n- '))
);
if (withMarkdown) {
  console.log('');
  console.log('── Row with Markdown formatting (bold/heading/list) ──');
  console.log(`code=${withMarkdown.code}  title=${withMarkdown.title}`);
  console.log(withMarkdown.description);
}
