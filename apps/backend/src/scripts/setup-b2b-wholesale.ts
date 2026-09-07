import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { linkSalesChannelsToApiKeyWorkflow } from '@medusajs/medusa/core-flows';
import type { ExecArgs } from '@medusajs/framework/types';

/**
 * Deja operativo el canal mayorista (B2B). Idempotente: se puede correr las veces
 * que haga falta.
 *
 *   npx medusa exec ./src/scripts/setup-b2b-wholesale.ts
 *
 * Opcional: WHOLESALE_SC_NAME para elegir el nombre del sales channel (default
 * "Wholesale"; también detecta "Mayorista").
 *
 * Hace:
 *  1. Encuentra (o crea) el sales channel mayorista.
 *  2. Vincula TODOS los productos a ese sales channel.
 *  3. Vincula el sales channel a las publishable API keys (storefront).
 *  4. Asegura un payment provider (pp_system_default) en cada región.
 *
 * NO crea shipping options (depende de stock locations / fulfillment sets): eso
 * conviene hacerlo desde Admin → Settings → Locations & Shipping. El script avisa
 * si la región no tiene ninguna.
 */
export default async function setupB2BWholesale({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const scService = container.resolve(Modules.SALES_CHANNEL);
  const apiKeyService = container.resolve(Modules.API_KEY);

  // 1) Sales channel mayorista
  const targetName = process.env.WHOLESALE_SC_NAME || 'Wholesale';
  let sc: { id: string; name: string } | undefined;
  try {
    const found =
      (await scService.listSalesChannels({ name: targetName }))[0] ??
      (await scService.listSalesChannels({ name: 'Mayorista' }))[0];
    sc = found;
    if (!sc) {
      sc = await scService.createSalesChannels({ name: targetName });
      logger.info(`[b2b] Sales channel creado: ${sc.id} (${sc.name})`);
    }
    logger.info(`[b2b] Sales channel mayorista: ${sc.id} (${sc.name})`);
  } catch (e) {
    logger.error(`[b2b] No se pudo resolver el sales channel: ${(e as Error).message}`);
    return;
  }

  // 2) Todos los productos -> sales channel (links faltantes)
  try {
    const { data: products } = await query.graph({
      entity: 'product',
      fields: ['id', 'sales_channels.id'],
    });
    const links = products
      .filter((p: { sales_channels?: { id: string }[] }) =>
        !(p.sales_channels ?? []).some((s) => s.id === sc!.id),
      )
      .map((p: { id: string }) => ({
        [Modules.PRODUCT]: { product_id: p.id },
        [Modules.SALES_CHANNEL]: { sales_channel_id: sc!.id },
      }));
    if (links.length) await link.create(links);
    logger.info(`[b2b] Productos vinculados al SC: ${links.length} (total ${products.length})`);
  } catch (e) {
    logger.error(`[b2b] Error vinculando productos al SC: ${(e as Error).message}`);
  }

  // 3) Sales channel -> publishable API keys
  try {
    const keys = await apiKeyService.listApiKeys({ type: 'publishable' });
    for (const k of keys) {
      try {
        await linkSalesChannelsToApiKeyWorkflow(container).run({
          input: { id: k.id, add: [sc.id] },
        });
      } catch (e) {
        logger.warn(`[b2b] publishable key ${k.id}: ${(e as Error).message}`);
      }
    }
    logger.info(`[b2b] SC vinculado a ${keys.length} publishable key(s)`);
  } catch (e) {
    logger.error(`[b2b] Error vinculando SC a las API keys: ${(e as Error).message}`);
  }

  // 4) Payment provider (system default) por región + chequeo de shipping
  try {
    const { data: regions } = await query.graph({
      entity: 'region',
      fields: ['id', 'name', 'payment_providers.id'],
    });
    for (const r of regions as { id: string; name: string; payment_providers?: { id: string }[] }[]) {
      if (!(r.payment_providers ?? []).length) {
        try {
          await link.create({
            [Modules.REGION]: { region_id: r.id },
            [Modules.PAYMENT]: { payment_provider_id: 'pp_system_default' },
          });
          logger.info(`[b2b] Payment provider pp_system_default agregado a región ${r.name}`);
        } catch (e) {
          logger.warn(`[b2b] región ${r.id} payment: ${(e as Error).message}`);
        }
      }
    }
  } catch (e) {
    logger.error(`[b2b] Error asegurando payment providers: ${(e as Error).message}`);
  }

  // 5) Aviso de shipping options
  try {
    const { data: opts } = await query.graph({
      entity: 'shipping_option',
      fields: ['id', 'name'],
    });
    if (!opts.length) {
      logger.warn(
        '[b2b] No hay shipping options. Creá al menos una en Admin → Settings → Locations & Shipping (asociada a la región) para poder finalizar pedidos.',
      );
    } else {
      logger.info(`[b2b] Shipping options existentes: ${opts.length}`);
    }
  } catch {
    /* best-effort */
  }

  logger.info('[b2b] Setup mayorista completado.');
}
