/**
 * Minimal SHIM of the gift-card contract for the host backfill script.
 *
 * The authoritative contract lives in `packages/shared/gift-cards.ts` and is
 * vendored inside `@minimalart/mercatto-plugin-gift-cards`
 * (`src/lib/gift-cards-shared.ts`). Every runtime consumer (module service,
 * subscribers, workflow hook, admin/store routes) now imports from the plugin.
 *
 * What stays here is only what `apps/backend/src/scripts/backfill-gift-card-deliveries.ts`
 * needs to run under `pnpm gift-cards:backfill`. Moving the script into the
 * plugin would lose the pnpm script binding, and depending on the plugin from
 * a host script would require resolving `.medusa/server/**` from a raw
 * `tsx`/`ts-node` run (which is not how the script is invoked today).
 *
 * If either function drifts, keep both sides in sync — the failure mode is a
 * backfill that silently accepts inputs the plugin would reject.
 *
 * Note: `normalizePlainText` filters by code point (not by regex over control
 * literals) so the source never embeds control bytes (including NUL).
 */
import { z } from 'zod';

export const GIFT_CARD_CONFIG_KEY = 'gift_card_config';
export const GIFT_CARD_CONFIG_VERSION = 1 as const;
export const DEFAULT_GIFT_CARD_DESIGN_ID = 'brand-default';
export const GIFT_CARD_NAME_MAX_LENGTH = 80;
export const GIFT_CARD_MESSAGE_MAX_LENGTH = 300;

/** C0 controls except TAB/LF/CR, plus DEL. */
const isStrippableControl = (code: number): boolean =>
  (code >= 0x00 && code <= 0x08) ||
  code === 0x0b ||
  code === 0x0c ||
  (code >= 0x0e && code <= 0x1f) ||
  code === 0x7f;

const normalizePlainText = (value: string): string => {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (isStrippableControl(code)) continue;
    if (ch === '<' || ch === '>') continue;
    out += ch;
  }
  return out.trim();
};

const optionalPlainText = (max: number) =>
  z
    .string()
    .max(max)
    .transform(normalizePlainText)
    .optional()
    .transform((value) => value || undefined);

const giftCardDeliverySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('now') }).strict(),
  z
    .object({
      type: z.literal('scheduled'),
      date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
      window: z.enum(['morning', 'afternoon', 'evening']),
    })
    .strict(),
]);

const giftCardConfigV1Schema = z
  .object({
    version: z.literal(GIFT_CARD_CONFIG_VERSION),
    delivery_mode: z.enum(['self', 'recipient']),
    design_id: z.string().min(1).max(120).transform(normalizePlainText),
    recipient_email: z
      .string()
      .email()
      .max(254)
      .transform((value) => value.trim().toLowerCase())
      .optional(),
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

  const recipientEmail =
    typeof source.recipient_email === 'string' ? source.recipient_email.trim() : '';
  return giftCardConfigV1Schema.parse({
    version: GIFT_CARD_CONFIG_VERSION,
    delivery_mode: recipientEmail ? 'recipient' : 'self',
    design_id:
      typeof source.gift_card_design_id === 'string' && source.gift_card_design_id.trim()
        ? source.gift_card_design_id
        : defaultDesignId,
    recipient_email: recipientEmail || undefined,
    recipient_name:
      typeof source.recipient_name === 'string' ? source.recipient_name : undefined,
    sender_name:
      typeof source.sender_name === 'string' ? source.sender_name : undefined,
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
    throw new Error('Usá "Para mí" cuando el destinatario es el comprador.');
  }
}
