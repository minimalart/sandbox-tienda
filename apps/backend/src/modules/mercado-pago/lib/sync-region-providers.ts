import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { updateRegionsWorkflow } from '@medusajs/medusa/core-flows';
import { MERCADO_PAGO_PROVIDER_ID } from '../constants';

const SYSTEM_PROVIDER_ID = 'pp_system_default';

type MinimalLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

type RegionRow = {
  id: string;
  name: string;
  payment_providers?: { id: string }[] | null;
};

/**
 * Reconciles the MercadoPago payment provider link across ALL regions to match
 * the desired enabled state. Shared by the module loader (runs on boot) and the
 * `setup-mercadopago` exec script (manual re-sync).
 *
 * Surgical + idempotent: it only ever adds or removes
 * `pp_mercadopago_mercadopago`. Every other provider already linked to a region
 * (pp_system_default, Stripe, ...) is preserved — because
 * `setRegionsPaymentProvidersStep` REPLACES a region's provider list, we read
 * the current set first and merge, never blind-write. Manual payment
 * (pp_system_default) is always kept available.
 */
export async function syncMercadoPagoRegionProviders({
  container,
  enabled,
  logger,
}: {
  container: MedusaContainer;
  enabled: boolean;
  logger?: MinimalLogger;
}): Promise<void> {
  const log =
    logger ?? (container.resolve(ContainerRegistrationKeys.LOGGER) as MinimalLogger);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: regions } = (await query.graph({
    entity: 'region',
    fields: ['id', 'name', 'payment_providers.id'],
  })) as { data: RegionRow[] };

  if (!regions?.length) {
    log.info('[mercadopago] No regions found; nothing to sync.');
    return;
  }

  for (const region of regions) {
    const current = (region.payment_providers ?? [])
      .map((provider) => provider.id)
      .filter(Boolean);
    const hasMercadoPago = current.includes(MERCADO_PAGO_PROVIDER_ID);

    let desired: string[];
    if (enabled && !hasMercadoPago) {
      desired = [...current, MERCADO_PAGO_PROVIDER_ID];
    } else if (!enabled && hasMercadoPago) {
      desired = current.filter((id) => id !== MERCADO_PAGO_PROVIDER_ID);
    } else {
      // Already in the desired state — skip the write entirely (idempotent).
      continue;
    }

    // Manual payment must never be dropped.
    if (!desired.includes(SYSTEM_PROVIDER_ID)) {
      desired.push(SYSTEM_PROVIDER_ID);
    }

    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: region.id },
        update: { payment_providers: desired },
      },
    });

    log.info(
      `[mercadopago] Region "${region.name}" (${region.id}): ${
        enabled ? 'linked' : 'unlinked'
      } ${MERCADO_PAGO_PROVIDER_ID}. Providers now: [${desired.join(', ')}]`,
    );
  }
}
