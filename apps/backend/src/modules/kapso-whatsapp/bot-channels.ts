/**
 * Canales de venta que atiende el bot de WhatsApp.
 *
 * Antes esto era la env `WHATSAPP_SALES_CHANNEL_ID`, que tiene dos problemas:
 * cambiarla exige un deploy, y no se puede ver desde el backoffice — el síntoma
 * real fue un bot ofreciendo parrilleros y termotanques porque apuntaba al canal
 * equivocado, sin que nada en la UI lo delatara.
 *
 * Vive en `store_setting` igual que el botón flotante y los bindings de
 * plantillas: una fila JSON por clave, sin migración propia.
 *
 * ── Uno o VARIOS canales ─────────────────────────────────────────────────────
 * La BÚSQUEDA abarca todos los canales elegidos, pero un PEDIDO pertenece a uno
 * solo (así funciona un carrito en Medusa). El primero de la lista es el
 * PRINCIPAL: es el que se usa para crear el checkout cuando no se puede deducir
 * del carrito. Ver `resolveOrderSalesChannel`.
 */

/** Clave del setting que guarda los canales del bot. */
export const WHATSAPP_BOT_CHANNELS_KEY = 'whatsapp_bot_channels';

export type WhatsappBotChannelsConfig = {
  /**
   * Canales cuyo catálogo puede ofrecer el bot, en orden. El PRIMERO es el
   * principal (el del pedido). Vacío = sin configurar: se cae a la env y, si
   * tampoco está, al canal por defecto de la tienda.
   */
  sales_channel_ids: string[];
};

export const WHATSAPP_BOT_CHANNELS_DEFAULTS: WhatsappBotChannelsConfig = {
  sales_channel_ids: [],
};

/** Tope defensivo: nadie va a atender 20 catálogos desde un número. */
const MAX_CHANNELS = 10;

/**
 * Normaliza la lista: strings no vacíos, sin duplicados y preservando el orden
 * (el orden define cuál es el principal, así que no se ordena alfabéticamente).
 */
export function normalizeChannelIds(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of list) {
    const id = String(entry ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_CHANNELS) break;
  }
  return out;
}

export function mergeBotChannelsConfig(raw: unknown): WhatsappBotChannelsConfig {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { sales_channel_ids: normalizeChannelIds(value.sales_channel_ids) };
}

/**
 * Superficie mínima de store-config que hace falta. Se tipa acá en vez de
 * importar el service para no acoplar la extensión de WhatsApp a su árbol de
 * tipos — mismo criterio que `floating-button.ts`.
 */
export type StoreSettingReader = {
  /**
   * `readSetting` y NO `listStoreSettings({ key })`: desde que `store_setting` tiene
   * `site_id`, el listado puede devolver DOS filas —la de la tienda y la global— y
   * quedarse con la primera da un resultado que depende del plan de ejecución.
   */
  readSetting: (key: string, siteId?: string | null) => Promise<{ value?: unknown } | undefined>;
};

export type StoreSettingWriter = StoreSettingReader & {
  upsertSetting: (key: string, value: unknown, siteId?: string | null) => Promise<unknown>;
};

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Lee la config guardada, siempre completa. */
export async function readBotChannelsConfig(
  service: StoreSettingReader,
  /** `null`/ausente = la fila GLOBAL, el fallback de toda tienda sin config propia. */
  siteId?: string | null,
): Promise<WhatsappBotChannelsConfig> {
  const row = await service.readSetting(WHATSAPP_BOT_CHANNELS_KEY, siteId);
  const raw = row?.value;
  const parsed = typeof raw === 'string' ? safeParse(raw) : raw;
  return mergeBotChannelsConfig(parsed);
}

/**
 * Persiste la lista. NO mergea por campo como el botón flotante: acá el patch ES
 * la lista completa, porque deseleccionar el último canal tiene que poder dejarla
 * vacía (y un merge la dejaría intacta para siempre).
 */
export async function writeBotChannelsConfig(
  service: StoreSettingWriter,
  patch: Partial<WhatsappBotChannelsConfig>,
  /** `null`/ausente = escribe la fila GLOBAL, que es el comportamiento de antes. */
  siteId?: string | null,
): Promise<WhatsappBotChannelsConfig> {
  const next = mergeBotChannelsConfig({
    sales_channel_ids: patch.sales_channel_ids ?? [],
  });
  await service.upsertSetting(WHATSAPP_BOT_CHANNELS_KEY, next, siteId);
  return next;
}
