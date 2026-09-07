"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const gift_card_experience_1 = require("../../../../modules/gift-card-experience");
async function GET(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const customerId = req.auth_context?.actor_id;
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    const wallets = await service.getCustomerWallet(customerId);
    res.json({ wallets });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2dpZnQtY2FyZC1leHBlcmllbmNlL3dhbGxldC9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUlBLGtCQU1DO0FBVEQsbUZBQXVGO0FBR2hGLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMzQyxNQUFNLFVBQVUsR0FBSSxHQUFnRSxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUM7SUFDNUcsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQWtDLGtEQUEyQixDQUFDLENBQUM7SUFDaEcsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMsaUJBQWlCLENBQUMsVUFBVyxDQUFDLENBQUM7SUFDN0QsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDeEIsQ0FBQyJ9