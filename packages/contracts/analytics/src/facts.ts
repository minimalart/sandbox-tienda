import { aggregateFacts, compareRows, emptyResult, type Fact, type Measure } from './aggregate';
import {
  validateQuery,
  type Context,
  type Dataset,
  type DatasetProvider,
  type Query,
} from './index';
export type FactSource = {
  definition: Dataset;
  resource: string;
  available(scope: any): Promise<boolean>;
  /** `query` is present when a widget is asking, and absent when the snapshot
   *  refresh is capturing everything. A source that can answer one metric with
   *  less work than the whole dataset uses it to skip what nobody will read. */
  read(scope: any, context: Context, query?: Query): Promise<Fact[]>;
  measures: Record<string, Measure>;
};
const allContext: Context = {
  storeIds: [],
  channelIds: null,
  locationIds: null,
  from: '1970-01-01T00:00:00.000Z',
  to: '9999-01-01T00:00:00.000Z',
  timezone: 'UTC',
  currency: null,
  filters: [],
};
function scopeFacts(facts: Fact[], context: Context) {
  return facts
    .filter((f) => {
      if (context.channelIds?.length === 0 && context.locationIds?.length === 0) return false;
      const channel = f.dimensions.channel,
        location = f.dimensions.location,
        store = f.dimensions.store;
      if (
        store != null &&
        context.storeIds.length > 0 &&
        !context.storeIds.some((id) => (Array.isArray(store) ? store.includes(id) : id === store))
      )
        return false;
      if (
        context.channelIds !== null &&
        channel != null &&
        !(Array.isArray(channel)
          ? channel.some((id) => context.channelIds!.includes(id))
          : context.channelIds.includes(String(channel)))
      )
        return false;
      if (
        context.locationIds !== null &&
        location != null &&
        !context.locationIds.includes(String(location))
      )
        return false;
      if (context.channelIds !== null && channel == null && location == null && store == null)
        return false;
      return true;
    })
    .map((f) => ({
      ...f,
      dimensions: {
        ...f.dimensions,
        ...(Array.isArray(f.dimensions.channel) && context.channelIds !== null
          ? { channel: f.dimensions.channel.filter((id) => context.channelIds!.includes(id)) }
          : {}),
        ...(Array.isArray(f.dimensions.store) && context.storeIds.length
          ? { store: f.dimensions.store.filter((id) => context.storeIds.includes(id)) }
          : {}),
      },
    }));
}
async function mapStores(facts: Fact[], scope: any, context: Context) {
  let registry: any;
  try {
    registry = scope.resolve('demo_store');
  } catch {
    return facts;
  }
  const sites = await registry.listDemoStores({}, { take: null });
  for (const fact of facts)
    if (fact.dimensions.store == null)
      fact.dimensions.store = sites
        .filter(
          (s: any) =>
            (context.storeIds.length === 0 || context.storeIds.includes(s.id)) &&
            (fact.dimensions.channel != null
              ? [s.sales_channel_id, s.b2b_sales_channel_id].some((id) =>
                  Array.isArray(fact.dimensions.channel)
                    ? fact.dimensions.channel.includes(id)
                    : id === fact.dimensions.channel
                )
              : fact.dimensions.location != null &&
                s.stock_location_id === fact.dimensions.location)
        )
        .map((s: any) => s.id);
  return facts;
}
/** Serialización con orden de claves estable. `jsonb` reordena las suyas al
 *  guardarlas, así que comparar el `JSON.stringify` de un fact recién leído
 *  contra el de la fila que vuelve de la base daría distinto siempre. */
