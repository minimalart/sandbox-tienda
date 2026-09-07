import type { CreateGiftCardDeliveryIntentInput, GiftCardDeliveryRow, GiftCardDesignRow, GiftCardSettingsRow } from './types';
declare const truncateError: (error: unknown, max?: number) => string;
declare const GiftCardExperienceModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly GiftCardDesign: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        public_id: import("@medusajs/framework/utils").TextProperty;
        name: import("@medusajs/framework/utils").TextProperty;
        occasion: import("@medusajs/framework/utils").EnumProperty<["general", "birthday", "thanks", "congratulations", "holidays", "brand"]>;
        desktop_image_url: import("@medusajs/framework/utils").TextProperty;
        mobile_image_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        text_color: import("@medusajs/framework/utils").TextProperty;
        content_position: import("@medusajs/framework/utils").EnumProperty<["top_left", "top_center", "top_right", "center_left", "center", "center_right", "bottom_left", "bottom_center", "bottom_right"]>;
        active: import("@medusajs/framework/utils").BooleanProperty;
        sort_order: import("@medusajs/framework/utils").NumberProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "gift_card_design">;
    readonly GiftCardDelivery: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        idempotency_key: import("@medusajs/framework/utils").TextProperty;
        order_id: import("@medusajs/framework/utils").TextProperty;
        order_display_id: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        line_item_id: import("@medusajs/framework/utils").TextProperty;
        unit_index: import("@medusajs/framework/utils").NumberProperty;
        gift_card_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        store_credit_account_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        buyer_customer_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        buyer_email: import("@medusajs/framework/utils").TextProperty;
        delivery_mode: import("@medusajs/framework/utils").EnumProperty<["self", "recipient"]>;
        recipient_email: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        recipient_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        sender_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        anonymous: import("@medusajs/framework/utils").BooleanProperty;
        message: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        design_id: import("@medusajs/framework/utils").TextProperty;
        design_snapshot: import("@medusajs/framework/utils").JSONProperty;
        currency_code: import("@medusajs/framework/utils").TextProperty;
        face_value: import("@medusajs/framework/utils").BigNumberProperty;
        paid_amount: import("@medusajs/framework/utils").BigNumberProperty;
        timezone: import("@medusajs/framework/utils").TextProperty;
        scheduled_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        expires_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        token_hash: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        token_encrypted: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        token_version: import("@medusajs/framework/utils").NumberProperty;
        issuance_status: import("@medusajs/framework/utils").EnumProperty<["awaiting_payment", "processing", "issued", "failed", "canceled"]>;
        delivery_status: import("@medusajs/framework/utils").EnumProperty<["not_ready", "scheduled", "pending", "processing", "sent", "delivered", "failed", "dead_letter", "canceled"]>;
        attempts: import("@medusajs/framework/utils").NumberProperty;
        next_retry_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        processing_started_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        paid_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        issued_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        sent_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        delivered_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        failed_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        claimed_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        claimed_customer_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        first_used_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        exhausted_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        provider_message_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        last_error: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        fallback_sent_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        legacy: import("@medusajs/framework/utils").BooleanProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "gift_card_delivery">;
    readonly GiftCardDeliveryAttempt: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        delivery_id: import("@medusajs/framework/utils").TextProperty;
        attempt_no: import("@medusajs/framework/utils").NumberProperty;
        channel: import("@medusajs/framework/utils").EnumProperty<["email", "audit"]>;
        trigger: import("@medusajs/framework/utils").EnumProperty<["initial", "automatic_retry", "manual_resend", "fallback_buyer", "secure_link"]>;
        status: import("@medusajs/framework/utils").EnumProperty<["processing", "sent", "delivered", "failed"]>;
        recipient: import("@medusajs/framework/utils").TextProperty;
        notification_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        provider_message_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        error: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        attempted_at: import("@medusajs/framework/utils").DateTimeProperty;
        completed_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "gift_card_delivery_attempt">;
    readonly GiftCardSettings: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        singleton_key: import("@medusajs/framework/utils").TextProperty;
        enabled: import("@medusajs/framework/utils").BooleanProperty;
        timezone: import("@medusajs/framework/utils").TextProperty;
        morning_time: import("@medusajs/framework/utils").TextProperty;
        afternoon_time: import("@medusajs/framework/utils").TextProperty;
        evening_time: import("@medusajs/framework/utils").TextProperty;
        schedule_horizon_days: import("@medusajs/framework/utils").NumberProperty;
        default_expiry_days: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        default_design_id: import("@medusajs/framework/utils").TextProperty;
        max_name_length: import("@medusajs/framework/utils").NumberProperty;
        max_message_length: import("@medusajs/framework/utils").NumberProperty;
        retry_delays_minutes: import("@medusajs/framework/utils").JSONProperty;
        fallback_to_buyer: import("@medusajs/framework/utils").BooleanProperty;
        balance_reminder_days: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        expiring_notice_days: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        legal_text: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        terms_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        merchandising_url: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        updated_by: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "gift_card_settings">;
    readonly GiftCardEvent: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        delivery_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        event: import("@medusajs/framework/utils").EnumProperty<["view", "purchase", "issued", "sent", "delivered", "claimed", "first_use", "exhausted", "balance_reminder", "expiring_notice"]>;
        design_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        currency_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        amount: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").BigNumberProperty>;
        occurred_at: import("@medusajs/framework/utils").DateTimeProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "gift_card_event">;
}>>;
declare class GiftCardExperienceModuleService extends GiftCardExperienceModuleService_base {
    private get knex();
    /**
     * La configuración EFECTIVA de una tienda: la suya si la definió, la global si no.
     *
     * Es precedencia, no unión. Y la creación perezosa sigue siendo sobre la fila
     * GLOBAL: crear una fila por tienda la primera vez que alguien mira la pantalla
     * congelaría los defaults de ese momento, y a partir de ahí cambiar el global ya
     * no se propagaría a esa tienda. La fila de la tienda nace recién cuando alguien
     * guarda algo distinto (`upsertSettingsForSite`).
     *
     * `siteId` es OBLIGATORIO —`string | null`, no opcional— por lo mismo que en
     * `ga4/service.ts upsertBuiltinSetting`: mientras se podía omitir, se omitió en los
     * cuatro lugares donde más caro sale. `createGiftCardIntentsForOrder` sellaba
     * `expires_at`, `timezone`, `scheduled_at` y el diseño por defecto de la fila
     * GLOBAL en la entrega de una tienda que había configurado la suya, y eso queda
     * escrito en `gift_card_delivery` para siempre. Un default acá deja el mismo camino
     * abierto para el próximo call site; escribir `null` es una decisión que se lee en
     * el diff.
     */
    getSettings(siteId: string | null): Promise<GiftCardSettingsRow>;
    /**
     * Guarda la configuración de UNA tienda, creando su fila si todavía no existe.
     *
     * Los valores parten de la configuración efectiva —no de los defaults del modelo—
     * porque el operador abre la pantalla, ve el valor heredado, cambia un campo y
     * guarda: espera que el resto quede como lo estaba viendo.
     */
    upsertSettingsForSite(siteId: string | null, values: Record<string, unknown>): Promise<GiftCardSettingsRow>;
    ensureDefaultDesign(): Promise<GiftCardDesignRow>;
    resolveDesign(publicId: string, includeInactive?: boolean): Promise<GiftCardDesignRow | null>;
    /**
     * `scope` es el filtro de tienda que arma el call site (`siteColumnFilter` con
     * `GIFT_CARD_DESIGN_SITE_SCOPE`). Llega por parámetro y no se resuelve acá porque el
     * servicio de un módulo recibe un container aislado y no puede resolver el registro
     * de tiendas — mismo motivo que `resolve-site-sql.ts`.
     *
     * Opcional a propósito: los call sites internos que sólo necesitan saber si hay
     * algún diseño vivo no tienen tienda que pasar, y obligarlos a `{}` no los haría más
     * correctos. Lo que importa es que la ruta del storefront SÍ lo pase.
     */
    listActiveDesigns(scope?: Record<string, unknown>): Promise<GiftCardDesignRow[]>;
    findDeliveryByKey(idempotencyKey: string): Promise<GiftCardDeliveryRow | null>;
    createDeliveryIntent(input: CreateGiftCardDeliveryIntentInput): Promise<{
        created: boolean;
        delivery: GiftCardDeliveryRow;
    }>;
    claimIssuance(deliveryId: string, paidAt: Date): Promise<GiftCardDeliveryRow | null>;
    cancelUnissuedDeliveriesForOrder(orderId: string): Promise<number>;
    findOfficialGiftCardByIdempotencyKey(idempotencyKey: string): Promise<{
        id: string;
        code: string;
    } | null>;
    retrieveOfficialGiftCard(giftCardId: string): Promise<{
        id: string;
        code: string;
    } | null>;
    getCustomerWallet(customerId: string): Promise<Array<Record<string, unknown>>>;
    getDeliveryOperations(deliveryId: string): Promise<{
        attempts: unknown[];
        events: unknown[];
    }>;
    markIssued(deliveryId: string, values: {
        giftCardId: string;
        storeCreditAccountId?: string | null;
        deliveryStatus: 'pending' | 'scheduled' | 'sent';
        claimedCustomerId?: string | null;
    }): Promise<void>;
    markIssuanceFailed(deliveryId: string, error: unknown): Promise<void>;
    claimDueDeliveries(limit?: number): Promise<GiftCardDeliveryRow[]>;
    startAttempt(delivery: GiftCardDeliveryRow, trigger: 'initial' | 'automatic_retry' | 'manual_resend' | 'fallback_buyer', recipient: string): Promise<{
        id: string;
    }>;
    auditSecureLink(delivery: GiftCardDeliveryRow, actorId: string): Promise<void>;
    markDeliverySent(deliveryId: string, attemptId: string, values: {
        notificationId?: string | null;
        providerMessageId?: string | null;
    }): Promise<void>;
    markDeliveryFailed(delivery: GiftCardDeliveryRow, attemptId: string, error: unknown, retryDelays: unknown): Promise<'failed' | 'dead_letter'>;
    markFallbackSent(deliveryId: string): Promise<void>;
    cancelScheduledDelivery(deliveryId: string): Promise<GiftCardDeliveryRow>;
    updateRecipientBeforeSending(deliveryId: string, recipientEmail: string): Promise<GiftCardDeliveryRow>;
    consumeToken(deliveryId: string, customerId: string): Promise<'claimed' | 'same_customer' | 'unavailable'>;
    releaseConsumedToken(deliveryId: string, customerId: string): Promise<void>;
    private attributedGiftBalances;
    private recordUsageMilestone;
    reconcileUsageMilestones(): Promise<{
        first_use: number;
        exhausted: number;
    }>;
    listExpiringNotificationCandidates(days: number, limit?: number): Promise<GiftCardDeliveryRow[]>;
    listBalanceReminderCandidates(days: number, limit?: number): Promise<Array<{
        delivery: GiftCardDeliveryRow;
        remaining: number;
        customer_email: string;
    }>>;
    claimLifecycleNotification(delivery: GiftCardDeliveryRow, event: 'balance_reminder' | 'expiring_notice'): Promise<string | null>;
    completeLifecycleNotification(eventId: string, notificationId?: string | null): Promise<void>;
    releaseLifecycleNotification(eventId: string): Promise<void>;
    requeueDelivery(deliveryId: string): Promise<GiftCardDeliveryRow>;
    markClaimed(deliveryId: string, customerId: string): Promise<void>;
    findDeliveryByTokenHash(hash: string): Promise<GiftCardDeliveryRow | null>;
    applySendGridEvent(input: {
        eventId: string;
        messageId: string;
        event: 'delivered' | 'deferred' | 'bounce' | 'dropped';
        occurredAt: Date;
    }): Promise<boolean>;
    /**
     * `deliveryIds` acota las entregas que entran en el agregado. Lo arma la ruta con el
     * predicado de la tienda activa: sin él, los KPIs suman las gift cards de TODAS las
     * tiendas y el operador decide sobre números que no son suyos.
     *
     * `null` = sin acotar, que es el comportamiento de antes.
     */
    analytics(deliveryIds?: string[] | null): Promise<Record<string, unknown>>;
    recordEvent(event: 'view' | 'purchase' | 'issued' | 'sent' | 'delivered' | 'claimed' | 'first_use' | 'exhausted' | 'balance_reminder' | 'expiring_notice', delivery?: GiftCardDeliveryRow | null, metadata?: Record<string, unknown>): Promise<void>;
}
export { truncateError };
export default GiftCardExperienceModuleService;
