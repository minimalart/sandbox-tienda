import type { ExecArgs } from '@medusajs/framework/types';
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
export default function seedLoyalty({ container }: ExecArgs): Promise<void>;
