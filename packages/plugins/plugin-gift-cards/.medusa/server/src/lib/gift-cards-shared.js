"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.giftCardConfigV1Schema = exports.giftCardDeliverySchema = exports.GIFT_CARD_SCHEDULE_MAX_DAYS = exports.GIFT_CARD_MESSAGE_MAX_LENGTH = exports.GIFT_CARD_NAME_MAX_LENGTH = exports.DEFAULT_GIFT_CARD_DESIGN_ID = exports.GIFT_CARD_CONFIG_VERSION = exports.GIFT_CARD_CONFIG_KEY = void 0;
exports.normalizeGiftCardConfig = normalizeGiftCardConfig;
exports.assertGiftCardBuyerIsNotRecipient = assertGiftCardBuyerIsNotRecipient;
exports.maskGiftCardCode = maskGiftCardCode;
// MIRROR de `packages/shared/src/gift-cards.ts`. Ver nota en `./index.ts`.
//
// Nota: `normalizePlainText` filtra por code point (en vez de un regex con
// literales de control) para no embeber bytes de control (incl. NUL) en el
// fuente. Semánticamente equivalente al original de `packages/shared`.
const zod_1 = require("zod");
exports.GIFT_CARD_CONFIG_KEY = 'gift_card_config';
exports.GIFT_CARD_CONFIG_VERSION = 1;
exports.DEFAULT_GIFT_CARD_DESIGN_ID = 'brand-default';
exports.GIFT_CARD_NAME_MAX_LENGTH = 80;
exports.GIFT_CARD_MESSAGE_MAX_LENGTH = 300;
exports.GIFT_CARD_SCHEDULE_MAX_DAYS = 365;
/** C0 controls except TAB/LF/CR, plus DEL — el set que el original removía. */
const isStrippableControl = (code) => (code >= 0x00 && code <= 0x08) ||
    code === 0x0b ||
    code === 0x0c ||
    (code >= 0x0e && code <= 0x1f) ||
    code === 0x7f;
const normalizePlainText = (value) => {
    let out = '';
    for (const ch of value) {
        const code = ch.codePointAt(0) ?? 0;
        if (isStrippableControl(code))
            continue;
        if (ch === '<' || ch === '>')
            continue;
        out += ch;
    }
    return out.trim();
};
const optionalPlainText = (max) => zod_1.z
    .string()
    .max(max)
    .transform(normalizePlainText)
    .optional()
    .transform((value) => value || undefined);
exports.giftCardDeliverySchema = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({ type: zod_1.z.literal('now') }).strict(),
    zod_1.z
        .object({
        type: zod_1.z.literal('scheduled'),
        date: zod_1.z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
        window: zod_1.z.enum(['morning', 'afternoon', 'evening']),
    })
        .strict(),
]);
exports.giftCardConfigV1Schema = zod_1.z
    .object({
    version: zod_1.z.literal(exports.GIFT_CARD_CONFIG_VERSION),
    delivery_mode: zod_1.z.enum(['self', 'recipient']),
    design_id: zod_1.z.string().min(1).max(120).transform(normalizePlainText),
    recipient_email: zod_1.z.string().email().max(254).transform((value) => value.trim().toLowerCase()).optional(),
    recipient_name: optionalPlainText(exports.GIFT_CARD_NAME_MAX_LENGTH),
    sender_name: optionalPlainText(exports.GIFT_CARD_NAME_MAX_LENGTH),
    anonymous: zod_1.z.boolean().default(false),
    message: optionalPlainText(exports.GIFT_CARD_MESSAGE_MAX_LENGTH),
    delivery: exports.giftCardDeliverySchema,
})
    .strict()
    .superRefine((value, context) => {
    if (value.delivery_mode === 'recipient' && !value.recipient_email) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['recipient_email'],
            message: 'El email del destinatario es obligatorio.',
        });
    }
    if (value.delivery_mode === 'self' && value.recipient_email) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['recipient_email'],
            message: 'Una compra para mí no debe incluir destinatario.',
        });
    }
});
/**
 * Accepts the versioned contract and the legacy flat metadata used by older
 * carts. Every caller receives the canonical v1 shape or a validation error.
 */
