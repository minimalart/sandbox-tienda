"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const gift_card_experience_1 = require("../../../modules/gift-card-experience");
const settings_1 = require("../../../modules/gift-card-experience/settings");
const EventSchema = zod_1.z.object({
    event: zod_1.z.enum(['delivered', 'deferred', 'bounce', 'dropped']),
    timestamp: zod_1.z.number(),
    sg_event_id: zod_1.z.string().min(1).max(500),
    sg_message_id: zod_1.z.string().min(1).max(500),
}).passthrough();
function verifySignature(rawBody, timestamp, signature, publicKey) {
    const seconds = Number(timestamp);
    if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 600)
        return false;
    try {
        return (0, node_crypto_1.verify)('sha256', Buffer.concat([Buffer.from(timestamp), rawBody]), publicKey, Buffer.from(signature, 'base64'));
    }
    catch {
        return false;
    }
}
async function POST(req, res) {
    // Ya viene normalizada a PEM: SendGrid entrega la clave en base64 de una sola
    // línea y `crypto.verify()` no acepta ese formato. Ver `settings.ts`.
    const publicKey = (0, settings_1.getGiftCardExperienceSettings)().sendgridEventPublicKey;
    const timestamp = String(req.headers['x-twilio-email-event-webhook-timestamp'] ?? '');
    const signature = String(req.headers['x-twilio-email-event-webhook-signature'] ?? '');
    const raw = req.rawBody;
    const rawBody = Buffer.isBuffer(raw) ? raw : Buffer.from(typeof raw === 'string' ? raw : JSON.stringify(req.body ?? []));
    if (!publicKey || !verifySignature(rawBody, timestamp, signature, publicKey)) {
        res.status(401).json({ message: 'Invalid signature.' });
        return;
    }
    const events = zod_1.z.array(EventSchema).max(1000).parse(req.body);
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    let accepted = 0;
    for (const event of events) {
        accepted += Number(await service.applySendGridEvent({
            eventId: event.sg_event_id,
            messageId: event.sg_message_id,
            event: event.event,
            occurredAt: new Date(event.timestamp * 1000),
        }));
    }
    res.json({ accepted });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3dlYmhvb2tzL3NlbmRncmlkLWdpZnQtY2FyZHMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUF3QkEsb0JBd0JDO0FBaERELDZDQUFxQztBQUVyQyw2QkFBd0I7QUFDeEIsZ0ZBQW9GO0FBRXBGLDZFQUErRjtBQUUvRixNQUFNLFdBQVcsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQzNCLEtBQUssRUFBRSxPQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDN0QsU0FBUyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUU7SUFDckIsV0FBVyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQztJQUN2QyxhQUFhLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO0NBQzFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUVqQixTQUFTLGVBQWUsQ0FBQyxPQUFlLEVBQUUsU0FBaUIsRUFBRSxTQUFpQixFQUFFLFNBQWlCO0lBQy9GLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNsQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLEdBQUcsT0FBTyxDQUFDLEdBQUcsR0FBRztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzNGLElBQUksQ0FBQztRQUNILE9BQU8sSUFBQSxvQkFBTSxFQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsTUFBTSxD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