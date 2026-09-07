/**
 * Config runtime EFECTIVA de un canal: mergea las políticas editables desde el
 * admin (`recurring_setting`, campo a campo: fila del canal → fila global) con
 * los defaults de env (`config.ts`). Los procesos en vuelo NO se reescriben:
 * un ciclo pending_payment conserva su `expires_at` ya persistido aunque la
 * config cambie (precedencia process-local, como reorder).
 */

import type { MedusaContainer } from '@medusajs/framework/types';
import { getRecurringOrderConfig, type RecurringOrderConfig } from './config';
import { RECURRING_ORDER_MODULE } from './types';
import { resolveSite } from '../../lib/multistore/resolve-site';

export type StockPolicy = 'skip_unavailable' | 'fail_cycle';
export type PriceChangePolicy = 'always_current' | 'warn_over_threshold';

export type RecurringRuntimeConfig = RecurringOrderConfig & {
  stockPolicy: StockPolicy;
  priceChangePolicy: PriceChangePolicy;
  priceChangeThresholdPct: number;
};

type SettingRow = Record<string, unknown>;

function pickNumber(rows: SettingRow[], key: string, fallback: number): number {
  for (const row of rows) {
    const value = Number(row?.[key]);
    if (row?.[key] != null && Number.isFinite(value) && value > 0) return value;
  }
  return fallback;
}

function pickText<T extends string>(
  rows: SettingRow[],
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  for (const row of rows) {
    const value = row?.[key];
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
      return value as T;
    }
  }
  return fallback;
}

/** Merge puro (testeable): filas ordenadas por precedencia (canal, global). */
export function mergeRuntimeConfig(
  rows: SettingRow[],
  env: RecurringOrderConfig,
): RecurringRuntimeConfig {
  return {
    ...env,
    reminderHours: pickNumber(rows, 'reminder_hours', env.reminderHours),
    paymentExpirationHours: pickNumber(rows, 'expiration_hours', env.paymentExpirationHours),
    maxAttempts: pickNumber(rows, 'max_attempts', env.maxAttempts),
    retryHours: pickNumber(rows, 'retry_hours', env.retryHours),
    maxConsecutiveFailures: pickNumber(
      rows,
      'max_consecutive_failures',
      env.maxConsecutiveFailures,
    ),
    stockPolicy: pickText(rows, 'stock_policy', ['skip_unavailable', 'fail_cycle'], 'skip_unavailable'),
    priceChangePolicy: pickText(
      rows,
      'price_change_policy',
      ['always_current', 'warn_over_threshold'],
      'always_current',
    ),
    priceChangeThresholdPct: pickNumber(rows, 'price_change_threshold_pct', 20),
  };
}

/**
 * Las filas candidatas en orden de precedencia: el canal exacto, después
 * CUALQUIER otro canal de la MISMA tienda, y al final la global.
 *
 * El escalón del medio es el que faltaba, y es el bug B2B. Una tienda con
 * `b2b_enabled` tiene DOS sales channels —`sales_channel_id` y
 * `b2b_sales_channel_id`—, pero su configuración se guarda contra UNO. Buscando
 * sólo por el canal del pedido, un ciclo del canal mayorista no encontraba nada y
 * caía derecho a la global: la tienda quedaba operando con los reintentos, la
 * ventana de pago y la política de stock de la instancia en vez de las suyas, sin
 * un solo error. El síntoma es que "la config de recurrentes no se aplica" en la
 * mitad mayorista de la tienda, que es justo la que más plata mueve.
 *
 * Es exactamente lo que ya hace la ruta de admin (`api/admin/recurring-orders/
 * settings/route.ts`), que pide `resolution.site.channel_ids` entero. Acá faltaba
 * la misma vuelta, y por eso el admin mostraba la config guardada mientras el job
 * corría con otra.
 *
 * Entre hermanos no se elige: `listRecurringSettings` no garantiza orden y una
 * tienda no debería tener dos filas. Si las tiene, `mergeRuntimeConfig` resuelve
 * campo a campo por orden de llegada, que es el mismo criterio de siempre.
 */
export function orderRowsByPrecedence(
  rows: SettingRow[],
  salesChannelId: string | null | undefined,
  siblingChannelIds: readonly string[],
): SettingRow[] {
  const exact = salesChannelId
    ? rows.find((r) => r.sales_channel_id === salesChannelId)
    : undefined;

  const siblings = rows.filter(
    (r) =>
      r !== exact &&
      typeof r.sales_channel_id === 'string' &&
      r.sales_channel_id !== salesChannelId &&
      siblingChannelIds.includes(r.sales_channel_id),
  );

  const global = rows.find((r) => r.sales_channel_id == null);

  return [exact, ...siblings, global].filter(Boolean) as SettingRow[];
}

/**
 * Config efectiva para un canal. Best-effort: ante error, defaults de env.
 *
 * El `catch` es a propósito y NO se le agrega un fail-closed: acá degradar a los
 * defaults del entorno es lo correcto. Esto lo llaman el job de renovaciones y el
 * workflow del ciclo; cortar dejaría cobros sin procesar, que es peor que
 * procesarlos con la política de la instancia. Es la diferencia con las
 * CREDENCIALES, donde degradar significa cobrarle a la cuenta de otro.
 */
export async function resolveRuntimeConfig(
  container: MedusaContainer,
  salesChannelId: string | null | undefined,
): Promise<RecurringRuntimeConfig> {
  const env = getRecurringOrderConfig();
  try {
    const service: any = container.resolve(RECURRING_ORDER_MODULE);

    // Los canales hermanos salen del seam, no de una query propia: `resolveSite`
    // ya matchea las DOS columnas de canal y devuelve `channel_ids` como array
    // justamente para que no se pueda escribir un filtro por un solo canal.
    let channelIds: string[] = salesChannelId ? [salesChannelId] : [];
    if (salesChannelId) {
      const resolution = await resolveSite(container, { salesChannelId });
      if (resolution.status === 'site' || resolution.status === 'singleSite') {
        channelIds = resolution.site.channel_ids.length
          ? resolution.site.channel_ids
          : channelIds;
      }
    }

    const settings: SettingRow[] = await service.listRecurringSettings(
      channelIds.length
        ? { sales_channel_id: [...channelIds, null] }
        : { sales_channel_id: null },
    );

    return mergeRuntimeConfig(
      orderRowsByPrecedence(settings, salesChannelId, channelIds),
      env,
    );
  } catch {
    return mergeRuntimeConfig([], env);
  }
}
