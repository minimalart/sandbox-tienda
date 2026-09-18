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
  read(scope: any, context: Context): Promise<Fact[]>;
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
export function factDataset(source: FactSource): DatasetProvider {
  const state = source.definition.metrics.some((m) => m.temporal === 'state');
  async function refresh(scope: any) {
    if (!state || !(await source.available(scope))) return;
    const db = scope.resolve('__pg_connection__');
    // A PostgreSQL transaction-scoped lock prevents overlapping workers from capturing twice.
    await db.transaction(async (trx: any) => {
      const lock = await trx.raw('SELECT pg_try_advisory_xact_lock(hashtext(?)) locked', [
        `analytics:${source.definition.id}`,
      ]);
      if (!lock.rows[0].locked) return;
      const last = await trx('brick_analytics_refresh')
        .where({ dataset: source.definition.id })
        .first();
      if (last?.updated_at && Date.now() - +new Date(last.updated_at) < 290000) return;
      const at = new Date(Math.floor(Date.now() / 300000) * 300000),
        facts = await source.read(scope, allContext);
      if (facts.length > 100000) throw new Error('Snapshot exceeds record limit');
      for (let i = 0; i < facts.length; i += 500) {
        const batch = facts.slice(i, i + 500).map((f) => ({
          dataset: source.definition.id,
          entity_id: f.id,
          captured_at: at,
          record: JSON.stringify(f),
        }));
        if (batch.length)
          await trx('brick_analytics_snapshot')
            .insert(batch)
            .onConflict(['dataset', 'entity_id', 'captured_at'])
            .merge();
      }
      await trx('brick_analytics_batch')
        .insert({ dataset: source.definition.id, captured_at: at })
        .onConflict(['dataset', 'captured_at'])
        .ignore();
      await trx('brick_analytics_refresh')
        .insert({ dataset: source.definition.id, updated_at: at, activated_at: at })
        .onConflict('dataset')
        .merge({ updated_at: at, error_at: null });
    });
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
              (await source.read(scope, c)).filter(
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
        let records: any[];
        if (query.dimension && ['hour', 'day', 'week', 'month'].includes(query.dimension)) {
          const batches = await db.raw(
            `SELECT MAX(captured_at) at FROM brick_analytics_batch WHERE dataset=? AND captured_at>=? AND captured_at<? GROUP BY date_trunc(?,captured_at AT TIME ZONE ?) ORDER BY at`,
            [source.definition.id, c.from, c.to, query.dimension, c.timezone]
          );
          records = await db('brick_analytics_snapshot')
            .where({ dataset: source.definition.id })
            .whereIn(
              'captured_at',
              batches.rows.map((r: any) => r.at)
            )
            .select('record', 'captured_at')
            .limit(100001);
        } else
          records = await db('brick_analytics_snapshot')
            .where({ dataset: source.definition.id, captured_at: batch.at })
            .select('record', 'captured_at')
            .limit(100001);
        if (records.length > 100000) throw new Error('Snapshot query exceeds record limit');
        return mapStores(
          scopeFacts(
            records.map((r: any) => ({ ...r.record, at: new Date(r.captured_at).toISOString() })),
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
