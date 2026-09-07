/**
 * Ga4Settings — fila única de configuración de GA4. **LEGACY.**
 *
 * Nació como el reemplazo de las env vars, antes de que existiera
 * `app-settings`. Hoy la fuente de verdad es `site_setting`
 * (namespace `extension:ga4`) y esta tabla quedó como capa de compatibilidad:
 * cada columna NO nula sigue pisando al env, pero pierde contra una fila de
 * `site_setting` guardada desde la card del admin. La mezcla vive en
 * `modules/ga4/settings.ts` (`mergeWithLegacyRow`), con el orden justificado.
 *
 * No se migran los datos ni se dropea la tabla a propósito: hay instalaciones
 * con el measurement id y el api secret sólo acá, y moverlos implicaría escribir
 * en la tabla de otro módulo desde una migración, cifrado incluido.
 *
 * `api_secret` es sensible: nunca se devuelve por la API (se expone solo el flag
 * api_secret_set) y solo se actualiza cuando llega un valor no vacío.
 */
export declare const Ga4Settings: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    /**
     * Discriminante de la fila global. Existe SÓLO para poder indexarla.
     *
     * La global es `site_id IS NULL`, y un `UNIQUE (site_id) WHERE site_id IS NULL` no
     * restringe nada: en un único de Postgres los NULL no colisionan entre sí. Hace falta
     * una columna con valor real, igual que `singleton_key` en `gift_card_settings`.
     */
    singleton_key: import("@medusajs/framework/utils").TextProperty;
    measurement_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    api_secret: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    gtm_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    debug: import("@medusajs/framework/utils").BooleanProperty;
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    /**
     * La tienda dueña de esta configuración. `NULL` = GLOBAL de la instancia.
     *
     * Cada tienda puede medir en su propia propiedad de GA4 —son marcas distintas y los
     * informes no se mezclan—, pero la que no configuró la suya sigue heredando la
     * global, que es la sembrada desde las env.
     */
    site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "ga4_settings">;
export default Ga4Settings;
