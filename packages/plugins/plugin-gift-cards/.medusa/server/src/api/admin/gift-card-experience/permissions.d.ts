import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
export declare const GIFT_CARD_ADMIN_PERMISSIONS: {
    readonly read: "gift_cards.read";
    readonly designs: "gift_cards.designs";
    readonly deliveries: "gift_cards.deliveries";
    readonly settings: "gift_cards.settings";
    readonly metrics: "gift_cards.metrics";
};
export type GiftCardAdminPermission = typeof GIFT_CARD_ADMIN_PERMISSIONS[keyof typeof GIFT_CARD_ADMIN_PERMISSIONS];
export declare function resolveGiftCardAdminPermissions(req: MedusaRequest): Promise<{
    actor_id: string;
    permissions: GiftCardAdminPermission[];
    source: 'admin';
}>;
export declare function requireGiftCardAdminPermission(_permission: GiftCardAdminPermission): (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => Promise<void>;
