/**
 * Descuentos por suscripción (ofertas).
 *
 * La base es `recurring_setting.frequency_discounts` (% por frecuencia a nivel
 * canal, con fallback a la fila global); `recurring_offer` lo pisa por
 * producto. Resolución por producto:
 *   offer del canal → offer global → setting del canal → setting global → [].
 *
 * El descuento se APLICA en un solo lugar (build-renewal-cart, como manual
 * line-item adjustments): todas las entregas pasan por el carrito de
 * renovación. La PDP/carrito solo lo muestran como marketing.
 */

import type { MedusaContainer } from '@medusajs/framework/types';
import { RECURRING_ORDER_MODULE } from './types';
import type { RecurringFrequencyInterval } from './types';

export type FrequencyDiscount = {
  interval: RecurringFrequencyInterval;
  count: number;
  percentage: number;
};

const INTERVALS: readonly string[] = ['day', 'week', 'month'];

/** Sanea un jsonb de descuentos (descarta shapes inválidos y % fuera de rango). */
export function normalizeDiscounts(value: unknown): FrequencyDiscount[] {
  if (!Array.isArray(value)) return [];
  const out: FrequencyDiscount[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const d = raw as Record<string, unknown>;
    const interval = d.interval;
    const count = Number(d.count);
    const percentage = Number(d.percentage);
    if (typeof interval !== 'string' || !INTERVALS.includes(interval)) continue;
    if (!Number.isFinite(count) || count < 1) continue;
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 90) continue;
    out.push({
      interval: interval as RecurringFrequencyInterval,
      count: Math.trunc(count),
      percentage,
    });
  }
  return out;
}

/** % para una frecuencia exacta (interval + count). 0 si no hay oferta. */
export function pickDiscount(
  discounts: FrequencyDiscount[],
  interval: string,
  count: number,
): number {
  const match = discounts.find((d) => d.interval === interval && d.count === count);
  return match?.percentage ?? 0;
}

type OfferRow = {
  product_id: string;
  sales_channel_id: string | null;
  discounts: unknown;
  enabled: boolean;
};

type SettingRow = {
  sales_channel_id: string | null;
  frequency_discounts?: unknown;
};

/**
 * Resolución PURA por producto (testeable sin container): elige la fuente
 * ganadora y devuelve sus descuentos normalizados.
 */
export function resolveDiscountsForProduct(
  productId: string,
  salesChannelId: string | null,
  offers: OfferRow[],
  settings: SettingRow[],
): FrequencyDiscount[] {
  const enabled = offers.filter((o) => o.enabled && o.product_id === productId);
  const channelOffer = salesChannelId
    ? enabled.find((o) => o.sales_channel_id === salesChannelId)
    : undefined;
  const globalOffer = enabled.find((o) => o.sales_channel_id === null);
  const winnerOffer = channelOffer ?? globalOffer;
  if (winnerOffer) return normalizeDiscounts(winnerOffer.discounts);

  const channelSetting = salesChannelId
    ? settings.find((s) => s.sales_channel_id === salesChannelId)
    : undefined;
  const globalSetting = settings.find((s) => s.sales_channel_id === null);
  // Misma semántica que la elegibilidad: la fila del canal (si existe) pisa a
  // la global por completo; sin descuentos propios NO se hereda de la global.
  const winnerSetting = channelSetting ?? globalSetting;
  return normalizeDiscounts(winnerSetting?.frequency_discounts);
}

/**
 * Descuentos efectivos por producto en un canal. Best-effort: ante error
 * devuelve mapa vacío (sin descuento, nunca roto).
 */
export async function resolveProductDiscounts(
  container: MedusaContainer,
  salesChannelId: string | null | undefined,
  productIds: string[],
): Promise<Map<string, FrequencyDiscount[]>> {
  const unique = [...new Set(productIds.filter(Boolean))];
  const result = new Map<string, FrequencyDiscount[]>();
  if (!unique.length) return result;

  const service: any = container.resolve(RECURRING_ORDER_MODULE);
  try {
    const [offers, settings] = await Promise.all([
      service.listRecurringOffers({ product_id: unique }) as Promise<OfferRow[]>,
      service.listRecurringSettings(
        salesChannelId
          ? { sales_channel_id: [salesChannelId, null] }
          : { sales_channel_id: null },
      ) as Promise<SettingRow[]>,
    ]);
    for (const productId of unique) {
      const discounts = resolveDiscountsForProduct(
        productId,
        salesChannelId ?? null,
        offers,
        settings,
      );
      if (discounts.length) result.set(productId, discounts);
    }
    return result;
  } catch {
    return result;
  }
}
