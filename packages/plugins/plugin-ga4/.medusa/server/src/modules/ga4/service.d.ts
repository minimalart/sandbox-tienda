import { type Ga4SendConfig } from './lib/measurement-protocol';
import { type Ga4BuiltinKey } from './lib/supported-events';
type ContainerLike = {
    resolve: (key: string) => unknown;
};
export type Ga4BuiltinView = {
    builtin_key: Ga4BuiltinKey;
    trigger_event: string;
    default_ga4_event: string;
    category: string;
    is_active: boolean;
    hidden: boolean;
    ga4_event_name: string;
};
/**
 * Una fila de `ga4_settings`, o la config resuelta cuando todavía no hay
 * ninguna.
 *
 * `id: null` significa exactamente eso: nada persistido, los valores vienen de
 * `app-settings` (DB > env). `updateSettings` lo usa para decidir entre crear y
 * actualizar, y es lo que permite que `getSettings` no escriba nunca.
 */
export type Ga4SettingsRow = {
    id: string | null;
    site_id: string | null;
    measurement_id: string | null;
    api_secret: string | null;
    gtm_id: string | null;
    debug: boolean;
};
type ParamMapping = {
    ga4_param: string;
    source_path?: string;
    static_value?: unknown;
};
type Ga4Mapping = {
    id?: string;
    medusa_event: string;
    ga4_event_name: string;
    param_mappings?: ParamMapping[] | null;
};
declare const Ga4ModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly Ga4EventMapping: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        medusa_event: import("@medusajs/framework/utils").TextProperty;
        ga4_event_name: import("@medusajs/framework/utils").TextProperty;
        is_active: import("@medusajs/framework/utils").BooleanProperty;
        description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        param_mappings: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "ga4_event_mapping">;
    readonly Ga4BuiltinSetting: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        builtin_key: import("@medusajs/framework/utils").TextProperty;
        is_active: import("@medusajs/framework/utils").BooleanProperty;
        hidden: import("@medusajs/framework/utils").BooleanProperty;
        ga4_event_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "ga4_builtin_setting">;
    readonly Ga4Settings: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        singleton_key: import("@medusajs/framework/utils").TextProperty;
        measurement_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        api_secret: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        gtm_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        debug: import("@medusajs/framework/utils").BooleanProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        site_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    }>, "ga4_settings">;
}>>;
declare class Ga4ModuleService extends Ga4ModuleService_base {
    /**
     * La configuración EFECTIVA de una tienda: la suya si la definió, la global si
     * no, y si tampoco hay global, la resuelta por `app-settings` (DB > env).
     *
     * **Este método NO escribe.** Antes sembraba la fila global en el primer
     * acceso, y eso tenía dos problemas serios: un GET escribía en la base, y —
     * peor— si el env todavía no estaba cargado la fila nacía con NULLs y a partir
     * de ahí el env quedaba MUERTO para siempre. Definir `GA_MEASUREMENT_ID`
     * después no hacía absolutamente nada, sin ningún error que lo explicara.
     *
     * Sin fila, devuelve un objeto SIN `id`: es la señal de "todavía no hay nada
     * persistido" que `updateSettings` usa para decidir entre crear y actualizar.
     */
    getSettings(siteId?: string | null): Promise<Ga4SettingsRow>;
    /**
     * Guarda la configuración de UNA tienda, creando su fila si no existe.
     *
     * `updateGa4Settings` sobre la fila que devolvió `getSettings` escribiría la
     * GLOBAL cuando la tienda no tiene la suya: le cambiaría la propiedad de GA4 a
     * todas. Y como `getSettings` ya no siembra, acá también hay que contemplar
     * que no exista ninguna fila todavía.
     */
    updateSettings(data: Record<string, unknown>, siteId?: string | null): Promise<{
        id: string;
        singleton_key: string;
        measurement_id: string | null;
        api_secret: string | null;
        gtm_id: string | null;
        debug: boolean;
        metadata: Record<string, unknown> | null;
        site_id: string | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
    isConfigured(siteId?: string | null): Promise<boolean>;
    getSendConfig(siteId?: string | null): Promise<Ga4SendConfig | null>;
    listActiveMappings(medusaEvent: string): Promise<Ga4Mapping[]>;
    buildGa4Params(mapping: Ga4Mapping, eventData: unknown): Record<string, unknown>;
    resolveClientId(eventData: unknown): string | null;
    dispatch(mapping: Ga4Mapping, eventData: unknown): Promise<void>;
    /**
     * Los builtins EFECTIVOS de una tienda: los suyos pisan a los globales, clave por
     * clave.
     *
     * El merge es por clave y no por fila entera a propósito: una tienda que sólo apagó
     * un evento sigue heredando el resto.
     *
     * El orden se arma en memoria y NO con `ORDER BY site_id`: en Postgres `ASC` es
     * `NULLS LAST`, así que la fila global vendría última y le pisaría la suya a la
     * tienda — exactamente al revés de lo que hace falta. Dos pasadas explícitas no
     * dependen de ese detalle del driver.
     */
    getBuiltinSettings(siteId?: string | null): Promise<Ga4BuiltinView[]>;
    upsertBuiltinSetting(builtinKey: Ga4BuiltinKey, patch: {
        is_active?: boolean;
        hidden?: boolean;
        ga4_event_name?: string | null;
    }): Promise<{
        id: string;
        builtin_key: string;
        is_active: boolean;
        hidden: boolean;
        ga4_event_name: string | null;
        site_id: string | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
    }>;
    dispatchBuiltin(builtinKey: Ga4BuiltinKey, eventData: unknown, container: ContainerLike): Promise<void>;
}
export default Ga4ModuleService;
