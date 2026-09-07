"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseLoyaltyPointsWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const points_1 = require("../modules/points");
// Claws back the points earned from a given source (order canceled / returned).
// Idempotent: each reversal keys off the original earn txn id, so re-running or
// a duplicate event never double-reverses.
const reverseStep = (0, workflows_sdk_1.createStep)('loyalty-reverse-points', async (input, { container }) => {
    const points = container.resolve(points_1.POINTS_MODULE);
    const account = await points.getOrCreateAccount(input.customer_id);
    const earns = (await points.listPointsTransactions({
        account_id: account.id,
        type: 'earn',
        reference: input.reference ?? 'order',
        reference_id: input.reference_id,
    }));
    let reversed = 0;
    for (const e of earns) {
        const amount = Number(e.amount) || 0;
        if (amount <= 0)
            continue;
        const res = await points.reversePoints(input.customer_id, amount, {
            reference: 'order_reversal',
            reference_id: input.reference_id,
            idempotency_key: `reverse:earn:${e.id}`,
        });
        if (res)
            reversed += amount;
    }
    return new workflows_sdk_1.StepResponse({ reversed });
});
exports.reverseLoyaltyPointsWorkflow = (0, workflows_sdk_1.createWorkflow)('reverse-loyalty-points', (input) => {
    return new workflows_sdk_1.WorkflowResponse(reverseStep(input));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmV2ZXJzZS1sb3lhbHR5LXBvaW50cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvcmV2ZXJzZS1sb3lhbHR5LXBvaW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFLMkM7QUFDM0MsOENBQWtEO0FBU2xELGdGQUFnRjtBQUNoRixnRkFBZ0Y7QUFDaEYsMkNBQTJDO0FBQzNDLE1BQU0sV0FBVyxHQUFHLElBQUEsMEJBQVUsRUFDNUIsd0JBQXdCLEVBQ3hCLEtBQUssRUFBRSxLQUFnQyxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUN4RCxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFzQixzQkFBYSxDQUFDLENBQUM7SUFDckUsTUFBTSxPQUFPLEdBQUcsTUFBTSxNQUFNLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBRW5FLE1BQU0sS0FBSyxHQUFHLENBQUMsTUFBTSxNQUFNLENBQUMsc0JBQXNCLENBQUM7UUFDakQsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFO1FBQ3RCLElBQUksRUFBRSxNQUFNO1FBQ1osU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTLElBQUksT0FBTztRQUNyQyxZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7S0FDakMsQ0FBQyxDQUErQixDQUFDO0lBRWxDLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQztJQUNqQixLQUFLLE1BQU0sQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDO1FBQ3RCLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JDLElBQUksTUFBTSxJQUFJLENBQUM7WUFBRSxTQUFTO1FBQzFCLE1BQU0sR0FBRyxHQUFHLE1BQU0sTUFBTSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLE1BQU0sRUFBRTtZQUNoRSxTQUFTLEVBQUUsZ0JBQWdCO1lBQzNCLFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWTtZQUNoQyxlQUFlLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxFQUFFLEVBQUU7U0FDeEMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxHQUFHO1lBQUUsUUFBUSxJQUFJLE1BQU0sQ0FBQztJQUM5QixDQUFDO0lBRUQsT0FBTyxJQUFJLDRCQUFZLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0FBQ3hDLENBQUMsQ0FDRixDQUFDO0FBRVcsUUFBQSw0QkFBNEIsR0FBRyxJQUFBLDhCQUFjLEVBQ3hELHdCQUF3QixFQUN4QixDQUFDLEtBQWdDLEVBQUUsRUFBRTtJQUNuQyxPQUFPLElBQUksZ0NBQWdCLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDbEQsQ0FBQyxDQUNGLENBQUMifQ==