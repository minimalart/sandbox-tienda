"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const aggregate_commerce_metrics_1 = require("../../../../workflows/aggregate-commerce-metrics");
async function POST(req, res) {
    try {
        const body = (req.body ?? {});
        const to = body.to ?? new Date().toISOString();
        const from = body.from ??
            (() => {
                const date = new Date(to);
                date.setDate(date.getDate() - 30);
                date.setHours(0, 0, 0, 0);
                return date.toISOString();
            })();
        const { result, errors } = await (0, aggregate_commerce_metrics_1.aggregateCommerceMetricsWorkflow)(req.scope).run({
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
            console.error('[Admin Commerce Dashboard] aggregate step errors:', JSON.stringify(errors.map((e) => ({
                message: e?.error?.message,
                stack: e?.error?.stack,
            })), null, 2));
            const detail = errors
                .map((e) => e?.error?.message || String(e?.error))
                .join(' | ');
            return res.status(500).json({
                message: `No se pudieron regenerar los snapshots: ${detail}`,
            });
        }
        return res.status(202).json({ aggregate: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('[Admin Commerce Dashboard] aggregate failed:', error);
        return res.status(500).json({
            message: `No se pudieron regenerar los snapshots: ${message}`,
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NvbW1lcmNlLWRhc2hib2FyZC9hZ2dyZWdhdGUvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSxvQkEyREM7QUE3REQsaUdBQW9HO0FBRTdGLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxJQUFJLENBQUM7UUFDSCxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUszQixDQUFDO1FBRUYsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsSUFBSSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQy9DLE1BQU0sSUFBSSxHQUNSLElBQUksQ0FBQyxJQUFJO1lBQ1QsQ0FBQyxHQUFHLEVBQUU7Z0JBQ0osTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzFCLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO2dCQUNsQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUMxQixPQUFPLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUM1QixDQUFDLENBQUMsRUFBRSxDQUFDO1FBRVAsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLElBQUEsNkRBQWdDLEVBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQztZQUMvRSxLQUFLLEVBQUU7Z0JBQ0wsSUFBSTtnQkFDSixFQUFFO2dCQUNGLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxJQUFJLE9BQU87Z0JBQzlCLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYTthQUNsQztZQUNELFlBQVksRUFBRSxLQUFLO1NBQ3BCLENBQUMsQ0FBQztRQUVILElBQUksTUFBTSxFQUFFLE1BQU0sRUFBRSxDQUFDO1lBQ25CLDhEQUE4RDtZQUM5RCxPQUFPLENBQUMsS0FBSyxDQUNYLG1EQUFtRCxFQUNuRCxJQUFJLENBQUMsU0FBUyxDQUNaLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ3RCLE9BQU8sRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU87Z0JBQzFCLEtBQUssRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUs7YUFDdkIsQ0FBQyxDQUFDLEVBQ0gsSUFBSSxFQUNKLENBQUMsQ0FDRixDQUNGLENBQUM7WUFDRixNQUFNLE1BQU0sR0FBRyxNQUFNO2lCQUNsQixHQUFHLENBQUMsQ0FBQyxDQUFNLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxJQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7aUJBQ3RELElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNmLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7Z0JBQzFCLE9BQU8sRUFBRSwyQ0FBMkMsTUFBTSxFQUFFO2FBQzdELENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixNQUFNLE9BQU8sR0FDWCxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pFLE9BQU8sQ0FBQyxLQUFLLENBQUMsOENBQThDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUMxQixPQUFPLEVBQUUsMkNBQTJDLE9BQU8sRUFBRTtTQUM5RCxDQUFDLENBQUM7SUFDTCxDQUFDO0FBQ0gsQ0FBQyJ9