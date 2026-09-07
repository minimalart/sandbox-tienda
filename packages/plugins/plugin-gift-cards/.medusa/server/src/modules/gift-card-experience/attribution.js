"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attributeGiftCardLedger = attributeGiftCardLedger;
/**
 * Replays a store-credit ledger using FIFO lots. Non-gift credits remain in the
 * queue, so a debit is attributed to a gift card only when it actually reaches
 * that lot. Transactions must be ordered by created_at and then id.
 */
function attributeGiftCardLedger(transactions, giftCardSourceAccountIds) {
    const queues = new Map();
    const result = new Map();
    for (const transaction of transactions) {
        const targetAccountId = String(transaction.account_id);
        const queue = queues.get(targetAccountId) ?? [];
        queues.set(targetAccountId, queue);
        const amount = Math.max(0, Number(transaction.amount) || 0);
        if (transaction.type === 'credit') {
            const sourceAccountId = transaction.reference === 'store-credit' && transaction.reference_id && giftCardSourceAccountIds.has(String(transaction.reference_id))
                ? String(transaction.reference_id)
                : undefined;
            queue.push({ remaining: amount, source_account_id: sourceAccountId });
            if (sourceAccountId)
                result.set(sourceAccountId, {
                    source_account_id: sourceAccountId,
                    target_account_id: targetAccountId,
                    credited: amount,
                    remaining: amount,
                    first_used_at: null,
                    exhausted_at: null,
                });
            continue;
        }
        if (transaction.type !== 'debit')
            continue;
        let debitRemaining = amount;
        for (const lot of queue) {
            if (debitRemaining <= 0)
                break;
            if (lot.remaining <= 0)
                continue;
            const consumed = Math.min(lot.remaining, debitRemaining);
            lot.remaining -= consumed;
            debitRemaining -= consumed;
            if (!lot.source_account_id || consumed <= 0)
                continue;
            const attribution = result.get(lot.source_account_id);
            if (!attribution)
                continue;
            attribution.remaining = lot.remaining;
            attribution.first_used_at ??= new Date(transaction.created_at);
            if (lot.remaining <= 0)
                attribution.exhausted_at ??= new Date(transaction.created_at);
        }
    }
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9naWZ0LWNhcmQtZXhwZXJpZW5jZS9hdHRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQXdCQSwwREE4Q0M7QUFuREQ7Ozs7R0FJRztBQUNILFNBQWdCLHVCQUF1QixDQUNyQyxZQUE0QyxFQUM1Qyx3QkFBNkM7SUFFN0MsTUFBTSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQW9FLENBQUM7SUFDM0YsTUFBTSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7SUFFdEQsS0FBSyxNQUFNLFdBQVcsSUFBSSxZQUFZLEVBQUUsQ0FBQztRQUN2QyxNQUFNLGVBQWUsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2hELE1BQU0sQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ25DLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFNUQsSUFBSSxXQUFXLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ2xDLE1BQU0sZUFBZSxHQUFHLFdBQVcsQ0FBQyxTQUFTLEtBQUssY0FBYyxJQUFJLFdBQVcsQ0FBQyxZQUFZLElBQUksd0JBQXdCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQzVKLENBQUMsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQztnQkFDbEMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUNkLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxDQUFDLENBQUM7WUFDdEUsSUFBSSxlQUFlO2dCQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFO29CQUMvQyxpQkFBaUIsRUFBRSxlQUFlO29CQUNsQyxpQkFBaUIsRUFBRSxlQUFlO29CQUNsQyxRQUFRLEVBQUUsTUFBTTtvQkFDaEIsU0FBUyxFQUFFLE1BQU07b0JBQ2pCLGFBQWEsRUFBRSxJQUFJO29CQUNuQixZQUFZLEVBQUUsSUFBSTtpQkFDbkIsQ0FBQyxDQUFDO1lBQ0gsU0FBUztRQUNYLENBQUM7UUFDRCxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssT0FBTztZQUFFLFNBQVM7UUFFM0MsSUFBSSxjQUFjLEdBQUcsTUFBTSxDQUFDO1FBQzVCLEtBQUssTUFBTSxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7WUFDeEIsSUFBSSxjQUFjLElBQUksQ0FBQztnQkFBRSxNQUFNO1lBQy9CLElBQUksR0FBRyxDQUFDLFNBQVMsSUFBSSxDQUFDO2dCQUFFLFNBQVM7WUFDakMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBQ3pELEdBQUcsQ0FBQyxTQUFTLElBQUksUUFBUSxDQUFDO1lBQzFCLGNBQWMsSUFBSSxRQUFRLENBQUM7WUFDM0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsSUFBSSxRQUFRLElBQUksQ0FBQztnQkFBRSxTQUFTO1lBQ3RELE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDdEQsSUFBSSxDQUFDLFdBQVc7Z0JBQUUsU0FBUztZQUMzQixXQUFXLENBQUMsU0FBUyxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUM7WUFDdEMsV0FBVyxDQUFDLGFBQWEsS0FBSyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDL0QsSUFBSSxHQUFHLENBQUMsU0FBUyxJQUFJLENBQUM7Z0JBQUUsV0FBVyxDQUFDLFlBQVksS0FBSyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDeEYsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIn0=