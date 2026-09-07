/**
 * Crea órdenes REALES para poblar el Commerce Dashboard.
 *
 * - Usa el workflow nativo `createOrderWorkflow` → cada orden queda con su
 *   `order_summary` (totales reales), por eso el dashboard las suma bien y
 *   cuentan como ventas genuinas.
 * - Llevan una marca interna OCULTA `metadata.commerce_dashboard_seed: true`
 *   (no se muestra al cliente) que solo sirve para trazarlas/limpiarlas luego.
 * - Idempotente: no crea si ya existen N órdenes con esa marca.
 * - Distribuye `created_at` en los últimos N días (backdate vía knex).
 *
 * Reutilizable: `seedCommerceDashboardOrders(container, opts)` lo invoca tanto
 * este script CLI como la ruta admin `POST /admin/commerce-dashboard/seed-orders`
 * (la DB de prod tiene Trusted Sources, así que no se puede correr desde fuera
 * del server).
 *
 * Uso CLI (con DATABASE_URL real):
 *   pnpm --filter @repo/backend exec medusa exec ./src/scripts/seed-commerce-dashboard-demo-orders.ts
 *
 * Config (env):
 *   COMMERCE_DASHBOARD_SEED_PURCHASES=20
 *   COMMERCE_DASHBOARD_SEED_CURRENCY=ars
 *   COMMERCE_DASHBOARD_SEED_COUNTRY=ar
 */
