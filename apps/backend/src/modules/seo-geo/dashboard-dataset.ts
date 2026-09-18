import {
  registerDashboardDataset,
  defineDataset,
  commonDimensions,
  metric,
} from '@minimalart/mercatto-analytics-contract';
import { factDataset } from '@minimalart/mercatto-analytics-contract/facts';
const definition = defineDataset(
  'seo',
  { en: 'SEO', es: 'SEO' },
  [
    metric('issues', 'Open issues', 'Hallazgos abiertos'),
    metric('score', 'SEO score', 'Score SEO'),
    metric('missing_metadata', 'Pages missing metadata', 'Páginas sin metadata'),
  ],
  commonDimensions
);
registerDashboardDataset(
  factDataset({
    definition,
    resource: 'seo_geo',
    available: async (scope) => {
      try {
        scope.resolve('seo_geo');
        return true;
      } catch {
        return false;
      }
    },
    measures: {
      issues: { unit: 'number', numerator: 'issues' },
      score: { unit: 'number', numerator: 'score', denominator: 'scored' },
      missing_metadata: { unit: 'number', numerator: 'missing_metadata' },
    },
    async read(scope, context) {
      const db = scope.resolve('__pg_connection__');
      const bindings: any[] = [];
      const predicate = context.channelIds === null ? '' : 'AND a.sales_channel_id=ANY(?::text[])';
      if (context.channelIds !== null) bindings.push(context.channelIds);
      const { rows } = await db.raw(
        `WITH latest AS (SELECT DISTINCT ON(sales_channel_id) id,sales_channel_id,status,seo_score FROM seo_audit a WHERE deleted_at IS NULL AND status='completed' ${predicate} ORDER BY sales_channel_id,completed_at DESC)
      SELECT a.*,COUNT(f.id) FILTER(WHERE f.status='open') issues,COUNT(DISTINCT f.page_url) FILTER(WHERE f.status='open' AND f.type IN ('missing-title','missing-meta-description')) missing_metadata
      FROM latest a LEFT JOIN seo_finding f ON f.audit_id=a.id AND f.deleted_at IS NULL GROUP BY a.id,a.sales_channel_id,a.status,a.seo_score`,
        bindings
      );
      return rows.map((r: any) => ({
        id: r.id,
        at: new Date().toISOString(),
        currency: null,
        dimensions: { channel: r.sales_channel_id, status: r.status },
        values: {
          issues: Number(r.issues),
          score: Number(r.seo_score ?? 0),
          scored: r.seo_score == null ? 0 : 1,
          missing_metadata: Number(r.missing_metadata),
        },
      }));
    },
  })
);
