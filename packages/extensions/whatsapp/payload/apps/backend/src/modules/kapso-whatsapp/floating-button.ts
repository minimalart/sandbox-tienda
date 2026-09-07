/**
 * Configuración del botón flotante de WhatsApp del storefront.
 *
 * Vive en `store_setting` (módulo store-config), igual que los bindings de
 * plantillas: una sola fila JSON por clave. Así el toggle se administra desde el
 * backoffice sin migraciones propias y el storefront lo lee por un endpoint
 * público.
 */

/** Clave del setting que guarda la config del botón flotante. */
export const WHATSAPP_FLOATING_BUTTON_KEY = 'whatsapp_floating_button';

export type WhatsappFloatingButtonConfig = {
  /** Toggle maestro: si está apagado, el storefront no monta el botón. */
  enabled: boolean;
  /** Teléfono destino en formato Meta (solo dígitos, sin `+`). */
  phone: string;
  /** Mensaje pre-cargado en el chat al abrir wa.me. */
  message: string;
  /** Texto accesible / tooltip del botón. */
  label: string;
};

export const WHATSAPP_FLOATING_BUTTON_DEFAULTS: WhatsappFloatingButtonConfig = {
  enabled: false,
  phone: '',
  message: 'Hola! Tengo una consulta.',
  label: 'Escribinos por WhatsApp',
};

/** Largo mínimo de un teléfono internacional utilizable (mismo criterio que el provider). */
const MIN_PHONE_DIGITS = 8;
/** Tope de E.164. */
const MAX_PHONE_DIGITS = 15;

/**
 * Normaliza el teléfono al formato de wa.me / Meta: solo dígitos, sin `+`, sin
 * separadores y sin el prefijo internacional `00`. Devuelve '' si no queda nada
 * usable (el toggle se guarda igual, pero el botón no se muestra).
 */
export function normalizeWhatsappPhone(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const withoutIddPrefix = digits.startsWith('00') ? digits.slice(2) : digits;
  if (withoutIddPrefix.length < MIN_PHONE_DIGITS) return '';
  return withoutIddPrefix.slice(0, MAX_PHONE_DIGITS);
}

/** Ausente (no-string) ⇒ default; vacío ⇒ vacío (el operador lo borró a propósito). */
const optionalText = (raw: unknown, fallback: string, maxLength: number): string =>
  typeof raw === 'string' ? raw.trim().slice(0, maxLength) : fallback;

/** Ausente o vacío ⇒ default (campos que no pueden quedar en blanco, ej. el aria-label). */
const requiredText = (raw: unknown, fallback: string, maxLength: number): string => {
  const value = optionalText(raw, fallback, maxLength);
  return value === '' ? fallback : value;
};

/** Mergea un valor crudo/parcial sobre los defaults, normalizando cada campo. */
export function mergeFloatingButtonConfig(raw: unknown): WhatsappFloatingButtonConfig {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    enabled: value.enabled === true || value.enabled === 'true',
    phone: normalizeWhatsappPhone(value.phone),
    // El mensaje pre-cargado es opcional: vaciarlo abre el chat en blanco.
    message: optionalText(value.message, WHATSAPP_FLOATING_BUTTON_DEFAULTS.message, 400),
    label: requiredText(value.label, WHATSAPP_FLOATING_BUTTON_DEFAULTS.label, 80),
  };
}

/**
 * ¿El botón se tiene que ver en la tienda? Estar activado no alcanza: sin
 * teléfono válido el link de WhatsApp no lleva a ningún lado, así que preferimos
 * no mostrar nada antes que un botón roto.
 */
export const isFloatingButtonLive = (config: WhatsappFloatingButtonConfig): boolean =>
  config.enabled && config.phone !== '';

/**
 * Superficie mínima del servicio de store-config que necesitamos. Se tipa acá
 * (en vez de importar el service) para no acoplar la extensión de WhatsApp al
 * árbol de tipos de store-config — mismo patrón que los bindings.
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

/** Lee la config guardada, siempre completa (defaults mergeados). */
export async function readFloatingButtonConfig(
  service: StoreSettingReader,
  /** `null`/ausente = la fila GLOBAL, el fallback de toda tienda sin config propia. */
  siteId?: string | null,
): Promise<WhatsappFloatingButtonConfig> {
  const row = await service.readSetting(WHATSAPP_FLOATING_BUTTON_KEY, siteId);
  const raw = row?.value;
  const parsed = typeof raw === 'string' ? safeParse(raw) : raw;
  return mergeFloatingButtonConfig(parsed);
}

/**
 * Persiste un patch sobre lo ya guardado (los campos ausentes no se pisan) y
 * devuelve la config normalizada resultante.
 */
export async function writeFloatingButtonConfig(
  service: StoreSettingWriter,
  patch: Partial<WhatsappFloatingButtonConfig>,
  /** `null`/ausente = escribe la fila GLOBAL, que es el comportamiento de antes. */
  siteId?: string | null,
): Promise<WhatsappFloatingButtonConfig> {
  const current = await readFloatingButtonConfig(service, siteId);
  const next = mergeFloatingButtonConfig({ ...current, ...patch });
  await service.upsertSetting(WHATSAPP_FLOATING_BUTTON_KEY, next, siteId);
  return next;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
