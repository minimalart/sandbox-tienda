"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCommerceDashboardOrders = seedCommerceDashboardOrders;
exports.default = seedDemoOrders;
const utils_1 = require("@medusajs/framework/utils");
const utils_2 = require("@medusajs/utils");
const core_flows_1 = require("@medusajs/core-flows");
const DEMO_CUSTOMERS = 5;
const NAMES = [
    ['Lucía', 'Fernández'],
    ['Mateo', 'González'],
    ['Sofía', 'Rodríguez'],
    ['Tomás', 'Martínez'],
    ['Valentina', 'López'],
];
/**
 * Lógica reutilizable de seed. Devuelve cuántas órdenes creó.
 */
async function seedCommerceDashboardOrders(container, opts = {}) {
    const target = Number(opts.purchases) || 20;
    const currency = (opts.currency || 'ars').toLowerCase();
    const country = (opts.country || 'ar').toLowerCase();
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const knex = container.resolve('__pg_connection__');
    const customerService = container.resolve(utils_1.Modules.CUSTOMER);
    // 1) Idempotencia: contar órdenes seed existentes.
    const existing = await knex('order')
        .whereRaw(`(metadata->>'commerce_dashboard_seed') = 'true'`)
        .whereNull('deleted_at')
        .count('* as count');
    const already = Number(existing?.[0]?.count ?? 0);
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
    const region = regions.find((r) => (r.currency_code ?? '').toLowerCase() === currency) ?? regions[0];
    if (!region)
        throw new Error('No hay regiones configuradas.');
    const { data: channels } = await query.graph({
        entity: 'sales_channel',
        fields: ['id', 'name', 'is_disabled'],
    });
    const channel = channels.find((c) => !c.is_disabled) ?? channels[0];
    if (!channel)
        throw new Error('No hay sales channels.');
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
            variants: { calculated_price: (0, utils_2.QueryContext)({ currency_code: currency }) },
        },
    });
    const variants = [];
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
    const customerIds = [];
    for (let i = 0; i < DEMO_CUSTOMERS; i++) {
        const email = `cliente-seed-${i}@example.com`;
        const [firstName, lastName] = NAMES[i % NAMES.length];
        const found = await customerService.listCustomers({ email });
        if (found?.length && found[0]) {
            customerIds.push(found[0].id);
        }
        else {
            const created = await customerService.createCustomers([
                { email, first_name: firstName, last_name: lastName, has_account: false },
            ]);
            const c = Array.isArray(created) ? created[0] : created;
            if (c)
                customerIds.push(c.id);
        }
    }
    // 5) Crear las órdenes.
    let created = 0;
    for (let i = 0; i < toCreate; i++) {
        const idx = already + i;
        const customerId = customerIds[idx % customerIds.length];
        // 1-3 ítems (deterministico por índice).
        const nItems = (idx % 3) + 1;
        const items = Array.from({ length: nItems }, (_, k) => {
            const v = variants[(idx * 3 + k) % variants.length];
            return {
                variant_id: v.variant_id,
                quantity: ((idx + k) % 3) + 1,
                title: v.title,
                unit_price: v.unit_price,
            };
        });
        try {
            const { result } = await (0, core_flows_1.createOrderWorkflow)(container).run({
                input: {
                    region_id: region.id,
                    currency_code: currency,
                    sales_channel_id: channel.id,
                    customer_id: customerId,
                    email: `cliente-seed-${idx % DEMO_CUSTOMERS}@example.com`,
                    status: 'pending',
                    items,
                    shipping_address: {
                        first_name: NAMES[(idx % DEMO_CUSTOMERS) % NAMES.length][0],
                        last_name: NAMES[(idx % DEMO_CUSTOMERS) % NAMES.length][1],
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
                .where({ id: result.id })
                .update({ created_at: when });
            created++;
        }
        catch (e) {
            logger.warn(`[seed-orders] Falló la orden ${idx}: ${e.message}`);
        }
    }
    logger.info(`[seed-orders] Creadas ${created} órdenes (objetivo ${target}, ya había ${already}). Ahora ejecutá la regeneración del dashboard.`);
    return { created, already, target, currency, country };
}
async function seedDemoOrders({ container }) {
    await seedCommerceDashboardOrders(container, {
        purchases: Number(process.env.COMMERCE_DASHBOARD_SEED_PURCHASES) || 20,
        currency: process.env.COMMERCE_DASHBOARD_SEED_CURRENCY,
        country: process.env.COMMERCE_DASHBOARD_SEED_COUNTRY,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VlZC1jb21tZXJjZS1kYXNoYm9hcmQtZGVtby1vcmRlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NyaXB0cy9zZWVkLWNvbW1lcmNlLWRhc2hib2FyZC1kZW1vLW9yZGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQTBEQSxrRUFrSkM7QUFFRCxpQ0FNQztBQTNMRCxxREFBK0U7QUFDL0UsMkNBQStDO0FBQy9DLHFEQUEyRDtBQUUzRCxNQUFNLGNBQWMsR0FBRyxDQUFDLENBQUM7QUFFekIsTUFBTSxLQUFLLEdBQTRCO0lBQ3JDLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQztJQUN0QixDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUM7SUFDckIsQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDO0lBQ3RCLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQztJQUNyQixDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUM7Q0FDdkIsQ0FBQztBQWtCRjs7R0FFRztBQUNJLEtBQUssVUFBVSwyQkFBMkIsQ0FDL0MsU0FBMEIsRUFDMUIsT0FBMEIsRUFBRTtJQUU1QixNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUM1QyxNQUFNLFFBQVEsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDeEQsTUFBTSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBRXJELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQVMsaUNBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDM0UsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBYSxpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM3RSxNQUFNLElBQUksR0FBUSxT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