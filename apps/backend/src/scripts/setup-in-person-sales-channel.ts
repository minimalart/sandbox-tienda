import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { linkSalesChannelsToApiKeyWorkflow } from '@medusajs/medusa/core-flows';
import { STORE_CONFIG_MODULE } from '../modules/store-config';
import StoreConfigModuleService, { STORE_SETTING_KEYS } from '../modules/store-config/service';
import { getInPersonSalesChannelName } from '../modules/store-config/settings';

/**
 * Idempotent setup for the in-person/mobile scanner sales channel.
 *
 * Usage:
 *   pnpm --filter @repo/backend exec medusa exec ./src/scripts/setup-in-person-sales-channel.ts
 *
 * El nombre del canal sale de Preferencias (`IN_PERSON_SC_NAME`), con la env
 * como fallback:
 *   IN_PERSON_SC_NAME="Presencial supermercado" pnpm … medusa exec …
 *
 * OJO con la idempotencia, que es por NOMBRE EXACTO: cambiar el valor después de
 * haber corrido el script no renombra el canal existente, crea uno nuevo al lado.
 */
export default async function setupInPersonSalesChannel({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const scService = container.resolve(Modules.SALES_CHANNEL);
  const apiKeyService = container.resolve(Modules.API_KEY);
  const storeConfigService: StoreConfigModuleService = container.resolve(STORE_CONFIG_MODULE);
  const targetName = getInPersonSalesChannelName();

  let sc = (
    await scService.listSalesChannels({
      name: targetName,
    })
  )[0] as { id: string; name: string; metadata?: Record<string, unknown> | null } | undefined;

  if (!sc) {
    sc = (await scService.createSalesChannels({
      name: targetName,
    })) as { id: string; name: string; metadata?: Record<string, unknown> | null };
    await scService.updateSalesChannels(sc.id, {
      metadata: {
        channel_type: 'in_person',
        checkout_context: 'barcode_scanner',
      },
    });
    logger.info(`[in-person] Sales channel creado: ${sc.id} (${sc.name})`);
  } else {
    await scService.updateSalesChannels(sc.id, {
      metadata: {
        ...(sc.metadata ?? {}),
        channel_type: 'in_person',
        checkout_context: 'barcode_scanner',
      },
    });
    logger.info(`[in-person] Sales channel existente actualizado: ${sc.id} (${sc.name})`);
  }

  const { data: products } = (await query.graph({
    entity: 'product',
    fields: ['id', 'sales_channels.id'],
    filters: { status: 'published' },
    pagination: { take: 10000, skip: 0 },
  })) as { data: Array<{ id: string; sales_channels?: Array<{ id: string }> }> };

  const productLinks = products
    .filter((product) => !(product.sales_channels ?? []).some((channel) => channel.id === sc!.id))
    .map((product) => ({
      [Modules.PRODUCT]: { product_id: product.id },
      [Modules.SALES_CHANNEL]: { sales_channel_id: sc!.id },
    }));

  if (productLinks.length) {
    await link.create(productLinks);
  }
  logger.info(
    `[in-person] Productos vinculados al canal: ${productLinks.length} (publicados: ${products.length})`,
  );

  const keys = await apiKeyService.listApiKeys({ type: 'publishable' });
  for (const key of keys) {
    try {
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: key.id, add: [sc.id] },
      });
    } catch (error) {
      logger.warn(`[in-person] publishable key ${key.id}: ${(error as Error).message}`);
    }
  }
  logger.info(`[in-person] Canal vinculado a ${keys.length} publishable key(s)`);

  const { data: regions } = (await query.graph({
    entity: 'region',
    fields: ['id', 'name', 'payment_providers.id'],
  })) as {
    data: Array<{ id: string; name: string; payment_providers?: Array<{ id: string }> }>;
  };

  for (const region of regions) {
    if ((region.payment_providers ?? []).length) {
      logger.info(
        `[in-person] Región ${region.name}: providers ${(region.payment_providers ?? [])
          .map((provider) => provider.id)
          .join(', ')}`,
      );
      continue;
    }

    try {
      await link.create({
        [Modules.REGION]: { region_id: region.id },
        [Modules.PAYMENT]: { payment_provider_id: 'pp_system_default' },
      });
      logger.info(`[in-person] Payment provider pp_system_default agregado a ${region.name}`);
    } catch (error) {
      logger.warn(`[in-person] región ${region.id} payment: ${(error as Error).message}`);
    }
  }

  await storeConfigService.upsertSetting(STORE_SETTING_KEYS.BARCODE_SCANNER_ENABLED, true);
  logger.info('[in-person] Preferencia barcode_scanner_enabled=true');

  logger.info('[in-person] Setup presencial completado.');
}
