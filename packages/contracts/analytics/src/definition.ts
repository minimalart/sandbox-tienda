import type { Dataset, Metric, Label } from './index';
export function defineDataset(
  id: string,
  label: Label,
  metrics: Metric[],
  dimensions: { id: string; label: Label }[]
): Dataset {
  const time = [
    { id: 'hour', label: { en: 'Hour', es: 'Hora' } },
    { id: 'day', label: { en: 'Day', es: 'Día' } },
    { id: 'week', label: { en: 'Week', es: 'Semana' } },
    { id: 'month', label: { en: 'Month', es: 'Mes' } },
  ];
  dimensions = [...dimensions, ...time.filter((t) => !dimensions.some((d) => d.id === t.id))];
  metrics = metrics.map((m) =>
    m.temporal === 'state'
      ? { ...m, dimensions: [...new Set([...m.dimensions, ...time.map((t) => t.id)])] }
      : m
  );
  return {
    id,
    label,
    metrics,
    dimensions,
    filters: dimensions
      .filter((d) => !['hour', 'day', 'week', 'month', 'store'].includes(d.id))
      .map((d) => ({ ...d, operators: ['eq', 'in'] })),
    globalFilters: [
      'store',
      'date_range',
      ...dimensions
        .filter((d) => !['hour', 'day', 'week', 'month', 'store'].includes(d.id))
        .map((d) => d.id),
    ],
  };
}
export const commonDimensions = [
  { id: 'store', label: { en: 'Store', es: 'Tienda' } },
  { id: 'channel', label: { en: 'Channel', es: 'Canal' } },
  { id: 'status', label: { en: 'Status', es: 'Estado' } },
];
export function metric(
  id: string,
  en: string,
  es: string,
  unit: Metric['unit'] = 'number',
  temporal: Metric['temporal'] = 'state',
  dimensions = commonDimensions.map((d) => d.id)
): Metric {
  return { id, label: { en, es }, description: { en, es }, unit, temporal, dimensions };
}
