"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const loyalty_1 = require("../../../../modules/loyalty");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/loyalty/site-scope");
async function GET(req, res) {
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const resolution = await (0, request_1.siteFromRequest)(req);
    const [programs, count] = await service.listAndCountLoyaltyPrograms(await (0, scope_1.siteFilter)(req.scope, resolution, site_scope_1.LOYALTY_PROGRAM_SITE_SCOPE), { order: { created_at: 'DESC' } });
    res.json({ programs, count });
}
async function POST(req, res) {
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const resolution = await (0, request_1.siteFromRequest)(req);
    /**
     * El programa nace en la tienda activa.
     *
     * Los defaults van PRIMERO para que un `site_id` explícito en el body gane: es lo
     * que permite crear el programa de otra tienda desde un script sin pelear con el
     * header. Al revés, el default pisaría siempre y el body sería decorativo.
     */
    const created = await service.createLoyaltyPrograms({
        ...(0, scope_1.siteDefaults)(resolution, site_scope_1.LOYALTY_PROGRAM_SITE_SCOPE),
        ...req.validatedBody,
    });
    res.status(201).json({ program: created });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xveWFsdHkvcHJvZ3JhbXMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFPQSxrQkFRQztBQUVELG9CQWdCQztBQWhDRCx5REFBNkQ7QUFFN0QsZ0VBQXFFO0FBQ3JFLDREQUE0RTtBQUM1RSx1RUFBb0Y7QUFFN0UsS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUF1Qix3QkFBYyxDQUFDLENBQUM7SUFDeEUsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLENBQUM7SUFDOUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQywyQkFBMkIsQ0FDakUsTUFBTSxJQUFBLGtCQUFVLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUUsdUNBQTBCLENBQUMsRUFDbkUsRUFBRSxLQUFLLEVBQUUsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FDbEMsQ0FBQztJQUNGLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRU0sS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUF1Qix3QkFBYyxDQUFDLENBQUM7SUFDeEUsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFBLHlCQUFlLEVBQUMsR0FBRyxDQUFDLENBQUM7SUFFOUM7Ozs7OztPQU1HO0lBQ0gsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMscUJBQXFCLENBQUM7UUFDbEQsR0FBRyxJQUFBLG9CQUFZLEVBQUMsVUFBVSxFQUFFLHVDQUEwQixDQUFDO1FBQ3ZELEdBQUksR0FBRyxDQUFDLGFBQXlDO0tBQ2xELENBQUMsQ0FBQztJQUNILEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDN0MsQ0FBQyJ9