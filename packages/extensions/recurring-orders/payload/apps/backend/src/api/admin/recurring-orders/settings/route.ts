import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { pickBySitePrecedence } from '../../../../lib/multistore/scope';
import { z } from 'zod';
import { RECURRING_ORDER_MODULE } from '../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../modules/recurring-order/service';
import { normalizeSetting } from '../../../../modules/recurring-order/eligibility';
import { normalizeDiscounts } from '../../../../modules/recurring-order/offers';
import { normalizeRetention } from '../../../../modules/recurring-order/retention';

/** Fila de settings serializada para el admin (elegibilidad + ofertas + retención). */
function serializeSetting(row: Record<string, unknown>) {
  const num = (key: string) => {
    const value = Number(row[key]);
    return row[key] != null && Number.isFinite(value) && value > 0 ? value : null;
  };
  const text = (key: string) => (typeof row[key] === 'string' ? (row[key] as string) : null);
  return {
    ...normalizeSetting(row),
    frequency_discounts: normalizeDiscounts(row.frequency_discounts),
    retention_discount: normalizeRetention(row.retention_discount),
    reminder_hours: num('reminder_hours'),
    expiration_hours: num('expiration_hours'),
    max_attempts: num('max_attempts'),
    retry_hours: num('retry_hours'),
    max_consecutive_failures: num('max_consecutive_failures'),
    stock_policy: text('stock_policy'),
    price_change_policy: text('price_change_policy'),
    price_change_threshold_pct: num('price_change_threshold_pct'),
  };
}

/**
 * Config de elegibilidad de compras recurrentes. `sales_channel_id` ausente o
 * vacío = default global. GET devuelve la fila del canal (sin fallback, para
 * que el admin distinga "sin config propia") + la global como referencia.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const explicit = (req.query.sales_channel_id as string | undefined) || null;

  /**
   * Esto es CONFIG, no data: `sales_channel_id NULL` no es una fila huérfana, es el
   * FALLBACK global. Por eso va con `pickBySitePrecedence` y no con `siteFilter` —
   * listar une, resolver un valor efectivo tiene precedencia.
   *
   * Y por eso se piden LOS DOS canales de la tienda: una tienda B2B tiene retail y
   * mayorista, y buscar sólo por el primero devolvería "sin config propia" cuando la
   * config está guardada contra el otro.
   */
  const resolution = await siteFromRequest(req);
  const channels =
    explicit != null
      ? [explicit]
      : resolution.status === 'site'
        ? resolution.site.channel_ids
        : [];

  const candidates = channels.length
    ? await service.listRecurringSettings(
        { sales_channel_id: channels },
        { take: channels.length },
      )
    : [];

  const own = pickBySitePrecedence(
    candidates as unknown as Array<Record<string, unknown>>,
    explicit != null ? { status: 'allSites' } : resolution,
    { kind: 'channel_column', table: 'recurring_setting', column: 'sales_channel_id', empty: 'global' },
  );

  const [global] = channels.length
    ? await service.listRecurringSettings({ sales_channel_id: null }, { take: 1 })
    : [null];

  res.status(200).json({
    setting: own ? { ...serializeSetting(own), exists: true } : null,
    global_setting: global ? serializeSetting(global) : null,
  });
}

const DiscountSchema = z.object({
  interval: z.enum(['day', 'week', 'month']),
  count: z.number().int().min(1),
  percentage: z.number().gt(0).max(90),
});

const Body = z.object({
  sales_channel_id: z.string().min(1).nullish(),
  scope: z.enum(['all', 'selected']),
  category_ids: z.array(z.string()).max(500).default([]),
  tag_values: z.array(z.string()).max(500).default([]),
  product_ids: z.array(z.string()).max(1000).default([]),
  frequency_discounts: z.array(DiscountSchema).max(20).default([]),
  retention_discount: z
    .object({ percentage: z.number().gt(0).max(90), cycles: z.number().int().min(1).max(24) })
    .nullish(),
  // Políticas runtime (null = heredar del fallback global → env).
  reminder_hours: z.number().int().min(1).max(720).nullish(),
  expiration_hours: z.number().int().min(1).max(720).nullish(),
  max_attempts: z.number().int().min(1).max(10).nullish(),
  retry_hours: z.number().int().min(1).max(168).nullish(),
  max_consecutive_failures: z.number().int().min(1).max(10).nullish(),
  stock_policy: z.enum(['skip_unavailable', 'fail_cycle']).nullish(),
  price_change_policy: z.enum(['always_current', 'warn_over_threshold']).nullish(),
  price_change_threshold_pct: z.number().gt(0).max(500).nullish(),
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
  /**
   * Sin `sales_channel_id` en el body, la config se guarda contra el canal PRIMARIO
   * de la tienda activa — no contra la fila global.
   *
   * La diferencia importa: guardar en la global desde la pantalla de una tienda
   * cambia el default de TODAS las que no tienen config propia. Es el fail-open que
   * este archivo venía advirtiendo, sólo que del lado de la escritura.
   *
   * El primario y no los dos: una config pertenece a UN canal, y el retail es el que
   * el operador está mirando. La lectura sí busca en los dos, así que si alguien la
   * guardó contra el mayorista se sigue encontrando.
   */
  const writeResolution = await siteFromRequest(req);
  const defaultChannel =
    writeResolution.status === 'site' ? (writeResolution.site.channel_ids[0] ?? null) : null;

  const setting = await service.upsertRecurringSetting({
    sales_channel_id: parsed.data.sales_channel_id ?? defaultChannel,
    scope: parsed.data.scope,
    category_ids: parsed.data.category_ids,
    tag_values: parsed.data.tag_values,
    product_ids: parsed.data.product_ids,
    frequency_discounts: parsed.data.frequency_discounts,
    retention_discount: parsed.data.retention_discount ?? null,
    reminder_hours: parsed.data.reminder_hours ?? null,
    expiration_hours: parsed.data.expiration_hours ?? null,
    max_attempts: parsed.data.max_attempts ?? null,
    retry_hours: parsed.data.retry_hours ?? null,
    max_consecutive_failures: parsed.data.max_consecutive_failures ?? null,
    stock_policy: parsed.data.stock_policy ?? null,
    price_change_policy: parsed.data.price_change_policy ?? null,
    price_change_threshold_pct: parsed.data.price_change_threshold_pct ?? null,
  });
  res.status(200).json({ setting: { ...serializeSetting(setting), exists: true } });
}
