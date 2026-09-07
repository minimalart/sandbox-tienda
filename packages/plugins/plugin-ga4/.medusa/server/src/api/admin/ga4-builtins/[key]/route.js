"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateGa4BuiltinSchema = void 0;
exports.POST = POST;
const zod_1 = require("zod");
const ga4_1 = require("../../../../modules/ga4");
const supported_events_1 = require("../../../../modules/ga4/lib/supported-events");
exports.UpdateGa4BuiltinSchema = zod_1.z.object({
    is_active: zod_1.z.boolean().optional(),
    hidden: zod_1.z.boolean().optional(),
    ga4_event_name: zod_1.z.string().min(1, 'ga4_event_name cannot be empty').optional(),
});
async function POST(req, res) {
    const key = req.params.key;
    const isValid = supported_events_1.BUILTIN_GA4_EVENTS.some((b) => b.builtin_key === key);
    if (!isValid) {
        res.status(404).json({ message: `Unknown built-in event: ${key}` });
        return;
    }
    const input = req.validatedBody;
    const ga4Service = req.scope.resolve(ga4_1.GA4_MODULE);
    await ga4Service.upsertBuiltinSetting(key, input);
    const builtins = await ga4Service.getBuiltinSettings();
    const builtin = builtins.find((b) => b.builtin_key === key);
    res.status(200).json({ builtin });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dhNC1idWlsdGlucy9ba2V5XS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFjQSxvQkFxQkM7QUFsQ0QsNkJBQXdCO0FBQ3hCLGlEQUFxRDtBQUVyRCxtRkFBc0c7QUFFekYsUUFBQSxzQkFBc0IsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQzdDLFNBQVMsRUFBRSxPQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2pDLE1BQU0sRUFBRSxPQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzlCLGNBQWMsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxnQ0FBZ0MsQ0FBQyxDQUFDLFFBQVEsRUFBRTtDQUMvRSxDQUFDLENBQUM7QUFJSSxLQUFLLFVBQVUsSUFBSSxDQUN4QixHQUF5QyxFQUN6QyxHQUFtQjtJQUVuQixNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQW9CLENBQUM7SUFFNUMsTUFBTSxPQUFPLEdBQUcscUNBQWtCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQ3RFLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNiLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLDJCQUEyQixHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDcEUsT0FBTztJQUNULENBQUM7SUFFRCxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsYUFBc0MsQ0FBQztJQUN6RCxNQUFNLFVBQVUsR0FBcUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsZ0JBQVUsQ0FBQyxDQUFDO0lBRW5FLE1BQU0sVUFBVSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUVsRCxNQUFNLFFBQVEsR0FBRyxNQUFNLFVBQVUsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQ3ZELE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLEtBQUssR0FBRyxDQUFDLENBQUM7SUFFNUQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQ3BDLENBQUMifQ==