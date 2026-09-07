import { verify } from 'node:crypto';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../modules/gift-card-experience/service';
import { getGiftCardExperienceSettings } from '../../../modules/gift-card-experience/settings';

const EventSchema = z.object({
  event: z.enum(['delivered', 'deferred', 'bounce', 'dropped']),
  timestamp: z.number(),
  sg_event_id: z.string().min(1).max(500),
  sg_message_id: z.string().min(1).max(500),
}).passthrough();

function verifySignature(rawBody: Buffer, timestamp: string, signature: string, publicKey: string): boolean {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 600) return false;
  try {
    return verify('sha256', Buffer.concat([Buffer.from(timestamp), rawBody]), publicKey, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Ya viene normalizada a PEM: SendGrid entrega la clave en base64 de una sola
  // línea y `crypto.verify()` no acepta ese formato. Ver `settings.ts`.
  const publicKey = getGiftCardExperienceSettings().sendgridEventPublicKey;
  const timestamp = String(req.headers['x-twilio-email-event-webhook-timestamp'] ?? '');
  const signature = String(req.headers['x-twilio-email-event-webhook-signature'] ?? '');
  const raw = (req as MedusaRequest & { rawBody?: Buffer | string }).rawBody;
  const rawBody = Buffer.isBuffer(raw) ? raw : Buffer.from(typeof raw === 'string' ? raw : JSON.stringify(req.body ?? []));
  if (!publicKey || !verifySignature(rawBody, timestamp, signature, publicKey)) {
    res.status(401).json({ message: 'Invalid signature.' });
    return;
  }
  const events = z.array(EventSchema).max(1000).parse(req.body);
  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
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
