/**
 * Demo promotions for a demo store's catalog.
 *
 * Puts a random sample (~15%) of the demo's published products on sale, each
 * with EXACTLY ONE promotion (percentage / fixed / buy-2-get-1) so no product
 * ever carries more than one promo (single badge, single discount at cart). All
 * promotions are scoped to the demo's sales channel via a sales_channel_id rule
 * and tagged with a per-channel code/campaign prefix so re-running cleanly
 * re-randomizes only THIS demo's promotions.
 *
 * Adapted from the boilerplate seed (scripts/seed.ts §8). Runs at the end of the
 * import and on-demand from the admin "Crear promociones" button. After calling
 * this, re-index Typesense so has_promotion/discount surface on the storefront.
 */
import { createPromotionsWorkflow } from '@medusajs/core-flows';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

export type CreateDemoPromotionsResult = {
  totalProducts: number;
  promotedProducts: number;
  promotions: number;
};

/**
 * Prefijos de código/campaña de las promos de demo de un canal. Namespacing por
 * canal: varias demos no colisionan y re-generar solo toca las de ESE canal.
 */
function promoPrefixes(salesChannelId: string): { code: string; campaign: string } {
  const tag = salesChannelId.replace(/[^a-zA-Z0-9]/g, '').slice(-10).toUpperCase();
  return { code: `DEMO-${tag}-`, campaign: `demo-${tag.toLowerCase()}-` };
}

/**
 * Borra las promos + campañas de demo de un canal. Best-effort (no lanza).
 *
 * Se usa antes de re-generarlas y también al desmontar/repuntar el canal de una
 * demo: si el canal se borra, sus promos quedarían como basura en el listado del
 * admin, con una regla que apunta a un canal inexistente.
 */
export async function deleteDemoPromotions(container: any, salesChannelId: string): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const promotionService: any = container.resolve(Modules.PROMOTION);
  const prefixes = promoPrefixes(salesChannelId);

  try {
    const existingPromos: Array<{ id: string; code?: string }> =
      await promotionService.listPromotions({}, { take: 1000, select: ['id', 'code'] });
    const stale = existingPromos
      .filter((p) => typeof p.code === 'string' && p.code.startsWith(prefixes.code))
      .map((p) => p.id);
    if (stale.length) await promotionService.deletePromotions(stale);

    const existingCampaigns: Array<{ id: string; campaign_identifier?: string }> =
      await promotionService.listCampaigns({}, { take: 1000, select: ['id', 'campaign_identifier'] });
    const staleCampaigns = existingCampaigns
      .filter(
        (c) =>
          typeof c.campaign_identifier === 'string' &&
          c.campaign_identifier.startsWith(prefixes.campaign),
      )
      .map((c) => c.id);
    if (staleCampaigns.length) await promotionService.deleteCampaigns(staleCampaigns);
  } catch (err) {
    logger.warn(`[demo-store] Promotion cleanup skipped: ${(err as Error).message}`);
  }
}

