import { z } from 'zod';
export declare const GIFT_CARD_CONFIG_KEY = "gift_card_config";
export declare const GIFT_CARD_CONFIG_VERSION: 1;
export declare const DEFAULT_GIFT_CARD_DESIGN_ID = "brand-default";
export declare const GIFT_CARD_NAME_MAX_LENGTH = 80;
export declare const GIFT_CARD_MESSAGE_MAX_LENGTH = 300;
export declare const GIFT_CARD_SCHEDULE_MAX_DAYS = 365;
export declare const giftCardDeliverySchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"now">;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"scheduled">;
    date: z.ZodString;
    window: z.ZodEnum<{
        morning: "morning";
        afternoon: "afternoon";
        evening: "evening";
    }>;
}, z.core.$strict>], "type">;
export declare const giftCardConfigV1Schema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    delivery_mode: z.ZodEnum<{
        self: "self";
        recipient: "recipient";
    }>;
    design_id: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    recipient_email: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    recipient_name: z.ZodPipe<z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>, z.ZodTransform<string | undefined, string | undefined>>;
    sender_name: z.ZodPipe<z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>, z.ZodTransform<string | undefined, string | undefined>>;
    anonymous: z.ZodDefault<z.ZodBoolean>;
    message: z.ZodPipe<z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>, z.ZodTransform<string | undefined, string | undefined>>;
    delivery: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"now">;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"scheduled">;
        date: z.ZodString;
        window: z.ZodEnum<{
            morning: "morning";
            afternoon: "afternoon";
            evening: "evening";
        }>;
    }, z.core.$strict>], "type">;
}, z.core.$strict>;
export type GiftCardConfigV1 = z.infer<typeof giftCardConfigV1Schema>;
export type GiftCardDeliveryWindow = 'morning' | 'afternoon' | 'evening';
export type GiftCardLineItemMetadata = Record<string, unknown> & {
    [GIFT_CARD_CONFIG_KEY]?: GiftCardConfigV1;
};
/**
 * Accepts the versioned contract and the legacy flat metadata used by older
 * carts. Every caller receives the canonical v1 shape or a validation error.
 */
export declare function normalizeGiftCardConfig(metadata: unknown, defaultDesignId?: string): GiftCardConfigV1;
export declare function assertGiftCardBuyerIsNotRecipient(config: GiftCardConfigV1, buyerEmail?: string | null): void;
export declare function maskGiftCardCode(code?: string | null): string;
