import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { aggregateCommerceMetricsWorkflow } from '../../../../workflows/aggregate-commerce-metrics';

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (req.body ?? {}) as {
      from?: string;
      to?: string;
      bucket?: 'daily' | 'hourly';
      currency_code?: string;
    };

    const to = body.to ?? new Date().toISOString();
    const from =
      body.from ??
      (() => {
        const date = new Date(to);
        date.setDate(date.getDate() - 30);
        date.setHours(0, 0, 0, 0);
        return date.toISOString();
      })();

    const { result, errors } = await aggregateCommerceMetricsWorkflow(req.scope).run({
      input: {
        from,
        to,
        bucket: body.bucket ?? 'daily',
        currency_code: body.currency_code,
      },
      throwOnError: false,
    });

    if (errors?.length) {
      // Surfacear el error REAL del step (el workflow lo envuelve).
      console.error(
        '[Admin Commerce Dashboard] aggregate step errors:',
        JSON.stringify(
          errors.map((e: any) => ({
            message: e?.error?.message,
            stack: e?.error?.stack,
          })),
          null,
          2,
        ),
      );
      const detail = errors
        .map((e: any) => e?.error?.message || String(e?.error))
        .join(' | ');
      return res.status(500).json({
        message: `No se pudieron regenerar los snapshots: ${detail}`,
      });
    }

    return res.status(202).json({ aggregate: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.error('[Admin Commerce Dashboard] aggregate failed:', error);
    return res.status(500).json({
      message: `No se pudieron regenerar los snapshots: ${message}`,
    });
  }
}
