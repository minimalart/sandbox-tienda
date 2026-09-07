import type { Knex } from '@mikro-orm/knex';
import {
  DELIVERY_PROVIDER_TYPES,
  DELIVERY_SERVICE_MODES,
  DELIVERY_STATUSES,
  DELIVERY_TERMINAL_STATUSES,
} from './analytics-constants';

/**
 * M9 — Control Tower / Delivery Analytics.
 *
 * Capa de SOLO LECTURA sobre los datos operativos ya existentes
 * (delivery_execution + delivery_zone + driver). NO introduce modelos nuevos:
 * computa todo on-the-fly con queries agregadas de knex, igual que el patrón de
 * commerce-dashboard (sum/count/groupBy/date_trunc). El admin consulta rangos
 * acotados, así que on-the-fly es suficiente; ver TODO de snapshots abajo.
 *
 * TODO(M9+): si el volumen de ejecuciones crece o se quiere comparar contra
 * rangos largos sin recomputar, materializar un `DeliverySnapshot` diario via
 * scheduled job (mismo patrón que commerce_metrics_daily) y leer de ahí. Por
 * ahora es overkill: el board es admin-only y los rangos son acotados.
 */

export type DeliveryMetricsFilters = {
  from: string;
  to: string;
  store_location_id?: string | null;
  provider_type?: string | null;
  /**
   * Sucursales de la TIENDA activa. Distinto de `store_location_id`, que es el filtro
   * que el operador elige a mano: éste acota el universo y siempre se aplica.
   *
   * Es una lista porque una tienda atiende con varias sucursales. `undefined` = sin
   * acotar, que es el comportamiento de antes.
   */
  site_store_location_ids?: string[] | null;
};

type NormalizedFilters = {
  from: Date;
  to: Date;
  store_location_id: string | null;
  provider_type: string | null;
  site_store_location_ids: string[] | null;
};

export type CountByKey = { key: string; count: number };
export type TimeseriesPoint = { period: string; value: number };
export type DriverRank = {
  driver_id: string;
  driver_name: string | null;
  delivered: number;
  failed_attempts: number;
};
export type ZoneRank = {
  zone_id: string;
  zone_name: string | null;
  delivered: number;
  total: number;
  delivery_rate: number;
  within_sla: number;
  sla_compliance: number | null;
};

export type DeliveryMetrics = {
  filters: {
    from: string;
    to: string;
    store_location_id: string | null;
    provider_type: string | null;
    site_store_location_ids?: string[] | null;
  };
  totals: {
    total: number;
    delivered: number;
    failed_terminal: number;
    canceled: number;
    in_flight: number;
    delivery_rate: number;
    failed_attempt_rate: number;
    avg_attempt_count: number;
  };
  sla: {
    avg_minutes: number | null;
    median_minutes: number | null;
    within_sla: number;
    sla_eligible: number;
    sla_compliance: number | null;
  };
  by_status: CountByKey[];
  by_provider: CountByKey[];
  by_service_mode: CountByKey[];
  timeseries: TimeseriesPoint[];
  top_drivers: DriverRank[];
  by_zone: ZoneRank[];
};

const numberValue = (value: unknown) => Number(value ?? 0);
const safeRatio = (value: number, total: number) => (total > 0 ? value / total : 0);

/**
 * Mixin de analytics para DeliveryModuleService. Se aplica sobre la clase del
 * service (que ya extiende MedusaService); accede a knex igual que
 * commerce-dashboard: this.__container__.manager.getKnex().
 *
 * Se define como funciones standalone que reciben el knex para mantener el
 * service.ts liviano y los tests aislables.
 */
export function normalizeDeliveryMetricsFilters(
  filters: DeliveryMetricsFilters,
): NormalizedFilters {
  const from = new Date(filters.from);
  const to = new Date(filters.to);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Invalid date range');
  }
  if (from > to) {
    throw new Error('from must be before to');
  }

  const inclusiveTo = new Date(to);
  inclusiveTo.setHours(23, 59, 59, 999);

  return {
    from,
    to: inclusiveTo,
    store_location_id: filters.store_location_id || null,
    provider_type: filters.provider_type || null,
    site_store_location_ids: filters.site_store_location_ids?.length
      ? filters.site_store_location_ids
      : null,
  };
}