import type { ExecArgs, Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import { createOrderWorkflow } from '@medusajs/core-flows';

const DEMO_CUSTOMERS = 5;

const NAMES: Array<[string, string]> = [
  ['Lucía', 'Fernández'],
  ['Mateo', 'González'],
  ['Sofía', 'Rodríguez'],
  ['Tomás', 'Martínez'],
  ['Valentina', 'López'],
];

type QueryGraph = { graph: (input: unknown) => Promise<{ data: any[] }> };

export type SeedOrdersOptions = {
  purchases?: number;
  currency?: string;
  country?: string;
};

export type SeedOrdersResult = {
  created: number;
  already: number;
  target: number;
  currency: string;
  country: string;
};

/**
 * Lógica reutilizable de seed. Devuelve cuántas órdenes creó.
 */
export async function seedCommerceDashboardOrders(
  container: MedusaContainer,
  opts: SeedOrdersOptions = {},
): Promise<SeedOrdersResult> {
  const target = Number(opts.purchases) || 20;
  const currency = (opts.currency || 'ars').toLowerCase();
  const country = (opts.country || 'ar').toLowerCase();

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<QueryGraph>(ContainerRegistrationKeys.QUERY);
  const knex: any = container.resolve('__pg_connection__');
  const customerService = container.resolve(Modules.CUSTOMER);

  // 1) Idempotencia: contar órdenes seed existentes.
  const existing = await knex('order')
    .whereRaw(`(metadata->>'commerce_dashboard_seed') = 'true'`)
    .whereNull('deleted_at')
    .count('* as count');
  const already = Number((existing?.[0] as { count?: string } | undefined)?.count ?? 0);
  if (already >= target) {
    logger.info(`[seed-orders] Ya existen ${already} órdenes seed (>= ${target}). Nada que hacer.`);
    return { created: 0, already, target, currency, country };
  }
  const toCreate = target - already;

  // 2) Region (currency) + sales channel.
  const { data: regions } = await query.graph({
    entity: 'region',
    fields: ['id', 'currency_code'],
  });
  const region =
    regions.find((r) => (r.currency_code ?? '').toLowerCase() === currency) ?? regions[0];
  if (!region) throw new Error('No hay regiones configuradas.');

  const { data: channels } = await query.graph({
    entity: 'sales_channel',
    fields: ['id', 'name', 'is_disabled'],
  });
  const channel = channels.find((c) => !c.is_disabled) ?? channels[0];
  if (!channel) throw new Error('No hay sales channels.');

  // 3) Variantes con precio en la moneda objetivo.
  const { data: products } = await query.graph({
    entity: 'product',
    fields: [
      'id',
      'title',
      'variants.id',
      'variants.title',
      'variants.calculated_price.calculated_amount',
    ],
    filters: { status: 'published' },
    pagination: { skip: 0, take: 200 },
    context: {
      variants: { calculated_price: QueryContext({ currency_code: currency }) },
    },
  });
  const variants: Array<{ variant_id: string; title: string; unit_price: number }> = [];
  for (const p of products) {
    for (const v of p.variants ?? []) {
      const price = Number(v?.calculated_price?.calculated_amount);
      if (Number.isFinite(price) && price > 0) {
        variants.push({ variant_id: v.id, title: `${p.title} - ${v.title}`, unit_price: price });
      }
    }
  }
  if (!variants.length) {
    throw new Error('No hay variantes con precio en ' + currency + '. Cargá precios primero.');
  }

  // 4) Clientes (para new/returning). Nombres realistas; email en dominio
  //    seguro `example.com` (RFC 2606, no entrega → cero rebotes a personas).
  const customerIds: string[] = [];
  for (let i = 0; i < DEMO_CUSTOMERS; i++) {
    const email = `cliente-seed-${i}@example.com`;
    const [firstName, lastName] = NAMES[i % NAMES.length]!;
    const found = await customerService.listCustomers({ email });
    if (found?.length && found[0]) {
      customerIds.push(found[0].id);
    } else {
      const created = await customerService.createCustomers([
        { email, first_name: firstName, last_name: lastName, has_account: false },
      ]);
      const c = Array.isArray(created) ? created[0] : created;
      if (c) customerIds.push(c.id);
    }
  }

  // 5) Crear las órdenes.
  let created = 0;
  for (let i = 0; i < toCreate; i++) {
    const idx = already + i;
    const customerId = customerIds[idx % customerIds.length] as string;
    // 1-3 ítems (deterministico por índice).
    const nItems = (idx % 3) + 1;
    const items = Array.from({ length: nItems }, (_, k) => {
      const v = variants[(idx * 3 + k) % variants.length]!;
      return {
        variant_id: v.variant_id,
        quantity: ((idx + k) % 3) + 1,
        title: v.title,
        unit_price: v.unit_price,
      };
    });

    try {
      const { result } = await createOrderWorkflow(container).run({
        input: {
          region_id: region.id,
          currency_code: currency,
          sales_channel_id: channel.id,
          customer_id: customerId,
          email: `cliente-seed-${idx % DEMO_CUSTOMERS}@example.com`,
          status: 'pending',
          items,
          shipping_address: {
            first_name: NAMES[(idx % DEMO_CUSTOMERS) % NAMES.length]![0],
            last_name: NAMES[(idx % DEMO_CUSTOMERS) % NAMES.length]![1],
            address_1: 'Av. Corrientes 1234',
            city: 'Buenos Aires',
            province: 'CABA',
            country_code: country,
            postal_code: '1000',
          },
          metadata: { commerce_dashboard_seed: true },
        },
      });

      // Backdate created_at en los últimos N días.
      const daysAgo = idx % target;
      const when = new Date();
      when.setDate(when.getDate() - daysAgo);
      await knex('order')
        .where({ id: (result as { id: string }).id })
        .update({ created_at: when });

      created++;
    } catch (e) {
      logger.warn(`[seed-orders] Falló la orden ${idx}: ${(e as Error).message}`);
    }
  }

  logger.info(
    `[seed-orders] Creadas ${created} órdenes (objetivo ${target}, ya había ${already}). Ahora ejecutá la regeneración del dashboard.`,
  );
  return { created, already, target, currency, country };
}

export default async function seedDemoOrders({ container }: ExecArgs) {
  await seedCommerceDashboardOrders(container, {
    purchases: Number(process.env.COMMERCE_DASHBOARD_SEED_PURCHASES) || 20,
    currency: process.env.COMMERCE_DASHBOARD_SEED_CURRENCY,
    country: process.env.COMMERCE_DASHBOARD_SEED_COUNTRY,
  });
}
