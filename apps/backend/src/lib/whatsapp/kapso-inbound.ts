import { z } from 'zod';

/**
 * Schema del payload entrante de Kapso (webhook `whatsapp.message.received`).
 * Intencionalmente laxo: solo extraemos lo que usamos e ignoramos el resto, para
 * que cambios futuros del payload no rompan el endpoint.
 *
 * Portado/adaptado de llorente-logistica-next/lib/whatsapp/inbound-schema.ts.
 */
const KapsoMessageSchema = z.object({
  /** Teléfono del remitente en formato Meta (solo dígitos, con código de país). */
  from: z.string(),
  /** Id del mensaje de WhatsApp (wamid...), para deduplicar reintentos. */
  id: z.string().optional(),
  type: z.string().optional(),
  text: z.object({ body: z.string() }).optional(),
  // Quick-reply de un CARRUSEL (y de templates): llega como mensaje `type: "button"`
  // con `button: { text, payload }` — NO como interactive.button_reply. El `payload`
  // es el id que definimos al enviar la tarjeta (para productos = variant_id).
  button: z.object({ text: z.string().optional(), payload: z.string().optional() }).optional(),
  interactive: z
    .object({
      type: z.string().optional(),
      nfm_reply: z
        .object({
          response_json: z.string(),
          name: z.string().optional(),
        })
        .optional(),
      // Respuesta a una lista interactiva: el `id` es el que definimos al enviarla
      // (usamos el variant_id). `title` es el texto de la fila elegida.
      list_reply: z
        .object({ id: z.string(), title: z.string().optional(), description: z.string().optional() })
        .optional(),
      // Respuesta a botones de respuesta rápida.
      button_reply: z
        .object({ id: z.string(), title: z.string().optional() })
        .optional(),
    })
    .optional(),
});

const KapsoEventInboundSchema = z.object({
  event: z.literal('whatsapp.message.received'),
  data: z.object({ message: KapsoMessageSchema }),
});

const KapsoNormalizedInboundSchema = z.object({
  message: KapsoMessageSchema,
});

export const KapsoInboundSchema = z.union([
  KapsoEventInboundSchema,
  KapsoNormalizedInboundSchema,
]);

export type KapsoInbound = z.infer<typeof KapsoInboundSchema>;
export type KapsoInboundMessage = z.infer<typeof KapsoMessageSchema>;

/** Devuelve el mensaje sin importar cuál de las dos formas trae el payload. */
export function getKapsoInboundMessage(payload: KapsoInbound): KapsoInboundMessage {
  return 'message' in payload ? payload.message : payload.data.message;
}

/** Texto plano del mensaje entrante (o null si no es un mensaje de texto). */
export function getInboundText(msg: KapsoInboundMessage): string | null {
  const body = msg.text?.body?.trim();
  return body ? body : null;
}

/**
 * Selección de una lista/botón interactivo (o null). El `id` es el que definimos
 * al enviar la lista (para productos = variant_id); `title` es la fila elegida.
 */
export function getInboundSelection(
  msg: KapsoInboundMessage,
): { id: string; title: string | null } | null {
  const r = msg.interactive?.list_reply ?? msg.interactive?.button_reply;
  if (r?.id) return { id: r.id, title: r.title ?? null };
  // Carrusel/plantilla: el quick-reply viene como `type: "button"` con `button.payload`.
  if (msg.button?.payload) return { id: msg.button.payload, title: msg.button.text ?? null };
  return null;
}
