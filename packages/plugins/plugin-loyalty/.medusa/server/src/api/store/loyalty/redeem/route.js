"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const redeem_reward_1 = require("../../../../workflows/redeem-reward");
// Redeem a reward: spends points and produces the benefit (coupon / store credit)
// transactionally. Points are refunded automatically if the benefit fails.
async function POST(req, res) {
    const customerId = req.auth_context?.actor_id;
    if (!customerId) {
        res.status(401).json({ message: 'No autenticado' });
        return;
    }
    const body = (req.validatedBody ?? req.body);
    const redemptionRef = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    try {
        const { result } = await (0, redeem_reward_1.redeemRewardWorkflow)(req.scope).run({
            input: {
                customer_id: customerId,
                reward_id: body.reward_id,
                redemption_ref: redemptionRef,
                sales_channel_id: body.sales_channel_id ?? null,
            },
        });
        res.json({ grant: result.grant, already: result.already });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2xveWFsdHkvcmVkZWVtL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBT0Esb0JBdUJDO0FBN0JELHVFQUEyRTtBQUkzRSxrRkFBa0Y7QUFDbEYsMkVBQTJFO0FBQ3BFLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBK0IsRUFBRSxHQUFtQjtJQUM3RSxNQUFNLFVBQVUsR0FBRyxHQUFHLENBQUMsWUFBWSxFQUFFLFFBQVEsQ0FBQztJQUM5QyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDaEIsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO1FBQ3BELE9BQU87SUFDVCxDQUFDO0lBRUQsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQWUsQ0FBQztJQUMzRCxNQUFNLGFBQWEsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFFNUYsSUFBSSxDQUFDO1FBQ0gsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBQSxvQ0FBb0IsRUFBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDO1lBQzNELEtBQUssRUFBRTtnQkFDTCxXQUFXLEVBQUUsVUFBVTtnQkFDdkIsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTO2dCQUN6QixjQUFjLEVBQUUsYUFBYTtnQkFDN0IsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixJQUFJLElBQUk7YUFDaEQ7U0FDRixDQUFDLENBQUM7UUFDSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUcsS0FBZSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDOUQsQ0FBQztBQUNILENBQUMifQ==