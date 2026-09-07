"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateGa4MappingSchema = void 0;
exports.POST = POST;
exports.GET = GET;
const zod_1 = require("zod");
const ga4_1 = require("../../../modules/ga4");
const create_ga4_mapping_1 = require("../../../workflows/create-ga4-mapping");
const request_1 = require("../../../lib/multistore/request");
const scope_1 = require("../../../lib/multistore/scope");
const site_scope_1 = require("../../../modules/ga4/site-scope");
const Ga4ParamMappingSchema = zod_1.z.object({
    ga4_param: zod_1.z.string().min(1, 'ga4_param is required'),
    source_path: zod_1.z.string().optional(),
    static_value: zod_1.z.unknown().optional(),
});
exports.CreateGa4MappingSchema = zod_1.z.object({
    medusa_event: zod_1.z.string().min(1, 'medusa_event is required'),
    ga4_event_name: zod_1.z.string().min(1, 'ga4_event_name is required'),
    is_active: zod_1.z.boolean().optional().default(true),
    description: zod_1.z.string().optional(),
    param_mappings: zod_1.z.array(Ga4ParamMappingSchema).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
async function POST(req, res) {
    const input = req.validatedBody;
    const { result } = await (0, create_ga4_mapping_1.createGa4MappingWorkflow)(req.scope).run({
        input: {
            // Los defaults primero: un `site_id` explícito en el body gana.
            ...(0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.GA4_EVENT_MAPPING_SITE_SCOPE),
            ...input,
        },
    });
    res.status(201).json({ ga4_mapping: result });
}
async function GET(req, res) {
    const ga4Service = req.scope.resolve(ga4_1.GA4_MODULE);
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filters = {};
    if (q) {
        filters.$or = [
            { medusa_event: { $ilike: `%${q}%` } },
            { ga4_event_name: { $ilike: `%${q}%` } },
        ];
    }
    // El mapeo global se lista junto a los de la tienda: si se escondiera, el operador
    // vería eventos llegando a GA4 con un nombre que no aparece en ningún lado.
    Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GA4_EVENT_MAPPING_SITE_SCOPE));
    const [ga4_mappings, count] = await ga4Service.listAndCountGa4EventMappings(filters, {
        skip: offset,
        take: limit,
        order: { medusa_event: 'ASC' },
    });
    res.status(200).json({ ga4_mappings, count, offset, limit });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dhNC1tYXBwaW5ncy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUEyQkEsb0JBZUM7QUFFRCxrQkE2QkM7QUF4RUQsNkJBQXdCO0FBQ3hCLDhDQUFrRDtBQUVsRCw4RUFBaUY7QUFFakYsNkRBQWtFO0FBQ2xFLHlEQUF5RTtBQUN6RSxnRUFBK0U7QUFFL0UsTUFBTSxxQkFBcUIsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQ3JDLFNBQVMsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSx1QkFBdUIsQ0FBQztJQUNyRCxXQUFXLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNsQyxZQUFZLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNyQyxDQUFDLENBQUM7QUFFVSxRQUFBLHNCQUFzQixHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDN0MsWUFBWSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLDBCQUEwQixDQUFDO0lBQzNELGNBQWMsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSw0QkFBNEIsQ0FBQztJQUMvRCxTQUFTLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDL0MsV0FBVyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDbEMsY0FBYyxFQUFFLE9BQUMsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQyxRQUFRLEVBQUU7SUFDekQsUUFBUSxFQUFFLE9BQUMsQ0FBQyxNQUFNLENBQUMsT0FBQyxDQUFD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