function normalizeGiftCardConfig(metadata, defaultDesignId = exports.DEFAULT_GIFT_CARD_DESIGN_ID) {
    const source = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? metadata
        : {};
    const versioned = source[exports.GIFT_CARD_CONFIG_KEY];
    if (versioned && typeof versioned === 'object' && !Array.isArray(versioned)) {
        return exports.giftCardConfigV1Schema.parse(versioned);
    }
    const recipientEmail = typeof source.recipient_email === 'string'
        ? source.recipient_email.trim()
        : '';
    return exports.giftCardConfigV1Schema.parse({
        version: exports.GIFT_CARD_CONFIG_VERSION,
        delivery_mode: recipientEmail ? 'recipient' : 'self',
        design_id: typeof source.gift_card_design_id === 'string' && source.gift_card_design_id.trim()
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
function assertGiftCardBuyerIsNotRecipient(config, buyerEmail) {
    if (config.delivery_mode === 'recipient' &&
        buyerEmail &&
        config.recipient_email?.toLowerCase() === buyerEmail.trim().toLowerCase()) {
        throw new Error('Usá “Para mí” cuando el destinatario es el comprador.');
    }
}
function maskGiftCardCode(code) {
    if (!code)
        return 'Tarjeta de regalo';
    const compact = code.replace(/[^A-Za-z0-9]/g, '');
    const suffix = compact.slice(-4).toUpperCase();
    return suffix ? `•••• •••• ${suffix}` : 'Tarjeta de regalo';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2lmdC1jYXJkcy1zaGFyZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL2dpZnQtY2FyZHMtc2hhcmVkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQTZGQSwwREE2QkM7QUFFRCw4RUFXQztBQUVELDRDQUtDO0FBOUlELDJFQUEyRTtBQUMzRSxFQUFFO0FBQ0YsMkVBQTJFO0FBQzNFLDJFQUEyRTtBQUMzRSx1RUFBdUU7QUFDdkUsNkJBQXdCO0FBRVgsUUFBQSxvQkFBb0IsR0FBRyxrQkFBa0IsQ0FBQztBQUMxQyxRQUFBLHdCQUF3QixHQUFHLENBQVUsQ0FBQztBQUN0QyxRQUFBLDJCQUEyQixHQUFHLGVBQWUsQ0FBQztBQUM5QyxRQUFBLHlCQUF5QixHQUFHLEVBQUUsQ0FBQztBQUMvQixRQUFBLDRCQUE0QixHQUFHLEdBQUcsQ0FBQztBQUNuQyxRQUFBLDJCQUEyQixHQUFHLEdBQUcsQ0FBQztBQUUvQywrRUFBK0U7QUFDL0UsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLElBQVksRUFBVyxFQUFFLENBQ3BELENBQUMsSUFBSSxJQUFJLElBQUksSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDO0lBQzlCLElBQUksS0FBSyxJQUFJO0lBQ2IsSUFBSSxLQUFLLElBQUk7SUFDYixDQUFDLElBQUksSUFBSSxJQUFJLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQztJQUM5QixJQUFJLEtBQUssSUFBSSxDQUFDO0FBRWhCLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxLQUFhLEVBQVUsRUFBRTtJQUNuRCxJQUFJLEdBQUcsR0FBRyxFQUFFLENBQUM7SUFDYixLQUFLLE1BQU0sRUFBRSxJQUFJLEtBQUssRUFBRSxDQUFDO1FBQ3ZCLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BDLElBQUksbUJBQW1CLENBQUMsSUFBSSxDQUFDO1lBQUUsU0FBUztRQUN4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