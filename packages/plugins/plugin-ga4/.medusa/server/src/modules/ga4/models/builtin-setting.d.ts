/**
 * Config por evento built-in de ecommerce (purchase, add_to_cart, etc.). Guarda
 * SOLO el estado configurable: si está activo, si está oculto ("borrado") y un
 * override del nombre GA4. El payload lo arma el código (lib/builtin-dispatchers).
 * Una fila por builtin_key; si no existe fila, el default es activo, visible y
 * con el nombre del catálogo.
 */
export declare const Ga4BuiltinSetting: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    builtin_key: import("@medusajs/framework/utils").TextProperty;
    is_active: import("@medusajs/framework/utils").BooleanProperty;
    hidden: import("@medusajs/framework/utils").BooleanProperty;
    ga4_event_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    /**
     * La tienda dueña de esta fila. `NULL` = GLOBAL, el fallback de toda tienda que no
     * defina la suya para esa clave.
     *
     * Sirve para que una marca mida un evento propio (o le cambie el nombre) sin
     * tocárselo a las otras, que comparten el mapeo por defecto.
     */
    site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
}>, "ga4_builtin_setting">;