function canonical(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
    .join(',')}}`;
}
/** Las dimensiones con varios valores (categorías, canales, marcas) son
 *  conjuntos, pero llegan en el orden que devuelva el grafo, que no está
 *  garantizado. Sin ordenarlas, el mismo producto con las mismas categorías
 *  "cambiaba" en cada captura y se reescribía entero. */
export function normalizeRecord(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const items = value.map(normalizeRecord);
    return items.every((v) => v === null || typeof v !== 'object')
      ? [...items].sort((a, b) => String(a).localeCompare(String(b)))
      : items;
  }
  const out: Record<string, any> = {};
  for (const key of Object.keys(value)) out[key] = normalizeRecord(value[key]);
  return out;
}
/** Si otra captura del mismo dataset lleva más que esto marcada como en curso,
 *  se la da por muerta (un worker reiniciado a mitad) y se vuelve a tomar. */
const LEASE_MS = 15 * 60000;
const HEAD = 'brick_analytics_snapshot_head';
/** Postgres "relation does not exist": el plugin todavía no migró la tabla de
 *  últimos valores. Se cae al camino anterior en vez de romper la captura. */
const missingTable = (error: any) => error?.code === '42P01' || error?.code === '42703';
/** Llena `brick_analytics_snapshot_head` con el último valor de cada entidad
 *  del log, una sola vez por dataset. En vez de ordenar el historial entero
 *  (el `DISTINCT ON` que saturaba la base), salta de entidad en entidad por la
 *  clave primaria y toma la última fila de cada una con un índice hacia atrás:
 *  el costo depende de cuántas entidades hay, no de cuántas capturas acumulan. */
async function seedHead(db: any, dataset: string) {
  await db.raw(
    `WITH RECURSIVE e AS (
       (SELECT entity_id FROM brick_analytics_snapshot WHERE dataset = ? ORDER BY entity_id LIMIT 1)
       UNION ALL
       SELECT (SELECT s.entity_id FROM brick_analytics_snapshot s
                WHERE s.dataset = ? AND s.entity_id > e.entity_id
                ORDER BY s.entity_id LIMIT 1)
         FROM e WHERE e.entity_id IS NOT NULL
     )
     INSERT INTO ${HEAD} (dataset, entity_id, record, gone, captured_at)
     SELECT ?, l.entity_id, l.record, l.gone, l.captured_at
       FROM e
       CROSS JOIN LATERAL (
         SELECT s.entity_id, s.record, s.gone, s.captured_at FROM brick_analytics_snapshot s
          WHERE s.dataset = ? AND s.entity_id = e.entity_id
          ORDER BY s.captured_at DESC LIMIT 1
       ) l
      WHERE e.entity_id IS NOT NULL
     ON CONFLICT (dataset, entity_id) DO NOTHING`,
    [dataset, dataset, dataset, dataset]
  );
}
export function factDataset(source: FactSource): DatasetProvider {
  const state = source.definition.metrics.some((m) => m.temporal === 'state');
  async function refresh(scope: any) {
    if (!state || !(await source.available(scope))) return;
    const db = scope.resolve('__pg_connection__');
    const dataset = source.definition.id;
    // Un turno por dataset, tomado con un UPDATE atómico y no con un lock dentro
    // de una transacción: la transacción duraba toda la lectura y el cálculo, y
    // mientras está abierta el autovacuum no puede limpiar las filas muertas.
    await db('brick_analytics_refresh')
      .insert({ dataset, activated_at: new Date() })
      .onConflict('dataset')
      .ignore();
    const now = Date.now();
    let leased = true;
    try {
      const claimed = await db('brick_analytics_refresh')
        .where({ dataset })
        .where((q: any) =>
          q.whereNull('running_at').orWhere('running_at', '<', new Date(now - LEASE_MS))
        )
        .where((q: any) =>
          q.whereNull('updated_at').orWhere('updated_at', '<', new Date(now - 290000))
        )
        .update({ running_at: new Date(now) });
      if (!claimed) return;
    } catch (error) {
      // Base sin la migración de 1.15.0: sin columna de turno. Se respeta al
      // menos el intervalo entre capturas y se sigue sin tabla de últimos valores.
      if (!missingTable(error)) throw error;
      leased = false;
      const last = await db('brick_analytics_refresh').where({ dataset }).first();
      if (last?.updated_at && now - +new Date(last.updated_at) < 290000) return;
    }
    try {
      const at = new Date(Math.floor(now / 300000) * 300000);
      const facts = await source.read(scope, allContext);
      if (facts.length > 100000) throw new Error('Snapshot exceeds record limit');
      // La tabla es un LOG DE CAMBIOS, no una foto: se escribe sólo lo que
      // difiere del último valor conocido de cada entidad. El último valor se
      // lee de la tabla de últimos valores (una fila por entidad), no del log.
      const status = await db('brick_analytics_refresh').where({ dataset }).first();
      let known: Map<string, { canon: string; gone: boolean }>;
      let useHead = true;
      try {
        if (!status?.head_at) await seedHead(db, dataset);
        const head = await db(HEAD).where({ dataset }).select('entity_id', 'record', 'gone');
        known = new Map(
          head.map((r: any) => [
            String(r.entity_id),
            { canon: canonical(normalizeRecord(r.record)), gone: Boolean(r.gone) },
          ])
        );
      } catch (error) {
        if (!missingTable(error)) throw error;
        useHead = false;
        const previous = await db.raw(
          `SELECT DISTINCT ON (entity_id) entity_id, record, gone FROM brick_analytics_snapshot
             WHERE dataset = ? AND captured_at <= ? ORDER BY entity_id, captured_at DESC`,
          [dataset, at]
        );
        known = new Map(
          previous.rows.map((r: any) => [
            String(r.entity_id),
            { canon: canonical(normalizeRecord(r.record)), gone: Boolean(r.gone) },
          ])
        );
      }
      const rows: any[] = [];
      for (const fact of facts) {
        // `at` no se persiste: la lectura lo pisa con el `captured_at` del
        // bucket, y al ser un wall clock con milisegundos era lo único que
        // cambiaba entre capturas consecutivas.
        const { at: _unused, ...rest } = fact as any;
        const stored = normalizeRecord(rest);
        const canon = canonical(stored),
          before = known.get(String(fact.id));
        known.delete(String(fact.id));
        if (before && !before.gone && before.canon === canon) continue;
        rows.push({
          dataset,
          entity_id: fact.id,
          captured_at: at,
          record: JSON.stringify(stored),
          gone: false,
        });
      }
      // Lo que quedó en `known` es una entidad que el dataset ya no devuelve.
      // Sin lápida, "última fila con `captured_at <= T`" la reviviría.
      for (const [entity_id, before] of known)
        if (!before.gone)
          rows.push({ dataset, entity_id, captured_at: at, record: '{}', gone: true });
      // Sólo las escrituras van en la transacción: segundos, no minutos.
      await db.transaction(async (trx: any) => {
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          await trx('brick_analytics_snapshot')
            .insert(chunk)
            .onConflict(['dataset', 'entity_id', 'captured_at'])
            .merge();
          if (useHead) await trx(HEAD).insert(chunk).onConflict(['dataset', 'entity_id']).merge();
        }
        await trx('brick_analytics_batch')
          .insert({ dataset, captured_at: at })
          .onConflict(['dataset', 'captured_at'])
          .ignore();
        await trx('brick_analytics_refresh')
          .where({ dataset })
          .update({
            updated_at: at,
            error_at: null,
            ...(useHead && !status?.head_at ? { head_at: at } : {}),
          });
      });
    } finally {
      if (leased)
        await db('brick_analytics_refresh')
          .where({ dataset })
          .update({ running_at: null })
          .catch(() => {});
    }
  }
  return {
    definition: source.definition,
    resource: source.resource,
    available: source.available,
    refresh,
    async execute(query, context, scope: any) {
      validateQuery(query, source.definition);
      const metric = source.definition.metrics.find((m) => m.id === query.metric)!,
        result = emptyResult(query, context, metric.unit),
        db = scope.resolve('__pg_connection__');
      const read = async (c: Context): Promise<Fact[]> => {
        if (metric.temporal !== 'state')
          return mapStores(
            scopeFacts(
              (await source.read(scope, c, query)).filter(
                (f) => +new Date(f.at) >= +new Date(c.from) && +new Date(f.at) < +new Date(c.to)
              ),
              c
            ),
            scope,
            c
          );
        const batch = await db('brick_analytics_batch')
          .where({ dataset: source.definition.id })
          .where('captured_at', '<', c.to)
          .max('captured_at as at')
          .first();
        if (!batch?.at) {
          result.history = 'insufficient';
          return [];
        }
        if (c === context) result.updatedAt = new Date(batch.at).toISOString();
        let targets: any[];
        if (query.dimension && ['hour', 'day', 'week', 'month'].includes(query.dimension)) {
          const batches = await db.raw(
            `SELECT MAX(captured_at) at FROM brick_analytics_batch WHERE dataset=? AND captured_at>=? AND captured_at<? GROUP BY date_trunc(?,captured_at AT TIME ZONE ?) ORDER BY at`,
            [source.definition.id, c.from, c.to, query.dimension, c.timezone]
          );
          targets = batches.rows.map((r: any) => r.at);
        } else targets = [batch.at];
        if (targets.length === 0) return [];
        // La tabla es un log de cambios, así que el estado en el momento de un
        // bucket es la ÚLTIMA fila de cada entidad con `captured_at <= bucket`.
        // Para el estado actual alcanza la tabla de últimos valores. Para un
        // momento pasado se busca, entidad por entidad, su última fila anterior
        // con la clave primaria recorrida hacia atrás: el costo depende de
        // entidades × buckets, nunca del largo del historial. Antes era un
        // `DISTINCT ON` sobre todo el historial POR CADA bucket.
        const latestBatch = await db('brick_analytics_batch')
          .where({ dataset: source.definition.id })
          .max('captured_at as at')
          .first();
        const status = await db('brick_analytics_refresh')
          .where({ dataset: source.definition.id })
          .first();
        let records: any[];
        try {
          if (!status?.head_at)
            throw Object.assign(new Error('head not seeded'), { code: '42P01' });
          if (
            targets.length === 1 &&
            latestBatch?.at &&
            +new Date(targets[0]) >= +new Date(latestBatch.at)
          )
            records = (
              await db(HEAD)
                .where({ dataset: source.definition.id, gone: false })
                .select('record')
                .limit(100001)
            ).map((r: any) => ({ bucket: targets[0], record: r.record }));
          else
            records = (
              await db.raw(
                `SELECT t.at AS bucket, s.record
                   FROM unnest(ARRAY[${targets.map(() => '?').join(',')}]::timestamptz[]) AS t(at)
                   CROSS JOIN ${HEAD} h
                   CROSS JOIN LATERAL (
                     SELECT record, gone FROM brick_analytics_snapshot s
                      WHERE s.dataset = h.dataset AND s.entity_id = h.entity_id
                        AND s.captured_at <= t.at
                      ORDER BY s.captured_at DESC LIMIT 1
                   ) s
                  WHERE h.dataset = ? AND NOT s.gone
                  LIMIT 100001`,
                [...targets, source.definition.id]
              )
            ).rows;
        } catch (error) {
          if (!missingTable(error)) throw error;
          // Tabla de últimos valores ausente o sin sembrar todavía: camino anterior.
          records = (
            await db.raw(
              `SELECT t.at AS bucket, s.record
                 FROM unnest(ARRAY[${targets.map(() => '?').join(',')}]::timestamptz[]) AS t(at)
                 CROSS JOIN LATERAL (
                   SELECT DISTINCT ON (entity_id) entity_id, record, gone
                     FROM brick_analytics_snapshot
                    WHERE dataset = ? AND captured_at <= t.at
                    ORDER BY entity_id, captured_at DESC
                 ) s
                WHERE NOT s.gone
                LIMIT 100001`,
              [...targets, source.definition.id]
            )
          ).rows;
        }
        if (records.length > 100000) throw new Error('Snapshot query exceeds record limit');
        return mapStores(
          scopeFacts(
            // El `at` del fact es el del BUCKET, no el de la fila: la fila
            // puede ser vieja justamente porque el valor no cambió.
            records.map((r: any) => ({ ...r.record, at: new Date(r.bucket).toISOString() })),
            c
          ),
          scope,
          c
        );
      };
      if (metric.temporal === 'state') {
        const latest = await db('brick_analytics_refresh')
          .where({ dataset: source.definition.id })
          .first();
        if (!latest) {
          result.history = 'insufficient';
          return result;
        }
        if (+new Date(latest.activated_at) > +new Date(context.from))
          result.history = 'insufficient';
        result.stale =
          !latest.updated_at ||
          Date.now() - +new Date(latest.updated_at) > 600000 ||
          !!latest.error_at;
      }
      const currentFacts = await read(context);
      result.rows = aggregateFacts(currentFacts, query, context, source.measures[query.metric]);
      // Re-aggregate the facts for the headline; never average per-bucket averages.
      if (result.shape === 'time_series') {
        const latest =
          metric.temporal === 'state'
            ? currentFacts.filter(
                (f) => f.at === currentFacts.reduce((at, r) => (r.at > at ? r.at : at), '')
              )
            : currentFacts;
        result.summary = aggregateFacts(
          latest,
          { ...query, dimension: undefined },
          context,
          source.measures[query.metric]
        );
      }
      if (query.comparison !== 'none') {
        const previous = previousContext(context, query.comparison);
        if (metric.temporal === 'state') {
          const first = await db('brick_analytics_refresh')
            .where({ dataset: source.definition.id })
            .first();
          if (!first || +new Date(first.activated_at) > +new Date(previous.from))
            result.history = 'insufficient';
        }
        const rows = aggregateFacts(
          await read(previous),
          query,
          previous,
          source.measures[query.metric]
        );
        result.rows = compareRows(result.rows, rows, result.shape === 'time_series', {
          currentFrom: context.from,
          comparison: query.comparison,
          previousFrom: previous.from,
          dimension: query.dimension ?? '',
          timezone: context.timezone,
        });
      }
      return result;
    },
  };
}
function wallTime(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(
    n('year'),
    n('month') - 1,
    n('day'),
    n('hour'),
    n('minute'),
    n('second'),
    instant.getUTCMilliseconds()
  );
}
function instantAtWall(wall: number, timezone: string): string {
  let guess = wall;
  for (let attempt = 0; attempt < 4; attempt++) {
    const offset = wall - wallTime(new Date(guess), timezone);
    if (offset === 0) break;
    guess += offset;
  }
  return new Date(guess).toISOString();
}
/** Compare calendar periods in the requested zone, including daylight-saving changes. */
export function previousContext(context: Context, comparison: Query['comparison']): Context {
  const from = new Date(wallTime(new Date(context.from), context.timezone)),
    to = new Date(wallTime(new Date(context.to), context.timezone));
  if (comparison === 'previous') {
    const length = +to - +from;
    return { ...context, from: instantAtWall(+from - length, context.timezone), to: context.from };
  }
  for (const date of [from, to]) {
    const month = date.getUTCMonth();
    date.setUTCFullYear(date.getUTCFullYear() - 1);
    if (date.getUTCMonth() !== month) date.setUTCDate(0);
  }
  return {
    ...context,
    from: instantAtWall(+from, context.timezone),
    to: instantAtWall(+to, context.timezone),
  };
}
