"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const gift_card_experience_1 = require("../../../../modules/gift-card-experience");
const request_1 = require("../../../../lib/multistore/request");
const scope_1 = require("../../../../lib/multistore/scope");
const site_scope_1 = require("../../../../modules/gift-card-experience/site-scope");
async function GET(req, res) {
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    await service.ensureDefaultDesign();
    const resolution = await (0, request_1.siteFromRequest)(req);
    const [designs, count] = await service.listAndCountGiftCardDesigns(await (0, scope_1.siteFilter)(req.scope, resolution, site_scope_1.GIFT_CARD_DESIGN_SITE_SCOPE), { order: { sort_order: 'ASC' } });
    res.json({ designs, count });
}
async function POST(req, res) {
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const design = await service.createGiftCardDesigns({
        // El diseño nace en la tienda activa.
        ...(0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.GIFT_CARD_DESIGN_SITE_SCOPE),
        ...req.validatedBody,
    });
    res.status(201).json({ design });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dpZnQtY2FyZC1leHBlcmllbmNlL2Rlc2lnbnMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFZQSxrQkFTQztBQUVELG9CQVFDO0FBOUJELG1GQUF1RjtBQUt2RixnRUFBcUU7QUFDckUsNERBQTRFO0FBQzVFLG9GQUFrRztBQUkzRixLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQWtDLGtEQUEyQixDQUFDLENBQUM7SUFDaEcsTUFBTSxPQUFPLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztJQUNwQyxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsQ0FBQztJQUM5QyxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLDJCQUEyQixDQUNoRSxNQUFNLElBQUEsa0JBQVUsRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLFVBQVUsRUFBRSx3Q0FBMkIsQ0FBQyxFQUNwRSxFQUFFLEtBQUssRUFBRSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUNqQyxDQUFDO0lBQ0YsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQy9CLENBQUM7QUFFTSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQXlCLEVBQUUsR0FBbUI7SUFDdkUsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQWtDLGtEQUEyQixDQUFDLENBQUM7SUFDaEcsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMscUJBQXFCLENBQUM7UUFDakQsc0NBQXNDO1FBQ3RDLEdBQUcsSUFBQSxvQkFBWSxFQUFDLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxFQUFFLHdDQUEyQixDQUFDO1FBQ3hFLEdBQUksR0FBRyxDQUFDLGFBQXVCO0tBQ2hDLENBQUMsQ0FBQztJQUNILEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUNuQyxDQUFDIn0=