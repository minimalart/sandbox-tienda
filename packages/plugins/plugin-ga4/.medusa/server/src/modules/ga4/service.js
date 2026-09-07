"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
const measurement_protocol_1 = require("./lib/measurement-protocol");
const settings_1 = require("./settings");
const builtin_dispatchers_1 = require("./lib/builtin-dispatchers");
const supported_events_1 = require("./lib/supported-events");
// Resolve a dot-path (e.g. "metadata.ga_client_id") into a nested object.
function resolvePath(source, path) {
    if (!path)
        return undefined;
    return path.split('.').reduce((acc, key) => {
        if (acc && typeof acc === 'object') {
            return acc[key];
        }
        return undefined;
    }, source);
}
class Ga4ModuleService extends (0, utils_1.MedusaService)({
    Ga4EventMapping: models_1.Ga4EventMapping,
    Ga4BuiltinSetting: models_1.Ga4BuiltinSetting,
    Ga4Settings: models_1.Ga4Settings,
}) {
    // ---- Config (app-settings + fila legacy ga4_settings) --------------------
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
    async getSettings(siteId) {
        if (siteId) {
            const [own] = await this.listGa4Settings({ site_id: siteId }, { take: 1 });
            if (own)
                return own;
        }
        const [existing] = await this.listGa4Settings({ site_id: null }, { take: 1 });
        if (existing)
            return existing;
        const resolved = (0, settings_1.getGa4Settings)();
        return {
            id: null,
            site_id: null,
            measurement_id: resolved.measurementId,
            api_secret: resolved.apiSecret,
            gtm_id: resolved.gtmId,
            debug: resolved.debug,
        };
    }
    /**
     * Guarda la configuración de UNA tienda, creando su fila si no existe.
     *
     * `updateGa4Settings` sobre la fila que devolvió `getSettings` escribiría la
     * GLOBAL cuando la tienda no tiene la suya: le cambiaría la propiedad de GA4 a
     * todas. Y como `getSettings` ya no siembra, acá también hay que contemplar
     * que no exista ninguna fila todavía.
     */
    async updateSettings(data, siteId) {
        const current = (await this.getSettings(siteId));
        const target = siteId ?? null;
        // Sin nada persistido: la primera escritura crea la fila, con los valores
        // heredados del env como base.
        if (!current.id) {
            const { id: _noId, site_id: _noSite, ...seed } = current;
            return this.createGa4Settings({ ...seed, site_id: target, ...data });
        }
        // `?? null` de los DOS lados: sin eso, `siteId` undefined contra un
        // `site_id` null daba false y creaba una segunda fila global.
        if ((current.site_id ?? null) === target) {
            return this.updateGa4Settings({ id: current.id, ...data });
        }
        const { id: _inheritedId, ...inherited } = current;
        return this.createGa4Settings({ ...inherited, site_id: target, ...data });
    }
    // NO hay writer de la fila legacy, a propósito. `ga4_settings` quedó de SÓLO
    // LECTURA: existe para las instalaciones que todavía tienen sus valores
    // únicamente ahí, y `site_setting` le gana. Un método que escribiera esa fila
    // sería una trampa — devolvería 200 y no cambiaría nada en cuanto alguien
    // hubiera tocado la card. `POST /admin/ga4-config` escribe en `site_setting`.
    // El envío server-side requiere measurement id + api secret.
    async isConfigured(siteId) {
        const settings = await this.getSettings(siteId);
        return Boolean(settings.measurement_id && settings.api_secret);
    }
    // Config lista para pasar a sendGa4Event/validateGa4Event. null si falta algo.
    async getSendConfig(siteId) {
        const settings = await this.getSettings(siteId);
        if (!settings.measurement_id || !settings.api_secret)
            return null;
        return {
            measurementId: settings.measurement_id,
            apiSecret: settings.api_secret,
            debug: settings.debug,
        };
    }
    // Active mappings for a given Medusa event.
    async listActiveMappings(medusaEvent) {
        // param_mappings es una columna json() (tipada como Record por el ORM) que
        // en runtime guarda un array — casteamos en el borde para consumirla tipada.
        const rows = await this.listGa4EventMappings({
            medusa_event: medusaEvent,
            is_active: true,
        });
        return rows;
    }
    // Build the GA4 params object from a mapping's param_mappings. For each entry:
    // a static_value wins; otherwise resolve source_path as a dot-path into the
    // event data. Entries that resolve to undefined are skipped.
    buildGa4Params(mapping, eventData) {
        const params = {};
        const entries = mapping.param_mappings ?? [];
        for (const entry of entries) {
            if (!entry || !entry.ga4_param)
                continue;
            if (entry.static_value !== undefined) {
                params[entry.ga4_param] = entry.static_value;
                continue;
            }
            if (entry.source_path) {
                const value = resolvePath(eventData, entry.source_path);
                if (value !== undefined) {
                    params[entry.ga4_param] = value;
                }
            }
        }
        return params;
    }
    // Resolve the GA4 client_id from the event data, in cascade:
    // cart/metadata ga_client_id -> top-level ga_client_id -> deterministic
    // fallback derived from the entity id -> null.
    resolveClientId(eventData) {
        const data = (eventData ?? {});
        const metadata = (data.metadata ?? {});
        const fromMetadata = metadata.ga_client_id;
        if (typeof fromMetadata === 'string' && fromMetadata)
            return fromMetadata;
        const fromTop = data.ga_client_id;
        if (typeof fromTop === 'string' && fromTop)
            return fromTop;
        if (typeof data.id === 'string' && data.id)
            return `mp.${data.id}`;
        return null;
    }
    // Dispatch a single mapping to GA4. NUNCA lanza: cualquier fallo se traga para
    // que un evento malo no pueda tumbar el event bus. Los hits ya quedan en GA4,
    // no se persisten localmente. Skip silencioso si no hay client_id o config.
    async dispatch(mapping, eventData) {
        const clientId = this.resolveClientId(eventData);
        if (!clientId)
            return;
        const config = await this.getSendConfig();
        if (!config)
            return;
        const params = this.buildGa4Params(mapping, eventData);
        try {
            await (0, measurement_protocol_1.sendGa4Event)({
                clientId,
                eventName: mapping.ga4_event_name,
                params,
                config,
            });
        }
        catch {
            // Swallow: un mapping malo no debe frenar al resto ni al event bus.
        }
    }
    // ---- Built-in ecommerce events (portados del plugin) ----
    // Merge del catálogo BUILTIN_GA4_EVENTS con las filas de settings guardadas.
    // Si no hay fila para un builtin, el default es activo con el nombre del catálogo.
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
    async getBuiltinSettings(siteId) {
        const all = await this.listGa4BuiltinSettings(siteId ? { site_id: [null, siteId] } : { site_id: null });
        const rows = [
            ...all.filter((r) => r.site_id == null),
            ...all.filter((r) => r.site_id != null),
        ];
        const byKey = new Map(rows.map((r) => [
            r.builtin_key,
            { is_active: r.is_active, hidden: Boolean(r.hidden), ga4_event_name: r.ga4_event_name },
        ]));
        return supported_events_1.BUILTIN_GA4_EVENTS.map((b) => {
            const row = byKey.get(b.builtin_key);
            return {
                builtin_key: b.builtin_key,
                trigger_event: b.trigger_event,
                default_ga4_event: b.default_ga4_event,
                category: b.category,
                is_active: row ? row.is_active : true,
                hidden: row ? Boolean(row.hidden) : false,
                ga4_event_name: row?.ga4_event_name ?? b.default_ga4_event,
            };
        });
    }
    // Upsert de la config de un built-in (activar/desactivar + ocultar + renombrar).
    async upsertBuiltinSetting(builtinKey, patch) {
        const [existing] = await this.listGa4BuiltinSettings({ builtin_key: builtinKey });
        if (existing) {
            return this.updateGa4BuiltinSettings({ id: existing.id, ...patch });
        }
        return this.createGa4BuiltinSettings({ builtin_key: builtinKey, ...patch });
    }
    // Despacha un evento built-in a GA4. NUNCA lanza. Chequea que esté activo,
    // arma el payload con su builder, y envía con el nombre GA4 configurado.
    async dispatchBuiltin(builtinKey, eventData, container) {
        const catalog = supported_events_1.BUILTIN_GA4_EVENTS.find((b) => b.builtin_key === builtinKey);
        if (!catalog)
            return;
        const [row] = await this.listGa4BuiltinSettings({ builtin_key: builtinKey });
        const isActive = row ? row.is_active : true;
        // Oculto ("borrado") o inactivo → no se dispara.
        if (!isActive || row?.hidden)
            return;
        const eventName = row?.ga4_event_name ?? catalog.default_ga4_event;
        const config = await this.getSendConfig();
        if (!config)
            return;
        try {
            const built = await builtin_dispatchers_1.BUILTIN_BUILDERS[builtinKey](container, eventData);
            if (!built)
                return; // sin client_id / entidad resuelta → skip silencioso
            await (0, measurement_protocol_1.sendGa4Event)({
                clientId: built.clientId,
                userId: built.userId,
                eventName,
                params: built.params,
                config,
            });
        }
        catch {
            // Swallow: los hits ya quedan en GA4; no persistimos logs localmente.
        }
    }
}
exports.default = Ga4ModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dhNC9zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEscURBQTBEO0FBQzFELHFDQUEyRTtBQUMzRSxxRUFBOEU7QUFDOUUseUNBQTRDO0FBQzVDLG1FQUE2RDtBQUM3RCw2REFBZ0Y7QUE0Q2hGLDBFQUEwRTtBQUMxRSxTQUFTLFdBQVcsQ0FBQyxNQUFlLEVBQUUsSUFBWTtJQUNoRCxJQUFJLENBQUMsSUFBSTtRQUFFLE9BQU8sU0FBUyxDQUFDO0lBQzVCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQVUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUU7UUFDbEQsSUFBSSxHQUFHLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDbkMsT0FBUSxHQUErQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQy9DLENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDYixDQUFDO0FBRUQsTUFBTSxnQkFBaUIsU0FBUSxJQUFBLHFCQUFhLEVBQUM7SUFDM0MsZUFBZSxFQUFmLHdCQUFlO0lBQ2YsaUJBQWlCLEVBQWpCLDBCQUFpQjtJQUNqQixXQUFXLEVBQVgsb0JBQVc7Q0FDWixDQUFDO0lBQ0EsNkVBQTZFO0lBRTdFOzs7Ozs7Ozs7Ozs7T0FZRztJQUNILEtBQUssQ0FBQyxXQUFXLENBQUMsTUFBc0I7UUFDdEMsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNYLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUMzRSxJQUFJLEdBQUc7Z0JBQUUsT0FBTyxH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