/**
 * Aplica los filtros comunes de rango/provider a una query sobre
 * delivery_execution. El rango se mide sobre `created_at` (cuándo entró la
 * ejecución al sistema), que es el eje consistente con el board operativo.
 *
 * SCOPING POR TIENDA (M10) — estrategia híbrida directo+zona:
 * Desde M10 delivery_execution tiene `store_location_id` directo, así que el
 * filtro primario es esa columna. PERO las ejecuciones previas a M10 (y las
 * que no resolvieron tienda al crearse) tienen store_location_id NULL aunque su
 * zona SÍ pertenezca a la sucursal. Para no perder históricos, el filtro es un
 * OR: store_location_id = X  OR  delivery_zone_id IN (zonas de X). El alias de
 * tabla puede variar (con/sin prefijo), por eso recibimos `column` calificada.
 *
 * `zoneIds` se sigue resolviendo (zonas de la sucursal) solo para ese fallback;
 * null = sin restricción de tienda.
 */
function applyExecutionFilters(
  query: Knex.QueryBuilder,
  filters: NormalizedFilters,
  zoneIds: string[] | null,
  alias?: string,
): Knex.QueryBuilder {
  // Cuando la query hace JOIN (ej. a delivery_zone, que también tiene
  // created_at/deleted_at), TODAS las columnas de delivery_execution deben ir
  // calificadas por su alias o Postgres lanza "column reference is ambiguous".
  const col = (name: string) => (alias ? `${alias}.${name}` : name);

  query
    .where(col('created_at'), '>=', filters.from)
    .where(col('created_at'), '<=', filters.to)
    .whereNull(col('deleted_at'));

  if (filters.provider_type)
    query.where(col('provider_type'), filters.provider_type);

  // El universo de la tienda, SIEMPRE. Va antes del filtro manual de sucursal para
  // que elegir una sucursal ajena no la traiga igual.
  //
  // Se incluyen las ejecuciones sin sucursal (`NULL`): son el CD nacional y las
  // anteriores a M10, y esconderlas haría que los KPIs no cierren con las órdenes.
  if (filters.site_store_location_ids?.length) {
    const allowed = filters.site_store_location_ids;
    query.where((builder) => {
      builder.whereIn(col('store_location_id'), allowed).orWhereNull(col('store_location_id'));
    });
  }

  // Solo aplicamos scoping de tienda cuando hay store_location_id solicitado
  // (zoneIds !== null lo refleja: resolveZoneIds devuelve null sin filtro).
  if (zoneIds) {
    query.where((builder) => {
      builder.where(col('store_location_id'), filters.store_location_id);
      if (zoneIds.length > 0) {
        builder.orWhereIn(col('delivery_zone_id'), zoneIds);
      }
    });
  }
  return query;
}

/**
 * Resuelve las zonas de una sucursal para el FALLBACK de scoping histórico
 * (ejecuciones sin store_location_id directo). Devuelve:
 *  - null  → no hay filtro de tienda (sin restricción).
 *  - []    → hay filtro de tienda pero la sucursal no tiene zonas; igual se
 *            filtra por store_location_id directo (el OR cubre el caso).
 *  - [...] → ids de zonas de la sucursal para el OR con la columna directa.
 */
async function resolveZoneIds(
  knex: Knex,
  storeLocationId: string | null,
): Promise<string[] | null> {
  if (!storeLocationId) return null;
  const rows = await knex('delivery_zone')
    .select('id')
    .where('store_location_id', storeLocationId)
    .whereNull('deleted_at');
  return rows.map((r: { id: string }) => String(r.id));
}

/** Counts agrupados por una columna (status / provider_type / service_mode). */
async function countBy(
  knex: Knex,
  column: 'status' | 'provider_type' | 'service_mode',
  filters: NormalizedFilters,
  zoneIds: string[] | null,
  known: readonly string[],
): Promise<CountByKey[]> {
  const rows = await applyExecutionFilters(knex('delivery_execution'), filters, zoneIds)
    .select(column)
    .count<{ count: string }[]>({ count: '*' })
    .groupBy(column);

  const map = new Map<string, number>();
  for (const row of rows as Array<Record<string, unknown>>) {
    map.set(String(row[column] ?? 'unknown'), numberValue(row.count));
  }
  // Garantizamos que TODOS los valores conocidos aparezcan (0 incluidos) para
  // una UI estable; luego sumamos cualquier valor inesperado no listado.
  const result: CountByKey[] = known.map((key) => ({ key, count: map.get(key) ?? 0 }));
  for (const [key, count] of map) {
    if (!known.includes(key)) result.push({ key, count });
  }
  return result;
}

