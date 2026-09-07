"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const points_1 = require("../../../../modules/points");
// POST /store/points/redeem — debit points from the authenticated customer.
// Converting redeemed points into a cart discount happens at checkout (storefront
// integration); this endpoint owns the balance/ledger side only.
async function POST(req, res) {
    const customerId = req.auth_context.actor_id;
    const amount = req.body?.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ message: 'amount must be a positive number' });
        return;
    }
    const service = req.scope.resolve(points_1.POINTS_MODULE);
    try {
        const account = await service.redeemPoints(customerId, amount, { reference: 'manual' });
        res.status(200).json({ balance: account.balance, redeemed: amount });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL3BvaW50cy9yZWRlZW0vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFPQSxvQkFvQkM7QUExQkQsdURBQTJEO0FBRzNELDRFQUE0RTtBQUM1RSxrRkFBa0Y7QUFDbEYsaUVBQWlFO0FBQzFELEtBQUssVUFBVSxJQUFJLENBQ3hCLEdBQW9ELEVBQ3BELEdBQW1CO0lBRW5CLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO0lBQzdDLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDO0lBRWhDLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxNQUFNLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDMUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsa0NBQWtDLEVBQUUsQ0FBQyxDQUFDO1FBQ3RFLE9BQU87SUFDVCxDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQXNCLHNCQUFhLENBQUMsQ0FBQztJQUV0RSxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLE1BQU0sRUFBRSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ3hGLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRyxLQUFlLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUM5RCxDQUFDO0FBQ0gsQ0FBQyJ9