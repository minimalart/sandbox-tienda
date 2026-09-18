export type ClarityReport = {
  fetchedAt: string;
  days: number;
  status: 'success' | 'rate_limited' | 'error';
  metrics: Array<{ name: string; rows: Array<Record<string, string | number>> }>;
};
export function clarityOverview(metrics: ClarityReport['metrics']) {
  const row = (name: string) => {
    const m = metrics.find((m) => m.name.replace(/[^a-z]/gi, '').toLowerCase() === name);
    return m?.rows.length === 1 ? m.rows[0] : undefined;
  };
  const number = (value: unknown): number | null =>
    value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : null;
  const traffic = row('traffic'),
    scroll = row('scrolldepth'),
    engagement = row('engagementtime');
  const sessions = number(traffic?.totalSessionCount);
  const bots = number(traffic?.totalBotSessionCount);
  return {
    sessions: sessions === null ? null : Math.max(0, sessions - (bots ?? 0)),
    pagesPerSession: number(
      traffic?.pagesPerSessionPercentage ??
        traffic?.PagesPerSessionPercentage ??
        traffic?.pagesPerSession
    ),
    scrollDepth: number(scroll?.averageScrollDepth ?? scroll?.scrollDepth),
    activeTimeSeconds: number(engagement?.activeTime ?? engagement?.averageEngagementTime),
  };
}
export function normalizeClarity(payload: unknown): ClarityReport['metrics'] {
  if (!Array.isArray(payload)) throw new Error('Invalid Clarity response');
  return payload.slice(0, 30).map((metric) => {
    if (!metric || typeof metric.metricName !== 'string' || !Array.isArray(metric.information))
      throw new Error('Invalid Clarity metric');
    return {
      name: metric.metricName.slice(0, 100),
      rows: metric.information.slice(0, 1000).map((row: unknown) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return {};
        return Object.fromEntries(
          Object.entries(row)
            .filter(
              ([key, value]) =>
                key.length < 100 &&
                (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)))
            )
            .slice(0, 50)
            .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 2048) : value])
        );
      }),
    };
  });
}
