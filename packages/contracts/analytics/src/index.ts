/** Shared semantic contract. No dependency on Medusa, React or optional modules. */
export { defineDataset, commonDimensions, metric } from './definition';
export type Label = { en: string; es: string };
export type Shape = 'single_metric' | 'time_series' | 'dimension_metric';
export type Unit = 'number' | 'money' | 'percent';
export type Filter = {
  field: string;
  operator: 'eq' | 'in' | 'gt' | 'lt';
  value: string | number | string[];
};
export type Query = {
  dataset: string;
  metric: string;
  dimension?: string;
  filters: Filter[];
  comparison: 'none' | 'previous' | 'year';
  store: { mode: 'inherit' | 'fixed'; ids: string[] };
};
export type Context = {
  storeIds: string[];
  channelIds: string[] | null;
  locationIds: string[] | null;
  from: string;
  to: string;
  timezone: string;
  currency: string | null;
  filters: Filter[];
};
export type Result = {
  shape: Shape;
  unit: Unit;
  rows: {
    key: string;
    /** Human name of the key when the dimension is an entity (store, product…). */
    label?: string;
    value: number;
    currency: string | null;
    previous?: number | null;
    delta?: number | null;
  }[];
  summary?: Result['rows'];
  context: Context;
  updatedAt: string;
  history: 'complete' | 'insufficient';
  stale: boolean;
};
export type Metric = {
  id: string;
  label: Label;
  description: Label;
  unit: Unit;
  temporal: 'flow' | 'state';
  dimensions: string[];
  /** Whether growth is good news. Refunds going up is not a green arrow. */
  polarity?: 'up_good' | 'down_good' | 'neutral';
};
export type Dataset = {
  id: string;
  label: Label;
  metrics: Metric[];
  dimensions: { id: string; label: Label }[];
  filters: { id: string; label: Label; operators: Filter['operator'][] }[];
  globalFilters: string[];
};
/** Presentation choices that never change what is queried. */
export type WidgetOptions = {
  /** Categories shown in bars, rankings and pies; the rest folds into "Other". */
  limit?: number;
  legend?: boolean;
  /** Abbreviated numbers even when there is room. */
  compact?: boolean;
};
export type Widget = {
  id: string;
  title: string;
  showTitle: boolean;
  query: Query;
  visualization: string;
  target?: number;
  options?: WidgetOptions;
  x: number;
  y: number;
  w: number;
  h: number;
};
export type Dashboard = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  visibility: 'personal' | 'role' | 'global';
  roleIds: string[];
  storeIds: string[];
  filters: string[];
  widgets: Widget[];
  version: number;
};
export type Visualization = {
  id: string;
  label: Label;
  shapes: Shape[];
  min: { w: number; h: number };
  max: { w: number; h: number };
  /** Size a new widget of this kind starts with. Presets only: saved layouts
   *  are never rewritten to match. */
  default?: { w: number; h: number };
};
export type Template = {
  id: string;
  label: Label;
  datasets: string[];
  widgets: Widget[];
  filters: string[];
};
export type DatasetProvider = {
  definition: Dataset;
  resource?: string;
  available(scope: unknown): Promise<boolean>;
  execute(query: Query, context: Context, scope: unknown): Promise<Result>;
  refresh?(scope: unknown): Promise<void>;
};
// One registry per JS realm, including npm archive and workspace consumers.
const registryKey = Symbol.for('@minimalart/mercatto-analytics-contract/v1');
const registry: {
  providers: Map<string, DatasetProvider>;
  visualizations?: Visualization[];
  templates: Template[];
  renderers: Map<string, unknown>;
} =
  ((globalThis as any)[registryKey] ??=
  (globalThis as any)[registryKey] =
    { providers: new Map(), templates: [], renderers: new Map() });
const providers = registry.providers;
export function registerDashboardDataset(provider: DatasetProvider): void {
  if (providers.has(provider.definition.id))
    throw new Error(`Duplicate analytics dataset: ${provider.definition.id}`);
  providers.set(provider.definition.id, provider);
}
export function getDashboardDatasets(): DatasetProvider[] {
  return [...providers.values()];
}
export function resultShape(query: Query): Shape {
  return !query.dimension
    ? 'single_metric'
    : ['hour', 'day', 'week', 'month'].includes(query.dimension)
      ? 'time_series'
      : 'dimension_metric';
}
// Starting sizes on the 12-column, 80px-row grid: an indicator needs a strip,
// a chart needs room for axes and labels, a table needs rows.
const builtInVisualizations: Visualization[] = (
  [
    ['metric', 'Indicator', 'Indicador', ['single_metric'], [3, 2]],
    ['sparkline', 'Indicator + trend', 'Indicador + evolución', ['time_series'], [3, 3]],
    ['gauge', 'Gauge', 'Medidor', ['single_metric'], [3, 2]],
    ['line', 'Line', 'Línea', ['time_series'], [6, 4]],
    ['area', 'Area', 'Área', ['time_series'], [6, 4]],
    ['bar', 'Bars', 'Barras', ['time_series', 'dimension_metric'], [6, 4]],
    ['pie', 'Pie', 'Circular', ['dimension_metric'], [4, 4]],
    ['donut', 'Donut', 'Dona', ['dimension_metric'], [4, 4]],
    ['table', 'Table', 'Tabla', ['single_metric', 'time_series', 'dimension_metric'], [6, 5]],
    ['ranking', 'Ranking', 'Ranking', ['dimension_metric'], [6, 5]],
  ] as [string, string, string, Shape[], [number, number]][]
).map(([id, en, es, shapes, [w, h]]) => ({
  id,
  label: { en, es },
  shapes,
  // A card may be squeezed to a single cell: what fits inside is the
  // renderer's problem, not a rule the editor should enforce.
  min: { w: 1, h: 1 },
  max: { w: 12, h: 12 },
  default: { w, h },
}));
/** Where a new widget of this kind starts: its preset, else its minimum, else
 *  the 4×4 every widget used to get. A registry filled by an older contract
 *  copy has no presets, hence the fallbacks. */
