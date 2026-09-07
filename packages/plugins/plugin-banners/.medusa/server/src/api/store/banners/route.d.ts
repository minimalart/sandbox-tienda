import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /store/banners
 *
 * Query params:
 *   placement  (repeatable) — filter by placement(s), required
 *   sales_channel_id, customer_group_id, locale, country, device, path
 *     — optional targeting inputs matched against each banner's `rules`
 *
 * Returns: { banners: RawApiBanner[] } published, active (date window) and
 * rule-matched, ordered by priority DESC.
 * Always returns 200 — empty array when nothing matches or on error.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
