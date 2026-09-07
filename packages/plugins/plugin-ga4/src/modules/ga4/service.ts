import { MedusaService } from '@medusajs/framework/utils';
import { Ga4EventMapping, Ga4BuiltinSetting, Ga4Settings } from './models';
import { sendGa4Event, type Ga4SendConfig } from './lib/measurement-protocol';
import { getGa4Settings } from './settings';
import { BUILTIN_BUILDERS } from './lib/builtin-dispatchers';
import { BUILTIN_GA4_EVENTS, type Ga4BuiltinKey } from './lib/supported-events';

type ContainerLike = { resolve: (key: string) => unknown };

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

// Resolve a dot-path (e.g. "metadata.ga_client_id") into a nested object.
function resolvePath(source: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

class Ga4ModuleService extends MedusaService({
  Ga4EventMapping,
  Ga4BuiltinSetting,
  Ga4Settings,
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
  async getSettings(siteId?: string | null): Promise<Ga4SettingsRow> {
    if (siteId) {
      const [own] = await this.listGa4Settings({ site_id: siteId }, { take: 1 });
      if (own) return own as unknown as Ga4SettingsRow;
    }
    const [existing] = await this.listGa4Settings({ site_id: null }, { take: 1 });
    if (existing) return existing as unknown as Ga4SettingsRow;

    const resolved = getGa4Settings();
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
  async updateSettings(data: Record<string, unknown>, siteId?: string | null) {
    const current = (await this.getSettings(siteId)) as unknown as Record<string, unknown>;
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
      return this.updateGa4Settings({ id: current.id as string, ...data });
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
  async isConfigured(siteId?: string | null): Promise<boolean> {
    const settings = await this.getSettings(siteId);
    return Boolean(settings.measurement_id && settings.api_secret);
  }

  // Config lista para pasar a sendGa4Event/validateGa4Event. null si falta algo.
  async getSendConfig(siteId?: string | null): Promise<Ga4SendConfig | null> {
    const settings = await this.getSettings(siteId);
    if (!settings.measurement_id || !settings.api_secret) return null;
    return {
      measurementId: settings.measurement_id,
      apiSecret: settings.api_secret,
      debug: settings.debug,
    };
  }

  // Active mappings for a given Medusa event.
  async listActiveMappings(medusaEvent: string): Promise<Ga4Mapping[]> {
    // param_mappings es una columna json() (tipada como Record por el ORM) que
    // en runtime guarda un array — casteamos en el borde para consumirla tipada.
    const rows = await this.listGa4EventMappings({
      medusa_event: medusaEvent,
      is_active: true,
    });
    return rows as unknown as Ga4Mapping[];
  }

  // Build the GA4 params object from a mapping's param_mappings. For each entry:
  // a static_value wins; otherwise resolve source_path as a dot-path into the
  // event data. Entries that resolve to undefined are skipped.
  buildGa4Params(mapping: Ga4Mapping, eventData: unknown): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    const entries = mapping.param_mappings ?? [];

    for (const entry of entries) {
      if (!entry || !entry.ga4_param) continue;

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
  resolveClientId(eventData: unknown): string | null {
    const data = (eventData ?? {}) as Record<string, unknown>;
    const metadata = (data.metadata ?? {}) as Record<string, unknown>;

    const fromMetadata = metadata.ga_client_id;
    if (typeof fromMetadata === 'string' && fromMetadata) return fromMetadata;

    const fromTop = data.ga_client_id;
    if (typeof fromTop === 'string' && fromTop) return fromTop;

    if (typeof data.id === 'string' && data.id) return `mp.${data.id}`;

    return null;
  }

  // Dispatch a single mapping to GA4. NUNCA lanza: cualquier fallo se traga para
  // que un evento malo no pueda tumbar el event bus. Los hits ya quedan en GA4,
  // no se persisten localmente. Skip silencioso si no hay client_id o config.
  async dispatch(mapping: Ga4Mapping, eventData: unknown): Promise<void> {
    const clientId = this.resolveClientId(eventData);
    if (!clientId) return;

    const config = await this.getSendConfig();
    if (!config) return;

    const params = this.buildGa4Params(mapping, eventData);

    try {
      await sendGa4Event({
        clientId,
        eventName: mapping.ga4_event_name,
        params,
        config,
      });
    } catch {
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
  async getBuiltinSettings(siteId?: string | null): Promise<Ga4BuiltinView[]> {
    const all = await this.listGa4BuiltinSettings(
      siteId ? { site_id: [null, siteId] } : { site_id: null },
    );
    const rows = [
      ...all.filter((r: any) => r.site_id == null),
      ...all.filter((r: any) => r.site_id != null),
    ];
    const byKey = new Map<
      string,
      { is_active: boolean; hidden: boolean; ga4_event_name: string | null }
    >(
      rows.map((r: any) => [
        r.builtin_key,
        { is_active: r.is_active, hidden: Boolean(r.hidden), ga4_event_name: r.ga4_event_name },
      ])
    );

    return BUILTIN_GA4_EVENTS.map((b) => {
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
  async upsertBuiltinSetting(
    builtinKey: Ga4BuiltinKey,
    patch: { is_active?: boolean; hidden?: boolean; ga4_event_name?: string | null }
  ) {
    const [existing] = await this.listGa4BuiltinSettings({ builtin_key: builtinKey });
    if (existing) {
      return this.updateGa4BuiltinSettings({ id: existing.id, ...patch });
    }
    return this.createGa4BuiltinSettings({ builtin_key: builtinKey, ...patch });
  }

  // Despacha un evento built-in a GA4. NUNCA lanza. Chequea que esté activo,
  // arma el payload con su builder, y envía con el nombre GA4 configurado.
  async dispatchBuiltin(
    builtinKey: Ga4BuiltinKey,
    eventData: unknown,
    container: ContainerLike
  ): Promise<void> {
    const catalog = BUILTIN_GA4_EVENTS.find((b) => b.builtin_key === builtinKey);
    if (!catalog) return;

    const [row] = await this.listGa4BuiltinSettings({ builtin_key: builtinKey });
    const isActive = row ? row.is_active : true;
    // Oculto ("borrado") o inactivo → no se dispara.
    if (!isActive || (row as any)?.hidden) return;

    const eventName = row?.ga4_event_name ?? catalog.default_ga4_event;

    const config = await this.getSendConfig();
    if (!config) return;

    try {
      const built = await BUILTIN_BUILDERS[builtinKey](container, eventData);
      if (!built) return; // sin client_id / entidad resuelta → skip silencioso

      await sendGa4Event({
        clientId: built.clientId,
        userId: built.userId,
        eventName,
        params: built.params,
        config,
      });
    } catch {
      // Swallow: los hits ya quedan en GA4; no persistimos logs localmente.
    }
  }
}

export default Ga4ModuleService;
