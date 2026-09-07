import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { updateRegionsWorkflow } from '@medusajs/medusa/core-flows';
import { MERCADO_PAGO_API_PROVIDER_ID } from '../constants';

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
 * Reconciles the MercadoPago **Checkout API** provider link across ALL regions.
 * Surgical + idempotent: only ever adds/removes
 * `pp_mercadopagoapi_mercadopagoapi`; every other provider (system default,
 * Stripe, the Express MP provider, ...) is preserved. Mirrors the Express
 * module's sync so both providers can be linked to the same region.
 */
export async function syncMercadoPagoApiRegionProviders({
  container,
  enabled,
  logger,
}: {
  container: MedusaContainer;
  enabled: boolean;
  logger?: MinimalLogger;
}): Promise<void> {
  const log = logger ?? (container.resolve(ContainerRegistrationKeys.LOGGER) as MinimalLogger);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: regions } = (await query.graph({
    entity: 'region',
    fields: ['id', 'name', 'payment_providers.id'],
  })) as { data: RegionRow[] };

  if (!regions?.length) {
    log.info('[mercadopago-api] No regions found; nothing to sync.');
    return;
  }

  for (const region of regions) {
    const current = (region.payment_providers ?? []).map((p) => p.id).filter(Boolean);
    const has = current.includes(MERCADO_PAGO_API_PROVIDER_ID);

    let desired: string[];
    if (enabled && !has) {
      desired = [...current, MERCADO_PAGO_API_PROVIDER_ID];
    } else if (!enabled && has) {
      desired = current.filter((id) => id !== MERCADO_PAGO_API_PROVIDER_ID);
    } else {
      continue;
    }

    if (!desired.includes(SYSTEM_PROVIDER_ID)) {
      desired.push(SYSTEM_PROVIDER_ID);
    }

    await updateRegionsWorkflow(container).run({
      input: { selector: { id: region.id }, update: { payment_providers: desired } },
    });

    log.info(
      `[mercadopago-api] Region "${region.name}" (${region.id}): ${
        enabled ? 'linked' : 'unlinked'
      } ${MERCADO_PAGO_API_PROVIDER_ID}. Providers now: [${desired.join(', ')}]`,
    );
  }
}
