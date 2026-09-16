// Dry-run end-to-end del envío al ERP con los custom fields de Alumnos.
// - Usa el OdooErpAdapter REAL apuntando al Odoo local (sin pasar por outbox).
// - Payload sintético con school + student_assignments y `order_id` único para
//   no chocar con el guard de idempotencia (`client_order_ref`).
// - Muestra en stdout la salida de la sonda `fields_get`, el body del create,
//   y el resultado (`external_ref` = id del sale.order creado en Odoo).

// Carga TS via el mismo loader que usa `pnpm test` (`--import ./test-register.mjs`).
const { OdooErpAdapter } = await import('../src/modules/erp/adapters/odoo.ts');

const ODOO_BASE = 'http://localhost:8069';
const ODOO_DB = 'mercatto-dev';
const ODOO_UID = 2;
const ODOO_KEY = '404a61058b931d1dea2e66d614774492e995610f';

// Usar un SKU que sabemos que existe en el Odoo local (mismo que smoke-notify-sale.mjs).
const KNOWN_SKU = 'ELE-P20464-EB';

const uniqueId = `test_probe_${Date.now()}`;

const payload = {
  event_key: `probe:${uniqueId}`,
  order_id: uniqueId,
  display_id: 9999,
  created_at: new Date().toISOString(),
  country_code: 'AR',
  currency_code: 'ars',
  customer: {
    id: 'cus_probe',
    email: 'probe@minimalart.co',
    first_name: 'Probe',
    last_name: 'Alumnos',
    phone: '+541100000000',
    document: { type: 'DNI', number: '99999999' },
  },
  items: [
    { sku: KNOWN_SKU, title: 'Arduino Mega (probe)', quantity: 2, unit_price: 100, total: 200 },
  ],
  totals: { subtotal: 200, discount: 0, shipping: 0, tax: 0, total: 200 },
  payment: { provider_id: 'pp_probe', captured_amount: 200, currency_code: 'ars' },
  shipping: {
    method: 'Standard',
    address: { street: 'Probe', city: 'CABA', province: 'CABA', postal_code: 'C1043', country_code: 'AR' },
  },
  school: {
    external_ref: 'estudiantes-de-la-plata',
    name: 'Estudiantes de la Plata',
    source_site_id: 'demo_01M1P9KA3F93ZHJ9QRHKMGKF5G',
  },
  student_assignments: {
    schema_version: '1.0',
    items: [{
      sku: KNOWN_SKU,
      quantity: 2,
      recipients: [
        { external_id: 'p-ale-1', first_name: 'Ale', last_name: '1', document: '41245879', grade: '4A', quantity: 1 },
        { external_id: 'p-ale-2', first_name: 'Ale', last_name: '2', document: '12345678', grade: '4A', quantity: 1 },
      ],
    }],
  },
};

const ctx = {
  credentials: { api_key: ODOO_KEY },
  settings: {
    odoo: { base_url: ODOO_BASE, db: ODOO_DB, uid: ODOO_UID, auto_confirm: false },
  },
  countryCode: 'AR',
  logger: { info: console.log, warn: console.warn, error: console.error, debug: console.log },
};

console.log(`\n─── DRY-RUN: notifySale con school + student_assignments ───`);
console.log(`Odoo: ${ODOO_BASE} db=${ODOO_DB} uid=${ODOO_UID}`);
console.log(`Payload order_id: ${uniqueId} (único, no choca con guard de duplicate)`);
console.log(`SKU: ${KNOWN_SKU}`);
console.log(`Alumnos: ${payload.student_assignments.items[0].recipients.length}, unidades: ${payload.student_assignments.items[0].quantity}`);
console.log();

const adapter = new OdooErpAdapter();
try {
  const result = await adapter.notifySale(payload, ctx);
  console.log(`\n─── RESULTADO ───`);
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'sent') {
    console.log(`\n✅ sale.order creado en Odoo con id=${result.external_ref}`);
    console.log(`   Verificalo en el admin Odoo: ${ODOO_BASE}/odoo/action-sale.action_quotations_with_onboarding/${result.external_ref}`);
  }
} catch (error) {
  console.error(`\n❌ ERROR: ${error.message}`);
  if (error.stack) console.error(error.stack);
  process.exit(1);
}
