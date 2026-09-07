import { model } from '@medusajs/framework/utils';

/**
 * Conversación de WhatsApp por teléfono. `draft_items` es el carrito en armado
 * (spec de variantes), `messages` la ventana de contexto reciente. `customer_id`/
 * `email` se cachean cuando el webhook logra identificar al cliente por teléfono,
 * para prefijar el checkout link.
 */
export const WhatsappConversation = model
  .define('whatsapp_conversation', {
    id: model.id({ prefix: 'wac' }).primaryKey(),
    phone: model.text(),
    customer_id: model.text().nullable(),
    email: model.text().nullable(),
    country_code: model.text().nullable(),
    /** Borrador de carrito: Array<{ variant_id, quantity }>. */
    draft_items: model.json().nullable(),
    /** Historial reciente: Array<{ role, content }> (ventana acotada). */
    messages: model.json().nullable(),
    /** Último token de checkout generado (para referencia/depuración). */
    last_checkout_token: model.text().nullable(),
    /**
     * Handoff a humano. `bot` = el bot responde; `pending_human`/`human` = un humano
     * atiende (el bot NO responde); `resolved` = vuelve al bot. Se escala con la tool
     * `wa_handoff_to_human`; se resuelve manual (panel del admin) o por inactividad.
     */
    /**
     * Sesión comercial en curso (PRD §25): `{ session_id, intent, step, answers,
     * shown_variant_ids, updated_at }`. Es lo que permite que el recorrido por
     * botones sea determinístico entre turnos (saber que el próximo texto libre
     * es la búsqueda que se pidió, o el número de pedido) y que los eventos del
     * embudo se agrupen por compra — la fila es única por teléfono y vive para
     * siempre, así que el teléfono no separa una compra de la siguiente.
     *
     * Va como UNA columna json y no como columnas sueltas porque la forma va a
     * cambiar durante la beta.
     */
    session: model.json().nullable(),
    status: model.text().default('bot'),
    escalated_at: model.dateTime().nullable(),
    escalation_reason: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['phone'], unique: true }, { on: ['status'] }]);

export default WhatsappConversation;
