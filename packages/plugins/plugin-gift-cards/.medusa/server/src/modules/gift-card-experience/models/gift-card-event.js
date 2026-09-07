"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftCardEvent = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.GiftCardEvent = utils_1.model.define('gift_card_event', {
    id: utils_1.model.id({ prefix: 'gcevent' }).primaryKey(),
    delivery_id: utils_1.model.text().nullable(),
    event: utils_1.model.enum(['view', 'purchase', 'issued', 'sent', 'delivered', 'claimed', 'first_use', 'exhausted', 'balance_reminder', 'expiring_notice']),
    design_id: utils_1.model.text().nullable(),
    currency_code: utils_1.model.text().nullable(),
    amount: utils_1.model.bigNumber().nullable(),
    occurred_at: utils_1.model.dateTime(),
    metadata: utils_1.model.json().nullable(),
}).indexes([{ on: ['event', 'occurred_at'] }, { on: ['delivery_id', 'event'] }]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2lmdC1jYXJkLWV2ZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZ2lmdC1jYXJkLWV4cGVyaWVuY2UvbW9kZWxzL2dpZnQtY2FyZC1ldmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFckMsUUFBQSxhQUFhLEdBQUcsYUFBSyxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsRUFBRTtJQUMzRCxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUNoRCxXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxLQUFLLEVBQUUsYUFBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsa0JBQWtCLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztJQUNsSixTQUFTLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNsQyxhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN0QyxNQUFNLEVBQUUsYUFBSyxDQUFDLFNBQVMsRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxXQUFXLEVBQUUsYUFBSyxDQUFDLFFBQVEsRUFBRTtJQUM3QixRQUFRLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNsQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyJ9