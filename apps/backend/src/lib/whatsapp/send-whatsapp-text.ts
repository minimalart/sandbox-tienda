import { KapsoClient } from '../../modules/kapso-whatsapp/client';
import {
  getKapsoCredentials,
  getKapsoSettings,
} from '../../modules/kapso-whatsapp/settings';
import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import { pickSendableImageUrl } from './safe-image';

/**
 * Credenciales + cliente listo, o `null` si falta configuración.
 *
 * Se resuelve en CADA llamada (no en un singleton de módulo) porque los ajustes
 * viven en la base y pueden cambiar sin reiniciar: cachear el cliente acá dejaría
 * al bot hablando con la API key vieja hasta el próximo deploy.
 */
function kapso(): { client: KapsoClient; phoneNumberId: string } | null {
  const credentials = getKapsoCredentials();
  if (!credentials) return null;
  return {
    client: new KapsoClient({
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
    }),
    phoneNumberId: credentials.phoneNumberId,
  };
}

/**
 * Envía un mensaje de texto LIBRE por WhatsApp vía Kapso (Cloud API de Meta).
 *
 * A diferencia del provider de notificaciones (`kapso-whatsapp/service.ts`), que
 * solo manda templates aprobados, esto manda `type:'text'`: sirve para las
 * respuestas conversacionales del bot. WhatsApp solo permite texto libre DENTRO
 * de la ventana de atención de 24 h (desde el último mensaje del cliente); como
 * siempre respondemos a un inbound, estamos dentro de la ventana.
 *
 * Best-effort: si falta configuración de Kapso, loguea y no envía (no rompe el
 * webhook). Devuelve el id del mensaje (wamid...) cuando Kapso lo acepta.
 */
export async function sendWhatsappText(
  to: string,
  body: string,
): Promise<{ id?: string } | null> {
  const kp = kapso();
  if (!kp) {
    console.warn(
      '[WhatsApp bot] Falta la API key o el ID de número de Kapso: no se envía la respuesta.',
    );
    return null;
  }

  const digits = to.replace(/\D+/g, '');
  const result = await kp.client.sendMessage(kp.phoneNumberId, {
    messaging_product: 'whatsapp',
    to: digits,
    type: 'text',
    // preview_url deja que WhatsApp renderice el preview de links (útil para el
    // link de tracking / de pago).
    text: { body, preview_url: true },
  });
  return { id: result.id };
}

/**
 * Envía una IMAGEN por WhatsApp (con caption). Sirve para mostrar el detalle de
 * un producto (foto + nombre + precio + link). Best-effort. `imageUrl` debe ser
 * una URL pública. Devuelve el id del mensaje o null si falta config/URL.
 */
export async function sendWhatsappImage(
  to: string,
  imageUrl: string,
  caption?: string,
): Promise<{ id?: string } | null> {
  const kp = kapso();
  if (!kp || !imageUrl) return null;
  // Mismo motivo que en el carrusel: una imagen que Meta no decodifica se rechaza
  // después del ack y el cliente no ve nada. Ver `safe-image.ts`.
  const placeholder = getKapsoSettings().placeholderImageUrl;
  const link = await pickSendableImageUrl(imageUrl, placeholder);
  if (!link) return null;
  const res = await kp.client.sendMessage(kp.phoneNumberId, {
    messaging_product: 'whatsapp',
    to: to.replace(/\D+/g, ''),
    type: 'image',
    image: { link, ...(caption ? { caption } : {}) },
  });
  return { id: res.id };
}

export type WaListRow = { id: string; title: string; description?: string };

/**
 * Envía un mensaje interactivo de LISTA nativo de WhatsApp (body + botón que abre
 * un modal con filas seleccionables). Al tocar una fila, WhatsApp devuelve un
 * `interactive.list_reply` con el `id` de la fila (usamos el variant_id).
 *
 * Límites de WhatsApp: máx. 10 filas en total, título de fila ≤24 chars,
 * descripción ≤72, texto del botón ≤20. Trunca lo necesario. Devuelve el id del
 * mensaje, o null si falta config o no hay filas. Best-effort desde el caller.
 */
export async function sendWhatsappList(opts: {
  to: string;
  body: string;
  button: string;
  rows: WaListRow[];
  header?: string;
  footer?: string;
}): Promise<{ id?: string } | null> {
  const kp = kapso();
  const rows = opts.rows.slice(0, 10);
  if (!kp || rows.length === 0) return null;

  const cut = (s: string, n: number): string => {
    const t = (s ?? '').trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  };

  const result = await kp.client.sendMessage(kp.phoneNumberId, {
    messaging_product: 'whatsapp',
    to: opts.to.replace(/\D+/g, ''),
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(opts.header ? { header: { type: 'text', text: cut(opts.header, 60) } } : {}),
      body: { text: cut(opts.body, 1024) },
      ...(opts.footer ? { footer: { text: cut(opts.footer, 60) } } : {}),
      action: {
        button: cut(opts.button, 20),
        sections: [
          {
            title: cut(opts.header || 'Opciones', 24),
            rows: rows.map((r) => ({
              id: r.id.slice(0, 200),
              title: cut(r.title, 24),
              ...(r.description ? { description: cut(r.description, 72) } : {}),
            })),
          },
        ],
      },
    },
  });
  return { id: result.id };
}

export type WaCarouselCard = {
  imageUrl: string;
  title: string;
  buttonId: string;
  buttonTitle: string;
};

/**
 * Envía un CARRUSEL interactivo nativo de WhatsApp (tarjetas con imagen + texto +
 * un botón "Agregar"). Es un mensaje de SESIÓN (dentro de la ventana de 24 h, que
 * es siempre nuestro caso), no una plantilla → no requiere aprobación de Meta.
 *
 * Usa el SDK de Kapso (`sendInteractiveCarousel`), que arma la estructura exacta que
 * espera el proxy de Meta. Límites: máx. 10 tarjetas, cada tarjeta necesita imagen y
 * el MISMO número de botones (acá: 1). El `id` del botón vuelve como `button_reply.id`
 * (lo lee `getInboundSelection`); usamos el variant_id para reusar el flujo de add.
 * Best-effort: null si falta config, no hay tarjetas o el envío falla.
 */
export async function sendWhatsappCarousel(opts: {
  to: string;
  body: string;
  cards: WaCarouselCard[];
}): Promise<{ id?: string } | null> {
  const credentials = getKapsoCredentials();
  const cards = opts.cards.slice(0, 10);
  if (!credentials || cards.length === 0) return null;

  const cut = (s: string, n: number): string => {
    const t = (s ?? '').trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  };

  // Meta rechaza el carrusel COMPLETO si no puede decodificar una sola imagen, y lo
  // hace DESPUÉS de que Kapso nos devolvió un id: nosotros creemos que salió y el
  // cliente no recibe nada. Pasó en producción (error 131053) con un WebP animado
  // que se llamaba `.JPG`. Por eso las URLs se verifican por sus BYTES acá, en el
  // emisor, y no en cada llamador.
  const placeholder = getKapsoSettings().placeholderImageUrl;
  const checked = await Promise.all(
    cards.map(async (card) => ({
      card,
      imageUrl: await pickSendableImageUrl(card.imageUrl, placeholder),
    })),
  );
  const usable = checked.filter((entry) => entry.imageUrl);
  // Si quedó alguna card sin imagen enviable, no se manda un carrusel incompleto: se
  // devuelve null y el llamador cae a la lista, que muestra TODOS los productos.
  if (usable.length !== cards.length) return null;

  const baseUrl = `${credentials.baseUrl.replace(/\/$/, '')}/meta/whatsapp`;
  const client = new WhatsAppClient({ baseUrl, kapsoApiKey: credentials.apiKey });
  const res = (await client.messages.sendInteractiveCarousel({
    phoneNumberId: credentials.phoneNumberId,
    to: opts.to.replace(/\D+/g, ''),
    bodyText: cut(opts.body, 1024),
    cards: usable.map(({ card, imageUrl }, i) => ({
      cardIndex: i,
      header: { type: 'image' as const, image: { link: imageUrl as string } },
      bodyText: cut(card.title, 160),
      action: { buttons: [{ id: card.buttonId.slice(0, 256), title: cut(card.buttonTitle, 20) }] },
    })),
  })) as { messages?: Array<{ id?: string }> };
  return { id: res?.messages?.[0]?.id };
}

export type WaButton = { id: string; title: string };

/**
 * Envía BOTONES de respuesta rápida nativos de WhatsApp (`interactive.type:'button'`).
 * Al tocar un botón, WhatsApp devuelve un `interactive.button_reply` con el `id` que
 * definimos acá (lo lee `getInboundSelection`). Sirve para confirmaciones y sí/no.
 *
 * Límites de WhatsApp: máx. 3 botones, título ≤20 chars, id ≤256. Trunca lo necesario.
 * Best-effort: devuelve null si falta config o no hay botones (no rompe el caller).
 */
export async function sendWhatsappButtons(opts: {
  to: string;
  body: string;
  buttons: WaButton[];
  header?: string;
  footer?: string;
}): Promise<{ id?: string } | null> {
  const kp = kapso();
  const buttons = opts.buttons.slice(0, 3);
  if (!kp || buttons.length === 0) return null;

  const cut = (s: string, n: number): string => {
    const t = (s ?? '').trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  };

  const result = await kp.client.sendMessage(kp.phoneNumberId, {
    messaging_product: 'whatsapp',
    to: opts.to.replace(/\D+/g, ''),
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(opts.header ? { header: { type: 'text', text: cut(opts.header, 60) } } : {}),
      body: { text: cut(opts.body, 1024) },
      ...(opts.footer ? { footer: { text: cut(opts.footer, 60) } } : {}),
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id.slice(0, 256), title: cut(b.title, 20) },
        })),
      },
    },
  });
  return { id: result.id };
}

/**
 * Marca el mensaje entrante como leído y muestra "escribiendo…" en el chat del
 * cliente mientras el bot prepara la respuesta (el LLM tarda unos segundos y sin
 * esto da sensación de que no funciona). El indicador se descarta al responder o
 * a los ~25s. Best-effort: si falta config o falla, no rompe nada.
 */
export async function sendWhatsappTyping(messageId: string): Promise<void> {
  const kp = kapso();
  if (!kp || !messageId) return;
  await kp.client.markRead(kp.phoneNumberId, messageId, { typing: true });
}
