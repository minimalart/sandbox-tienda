import { model } from '@medusajs/framework/utils';

/**
 * WhatsappEvent — un paso del embudo comercial de una conversación de WhatsApp.
 *
 * Módulo HERMANO de `whatsapp-agent` (anidado en su carpeta, igual que
 * `typesense/sync-log`): así la extensión lo mapea sin agregar un root de
 * ownership nuevo, y el service puede extender `MedusaService` sin tocar el del
 * agente.
 *
 * Por qué una tabla propia y no el tracer del Asistente IA: `RunTracer` sólo
 * registra turnos que pasaron por el LLM, y acá lo que hay que medir es
 * justamente el recorrido determinístico SIN IA (criterio del PRD §30.19). Por eso
 * `used_ai` es una columna: el embudo tiene que poder separar los dos caminos.
 *
 * - `type`: uno de `WA_EVENT_TYPES` (TEXT, ver `../types.ts`).
 * - `step`: la dimensión del asesor guiado cuando aplica (`surface`, `base`, …).
 * - `payload`: datos del evento (query, variant_ids, subtotal, motivo…).
 * - `session_id`: agrupa los eventos de UNA conversación comercial. Queda `null`
 *   hasta que el estado de sesión exista (`whatsapp_conversation.session`): la
 *   fila de conversación es única por teléfono y vive para siempre, así que el
 *   teléfono NO alcanza para separar una compra de la siguiente.
 */
export const WhatsappEvent = model
  .define('whatsapp_event', {
    id: model.id({ prefix: 'wae' }).primaryKey(),
    phone: model.text(),
    session_id: model.text().nullable(),
    type: model.text(),
    step: model.text().nullable(),
    payload: model.json().nullable(),
    used_ai: model.boolean().default(false),
    /**
     * Orden de emisión dentro del proceso que atendió el turno.
     *
     * `created_at` no basta para reconstruir un recorrido: los eventos son
     * fire-and-forget y varios de un mismo turno comparten milisegundo, así que el
     * timeline salía con las decisiones invertidas. Se ordena por `(created_at, seq)`.
     * Nullable porque las filas anteriores a esta columna no lo tienen.
     */
    seq: model.number().nullable(),
    /**
     * La tienda que RECIBIÓ el mensaje. `NULL` = no se pudo determinar.
     *
     * `phone` es el teléfono del CLIENTE, no el eje: el eje es el número de WhatsApp
     * al que escribió, que ya es por tienda desde que las credenciales de Kapso lo son.
     *
     * Ese dato no viene en el payload que Kapso manda, así que llega por la URL del
     * webhook (`?site=`) — cada tienda apunta su cuenta a la suya. Es el mismo patrón
     * que el repo ya usa para MercadoPago, cuyo `notification_url` lleva `?sc=`.
     */
    site_id: model.text().nullable(),
  })
  .indexes([
    { on: ['phone', 'created_at'] },
    { on: ['site_id', 'created_at'] },
    { on: ['type', 'created_at'] },
    { on: ['session_id'] },
    // El timeline de UNA sesión ordenado por tiempo: sin el compuesto, Postgres
    // filtra por `session_id` y después ordena en memoria.
    { on: ['session_id', 'created_at'] },
  ]);
