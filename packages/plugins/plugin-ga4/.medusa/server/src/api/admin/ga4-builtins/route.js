"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const ga4_1 = require("../../../modules/ga4");
const request_1 = require("../../../lib/multistore/request");
/** `null` = la fila GLOBAL, el fallback de toda tienda sin mapeo propio. */
const siteOf = async (req) => {
    const resolution = await (0, request_1.siteFromRequest)(req);
    return resolution.status === 'site' ? resolution.site.id : null;
};
async function GET(req, res) {
    const ga4Service = req.scope.resolve(ga4_1.GA4_MODULE);
    const builtins = await ga4Service.getBuiltinSettings(await siteOf(req));
    res.status(200).json({ builtins });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dhNC1idWlsdGlucy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWFBLGtCQUlDO0FBaEJELDhDQUFrRDtBQUdsRCw2REFBa0U7QUFHbEUsNEVBQTRFO0FBQzVFLE1BQU0sTUFBTSxHQUFHLEtBQUssRUFBRSxHQUFrQixFQUEwQixFQUFFO0lBQ2xFLE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzlDLE9BQU8sVUFBVSxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDbEUsQ0FBQyxDQUFDO0FBRUssS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sVUFBVSxHQUFxQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxnQkFBVSxDQUFDLENBQUM7SUFDbkUsTUFBTSxRQUFRLEdBQUcsTUFBTSxVQUFVLENBQUMsa0JBQWtCLENBQUMsTUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN4RSxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7QUFDckMsQ0FBQyJ9