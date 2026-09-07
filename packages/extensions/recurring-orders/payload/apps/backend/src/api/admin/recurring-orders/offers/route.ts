import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { z } from 'zod';
import { RECURRING_ORDER_MODULE } from '../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../modules/recurring-order/service';
import { normalizeDiscounts } from '../../../../modules/recurring-order/offers';

/**
 * Overrides de descuento por producto (ofertas de suscripción).
 * GET lista los del canal pedido (o los globales) con el título del producto;
 * POST upsertea por (canal, producto).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const explicit = (req.query.sales_channel_id as string | undefined) || null;

  /**
   * Las ofertas son CONFIG con fallback: `sales_channel_id NULL` es la oferta global,
   * no una huérfana. Por eso el listado incluye LAS DOS —las de la tienda y las
   * globales— en vez de filtrar sólo por canal: el operador tiene que ver de dónde
   * sale cada precio, y una oferta global que no aparece se descubre por el ticket
   * del cliente.
   *
   * Los DOS canales de la tienda, no el primero: una B2B tiene retail y mayorista.
   */
  const resolution = await siteFromRequest(req);
  const channels =
    explicit != null
      ? [explicit]
      : resolution.status === 'site'
        ? resolution.site.channel_ids
        : [];

  const offers = await service.listRecurringOffers(
    channels.length ? { sales_channel_id: [...channels, null] } : { sales_channel_id: null },
    { order: { created_at: 'DESC' }, take: 200 },
  );

  // Título/thumbnail del producto para el listado del admin.
  const productIds = [...new Set(offers.map((o: any) => o.product_id))];
  const titles = new Map<string, { title: string | null; thumbnail: string | null }>();
  if (productIds.length) {
    try {
      const query = req.scope.resolve<{
        graph: (i: unknown) => Promise<{ data: any[] }>;
      }>(ContainerRegistrationKeys.QUERY);
      const { data: products } = await query.graph({
        entity: 'product',
        fields: ['id', 'title', 'thumbnail'],
        filters: { id: productIds },
      });
      for (const p of products) {
        titles.set(p.id, { title: p.title ?? null, thumbnail: p.thumbnail ?? null });
      }
    } catch {
      // Best-effort: sin títulos el listado muestra los ids.
    }
  }

  res.status(200).json({
    offers: offers.map((o: any) => ({
      id: o.id,
      sales_channel_id: o.sales_channel_id ?? null,
      product_id: o.product_id,
      product_title: titles.get(o.product_id)?.title ?? null,
      product_thumbnail: titles.get(o.product_id)?.thumbnail ?? null,
      discounts: normalizeDiscounts(o.discounts),
      enabled: Boolean(o.enabled),
    })),
  });
}

const Body = z.object({
  sales_channel_id: z.string().min(1).nullish(),
  product_id: z.string().min(1),
  discounts: z
    .array(
      z.object({
        interval: z.enum(['day', 'week', 'month']),
        count: z.number().int().min(1),
        percentage: z.number().gt(0).max(90),
      }),
    )
    .min(1)
    .max(20),
  enabled: z.boolean().default(true),
});

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const offer = await service.upsertRecurringOffer({
    // Sin canal explícito, la oferta se guarda contra el canal PRIMARIO de la tienda
    // activa. Guardarla en la global cambiaría el precio de todas las tiendas.
    sales_channel_id:
      parsed.data.sales_channel_id ??
      ((await siteFromRequest(req)) as { status: string; site?: { channel_ids: string[] } }).site
        ?.channel_ids[0] ??
      null,
    product_id: parsed.data.product_id,
    discounts: parsed.data.discounts,
    enabled: parsed.data.enabled,
  });
  res.status(200).json({
    offer: {
      id: offer.id,
      sales_channel_id: offer.sales_channel_id ?? null,
      product_id: offer.product_id,
      discounts: normalizeDiscounts(offer.discounts),
      enabled: Boolean(offer.enabled),
    },
  });
}
