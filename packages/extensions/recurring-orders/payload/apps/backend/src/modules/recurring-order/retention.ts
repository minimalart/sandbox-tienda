/**
 * Retención al cancelar: la oferta "quedate y llevá X% en tus próximas N
 * entregas" configurada en `recurring_setting.retention_discount` (canal →
 * global → null). Al aceptarla, se persiste en
 * `recurring_order.metadata.retention = {percentage, remaining_cycles}` y
 * cada renovación aplica max(oferta normal, retención) y decrementa.
 */

import type { MedusaContainer } from '@medusajs/framework/types';
import { RECURRING_ORDER_MODULE } from './types';

export type RetentionDiscount = { percentage: number; cycles: number };

/** Sanea el jsonb {percentage, cycles} (null si el shape no sirve). */
export function normalizeRetention(value: unknown): RetentionDiscount | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const percentage = Number(v.percentage);
  const cycles = Number(v.cycles);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 90) return null;
  if (!Number.isFinite(cycles) || cycles < 1) return null;
  return { percentage, cycles: Math.trunc(cycles) };
}

/** Oferta de retención configurada para el canal (canal → global → null). */
export async function resolveRetentionOffer(
  container: MedusaContainer,
  salesChannelId: string | null | undefined,
): Promise<RetentionDiscount | null> {
  const service: any = container.resolve(RECURRING_ORDER_MODULE);
  try {
    if (salesChannelId) {
      const [own] = await service.listRecurringSettings(
        { sales_channel_id: salesChannelId },
        { take: 1 },
      );
      if (own) return normalizeRetention(own.retention_discount);
    }
    const [global] = await service.listRecurringSettings(
      { sales_channel_id: null },
      { take: 1 },
    );
    return normalizeRetention(global?.retention_discount);
  } catch {
    return null;
  }
}

type SubscriptionMetadata = Record<string, unknown> | null | undefined;

/** % de retención ACTIVA de una suscripción (0 si no hay o se agotó). */
export function activeRetentionPct(metadata: SubscriptionMetadata): number {
  const retention = (metadata ?? {})['retention'] as
    | { percentage?: unknown; remaining_cycles?: unknown }
    | undefined;
  const pct = Number(retention?.percentage);
  const remaining = Number(retention?.remaining_cycles);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 90) return 0;
  if (!Number.isFinite(remaining) || remaining < 1) return 0;
  return pct;
}

/**
 * Consume un ciclo de retención: metadata con remaining_cycles decrementado
 * (elimina la clave al llegar a 0). Devuelve null si no había retención activa.
 */
export function consumeRetention(
  metadata: SubscriptionMetadata,
): Record<string, unknown> | null {
  if (!activeRetentionPct(metadata)) return null;
  const base = { ...(metadata ?? {}) } as Record<string, unknown>;
  const retention = base.retention as { percentage: number; remaining_cycles: number };
  const remaining = Number(retention.remaining_cycles) - 1;
  if (remaining <= 0) {
    delete base.retention;
  } else {
    base.retention = { ...retention, remaining_cycles: remaining };
  }
  return base;
}
