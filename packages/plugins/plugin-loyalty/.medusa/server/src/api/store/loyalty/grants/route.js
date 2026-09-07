"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const loyalty_1 = require("../../../../modules/loyalty");
// The authenticated customer's reward grants (their obtained benefits).
async function GET(req, res) {
    const customerId = req.auth_context?.actor_id;
    if (!customerId) {
        res.status(401).json({ message: 'No autenticado' });
        return;
    }
    const service = req.scope.resolve(loyalty_1.LOYALTY_MODULE);
    const grants = (await service.listRewardGrants({ customer_id: customerId }, { relations: ['reward'], order: { created_at: 'DESC' } }));
    res.json({ grants });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2xveWFsdHkvZ3JhbnRzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBS0Esa0JBY0M7QUFsQkQseURBQTZEO0FBRzdELHdFQUF3RTtBQUNqRSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQStCLEVBQUUsR0FBbUI7SUFDNUUsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLFlBQVksRUFBRSxRQUFRLENBQUM7SUFDOUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2hCLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLENBQUMsQ0FBQztRQUNwRCxPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUF1Qix3QkFBYyxDQUFDLENBQUM7SUFDeEUsTUFBTSxNQUFNLEdBQUcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FDNUMsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLEVBQzNCLEVBQUUsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQ3pELENBQStCLENBQUM7SUFFakMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDdkIsQ0FBQyJ9