export function visualizationSize(id: string): { w: number; h: number } {
  const view = visualizations.find((v) => v.id === id);
  return (
    view?.default ?? (view?.min && (view.min.w > 2 || view.min.h > 2) ? view.min : { w: 4, h: 4 })
  );
}
export const visualizations =
  registry.visualizations ?? (registry.visualizations = builtInVisualizations);
export function registerDashboardWidget(definition: Visualization): void {
  if (visualizations.some((v) => v.id === definition.id))
    throw new Error('Duplicate visualization');
  visualizations.push(definition);
}
export const templates = registry.templates;
// Framework-neutral renderer registration. Admin integrations supply their component type.
const renderers = registry.renderers;
export function registerDashboardRenderer<T>(id: string, renderer: T): void {
  renderers.set(id, renderer);
}
export function getDashboardRenderer<T>(id: string): T | undefined {
  return renderers.get(id) as T | undefined;
}
export function registerDashboardTemplate(template: Template): void {
  if (templates.some((t) => t.id === template.id)) throw new Error('Duplicate template');
  templates.push(template);
}
export class AnalyticsValidationError extends Error {}
export function validateQuery(query: Query, dataset: Dataset): void {
  if (!query || query.dataset !== dataset.id) throw new AnalyticsValidationError('Unknown dataset');
  const metric = dataset.metrics.find((m) => m.id === query.metric);
  if (!metric || (query.dimension && !metric.dimensions.includes(query.dimension)))
    throw new AnalyticsValidationError('Unsupported metric or dimension');
  if (!['none', 'previous', 'year'].includes(query.comparison))
    throw new AnalyticsValidationError('Invalid comparison');
  if (
    !query.store ||
    !['inherit', 'fixed'].includes(query.store.mode) ||
    !Array.isArray(query.store.ids) ||
    query.store.ids.some((id) => typeof id !== 'string') ||
    (query.store.mode === 'fixed' && !query.store.ids.length)
  )
    throw new AnalyticsValidationError('Invalid store selection');
  if (!Array.isArray(query.filters) || query.filters.length > 20)
    throw new AnalyticsValidationError('Invalid filters');
  for (const filter of query.filters) {
    const def = dataset.filters.find((f) => f.id === filter.field);
    if (
      dataset.dimensions.some((d) => d.id === filter.field) &&
      !metric.dimensions.includes(filter.field)
    )
      throw new AnalyticsValidationError('Filter unsupported by metric');
    if (!def || !def.operators.includes(filter.operator))
      throw new AnalyticsValidationError('Unsupported filter');
    if (
      filter.operator === 'in'
        ? !Array.isArray(filter.value) ||
          !filter.value.length ||
          filter.value.some((v) => typeof v !== 'string')
        : !['string', 'number'].includes(typeof filter.value)
    )
      throw new AnalyticsValidationError('Invalid filter value');
    if (['gt', 'lt'].includes(filter.operator) && !Number.isFinite(Number(filter.value)))
      throw new AnalyticsValidationError('Invalid numeric filter');
  }
}
export function validateWidget(widget: Widget, dataset: Dataset): void {
  validateQuery(widget.query, dataset);
  const view = visualizations.find((v) => v.id === widget.visualization);
  if (!view?.shapes.includes(resultShape(widget.query)))
    throw new AnalyticsValidationError('Incompatible visualization');
  if (widget.visualization === 'gauge' && !(Number.isFinite(widget.target) && widget.target! > 0))
    throw new AnalyticsValidationError('Gauge requires a positive target');
  if (widget.options !== undefined) {
    const o = widget.options;
    if (
      o === null ||
      typeof o !== 'object' ||
      (o.limit !== undefined && !(Number.isInteger(o.limit) && o.limit! >= 1 && o.limit! <= 50)) ||
      (o.legend !== undefined && typeof o.legend !== 'boolean') ||
      (o.compact !== undefined && typeof o.compact !== 'boolean')
    )
      throw new AnalyticsValidationError('Invalid widget options');
  }
  if (
    ![widget.x, widget.y, widget.w, widget.h].every(Number.isInteger) ||
    widget.x < 0 ||
    widget.y < 0 ||
    widget.w < view.min.w ||
    widget.h < view.min.h ||
    widget.w > view.max.w ||
    widget.h > view.max.h ||
    widget.x + widget.w > 12
  )
    throw new AnalyticsValidationError('Invalid layout');
}
