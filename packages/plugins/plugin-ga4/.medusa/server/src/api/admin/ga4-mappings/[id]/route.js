"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateGa4MappingSchema = void 0;
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const zod_1 = require("zod");
const ga4_1 = require("../../../../modules/ga4");
const update_ga4_mapping_1 = require("../../../../workflows/update-ga4-mapping");
const delete_ga4_mapping_1 = require("../../../../workflows/delete-ga4-mapping");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/ga4/site-scope");
const Ga4ParamMappingSchema = zod_1.z.object({
    ga4_param: zod_1.z.string().min(1, 'ga4_param is required'),
    source_path: zod_1.z.string().optional(),
    static_value: zod_1.z.unknown().optional(),
});
exports.UpdateGa4MappingSchema = zod_1.z.object({
    medusa_event: zod_1.z.string().min(1).optional(),
    ga4_event_name: zod_1.z.string().min(1).optional(),
    is_active: zod_1.z.boolean().optional(),
    description: zod_1.z.string().optional(),
    param_mappings: zod_1.z.array(Ga4ParamMappingSchema).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
async function GET(req, res) {
    // Todos los handlers: editar el mapeo GLOBAL desde la pantalla de una tienda
    // cambia a qué evento de GA4 va cada acción en TODAS las demás.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GA4_EVENT_MAPPING_SITE_SCOPE, req.params.id);
    const id = req.params.id;
    const ga4Service = req.scope.resolve(ga4_1.GA4_MODULE);
    const ga4_mapping = await ga4Service.retrieveGa4EventMapping(id);
    res.status(200).json({ ga4_mapping });
}
async function POST(req, res) {
    // Todos los handlers: editar el mapeo GLOBAL desde la pantalla de una tienda
    // cambia a qué evento de GA4 va cada acción en TODAS las demás.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GA4_EVENT_MAPPING_SITE_SCOPE, req.params.id);
    const id = req.params.id;
    const input = req.validatedBody;
    const { result } = await (0, update_ga4_mapping_1.updateGa4MappingWorkflow)(req.scope).run({
        input: { id, ...input },
    });
    res.status(200).json({ ga4_mapping: result });
}
async function DELETE(req, res) {
    // Todos los handlers: editar el mapeo GLOBAL desde la pantalla de una tienda
    // cambia a qué evento de GA4 va cada acción en TODAS las demás.
    await (0, scope_1.assertIdInSite)(req.scope, await (0, request_1.siteFromRequest)(req), site_scope_1.GA4_EVENT_MAPPING_SITE_SCOPE, req.params.id);
    const id = req.params.id;
    await (0, delete_ga4_mapping_1.deleteGa4MappingWorkflow)(req.scope).run({
        input: { id },
    });
    res.status(200).json({ id, deleted: true });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dhNC1tYXBwaW5ncy9baWRdL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQTRCQSxrQkFXQztBQUVELG9CQWdCQztBQUVELHdCQVlDO0FBdEVELDZCQUF3QjtBQUN4QixpREFBcUQ7QUFFckQsaUZBQW9GO0FBQ3BGLGlGQUFvRjtBQUVwRixnRUFBcUU7QUFDckUsNERBQWtFO0FBQ2xFLG1FQUFrRjtBQUVsRixNQUFNLHFCQUFxQixHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDckMsU0FBUyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLHVCQUF1QixDQUFDO0lBQ3JELFdBQVcsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLFlBQVksRUFBRSxPQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ3JDLENBQUMsQ0FBQztBQUVVLFFBQUEsc0JBQXNCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUM3QyxZQUFZLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUU7SUFDMUMsY0FBYyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQzVDLFNBQVMsRUFBRSxPQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2pDLFdBQVcsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLGNBQWMsRUFBRSxPQUFDLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUMsUUFBUSxFQUFFO0lBQ3pELFFBQVEsRUFBRSxPQUFDLENBQUMsTUFBTSxDQUFDLE9BQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxPQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUU7Q0FDdkQsQ0FBQyxDQUFDO0FBSUksS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELDZFQUE2RTtJQUM3RSxnRUFBZ0U7SUFDaEUsTUFBTSxJQUFBLHNCQUFjLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsRUFBRSx5Q0FBNEIsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQyxDQUFDO0lBRW5ILE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxDQUFDO0lBQ25DLE1BQU0sVUFBVSxHQUFxQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxnQkFBVSxDQUFDLENBQUM7SUFFbkUsTUFBTSxXQUFXLEdBQUcsTUFBTSxVQUFVLENBQUMsdUJBQXVCLENBQUMsRUFBRSxDQUFDLENBQUM7SUFFakUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO0FBQ3hDLENBQUM7QUFFTSxLQUFLLFVBQVUsSUFBSSxDQUN4QixHQUF5QyxFQUN6QyxHQUFtQjtJQUVuQiw2RUFBNkU7SUFDN0UsZ0VBQWdFO0lBQ2hFLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUseUNBQTRCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUVuSCxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQztJQUNuQyxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsYUFBc0MsQ0FBQztJQUV6RCxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFBLDZDQUF3QixFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUM7UUFDL0QsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsS0FBSyxFQUFFO0tBQ3hCLENBQUMsQ0FBQztJQUVILEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDaEQsQ0FBQztBQUVNLEtBQUssVUFBVSxNQUFNLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNsRSw2RUFBNkU7SUFDN0UsZ0VBQWdFO0lBQ2hFLE1BQU0sSUFBQSxzQkFBYyxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLEVBQUUseUNBQTRCLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUMsQ0FBQztJQUVuSCxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQztJQUVuQyxNQUFNLElBQUEsNkNBQXdCLEVBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQztRQUM1QyxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUU7S0FDZCxDQUFDLENBQUM7SUFFSCxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUM5QyxDQUFDIn0=