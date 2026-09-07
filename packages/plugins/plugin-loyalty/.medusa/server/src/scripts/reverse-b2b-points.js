"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = reverseB2bPoints;
const utils_1 = require("@medusajs/framework/utils");
const points_1 = require("../modules/points");
const REVERSAL_REF = 'order_b2b_reversal';
async function reverseB2bPoints({ container }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const points = container.resolve(points_1.POINTS_MODULE);
    const earns = (await points.listPointsTransactions({
        type: 'earn',
        reference: 'order',
    }));
    const orderIds = [...new Set(earns.map((t) => t.reference_id).filter((id) => !!id))];
    if (!orderIds.length) {
        logger.info('[reverse-b2b-points] No earn-from-order transactions. Nothing to do.');
        return;
    }
    const { data: orders } = await query.graph({
        entity: 'order',
        fields: ['id', 'metadata', 'sales_channel.metadata'],
        filters: { id: orderIds },
    });
    const b2bOrders = new Set(orders
        .filter((o) => o.sales_channel?.metadata?.channel_type === 'b2b' || o.metadata?.context === 'b2b')
        .map((o) => o.id));
    // Idempotency: earn txn ids that already have a reversal.
    const reversals = (await points.listPointsTransactions({
        reference: REVERSAL_REF,
    }));
    const alreadyReversed = new Set(reversals.map((r) => r.reference_id));
    let reversedCount = 0;
    let reversedPoints = 0;
    for (const earn of earns) {
        if (!earn.reference_id || !b2bOrders.has(earn.reference_id))
            continue;
        if (alreadyReversed.has(earn.id))
            continue;
        if (!earn.account_id || !(earn.amount > 0))
            continue;
        await points.createPointsTransactions({
            account_id: earn.account_id,
            amount: -earn.amount,
            type: 'adjust',
            reference: REVERSAL_REF,
            reference_id: earn.id,
        });
        const account = await points.retrievePointsAccount(earn.account_id);
        await points.updatePointsAccounts({
            id: earn.account_id,
            balance: (account.balance ?? 0) - earn.amount,
        });
        reversedCount += 1;
        reversedPoints += earn.amount;
        logger.info(`[reverse-b2b-points] Reversed ${earn.amount} pts (earn ${earn.id}, order ${earn.reference_id}).`);
    }
    logger.info(`[reverse-b2b-points] Done. Reversed ${reversedCount} transaction(s), ${reversedPoints} points total.`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmV2ZXJzZS1iMmItcG9pbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjcmlwdHMvcmV2ZXJzZS1iMmItcG9pbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBMEJBLG1DQWtFQztBQTNGRCxxREFBc0U7QUFDdEUsOENBQWtEO0FBc0JsRCxNQUFNLFlBQVksR0FBRyxvQkFBb0IsQ0FBQztBQUUzQixLQUFLLFVBQVUsZ0JBQWdCLENBQUMsRUFBRSxTQUFTLEVBQVk7SUFDcEUsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxpQ0FBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuRSxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGlDQUF5QixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2pFLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQXNCLHNCQUFhLENBQUMsQ0FBQztJQUVyRSxNQUFNLEtBQUssR0FBRyxDQUFDLE1BQU0sTUFBTSxDQUFDLHNCQUFzQixDQUFDO1FBQ2pELElBQUksRUFBRSxNQUFNO1FBQ1osU0FBUyxFQUFFLE9BQU87S0FDbkIsQ0FBQyxDQUF5QixDQUFDO0lBRTVCLE1BQU0sUUFBUSxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3JCLE1BQU0sQ0FBQyxJQUFJLENBQUMsc0VBQXNFLENBQUMsQ0FBQztRQUNwRixPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEdB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