/** Totales agregados: counts terminales, attempts, in-flight. */
async function computeTotals(
  knex: Knex,
  filters: NormalizedFilters,
  zoneIds: string[] | null,
) {
  const [row] = await applyExecutionFilters(knex('delivery_execution'), filters, zoneIds)
    .count<{ count: string }[]>({ total: '*' })
    .sum({ total_attempts: 'attempt_count' })
    .select(
      knex.raw(`count(*) filter (where status = 'delivered') as delivered`),
      knex.raw(`count(*) filter (where status = 'canceled') as canceled`),
      knex.raw(`count(*) filter (where failed_at is not null) as ever_failed`),
      knex.raw(
        `count(*) filter (where status not in (${DELIVERY_TERMINAL_STATUSES.map(() => '?').join(',')})) as in_flight`,
        [...DELIVERY_TERMINAL_STATUSES],
      ),
    );

  const total = numberValue(row?.total);
  const delivered = numberValue(row?.delivered);
  const canceled = numberValue(row?.canceled);
  const everFailed = numberValue(row?.ever_failed);
  const inFlight = numberValue(row?.in_flight);
  const totalAttempts = numberValue(row?.total_attempts);

  // delivery_rate = entregadas sobre el universo de ejecuciones cuyo destino ya
  // se decidió en sentido entrega-vs-no-entrega. Tomamos delivered + canceled
  // como "resueltas terminalmente"; las en vuelo no penalizan la tasa.
  const terminalResolved = delivered + canceled;

  return {
    total,
    delivered,
    failed_terminal: canceled,
    canceled,
    in_flight: inFlight,
    delivery_rate: safeRatio(delivered, terminalResolved),
    // % de ejecuciones que tuvieron al menos un intento fallido en el camino.
    failed_attempt_rate: safeRatio(everFailed, total),
    avg_attempt_count: safeRatio(totalAttempts, total),
  };
}

/**
 * SLA dispatched→delivered. Computa avg y median (percentil 50) en minutos
 * sobre las ejecuciones entregadas que tienen ambos timestamps, y el % dentro
 * del sla_hours de su zona cuando la zona define uno.
 */
async function computeSla(
  knex: Knex,
  filters: NormalizedFilters,
  zoneIds: string[] | null,
) {
  // Subquery: ejecuciones entregadas con dispatched_at y delivered_at, su delta
  // en minutos, y el sla_hours de su zona (left join, puede ser null).
  const base = applyExecutionFilters(
    knex('delivery_execution as de'),
    filters,
    zoneIds,
    'de',
  )
    .whereNotNull('de.dispatched_at')
    .whereNotNull('de.delivered_at')
    .where('de.status', 'delivered');

  const [agg] = await base
    .clone()
    .leftJoin('delivery_zone as dz', 'dz.id', 'de.delivery_zone_id')
    .select(
      knex.raw(
        `avg(extract(epoch from (de.delivered_at - de.dispatched_at)) / 60.0) as avg_minutes`,
      ),
      knex.raw(
        `percentile_cont(0.5) within group (order by extract(epoch from (de.delivered_at - de.dispatched_at)) / 60.0) as median_minutes`,
      ),
      knex.raw(`count(*) as sla_eligible`),
      knex.raw(`count(*) filter (where dz.sla_hours is not null) as sla_measurable`),
      knex.raw(
        `count(*) filter (where dz.sla_hours is not null and extract(epoch from (de.delivered_at - de.dispatched_at)) / 3600.0 <= dz.sla_hours) as within_sla`,
      ),
    );

  const slaEligible = numberValue(agg?.sla_eligible);
  const slaMeasurable = numberValue(agg?.sla_measurable);
  const withinSla = numberValue(agg?.within_sla);

  return {
    avg_minutes: agg?.avg_minutes != null ? Number(agg.avg_minutes) : null,
    median_minutes: agg?.median_minutes != null ? Number(agg.median_minutes) : null,
    within_sla: withinSla,
    sla_eligible: slaEligible,
    sla_compliance: slaMeasurable > 0 ? safeRatio(withinSla, slaMeasurable) : null,
  };
}

/** Timeseries diaria de entregas (delivered por día, sobre delivered_at). */
async function computeTimeseries(
  knex: Knex,
  filters: NormalizedFilters,
  zoneIds: string[] | null,
): Promise<TimeseriesPoint[]> {
  // OJO: acá medimos por delivered_at (cuándo se entregó), no created_at, y
  // restringimos a status delivered. El rango sigue acotado por created_at via
  // applyExecutionFilters para mantener coherencia con el resto del board.
  const rows = await applyExecutionFilters(knex('delivery_execution'), filters, zoneIds)
    .where('status', 'delivered')
    .whereNotNull('delivered_at')
    .select(knex.raw(`date_trunc('day', delivered_at) as period`))
    .count<{ count: string }[]>({ value: '*' })
    .groupBy('period')
    .orderBy('period', 'asc');

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    period:
      row.period instanceof Date
        ? row.period.toISOString()
        : String(row.period),
    value: numberValue(row.value),
  }));
}

