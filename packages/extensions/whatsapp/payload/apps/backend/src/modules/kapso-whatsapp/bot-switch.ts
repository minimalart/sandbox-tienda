/**
 * EL INTERRUPTOR DEL BOT: que el número deje de contestar solo.
 *
 * Es una palanca distinta de despublicar un recorrido, y hace falta porque
 * despublicar NO apaga el bot: devuelve el turno al router determinístico y al
 * agente, que siguen contestando. Para una tienda que tiene UN SOLO número —el
 * caso normal— eso no alcanza: mientras el bot esté armándose, el número tiene
 * que quedar entero para las personas del inbox.
 *
 * ── POR QUÉ NO ES UN AJUSTE DE `extension:whatsapp` ─────────────────────────
 * Los ajustes de `app-settings` se leen por el camino SINCRÓNICO del snapshot,
 * que sólo sirve la capa de INSTANCIA (ver el recuadro de `settings.ts`). Este
 * interruptor es por TIENDA por definición: una tienda apaga su bot sin apagar
 * el de las demás. `store_setting` resuelve esa precedencia en `readSetting`, y
 * es donde ya viven los canales del bot y el botón flotante — misma clase de
 * dato, mismo lugar, sin migración propia.
 *
 * ── EL DEFAULT ES ENCENDIDO ─────────────────────────────────────────────────
 * Sin fila, el bot contesta. Una instalación que nunca abrió esta pantalla se
 * comporta byte por byte como antes, y el interruptor sólo cambia algo cuando
 * alguien lo apagó a propósito. Al revés —fail-closed— una actualización dejaría
 * mudos a todos los bots que hoy funcionan.
 */

/** Clave del setting. Una fila JSON por clave, igual que `whatsapp_bot_channels`. */
export const WHATSAPP_BOT_SWITCH_KEY = 'whatsapp_bot_switch';

export type WhatsappBotSwitch = {
  /** `false` = el bot no contesta nada; el turno queda para una persona. */
  enabled: boolean;
  /**
   * Por qué se apagó. No lo lee ningún código: es para que el que entra tres
   * semanas después sepa si puede volver a prenderlo o hay algo a medio hacer.
   */
  note: string | null;
};

export const WHATSAPP_BOT_SWITCH_DEFAULTS: WhatsappBotSwitch = { enabled: true, note: null };

const MAX_NOTE = 280;

/**
 * Superficie mínima de store-config, tipada acá y no importada del service, para
 * no acoplar la extensión a su árbol de tipos — mismo criterio que
 * `bot-channels.ts` y `floating-button.ts`.
 */
export type StoreSettingReader = {
  /** `readSetting` resuelve la precedencia tienda → global por CLAVE. */
  readSetting: (key: string, siteId?: string | null) => Promise<{ value?: unknown } | undefined>;
};

/** Para el runtime, que necesita ver TODAS las filas y no la que gana por precedencia. */
export type StoreSettingLister = {
  listStoreSettings: (filtro: { key: string }) => Promise<Array<{ site_id?: string | null; value?: unknown }>>;
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

/**
 * Normaliza lo guardado a un objeto COMPLETO.
 *
 * `enabled` sólo es `false` si está escrito explícitamente: cualquier cosa rara
 * en la fila —un `null`, un string, un jsonb a medio migrar— deja el bot
 * encendido. Un parser que falle apagando sería un bot mudo por un dato torcido,
 * que es exactamente el modo de falla que nadie diagnostica.
 */
export function mergeBotSwitch(raw: unknown): WhatsappBotSwitch {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const enabled = value.enabled === false || value.enabled === 'false' ? false : true;
  const note = typeof value.note === 'string' && value.note.trim() !== ''
    ? value.note.trim().slice(0, MAX_NOTE)
    : null;
  return { enabled, note };
}

/** Lee el estado del interruptor para una tienda. Siempre completo, nunca lanza. */
export async function readBotSwitch(
  service: StoreSettingReader,
  /** `null`/ausente = la fila GLOBAL, la que hereda toda tienda sin la suya. */
  siteId?: string | null,
): Promise<WhatsappBotSwitch> {
  const row = await service.readSetting(WHATSAPP_BOT_SWITCH_KEY, siteId);
  const raw = row?.value;
  return mergeBotSwitch(typeof raw === 'string' ? safeParse(raw) : raw);
}

/** Persiste el estado. Reemplaza la fila entera: son dos campos y se guardan juntos. */
export async function writeBotSwitch(
  service: StoreSettingWriter,
  patch: Partial<WhatsappBotSwitch>,
  siteId?: string | null,
): Promise<WhatsappBotSwitch> {
  const next = mergeBotSwitch({
    enabled: patch.enabled !== false,
    note: patch.note ?? null,
  });
  await service.upsertSetting(WHATSAPP_BOT_SWITCH_KEY, next, siteId);
  return next;
}

/**
 * ¿EL BOT ESTÁ SILENCIADO? La lectura del RUNTIME, y NO usa precedencia.
 *
 * `readBotSwitch` responde "qué dice la configuración que aplica acá", que es lo que
 * la pantalla tiene que mostrar. Esto responde otra cosa: "¿alguien apagó el bot de
 * un modo que alcance a este mensaje?". Son preguntas distintas y mezclarlas fue el
 * bug: un interruptor de emergencia que falla ABIERTO.
 *
 * ── EL AGUJERO QUE CIERRA ────────────────────────────────────────────────────
 * La pantalla escribe con la tienda activa del backoffice (header `x-site-id`), y el
 * webhook lee con el `?site=` de la URL de Kapso — que, como dice el comentario del
 * propio webhook, lo normal es que NO esté puesto. Fila de tienda + webhook sin
 * `?site=` da `readSetting(key, null)`, que sólo mira la fila global: el apagado
 * existe en la base, la pantalla lo muestra apagado, y el bot contesta igual.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 * Si CUALQUIER fila que alcance a este mensaje dice apagado, el bot no habla.
 *
 *  - Con tienda conocida: su fila y la global. Cualquiera de las dos apaga.
 *  - Sin tienda (el webhook no pudo resolverla): TODAS las filas. No es exagerado —
 *    si no se sabe de qué tienda es el mensaje, tampoco se puede servir a una tienda
 *    mientras otra está apagada; todo el tráfico entra por este mismo camino.
 *
 * Fallar CERRADO es la dirección correcta acá, y es la inversa de `mergeBotSwitch`:
 * un dato torcido no puede apagar el bot (eso sería silencio inexplicable), pero un
 * apagado EXPLÍCITO que no se ve por un problema de ámbito sí tiene que apagarlo. El
 * operador que apretó el botón ya decidió; el costo de respetarlo de más es que
 * alguien lo prenda de nuevo, y se ve al toque.
 */
export async function botSilenciado(
  service: StoreSettingLister,
  siteId?: string | null,
): Promise<boolean> {
  const rows = await service.listStoreSettings({ key: WHATSAPP_BOT_SWITCH_KEY });
  const alcanzan = rows.filter((r) => {
    const suyo = r.site_id ?? null;
    if (suyo === null) return true;              // la global alcanza siempre
    if (!siteId) return true;                    // sin tienda conocida, alcanzan todas
    return suyo === siteId;
  });
  return alcanzan.some((r) => {
    const raw = r.value;
    return !mergeBotSwitch(typeof raw === 'string' ? safeParse(raw) : raw).enabled;
  });
}