export async function createDemoPromotions(
  container: any,
  salesChannelId: string,
  percentage = 0.15,
): Promise<CreateDemoPromotionsResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { code: CODE_PREFIX, campaign: CAMPAIGN_PREFIX } = promoPrefixes(salesChannelId);

  // ── Clean previous promotions/campaigns for this demo ──────────────────────
  await deleteDemoPromotions(container, salesChannelId);

  // ── Sample ~percentage of the demo's published products ────────────────────
  // query.graph can't FILTER products by sales_channels, nor traverse
  // sales_channel.products — but it CAN SELECT sales_channels.id as a field. So
  // fetch published products with their channel ids and filter in JS to the
  // demo's channel.
  //
  // Memory: page through the catalog and keep ONLY the lightweight ids that
  // belong to this channel, dropping each page — instead of loading every
  // published product into memory at once (the unbounded take OOM'd the 2GB box).
  const ids: string[] = [];
  const PAGE = 200;
  for (let offset = 0; ; offset += PAGE) {
    const { data: page } = await query.graph({
      entity: 'product',
      fields: ['id', 'sales_channels.id'],
      filters: { status: 'published' },
      pagination: { skip: offset, take: PAGE },
    });
    const rows = (page ?? []) as any[];
    if (rows.length === 0) break;
    for (const p of rows) {
      if (
        Array.isArray(p.sales_channels) &&
        p.sales_channels.some((sc: any) => sc?.id === salesChannelId)
      ) {
        ids.push(p.id as string);
      }
    }
    if (rows.length < PAGE) break;
  }
  if (ids.length === 0) {
    return { totalProducts: 0, promotedProducts: 0, promotions: 0 };
  }
  // Fisher–Yates shuffle, then take the sample.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = ids[i]!;
    ids[i] = ids[j]!;
    ids[j] = tmp;
  }
  const selected = ids.slice(0, Math.max(1, Math.floor(ids.length * percentage)));

  const channelRule = {
    attribute: 'sales_channel_id',
    operator: 'eq',
    values: [salesChannelId],
  };

  // One template per product (picked at random) so a product never has >1 promo.
  const templates = [
    { code: `${CODE_PREFIX}PCT-20`, name: 'Hot Sale -20%', identifier: `${CAMPAIGN_PREFIX}pct-20`, kind: 'percentage', value: 20 },
    { code: `${CODE_PREFIX}PCT-15`, name: 'Oferta -15%', identifier: `${CAMPAIGN_PREFIX}pct-15`, kind: 'percentage', value: 15 },
    { code: `${CODE_PREFIX}PCT-10`, name: 'Descuento -10%', identifier: `${CAMPAIGN_PREFIX}pct-10`, kind: 'percentage', value: 10 },
    { code: `${CODE_PREFIX}FIJO-500`, name: 'Rebaja $500', identifier: `${CAMPAIGN_PREFIX}fijo-500`, kind: 'fixed', value: 500 },
    { code: `${CODE_PREFIX}2X1`, name: 'Combo 2x1', identifier: `${CAMPAIGN_PREFIX}2x1`, kind: 'buyget', value: 100 },
  ] as const;
  const bucket: string[][] = templates.map(() => []);
  for (const id of selected) {
    const idx = Math.floor(Math.random() * templates.length);
    bucket[idx]!.push(id);
  }

  const promotionsData: any[] = [];
  templates.forEach((t, idx) => {
    if (t.kind === 'buyget') return; // handled separately below
    const productIds = bucket[idx] ?? [];
    if (productIds.length === 0) return;
    promotionsData.push({
      code: t.code,
      type: 'standard',
      status: 'active',
      is_automatic: true,
      application_method: {
        type: t.kind,
        target_type: 'items',
        allocation: 'across',
        value: t.value,
        ...(t.kind === 'fixed' ? { currency_code: 'ars' } : {}),
        target_rules: [{ attribute: 'items.product.id', operator: 'in', values: productIds }],
      },
      rules: [channelRule],
      campaign: { name: t.name, campaign_identifier: t.identifier },
    });
  });

  let created = 0;
  if (promotionsData.length > 0) {
    await createPromotionsWorkflow(container).run({ input: { promotionsData } });
    created += promotionsData.length;
  }

  // Buy-2-get-1 in its own call (different quantity fields).
  const buygetIdx = templates.findIndex((t) => t.kind === 'buyget');
  const buygetProducts = buygetIdx >= 0 ? (bucket[buygetIdx] ?? []) : [];
  const bt = buygetIdx >= 0 ? templates[buygetIdx] : undefined;
  if (bt && buygetProducts.length > 0) {
    const buygetData: any[] = [
      {
        code: bt.code,
        type: 'buyget',
        status: 'active',
        is_automatic: true,
        application_method: {
          type: 'percentage',
          target_type: 'items',
          allocation: 'each',
          value: 100,
          max_quantity: 1,
          apply_to_quantity: 1,
          buy_rules_min_quantity: 2,
          buy_rules: [{ attribute: 'items.product.id', operator: 'in', values: buygetProducts }],
          target_rules: [{ attribute: 'items.product.id', operator: 'in', values: buygetProducts }],
        },
        rules: [channelRule],
        campaign: { name: bt.name, campaign_identifier: bt.identifier },
      },
    ];
    try {
      await createPromotionsWorkflow(container).run({ input: { promotionsData: buygetData } });
      created += 1;
    } catch (err) {
      logger.warn(`[demo-store] Buyget promotion skipped: ${(err as Error).message}`);
    }
  }

  logger.info(
    `[demo-store] Created ${created} promotions over ${selected.length}/${ids.length} products (sc=${salesChannelId}).`,
  );
  return { totalProducts: ids.length, promotedProducts: selected.length, promotions: created };
}
