import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { LOYALTY_MODULE } from '../modules/loyalty';
import type LoyaltyModuleService from '../modules/loyalty/service';
import { resolvePointsEarnRate } from '../modules/loyalty/settings';

/**
 * Seeds the default Loyalty Engine config: one program + a purchase earn rule
 * that replicates the legacy POINTS_EARN_RATE setting. A rate maps to a
 * percentage rule (rate 1 → 100% → 1 point per $1; rate 0.1 → 10% → 1 point per $10).
 *
 *   npx medusa exec ./src/scripts/seed-loyalty.ts   (o `pnpm seed:loyalty`)
 *
 * Idempotent: skips if any program already exists. Seeds are NOT auto-applied on
 * deploy — run once per environment.
 */
export default async function seedLoyalty({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE);

  const existing = await loyalty.listLoyaltyPrograms({}, { take: 1 });
  if (existing.length) {
    logger.info('[seed-loyalty] Ya existe un programa — no se siembra nada.');
    return;
  }

  // El saneo (`> 0`, `NaN` → default) vive en `resolvePointsEarnRate`, junto con
  // el del subscriber: eran dos criterios distintos para el mismo número.
  const rate = resolvePointsEarnRate();
  const percent = Math.max(0, Math.round(rate * 100));

  const program = await loyalty.createLoyaltyPrograms({
    name: 'Programa de fidelización',
    status: 'active',
    points_name: 'puntos',
    currency_code: 'ars',
    expiration_policy: { type: 'none' },
  });

  await loyalty.createEarnRules({
    name: 'Compras',
    status: 'active',
    priority: 0,
    event: 'purchase',
    calc_type: 'percentage',
    calc_value: percent,
    program_id: program.id,
  });

  logger.info(
    `[seed-loyalty] Programa ${program.id} + regla de compra creados (${percent}% ≈ rate ${rate}).`,
  );
}
