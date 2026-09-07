// Formato OpenUI portado del proyecto minimalart-web-scrapper: el asistente
// emite un bloque <sales_ui>{...}</sales_ui> con los datos a renderizar.

export const SALES_UI_START = '<sales_ui>';
export const SALES_UI_END = '</sales_ui>';

export type SalesAiMetric = {
  label: string;
  value: string;
  helper?: string;
  trend?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'negative';
};

export type SalesAiChartSeries = { key: string; label: string; color?: string };

export type SalesAiChartBlock = {
  type: 'chart';
  title: string;
  description?: string;
  chartType: 'line' | 'bar';
  xKey: string;
  series: SalesAiChartSeries[];
  data: Array<Record<string, string | number>>;
};

export type SalesAiMetricCardsBlock = {
  type: 'metric-cards';
  title?: string;
  metrics: SalesAiMetric[];
};

export type SalesAiTableBlock = {
  type: 'table';
  title: string;
  description?: string;
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>;
  rows: Array<Record<string, string | number>>;
};

export type SalesAiRankingBlock = {
  type: 'ranking';
  title: string;
  description?: string;
  items: Array<{ label: string; value: string; detail?: string; trend?: string }>;
};

export type SalesAiInsightsBlock = {
  type: 'insights';
  title?: string;
  items: Array<{ title: string; description: string; impact?: 'low' | 'medium' | 'high' }>;
};

export type SalesAiVisualBlock =
  | SalesAiChartBlock
  | SalesAiMetricCardsBlock
  | SalesAiTableBlock
  | SalesAiRankingBlock
  | SalesAiInsightsBlock;

export function parseSalesUiPayload(content: string): SalesAiVisualBlock[] | null {
  const start = content.indexOf(SALES_UI_START);
  const end = content.indexOf(SALES_UI_END);
  if (start === -1 || end === -1 || end <= start) return null;

  const raw = content.slice(start + SALES_UI_START.length, end).trim();
  try {
    const parsed = JSON.parse(raw) as { visuals?: SalesAiVisualBlock[] };
    return Array.isArray(parsed.visuals) ? parsed.visuals : null;
  } catch {
    return null;
  }
}

export function stripSalesUiPayload(content: string): string {
  const start = content.indexOf(SALES_UI_START);
  const end = content.indexOf(SALES_UI_END);
  if (start === -1) return content;
  if (end === -1 || end <= start) return content.slice(0, start).trim();
  return `${content.slice(0, start)}${content.slice(end + SALES_UI_END.length)}`.trim();
}
