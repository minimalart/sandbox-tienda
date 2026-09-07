import { Component, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  SalesAiChartBlock,
  SalesAiInsightsBlock,
  SalesAiMetricCardsBlock,
  SalesAiRankingBlock,
  SalesAiTableBlock,
  SalesAiVisualBlock,
} from '../lib/visuals';

const CHART_COLORS = ['#3b82f6', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeChartBlock(block: SalesAiChartBlock): SalesAiChartBlock | null {
  if (!Array.isArray(block.data) || block.data.length === 0) return null;
  if (!Array.isArray(block.series) || block.series.length === 0) return null;
  const series = block.series
    .filter((item) => typeof item.key === 'string' && item.key.length > 0)
    .slice(0, CHART_COLORS.length);
  if (series.length === 0) return null;
  const data = block.data
    .filter((row) => row && typeof row === 'object' && block.xKey in row)
    .map((row) => {
      const next = { ...row };
      for (const item of series) {
        if (!isFiniteNumber(next[item.key])) delete next[item.key];
      }
      return next;
    })
    .filter((row) => series.some((item) => isFiniteNumber(row[item.key])))
    .slice(0, 60);
  if (data.length === 0) return null;
  return { ...block, data, series };
}

class VisualErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return <UnsupportedBlock />;
    return this.props.children;
  }
}

const TONE: Record<string, string> = {
  neutral: 'bg-ui-bg-subtle text-ui-fg-subtle',
  positive: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  negative: 'bg-red-50 text-red-700',
};

function Card({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-base">
      {title ? (
        <div className="border-b border-ui-border-base px-4 py-3">
          <p className="txt-compact-small-plus text-ui-fg-base">{title}</p>
          {description ? <p className="txt-small text-ui-fg-subtle">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function MetricCardsBlock({ block }: { block: SalesAiMetricCardsBlock }) {
  return (
    <div className="flex flex-col gap-3">
      {block.title ? <div className="txt-compact-small-plus text-ui-fg-base">{block.title}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {block.metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="truncate text-[11px] font-medium uppercase text-ui-fg-muted" title={metric.label}>
                {metric.label}
              </p>
              {metric.trend ? (
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs ${TONE[metric.tone ?? 'neutral']}`}>
                  {metric.trend}
                </span>
              ) : null}
            </div>
            <p className="mt-3 truncate text-xl font-semibold text-ui-fg-base tabular-nums" title={metric.value}>
              {metric.value}
            </p>
            {metric.helper ? (
              <p className="mt-1 truncate txt-small text-ui-fg-subtle" title={metric.helper}>
                {metric.helper}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAxisNumber(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })}k`;
  return value.toLocaleString('es-AR');
}

function ChartBlock({ block }: { block: SalesAiChartBlock }) {
  const chartBlock = normalizeChartBlock(block);
  if (!chartBlock) return <UnsupportedBlock />;
  const Chart = block.chartType === 'bar' ? BarChart : LineChart;
  return (
    <Card title={chartBlock.title} description={chartBlock.description}>
      <div className="h-[260px] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={chartBlock.data} margin={{ bottom: 8, left: 8, right: 16, top: 8 }}>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={chartBlock.xKey} axisLine={false} tickLine={false} fontSize={12} tickMargin={10} />
            <YAxis
              axisLine={false}
              tickLine={false}
              fontSize={12}
              width={64}
              tickFormatter={(v) => formatAxisNumber(Number(v))}
            />
            <Tooltip formatter={(v) => Number(v).toLocaleString('es-AR')} />
            {chartBlock.series.map((series, index) =>
              chartBlock.chartType === 'bar' ? (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  fill={series.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ) : (
                <Line
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  dot={false}
                  type="monotone"
                  stroke={series.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2.5}
                />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function TableBlock({ block }: { block: SalesAiTableBlock }) {
  return (
    <Card title={block.title} description={block.description}>
      <div className="overflow-x-auto p-2">
        <table className="w-full txt-small">
          <thead>
            <tr className="border-b border-ui-border-base text-ui-fg-subtle">
              {block.columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className="border-b border-ui-border-base last:border-0">
                {block.columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 text-ui-fg-base ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {String(row[c.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RankingBlock({ block }: { block: SalesAiRankingBlock }) {
  return (
    <Card title={block.title} description={block.description}>
      <div className="flex flex-col gap-2 p-3">
        {block.items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-4 rounded-md border border-ui-border-base px-3 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ui-bg-subtle text-xs font-semibold text-ui-fg-subtle">
                {index + 1}
              </div>
              <div className="min-w-0">
                <p className="truncate txt-compact-small text-ui-fg-base">{item.label}</p>
                {item.detail ? <p className="truncate txt-small text-ui-fg-subtle">{item.detail}</p> : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="txt-compact-small-plus text-ui-fg-base">{item.value}</p>
              {item.trend ? <p className="txt-small text-ui-fg-subtle">{item.trend}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InsightsBlock({ block }: { block: SalesAiInsightsBlock }) {
  const impactLabel: Record<string, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto' };
  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
      <h3 className="mb-3 txt-compact-small-plus text-ui-fg-base">{block.title ?? 'Insights'}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {block.items.map((item) => (
          <div key={item.title} className="rounded-md border border-ui-border-base bg-ui-bg-base p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="txt-compact-small text-ui-fg-base">{item.title}</p>
              {item.impact ? (
                <span className="shrink-0 rounded-md bg-ui-bg-subtle px-1.5 py-0.5 text-xs text-ui-fg-subtle">
                  {impactLabel[item.impact]}
                </span>
              ) : null}
            </div>
            <p className="mt-1 txt-small text-ui-fg-subtle">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnsupportedBlock() {
  return (
    <div className="rounded-md border border-ui-border-base bg-ui-bg-subtle p-3 txt-small text-ui-fg-subtle">
      No se pudo renderizar este bloque visual.
    </div>
  );
}

export function VisualRenderer({ visuals }: { visuals?: SalesAiVisualBlock[] | null }) {
  if (!visuals?.length) return null;
  return (
    <div className="mt-3 flex flex-col gap-4">
      {visuals.map((block, index) => (
        <VisualErrorBoundary key={`${block.type}-${index}`}>
          {block.type === 'metric-cards' ? <MetricCardsBlock block={block} /> : null}
          {block.type === 'chart' ? <ChartBlock block={block} /> : null}
          {block.type === 'table' ? <TableBlock block={block} /> : null}
          {block.type === 'ranking' ? <RankingBlock block={block} /> : null}
          {block.type === 'insights' ? <InsightsBlock block={block} /> : null}
        </VisualErrorBoundary>
      ))}
    </div>
  );
}
