import type { Context, Query, Result, Unit } from './index';
import { resultShape } from './index';
export type Fact = {
  id: string;
  at: string;
  currency: string | null;
  dimensions: Record<string, string | string[] | null>;
  values: Record<string, number>;
};
export type Measure = {
  unit: Unit;
  numerator: string;
  denominator?: string;
  distinct?: string;
  /** Share of one distinct population within another, such as returning buyers
   *  over buyers. Counting rows cannot express it: both sides are de-duplicated. */
  distinctDenominator?: string;
  average?: boolean;
};
export function bucketKey(at: string, dimension: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  if (dimension === 'month') return date.slice(0, 7);
  if (dimension === 'hour') return `${date}T${get('hour')}:00`;
  if (dimension === 'week') {
    const day = new Date(`${date}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    return day.toISOString().slice(0, 10);
  }
  return date;
}
export function aggregateFacts(
  facts: Fact[],
  query: Query,
  context: Context,
  measure: Measure
): Result['rows'] {
  const groups = new Map<
    string,
    {
      key: string;
      currency: string | null;
      sum: number;
      count: number;
      distinct: Set<string>;
      population: Set<string>;
    }
  >();
  for (const fact of facts) {
    if (!(measure.numerator in fact.values)) continue;
    if (context.currency && fact.currency !== context.currency && measure.unit === 'money')
      continue;
    if (
      ![...context.filters, ...query.filters].every((f) => {
        const value = fact.dimensions[f.field] ?? fact.values[f.field];
        const values = Array.isArray(value) ? value : [String(value)];
        if (f.operator === 'eq') return values.includes(String(f.value));
        if (f.operator === 'in') return (f.value as string[]).some((v) => values.includes(v));
        return f.operator === 'gt'
          ? Number(value) > Number(f.value)
          : Number(value) < Number(f.value);
      })
    )
      continue;
    let dimensions: string[] = ['total'];
    if (query.dimension) {
      if (['hour', 'day', 'week', 'month'].includes(query.dimension)) {
        dimensions = [bucketKey(fact.at, query.dimension, context.timezone)];
      } else {
        const value = fact.dimensions[query.dimension];
        dimensions =
          Array.isArray(value) && value.length
            ? [...new Set(value)]
            : [typeof value === 'string' ? value : '—'];
      }
    }
    for (const key of dimensions) {
      const currency = measure.unit === 'money' ? fact.currency : null;
      const id = JSON.stringify([key, currency]);
      const group = groups.get(id) ?? {
        key,
        currency,
        sum: 0,
        count: 0,
        distinct: new Set<string>(),
        population: new Set<string>(),
      };
      // Category membership overlaps. Allocate additive measures so totals reconcile.
      const weight = ['category', 'brand', 'payment', 'shipping'].includes(query.dimension ?? '')
        ? 1 / dimensions.length
        : 1;
      group.sum += (fact.values[measure.numerator] ?? 0) * weight;
      group.count += (measure.denominator ? (fact.values[measure.denominator] ?? 0) : 1) * weight;
      if (measure.distinct) {
        const value = fact.dimensions[measure.distinct];
        if (typeof value === 'string') group.distinct.add(value);
      }
      if (measure.distinctDenominator) {
        const value = fact.dimensions[measure.distinctDenominator];
        if (typeof value === 'string') group.population.add(value);
      }
      groups.set(id, group);
    }
  }
  return [...groups.values()]
    .map((g) => ({
      key: g.key,
      currency: g.currency,
      value: measure.distinctDenominator
        ? g.population.size
          ? g.distinct.size / g.population.size
          : 0
        : measure.distinct
          ? g.distinct.size
          : measure.denominator || measure.average
            ? g.count
              ? g.sum / g.count
              : 0
            : g.sum,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
export function compareRows(
  current: Result['rows'],
  previous: Result['rows'],
  temporal: boolean,
  alignment?: {
    currentFrom: string;
    previousFrom: string;
    dimension: string;
    timezone: string;
    comparison?: Query['comparison'];
  }
): Result['rows'] {
  const ordinal = (key: string) =>
    alignment?.dimension === 'month'
      ? Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7))
      : Date.parse(key.length === 10 ? `${key}T00:00:00Z` : `${key}Z`);
  return current.map((row) => {
    const priorYearKey = () => {
      if (row.key.length === 7) return `${Number(row.key.slice(0, 4)) - 1}${row.key.slice(4)}`;
      const date = new Date(`${row.key.slice(0, 10)}T00:00:00Z`),
        month = date.getUTCMonth();
      date.setUTCFullYear(date.getUTCFullYear() - 1);
      if (date.getUTCMonth() !== month) date.setUTCDate(0);
      if (alignment?.dimension === 'week')
        date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      return date.toISOString().slice(0, 10) + row.key.slice(10);
    };
    const series = current.filter((r) => r.currency === row.currency),
      old = previous.filter((r) => r.currency === row.currency);
    const previousRow = temporal
      ? alignment?.comparison === 'year'
        ? old.find((r) => r.key === priorYearKey())
        : alignment
          ? old.find(
              (r) =>
                ordinal(r.key) -
                  ordinal(
                    bucketKey(alignment.previousFrom, alignment.dimension, alignment.timezone)
                  ) ===
                ordinal(row.key) -
                  ordinal(bucketKey(alignment.currentFrom, alignment.dimension, alignment.timezone))
            )
          : old[series.indexOf(row)]
      : old.find((r) => r.key === row.key);
    const value = previousRow?.value ?? null;
    return {
      ...row,
      previous: value,
      delta: value === null || value === 0 ? null : ((row.value - value) / Math.abs(value)) * 100,
    };
  });
}
export function emptyResult(query: Query, context: Context, unit: Unit): Result {
  return {
    shape: resultShape(query),
    unit,
    rows: [],
    context,
    updatedAt: new Date().toISOString(),
    history: 'complete',
    stale: false,
  };
}
