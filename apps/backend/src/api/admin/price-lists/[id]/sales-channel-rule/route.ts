import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import {
  invalidateReindexCaches,
  reindexProductsByIds,
} from '../../../../../modules/typesense/reindex';
import type { UpsertSalesChannelRuleInput } from './validators';

const RULE_ATTRIBUTE = 'sales_channel_id';

/**
 * Shape of the pricing module we consume. The Medusa v2 pricing module DTOs
 * we need (`listPriceLists`, `setPriceListRules`, `removePriceListRules`) are
 * declared as `any[]` in the public types, so we tighten locally with a
 * narrow structural type instead of leaking `any` into the file.
 */
type PricingModuleShape = {
  listPriceLists: (
    filter: { id: string[] },
    opts: { relations?: string[] }
  ) => Promise<
    Array<{
      id: string;
      price_list_rules?: Array<{ id: string; attribute: string; value: string | string[] }>;
    }>
  >;
  setPriceListRules: (data: {
    price_list_id: string;
    rules: Record<string, string[]>;
  }) => Promise<unknown>;
  removePriceListRules: (data: { price_list_id: string; rules: string[] }) => Promise<unknown>;
};

const resolvePricing = (req: AuthenticatedMedusaRequest): PricingModuleShape =>
  req.scope.resolve(Modules.PRICING) as unknown as PricingModuleShape;

/**
 * Resuelve los `product_id` que tienen precios en `priceListId`, para
 * dispararles el reindex de Typesense. Vía dos hops: `price` (filtrado por
 * `price_list_id`) → `price_set` → `product_variant` → `product`. Puede haber
 * muchas variantes por price_set y muchos precios por lista; deduplicamos por
 * product_id al final. Devuelve `[]` en cualquier error (fail-open, el
 * reindex no debe frenar la respuesta del admin).
 */
async function resolveAffectedProductIds(
  scope: MedusaContainer,
  priceListId: string,
): Promise<string[]> {
  const query = scope.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);
  try {
    const { data: prices } = (await query.graph({
      entity: 'price',
      fields: ['price_set_id'],
      filters: { price_list_id: priceListId },
    })) as { data: Array<{ price_set_id?: string | null }> };

    const priceSetIds = Array.from(
      new Set(prices.map((p) => p.price_set_id).filter((v): v is string => Boolean(v))),
    );
    if (priceSetIds.length === 0) return [];

    const { data: variants } = (await query.graph({
      entity: 'product_variant',
      fields: ['product_id'],
      filters: { price_set: { id: priceSetIds } },
    })) as { data: Array<{ product_id?: string | null }> };

    return Array.from(
      new Set(variants.map((v) => v.product_id).filter((v): v is string => Boolean(v))),
    );
  } catch {
    return [];
  }
}

/**
 * Dispara el reindex de los productos afectados por un cambio en la regla
 * `sales_channel_id` de un price list. Fire-and-forget: NO await al caller
 * porque el sync puede tardar decenas de segundos con catálogos grandes y el
 * operador no quiere esperar en el spinner del admin. Errores van al logger.
 *
 * `invalidateReindexCaches('channel_prices')` es lo importante: sin esto el
 * primer batch del reindex sigue viendo el mapa cacheado de antes del cambio
 * y produce el mismo doc equivocado.
 */
function fireReindex(scope: MedusaContainer, priceListId: string): void {
  const logger = scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  invalidateReindexCaches('channel_prices');
  void (async () => {
    try {
      const productIds = await resolveAffectedProductIds(scope, priceListId);
      if (productIds.length === 0) {
        logger.info(
          `[channel-price-rule] price_list ${priceListId} has no priced products; skipping reindex.`,
        );
        return;
      }
      const result = await reindexProductsByIds(scope, productIds);
      logger.info(
        `[channel-price-rule] Reindexed ${result.upserted} product(s) after rule change on ${priceListId} (${result.removed} removed).`,
      );
    } catch (err) {
      logger.warn(
        `[channel-price-rule] Reindex after rule change on ${priceListId} failed: ${(err as Error).message}`,
      );
    }
  })();
}

/**
 * GET /admin/price-lists/:id/sales-channel-rule
 *
 * Returns the current sales-channel rule for the given price list, or null
 * when no rule has been set yet.
 *
 * Related ticket: EDUCABOT-9
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params as { id: string };
  const pricing = resolvePricing(req);

  const priceLists = await pricing.listPriceLists(
    { id: [id] },
    { relations: ['price_list_rules'] }
  );

  if (!priceLists.length) {
    res.status(404).json({ message: `Price list ${id} not found` });
    return;
  }

  const rules = priceLists[0]!.price_list_rules ?? [];
  const channelRule = rules.find((r) => r.attribute === RULE_ATTRIBUTE) ?? null;

  if (!channelRule) {
    res.json({ rule: null });
    return;
  }

  const salesChannelIds = Array.isArray(channelRule.value)
    ? channelRule.value
    : [channelRule.value];

  res.json({
    rule: {
      attribute: RULE_ATTRIBUTE,
      operator: 'in',
      sales_channel_ids: salesChannelIds,
    },
  });
}

/**
 * POST /admin/price-lists/:id/sales-channel-rule
 *
 * Upserts the sales-channel rule. Body: `{ sales_channel_ids: string[] }`.
 * Operator is always `in` — the pricing engine matches JSONB arrays with `@>`.
 *
 * Después de guardar, dispara reindex de Typesense (fire-and-forget) para que
 * el `variants.channel_prices` del índice refleje el nuevo scope. Sin esto,
 * el HOME de un site queda mostrando los overrides viejos hasta el próximo
 * full sync (default: 15 min).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<UpsertSalesChannelRuleInput>,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params as { id: string };
  const { sales_channel_ids } = req.body;
  const pricing = resolvePricing(req);

  // Existence check with a bare list call before writing — cheaper than
  // throwing from setPriceListRules and gives a clean 404.
  const priceLists = await pricing.listPriceLists({ id: [id] }, {});
  if (!priceLists.length) {
    res.status(404).json({ message: `Price list ${id} not found` });
    return;
  }

  await pricing.setPriceListRules({
    price_list_id: id,
    rules: { [RULE_ATTRIBUTE]: sales_channel_ids },
  });

  fireReindex(req.scope, id);

  res.json({
    rule: {
      attribute: RULE_ATTRIBUTE,
      operator: 'in',
      sales_channel_ids,
    },
  });
}

/**
 * DELETE /admin/price-lists/:id/sales-channel-rule
 *
 * Idempotent — no error if the rule was never set. Dispara reindex igual que
 * POST porque al remover la regla los overrides del índice también dejan de
 * ser válidos y hay que restaurar el `calculated_price` base como fuente.
 */
export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params as { id: string };
  const pricing = resolvePricing(req);

  await pricing.removePriceListRules({
    price_list_id: id,
    rules: [RULE_ATTRIBUTE],
  });

  fireReindex(req.scope, id);

  res.json({ deleted: true });
}
