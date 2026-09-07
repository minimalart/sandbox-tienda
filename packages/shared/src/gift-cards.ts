import { z } from 'zod';

export const GIFT_CARD_CONFIG_KEY = 'gift_card_config';
export const GIFT_CARD_CONFIG_VERSION = 1 as const;
export const DEFAULT_GIFT_CARD_DESIGN_ID = 'brand-default';
export const GIFT_CARD_NAME_MAX_LENGTH = 80;
export const GIFT_CARD_MESSAGE_MAX_LENGTH = 300;
export const GIFT_CARD_SCHEDULE_MAX_DAYS = 365;

const normalizePlainText = (value: string): string =>
  value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim();

const optionalPlainText = (max: number) =>
  z
    .string()
    .max(max)
    .transform(normalizePlainText)
    .optional()
    .transform((value) => value || undefined);

export const giftCardDeliverySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('now') }).strict(),
  z
    .object({
      type: z.literal('scheduled'),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      window: z.enum(['morning', 'afternoon', 'evening']),
    })
    .strict(),
]);

export const giftCardConfigV1Schema = z
  .object({
    version: z.literal(GIFT_CARD_CONFIG_VERSION),
    delivery_mode: z.enum(['self', 'recipient']),
    design_id: z.string().min(1).max(120).transform(normalizePlainText),
    recipient_email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()).optional(),
    recipient_name: optionalPlainText(GIFT_CARD_NAME_MAX_LENGTH),
    sender_name: optionalPlainText(GIFT_CARD_NAME_MAX_LENGTH),
    anonymous: z.boolean().default(false),
    message: optionalPlainText(GIFT_CARD_MESSAGE_MAX_LENGTH),
    delivery: giftCardDeliverySchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.delivery_mode === 'recipient' && !value.recipient_email) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recipient_email'],
        message: 'El email del destinatario es obligatorio.',
      });
    }
    if (value.delivery_mode === 'self' && value.recipient_email) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recipient_email'],
        message: 'Una compra para mí no debe incluir destinatario.',
      });
    }
  });

export type GiftCardConfigV1 = z.infer<typeof giftCardConfigV1Schema>;
export type GiftCardDeliveryWindow = 'morning' | 'afternoon' | 'evening';

export type GiftCardLineItemMetadata = Record<string, unknown> & {
  [GIFT_CARD_CONFIG_KEY]?: GiftCardConfigV1;
};

/**
 * Accepts the versioned contract and the legacy flat metadata used by older
 * carts. Every caller receives the canonical v1 shape or a validation error.
 */
export function normalizeGiftCardConfig(
  metadata: unknown,
  defaultDesignId = DEFAULT_GIFT_CARD_DESIGN_ID,
): GiftCardConfigV1 {
  const source = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
  const versioned = source[GIFT_CARD_CONFIG_KEY];
  if (versioned && typeof versioned === 'object' && !Array.isArray(versioned)) {
    return giftCardConfigV1Schema.parse(versioned);
  }

  const recipientEmail = typeof source.recipient_email === 'string'
    ? source.recipient_email.trim()
    : '';
  return giftCardConfigV1Schema.parse({
    version: GIFT_CARD_CONFIG_VERSION,
    delivery_mode: recipientEmail ? 'recipient' : 'self',
    design_id:
      typeof source.gift_card_design_id === 'string' && source.gift_card_design_id.trim()
        ? source.gift_card_design_id
        : defaultDesignId,
    recipient_email: recipientEmail || undefined,
    recipient_name: typeof source.recipient_name === 'string' ? source.recipient_name : undefined,
    sender_name: typeof source.sender_name === 'string' ? source.sender_name : undefined,
    anonymous: source.anonymous === true,
    message: typeof source.message === 'string' ? source.message : undefined,
    delivery: { type: 'now' },
  });
}

export function assertGiftCardBuyerIsNotRecipient(
  config: GiftCardConfigV1,
  buyerEmail?: string | null,
): void {
  if (
    config.delivery_mode === 'recipient' &&
    buyerEmail &&
    config.recipient_email?.toLowerCase() === buyerEmail.trim().toLowerCase()
  ) {
    throw new Error('Usá “Para mí” cuando el destinatario es el comprador.');
  }
}

export function maskGiftCardCode(code?: string | null): string {
  if (!code) return 'Tarjeta de regalo';
  const compact = code.replace(/[^A-Za-z0-9]/g, '');
  const suffix = compact.slice(-4).toUpperCase();
  return suffix ? `•••• •••• ${suffix}` : 'Tarjeta de regalo';
}
