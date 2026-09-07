"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftCardDeliveryAttempt = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.GiftCardDeliveryAttempt = utils_1.model
    .define('gift_card_delivery_attempt', {
    id: utils_1.model.id({ prefix: 'gcattempt' }).primaryKey(),
    delivery_id: utils_1.model.text(),
    attempt_no: utils_1.model.number(),
    channel: utils_1.model.enum(['email', 'audit']).default('email'),
    trigger: utils_1.model.enum(['initial', 'automatic_retry', 'manual_resend', 'fallback_buyer', 'secure_link']),
    status: utils_1.model.enum(['processing', 'sent', 'delivered', 'failed']),
    recipient: utils_1.model.text(),
    notification_id: utils_1.model.text().nullable(),
    provider_message_id: utils_1.model.text().nullable(),
    error: utils_1.model.text().nullable(),
    attempted_at: utils_1.model.dateTime(),
    completed_at: utils_1.model.dateTime().nullable(),
    metadata: utils_1.model.json().nullable(),
})
    .indexes([
    { on: ['delivery_id', 'attempt_no'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['provider_message_id'] },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2lmdC1jYXJkLWRlbGl2ZXJ5LWF0dGVtcHQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9naWZ0LWNhcmQtZXhwZXJpZW5jZS9tb2RlbHMvZ2lmdC1jYXJkLWRlbGl2ZXJ5LWF0dGVtcHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRXJDLFFBQUEsdUJBQXVCLEdBQUcsYUFBSztLQUN6QyxNQUFNLENBQUMsNEJBQTRCLEVBQUU7SUFDcEMsRUFBRSxFQUFFLGFBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDbEQsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDekIsVUFBVSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUU7SUFDMUIsT0FBTyxFQUFFLGFBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQ3hELE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUNyRyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksQ0FBQyxDQUFDLFlBQVksRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pFLFNBQVMsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3ZCLGVBQWUsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3hDLG1CQUFtQixFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDNUMsS0FBSyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDOUIsWUFBWSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUU7SUFDOUIsWUFBWSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDekMsUUFBUSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDbEMsQ0FBQztLQUNELE9BQU8sQ0FBQztJQUNQLEVBQUUsRUFBRSxFQUFFLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFO0lBQ2hGLEVBQUUsRUFBRSxFQUFFLENBQUMscUJBQXFCLENBQUMsRUFBRTtDQUNoQyxDQUFDLENBQUMifQ==