export declare const GiftCardSettings: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
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
    /**
     * La tienda dueña de esta configuración. `NULL` = GLOBAL de la instancia, que es
     * el fallback de toda tienda que no defina la suya.
     *
     * Deja de ser un singleton: `singleton_key` sigue existiendo para no romper nada,
     * pero la unicidad ahora es por (site_id, singleton_key) y necesita DOS índices
     * parciales — en Postgres `NULL != NULL`, así que uno solo dejaría pasar dos filas
     * globales y `getSettings` devolvería cualquiera de las dos según el plan.
     */
    site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "gift_card_settings">;