/** Top drivers por entregas completadas (con sus intentos fallidos). */
async function computeTopDrivers(
  knex: Knex,
  filters: NormalizedFilters,
  zoneIds: string[] | null,
): Promise<DriverRank[]> {
  const rows = await applyExecutionFilters(
    knex('delivery_execution as de'),
    filters,
    zoneIds,
    'de',
  )
    .whereNotNull('de.driver_id')
    .leftJoin('driver as d', 'd.id', 'de.driver_id')
    .select('de.driver_id', 'd.name as driver_name')
    .select(
      knex.raw(`count(*) filter (where de.status = 'delivered') as delivered`),
      knex.raw(`count(*) filter (where de.failed_at is not null) as failed_attempts`),
    )
    .groupBy('de.driver_id', 'd.name')
    .orderByRaw(`count(*) filter (where de.status = 'delivered') desc`)
    .limit(10);

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    driver_id: String(row.driver_id),
    driver_name: row.driver_name != null ? String(row.driver_name) : null,
    delivered: numberValue(row.delivered),
    failed_attempts: numberValue(row.failed_attempts),
  }));
}

/** Breakdown por zona: entregadas, total, tasa y compliance de SLA. */
async function computeByZone(
  knex: Knex,
  filters: NormalizedFilters,
  zoneIds: string[] | null,
): Promise<ZoneRank[]> {
  const rows = await applyExecutionFilters(
    knex('delivery_execution as de'),
    filters,
    zoneIds,
    'de',
  )
    .whereNotNull('de.delivery_zone_id')
    .leftJoin('delivery_zone as dz', 'dz.id', 'de.delivery_zone_id')
    .select('de.delivery_zone_id', 'dz.name as zone_name')
    .select(
      knex.raw(`count(*) as total`),
      knex.raw(`count(*) filter (where de.status = 'delivered') as delivered`),
      knex.raw(
        `count(*) filter (where dz.sla_hours is not null and de.status = 'delivered' and de.dispatched_at is not null and de.delivered_at is not null) as sla_measurable`,
      ),
      knex.raw(
        `count(*) filter (where dz.sla_hours is not null and de.status = 'delivered' and de.dispatched_at is not null and de.delivered_at is not null and extract(epoch from (de.delivered_at - de.dispatched_at)) / 3600.0 <= dz.sla_hours) as within_sla`,
      ),
    )
    .groupBy('de.delivery_zone_id', 'dz.name')
    .orderByRaw(`count(*) filter (where de.status = 'delivered') desc`)
    .limit(20);

  return (rows as Array<Record<string, unknown>>).map((row) => {
    const total = numberValue(row.total);
    const delivered = numberValue(row.delivered);
    const slaMeasurable = numberValue(row.sla_measurable);
    const withinSla = numberValue(row.within_sla);
    return {
      zone_id: String(row.delivery_zone_id),
      zone_name: row.zone_name != null ? String(row.zone_name) : null,
      delivered,
      total,
      delivery_rate: safeRatio(delivered, total),
      within_sla: withinSla,
      sla_compliance: slaMeasurable > 0 ? safeRatio(withinSla, slaMeasurable) : null,
    };
  });
}

/**
 * Punto de entrada de las métricas del Control Tower. Recibe el knex del
 * service y los filtros crudos; devuelve el payload completo del dashboard.
 */
export async function computeDeliveryMetrics(
  knex: Knex,
  filtersInput: DeliveryMetricsFilters,
): Promise<DeliveryMetrics> {
  const filters = normalizeDeliveryMetricsFilters(filtersInput);
  const zoneIds = await resolveZoneIds(knex, filters.store_location_id);

  const [
    totals,
    sla,
    byStatus,
    byProvider,
    byServiceMode,
    timeseries,
    topDrivers,
    byZone,
  ] = await Promise.all([
    computeTotals(knex, filters, zoneIds),
    computeSla(knex, filters, zoneIds),
    countBy(knex, 'status', filters, zoneIds, DELIVERY_STATUSES),
    countBy(knex, 'provider_type', filters, zoneIds, DELIVERY_PROVIDER_TYPES),
    countBy(knex, 'service_mode', filters, zoneIds, DELIVERY_SERVICE_MODES),
    computeTimeseries(knex, filters, zoneIds),
    computeTopDrivers(knex, filters, zoneIds),
    computeByZone(knex, filters, zoneIds),
  ]);

  return {
    filters: {
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
      store_location_id: filters.store_location_id,
      provider_type: filters.provider_type,
    },
    totals,
    sla,
    by_status: byStatus,
    by_provider: byProvider,
    by_service_mode: byServiceMode,
    timeseries,
    top_drivers: topDrivers,
    by_zone: byZone,
  };
}
