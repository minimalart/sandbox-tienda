import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import type { NativeToolContext, NativeToolDef } from './index';
import { NATIVE_TOOL } from './names';
import {
  searchWaProducts,
  hydrateWaVariants,
  getWaVariantDetail,
  listWaProductPresentations,
  listWaPinnedProducts,
} from '../../../../lib/whatsapp/search-products';
import {
  resolveWaOrderContext,
  resolveOrderSalesChannel,
} from '../../../../lib/whatsapp/order-context';
// Migrated from `../../../../workflows/create-checkout-link` (in-tree) to the
// `@minimalart/mercatto-plugin-checkout-links` plugin. The plugin re-exports the
// workflow via its `./workflows/*` subpath export.
import { createCheckoutLinkWorkflow } from '@minimalart/mercatto-plugin-checkout-links/workflows/create-checkout-link';
import { getAdminNotificationEmail } from '../../../email/admin-recipient';
import { sendWhatsappList, sendWhatsappImage, sendWhatsappButtons, sendWhatsappCarousel } from '../../../../lib/whatsapp/send-whatsapp-text';
import { resolveWaCustomer } from '../../../../lib/whatsapp/resolve-customer';
import { createOrderReturn, resolveReturnShippingOption } from '../../../../lib/returns/create-return';
import { getKapsoSettings } from '../../../kapso-whatsapp/settings';
import { WHATSAPP_AGENT_MODULE } from '../../../whatsapp-agent';
import type WhatsappAgentModuleService from '../../../whatsapp-agent/service';
import { trackWaEvent } from '../../../../lib/whatsapp/events';
import type { WaEventType } from '../../../whatsapp-agent/event-log/types';
import { startAdvisor, sanitizeExtractedFilters } from '../../../../lib/whatsapp/advisor/flow';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const int = (v: unknown, def: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
};

function money(amount: number | null | undefined, currency: string): string {
  if (amount == null) return 's/precio';
  const n = Number(amount);
  if (!Number.isFinite(n)) return 's/precio';
  return `$${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${currency.toUpperCase()}`;
}

const storefrontBase = () =>
  (process.env.STOREFRONT_URL || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '');

/** Réplica local de buildPublicUrl (evita importar desde src/api hacia el módulo). */
function checkoutUrl(token: string, country: string): string {
  const base = storefrontBase();
  const path = `/${country}/c/${token}`;
  return base ? `${base}${path}` : path;
}

/** Link a la ficha del producto en el storefront. */
function productUrl(handle: string, country: string): string {
  const base = storefrontBase();
  const path = `/${country}/products/${handle}`;
  return base ? `${base}${path}` : path;
}

function svc(ctx: NativeToolContext): WhatsappAgentModuleService {
  return ctx.container.resolve(WHATSAPP_AGENT_MODULE) as WhatsappAgentModuleService;
}

/**
 * Evento del embudo desde una tool. Toma teléfono, sesión y `used_ai` del ctx del
 * turno, así que el llamador (webhook o router determinístico) decide una sola vez
 * si el recorrido gastó modelo. Fire-and-forget: nunca demora la respuesta.
 */
function track(
  ctx: NativeToolContext,
  type: WaEventType,
  payload?: Record<string, unknown>,
): void {
  const phone = str(ctx.waPhone);
  if (!phone) return;
  trackWaEvent(ctx.container, {
    phone,
    type,
    payload: payload ?? null,
    usedAi: ctx.waUsedAi === true,
    sessionId: ctx.waSessionId ?? null,
    siteId: ctx.waSiteId ?? null,
  });
}

/** Definiciones que ve el modelo (se spread-ean en NATIVE_TOOL_DEFS). */
export const WHATSAPP_TOOL_DEFS: NativeToolDef[] = [
  {
    name: NATIVE_TOOL.waSearchProducts,
    description:
      'Busca productos del catálogo por texto y se los muestra al cliente como una LISTA INTERACTIVA de WhatsApp (hasta 10 opciones, el máximo que permite WhatsApp). Devuelve nombre, precio y variant_id de cada resultado.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto a buscar (ej. "yerba", "vino malbec").' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.waAddToCart,
    description:
      'Agrega una variante al pedido SOLO después de que el cliente eligió explícitamente ese producto, presentación y cantidad. NO la uses ante consultas exploratorias o búsquedas generales ("¿tenés yerba?"): en ese caso mostrá opciones y esperá que elija. Usá un variant_id que haya devuelto wa_search_products (nunca inventes ids).',
    parameters: {
      type: 'object',
      properties: {
        variant_id: { type: 'string' },
        quantity: { type: 'number', description: 'Cantidad (default 1).' },
      },
      required: ['variant_id'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.waViewCart,
    description: 'Muestra el pedido en armado (ítems, cantidades y subtotal).',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: NATIVE_TOOL.waRemoveFromCart,
    description: 'Quita una variante del pedido en armado.',
    parameters: {
      type: 'object',
      properties: { variant_id: { type: 'string' } },
      required: ['variant_id'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.waCheckoutLink,
    description:
      'Genera el link de pago para el pedido en armado y lo devuelve para enviárselo al cliente. Confirmá los ítems ANTES de llamarlo. El pago se completa en el navegador.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: NATIVE_TOOL.waHandoffToHuman,
    description:
      'Derivá la conversación a una persona del equipo cuando no puedas resolver (reclamo, cambio, devolución, un pedido que no aparece, o algo fuera de tu alcance). Avisa al staff y PAUSA tus respuestas para este contacto hasta que un humano lo atienda. Usalo en vez de prometer que "alguien lo va a contactar".',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Motivo breve de la derivación (para el aviso al equipo).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.waStartReturn,
    description:
      'Inicia una DEVOLUCIÓN: muestra al cliente los ítems devolvibles de un pedido entregado como lista interactiva para que elija cuál devolver. Pasá el número de pedido (display_id) si el cliente lo dijo; si no, usa el pedido entregado más reciente.',
    parameters: {
      type: 'object',
      properties: {
        order_display_id: { type: 'number', description: 'Número de pedido (el que ve el cliente), si lo mencionó.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.waRequestReturn,
    description:
      'Crea la solicitud de devolución de un ítem, una vez que el cliente eligió el ítem (por la lista) y aclaró el motivo. Confirmá con el cliente antes de llamarla.',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'ID del pedido (viene de la selección de la lista).' },
        line_item_id: { type: 'string', description: 'ID de la línea del pedido a devolver (viene de la selección).' },
        quantity: { type: 'number', description: 'Cantidad a devolver (default 1).' },
        reason: { type: 'string', description: 'Motivo en palabras del cliente (se guarda como nota).' },
      },
      required: ['order_id', 'line_item_id'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.waProductDetail,
    description:
      'Muestra el DETALLE de un producto con su foto (imagen + nombre + precio + link a la ficha). Usalo cuando el cliente quiere "ver mejor" o pide más info/foto de una opción. Pasá el variant_id de la búsqueda o de la lista.',
    parameters: {
      type: 'object',
      properties: {
        variant_id: { type: 'string', description: 'variant_id del producto a mostrar (de la búsqueda/lista).' },
      },
      required: ['variant_id'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.waAskButtons,
    description:
      'Hacé una pregunta al cliente con BOTONES de respuesta rápida nativos (máx 3, ≤20 chars cada uno). Usalo para confirmaciones y sí/no: "Confirmar pago"/"Cambiar", "Algo más"/"Cerrar compra", "Sí, avisame"/"No, gracias". La pregunta va en `body`. NO lo uses para elegir entre productos: para eso está wa_search_products, que ya manda la lista interactiva. Cuando el cliente toque un botón, su elección te llega en el próximo turno.',
    parameters: {
      type: 'object',
      properties: {
        body: { type: 'string', description: 'Texto de la pregunta (1-2 líneas).' },
        buttons: {
          type: 'array',
          description:
            'Hasta 3 botones. `label` = texto visible (≤20 chars); `action` = clave corta de la intención (ej. confirm_pay, change, more, close, yes, no).',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              action: { type: 'string' },
            },
            required: ['label', 'action'],
            additionalProperties: false,
          },
        },
      },
      required: ['body', 'buttons'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.waReviewOrder,
    description:
      'Muestra al cliente el DETALLE COMPLETO del pedido (cada ítem con cantidad y precio + subtotal) junto con los botones "Confirmar pago" / "Cambiar". Usalo cuando el cliente quiere cerrar/terminar la compra, ANTES de generar el link de pago. Esta tool arma el detalle y los botones sola: NO resumas el pedido en texto vos.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: NATIVE_TOOL.waSetQuantity,
    description:
      'Fija la cantidad EXACTA de una variante que YA está en el pedido (no suma). Usalo cuando el cliente pide cambiar cantidades: "quiero 3", "poné 2", "dejá una". Para "sacame una" restá vos sobre la cantidad actual (mirala con wa_view_cart si no la sabés). quantity 0 quita el producto. Pasá un variant_id que ya esté en el carrito.',
    parameters: {
      type: 'object',
      properties: {
        variant_id: { type: 'string' },
        quantity: { type: 'number', description: 'Cantidad total deseada (0 = quitar).' },
      },
      required: ['variant_id', 'quantity'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.waListPresentations,
    description:
      'Publica las PRESENTACIONES comprables de un producto (1 L, 4 L, 20 L…) para que el paso siguiente del recorrido las ofrezca como lista. NO le manda nada al cliente: sólo deja las opciones listas. Es para los recorridos dibujados, no para vos.',
    parameters: {
      type: 'object',
      properties: {
        variant_id: { type: 'string', description: 'Una variante del producto; se listan las hermanas.' },
        product_id: { type: 'string', description: 'Alternativa a variant_id.' },
        save_as: { type: 'string', description: 'Clave de `vars` donde se publican. Por defecto "presentations".' },
      },
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.waListPinned,
    description:
      'Publica los productos que el operador ELIGIÓ A MANO para este paso del recorrido, para que la pregunta siguiente los ofrezca como lista. NO le manda nada al cliente. Es para los recorridos dibujados, no para vos: los ids los pone el editor, no los inventes.',
    parameters: {
      type: 'object',
      properties: {
        product_ids: { type: 'array', items: { type: 'string' }, description: 'Ids de producto, en el orden en que se muestran.' },
        save_as: { type: 'string', description: 'Clave de `vars` donde se publican. Por defecto "pinned".' },
      },
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.waClearCart,
    description:
      'Vacía TODO el pedido en armado (borra todos los ítems). Usalo cuando el cliente quiere "empezar de nuevo", "arrancar un pedido nuevo", "vaciar el carrito" o descartar lo que había. Confirmá brevemente después.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: NATIVE_TOOL.waGuidedStart,
    description:
      'Arranca el ASESOR GUIADO: le hace al cliente unas pocas preguntas con botones (superficie, tipo, ambiente, uso especial, base) y termina mostrándole productos comprables. Usalo cuando el cliente NO sabe qué producto necesita y describe una necesidad ("quiero pintar madera", "algo para una pileta", "necesito pintura para exterior"). Si su mensaje YA dice alguna de esas cosas, pasala como parámetro y el asesor no la vuelve a preguntar. Pasá SOLO los valores de la lista; si no estás seguro de uno, no lo pases.',
    parameters: {
      type: 'object',
      properties: {
        surface: {
          type: 'string',
          enum: ['wall', 'metal', 'wood', 'plastic', 'multi'],
          description: 'Superficie: wall = pared/cemento/placa, multi = multisuperficie.',
        },
        product_type: {
          type: 'string',
          enum: ['paint', 'art_paint', 'prep', 'accessory', 'tool'],
          description: 'prep = preparación o complemento (diluyente, masilla, fondo, adhesivo).',
        },
        environment: { type: 'string', enum: ['interior', 'exterior'] },
        special_use: { type: 'string', enum: ['floor', 'pool'] },
        base: { type: 'string', enum: ['water', 'solvent'] },
      },
      additionalProperties: false,
    },
  },
];

async function runSearch(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const query = str(args.query);
  if (!query) return 'Error: falta el texto de búsqueda.';
  // Red de seguridad: un solo mensaje al cliente por turno. Si ya se envió algo
  // (otra lista/botones), NO mandes otra lista.
  if (ctx.sentUserMessage) {
    return 'Ya le enviaste un mensaje al cliente en este turno: NO busques de nuevo ni mandes otra lista. Terminá el turno con lo que ya se envió.';
  }
  // Marca el turno como exploratorio: wa_add_to_cart NO agrega tras una búsqueda
  // (el cliente todavía no eligió una fila). Ver runAdd.
  ctx.didSearch = true;
  // Traemos el máximo que permite una lista interactiva de WhatsApp (10 filas).
  const { hits, ctx: oc } = await searchWaProducts(ctx.container, { query, limit: 10 });
  track(ctx, 'search', { query, count: hits.length });
  if (hits.length === 0) {
    track(ctx, 'no_results', { query });
    return `No encontré productos para "${query}". Pedile al cliente que lo nombre de otra forma o preguntá qué está buscando.`;
  }

  // Preferimos un CARRUSEL con fotos (tarjeta = imagen + nombre/precio + botón
  // "Agregar"); si falla o falta alguna imagen sin placeholder, caemos a la lista
  // interactiva de texto. El tap devuelve el variant_id (flujo de add existente).
  let sent = false;
  let mode: 'carousel' | 'list' | 'text' = 'text';
  const phone = str(ctx.waPhone);
  if (phone) {
    const placeholder = str(getKapsoSettings().placeholderImageUrl);
    const canCarousel = hits.every((h) => h.image_url || placeholder);
    if (canCarousel) {
      try {
        const res = await sendWhatsappCarousel({
          to: phone,
          body: `Encontré estas opciones para "${query}" 👇`,
          cards: hits.map((h) => ({
            imageUrl: (h.image_url || placeholder) as string,
            title: `${h.title} — ${money(h.unit_price, oc.currency_code)}${h.in_stock ? '' : ' · sin stock'}`,
            buttonId: h.variant_id,
            buttonTitle: 'Agregar',
          })),
        });
        sent = Boolean(res);
        if (sent) mode = 'carousel';
      } catch {
        sent = false;
      }
    }
    if (!sent) {
      try {
        const res = await sendWhatsappList({
          to: phone,
          header: 'Opciones',
          body: `Encontré estas opciones para "${query}". Tocá una para elegir 👇`,
          button: 'Ver opciones',
          rows: hits.map((h) => ({
            id: h.variant_id,
            title: h.title,
            description: `${money(h.unit_price, oc.currency_code)}${h.in_stock ? '' : ' · sin stock'}`,
          })),
        });
        sent = Boolean(res);
        if (sent) mode = 'list';
      } catch {
        sent = false;
      }
    }
  }

  track(ctx, 'products_shown', {
    query,
    count: hits.length,
    mode,
    variant_ids: hits.map((h) => h.variant_id),
  });

  const compact = hits
    .map(
      (h, i) =>
        `${i + 1}. ${h.title} — ${money(h.unit_price, oc.currency_code)}${h.in_stock ? '' : ' (sin stock)'} [variant_id: ${h.variant_id}]`,
    )
    .join('\n');

  if (sent) {
    ctx.sentUserMessage = true;
    return `Ya le mostré al cliente estas ${hits.length} opciones con sus fotos y precios (elige tocando "Agregar"):\n${compact}\nNO respondas nada más: las opciones ya se enviaron. Cuando toque una, te llega la variante seleccionada. (NO mandes foto por tu cuenta: wa_product_detail SOLO si el cliente pide ver/foto de un producto puntual.)`;
  }
  return `Encontré estas opciones (mostráselas al cliente como lista numerada, sin inventar nada):\n${compact}\nSi quiere ver una con foto, usá wa_product_detail. Cuando el cliente elija producto, agregá con wa_add_to_cart usando el variant_id.`;
}

async function runProductDetail(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  if (ctx.sentUserMessage) {
    return 'Ya le enviaste un mensaje al cliente en este turno: NO mandes también la foto. Terminá el turno.';
  }
  const variantId = str(args.variant_id);
  if (!variantId) return 'Error: falta variant_id.';
  const detail = await getWaVariantDetail(ctx.container, variantId);
  if (!detail) return 'No encontré ese producto. Pedile al cliente que elija de la lista.';

  const link = detail.handle ? productUrl(detail.handle, detail.country_code) : null;
  const caption = [
    `*${detail.title}*`,
    money(detail.unit_price, detail.currency_code),
    link ? `Ver ficha: ${link}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  let shown = false;
  if (detail.image_url) {
    const res = await sendWhatsappImage(phone, detail.image_url, caption).catch(() => null);
    shown = Boolean(res);
  }
  if (shown) {
    // La foto (caption con título+precio+link) ya se envió; el modelo agrega el
    // próximo paso. Para ofrecer "¿lo agrego?" usá botones (wa_ask_buttons), NO texto.
    return `Le mostré al cliente la foto de "${detail.title}" con precio y link. NO repitas la ficha en texto. Preguntale con BOTONES (wa_ask_buttons) si lo agrega al pedido o quiere ver otro.`;
  }
  // Sin imagen: dale al agente el detalle en texto para que lo mande.
  return `Este producto no tiene foto. Pasale al cliente: ${detail.title} — ${money(detail.unit_price, detail.currency_code)}${link ? ` — ${link}` : ''}.`;
}

/**
 * Envía una pregunta con botones de respuesta rápida. Prefija los ids con `act:`
 * para que el webhook nunca los confunda con un variant_id (una acción de control
 * NO dispara add-to-cart). Best-effort: si no se pudo enviar, cae a texto.
 */
async function runAskButtons(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  if (ctx.sentUserMessage) {
    return 'Ya le enviaste un mensaje al cliente en este turno: NO mandes otra pregunta con botones. Terminá el turno.';
  }
  const body = str(args.body);
  const raw = Array.isArray(args.buttons) ? args.buttons : [];
  const buttons = raw
    .map((b) => ({ title: str((b as Record<string, unknown>)?.label), action: str((b as Record<string, unknown>)?.action) }))
    .filter((b) => b.title && b.action)
    .slice(0, 3)
    .map((b) => ({ id: `act:${b.action}`, title: b.title }));
  if (!body || buttons.length === 0) return 'Error: faltan body o buttons válidos.';

  const res = await sendWhatsappButtons({ to: phone, body, buttons }).catch(() => null);
  if (res) {
    ctx.sentUserMessage = true;
    return `Ya le mostré al cliente la pregunta con ${buttons.length} botón(es). NO respondas nada más: la pregunta ya se envió. Cuando toque un botón te llega su elección.`;
  }
  const list = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
  return `No pude enviar los botones. Mandale al cliente esta pregunta en texto:\n${body}\n${list}`;
}

async function runAdd(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  const variantId = str(args.variant_id);
  if (!variantId) return 'Error: falta variant_id.';
  // Guardrail duro: SOLO se agrega cuando el cliente acaba de TOCAR un producto de
  // la lista (turno de selección). En un botón de control (Cerrar compra, Confirmar,
  // etc.) o un texto NO se agrega: si no, el modelo re-agrega y duplica el pedido.
  if (!ctx.isVariantSelection) {
    return 'NO agregues nada en este turno: solo se agrega cuando el cliente TOCA un producto de la lista. Si tocó "Cerrar compra" usá wa_review_order; si "Confirmar pago" usá wa_checkout_link. NUNCA vuelvas a agregar lo que ya está en el carrito.';
  }
  // Guardrail anti auto-add: si en este turno se hizo una búsqueda, el cliente
  // todavía NO eligió una fila. No agregamos por iniciativa del modelo; esperamos
  // que el cliente toque una opción de la lista (eso llega como turno de selección).
  if (ctx.didSearch) {
    return 'NO agregues nada todavía: le acabás de mostrar la lista y el cliente aún no eligió. Esperá a que toque una opción. (Solo agregá cuando llegue una selección explícita del cliente.)';
  }
  // Guardrail: la variante DEBE existir en el catálogo Y estar en los canales de
  // venta del bot. Mata ids alucinados, el "producto fantasma" y lo que no se vende
  // por chat (`getWaVariantDetail` devuelve null en los tres casos).
  const exists = await getWaVariantDetail(ctx.container, variantId).catch(() => null);
  if (!exists) {
    /**
     * ACÁ HAY QUE HABLARLE AL CLIENTE, no sólo devolverle un texto al modelo.
     *
     * Este mismo tool lo llama el ROUTER cuando el cliente toca un producto
     * (`handleVariantTap`), y ahí nadie lee lo que devuelve: el turno se da por
     * atendido y el cliente se queda MIRANDO LA NADA. Y es el caso más probable
     * de todos, porque un carrusel viejo sigue arriba en la conversación con sus
     * botones vivos: se toca un producto que ya no está en el canal y, sin este
     * mensaje, el bot enmudece.
     */
    if (!ctx.sentUserMessage) {
      await sendWhatsappButtons({
        to: phone,
        body: 'Ese producto no está disponible para comprar por acá 😕 ¿Buscamos otra cosa?',
        // `act:close` y NO `act:review`: el router no tiene ningún caso `review`,
        // así que ese botón se tocaba y no pasaba nada. El que abre la revisión
        // del pedido es `close` (§18), aunque se lea "Cerrar compra".
        buttons: [
          { id: 'act:search', title: 'Buscar otro' },
          { id: 'act:close', title: 'Ver mi pedido' },
        ],
      }).catch(() => null);
    }
    return 'No puedo agregar eso: la variante no existe o no está en los canales de venta del bot. Ya le avisé al cliente; NO mandes otro mensaje en este turno.';
  }
  const qty = int(args.quantity, 1);
  // Consumimos la selección: si el modelo llama add otra vez en ESTE mismo turno,
  // el gate de arriba (isVariantSelection) lo bloquea y no duplicamos la cantidad.
  ctx.isVariantSelection = false;
  const items = await svc(ctx).addToDraft(phone, { variant_id: variantId, quantity: qty });
  const total = items.reduce((a, i) => a + i.quantity, 0);
  track(ctx, 'added_to_cart', {
    variant_id: variantId,
    quantity: qty,
    title: exists.title,
    unit_price: exists.unit_price,
    cart_units: total,
  });
  // Si ya se envió un mensaje este turno (red de seguridad), NO mandamos botones de
  // nuevo: el ítem ya quedó agregado, solo evitamos apilar mensajes.
  if (ctx.sentUserMessage) {
    return `Agregué ${qty} x ${exists.title} (el pedido tiene ${total} unidad/es). Ya se envió un mensaje este turno: NO mandes otro.`;
  }
  // Confirmación + próximos pasos SIEMPRE con botones nativos (no texto numerado).
  const body = `Agregué ${qty} x *${exists.title}* al carrito 🛒 ¿Querés algo más o cerramos la compra?`;
  const sent = await sendWhatsappButtons({
    to: phone,
    body,
    buttons: [
      { id: 'act:more', title: 'Algo más' },
      { id: 'act:close', title: 'Cerrar compra' },
    ],
  }).catch(() => null);
  if (sent) {
    ctx.sentUserMessage = true;
    return `Listo: agregué ${qty} x ${exists.title} (el pedido tiene ${total} unidad/es). YA le confirmé y le ofrecí los botones "Algo más" / "Cerrar compra". NO respondas nada más.`;
  }
  return `OK: agregado (${total} unidad/es). Confirmale al cliente qué agregaste y preguntá si quiere *algo más* o *cerrar la compra* (si cierra, usá wa_review_order). NO enumeres opciones en texto.`;
}

/** Arma el detalle del carrito (líneas + subtotal) o null si está vacío. */
async function buildDraftSummary(
  ctx: NativeToolContext,
  phone: string,
): Promise<{ lines: string[]; subtotal: number; currency: string } | null> {
  const draft = await svc(ctx).getDraft(phone);
  if (draft.length === 0) return null;
  const oc = await resolveWaOrderContext(ctx.container);
  const info = await hydrateWaVariants(ctx.container, draft.map((d) => d.variant_id), oc);
  let subtotal = 0;
  const lines = draft.map((d) => {
    const meta = info.get(d.variant_id);
    const price = meta?.unit_price ?? null;
    if (price != null) subtotal += price * d.quantity;
    return `• ${meta?.title ?? d.variant_id} x${d.quantity} — ${money(price, oc.currency_code)}`;
  });
  return { lines, subtotal, currency: oc.currency_code };
}

async function runView(_args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  const summary = await buildDraftSummary(ctx, phone);
  if (!summary) return 'El pedido está vacío. Buscá productos con wa_search_products.';
  return `Pedido actual:\n${summary.lines.join('\n')}\nSubtotal: ${money(summary.subtotal, summary.currency)}`;
}

/**
 * Muestra el pedido completo (detalle + subtotal) con botones "Confirmar pago" /
 * "Cambiar". Deterministico: el detalle y los botones los manda esta tool, no el
 * modelo (así el resumen previo al pago SIEMPRE lista los ítems, no solo el subtotal).
 */
async function runReviewOrder(_args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  if (ctx.sentUserMessage) {
    return 'Ya le enviaste un mensaje al cliente en este turno: NO mandes el detalle otra vez. Terminá el turno.';
  }
  const summary = await buildDraftSummary(ctx, phone);
  if (!summary) return 'El pedido está vacío: no hay nada para confirmar. Ofrecé buscar productos con wa_search_products.';
  track(ctx, 'cart_reviewed', {
    lines: summary.lines.length,
    subtotal: summary.subtotal,
    currency: summary.currency,
  });
  const body = `Este es tu pedido:\n${summary.lines.join('\n')}\n\nSubtotal: ${money(summary.subtotal, summary.currency)}`;
  const sent = await sendWhatsappButtons({
    to: phone,
    body,
    buttons: [
      { id: 'act:confirm_pay', title: 'Confirmar pago' },
      { id: 'act:change', title: 'Cambiar' },
    ],
  }).catch(() => null);
  if (sent) {
    ctx.sentUserMessage = true;
    return 'Ya le mostré al cliente el detalle completo del pedido (ítems + subtotal) con los botones "Confirmar pago" / "Cambiar". NO respondas nada más; esperá su respuesta.';
  }
  return `No pude enviar los botones. Mandale al cliente este detalle y preguntá si confirma el pago o quiere cambiar algo (SIN numerar):\n${body}`;
}

async function runRemove(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  const variantId = str(args.variant_id);
  if (!variantId) return 'Error: falta variant_id.';
  const items = await svc(ctx).removeFromDraft(phone, variantId);
  track(ctx, 'removed_from_cart', { variant_id: variantId, lines: items.length });
  return `OK: quitado. El pedido tiene ${items.length} producto(s).`;
}

/**
 * Publica las presentaciones comprables de un producto en el `vars` del recorrido.
 *
 * Es la primera acción PRODUCTORA: no le habla al cliente, deja opciones listas
 * para que el `ask_list` siguiente las muestre con `optionsFrom`. Con eso se puede
 * dibujar "¿Qué presentación necesitás?", que hasta ahora no se podía porque las
 * opciones del editor son fijas y las presentaciones dependen del producto que el
 * cliente acaba de elegir.
 *
 * El `value` de cada opción es el `variant_id`, así que lo que el cliente elija cae
 * en `answers.<nodo>` listo para `wa_add_to_cart`.
 */
async function runListPresentations(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const key = str(args.save_as) || 'presentations';
  // Sin recorrido no hay dónde publicar. No es un error: la tool simplemente no
  // aplica fuera del grafo, y decirlo es mejor que escribir en el aire.
  if (!ctx.waFlowVars) return 'Esta acción sólo sirve dentro de un recorrido dibujado.';

  const variantId = str(args.variant_id);
  const productId = str(args.product_id);
  if (!variantId && !productId) {
    ctx.waFlowVars[key] = [];
    return 'Error: hace falta variant_id o product_id.';
  }

  const options = await listWaProductPresentations(ctx.container, { variantId, productId }).catch(() => []);
  ctx.waFlowVars[key] = options;
  if (options.length === 0) {
    return `No encontré presentaciones comprables. Quedó "${key}" vacío: el paso que las muestre no va a poder mandar el mensaje.`;
  }
  return `Publiqué ${options.length} presentación/es en vars.${key}.`;
}

/**
 * Publica en el `vars` del recorrido los productos que el operador eligió a mano.
 *
 * Es la cuarta fuente de opciones, y la única que no calcula nada: el documento
 * pide "{{producto recomendado 1/2/3}}" y eso es una decisión comercial. Los ids
 * los pone el `ProductSelector` del editor, en el orden en que quedaron.
 *
 * Los productos fuera del canal del bot se filtran en `listWaPinnedProducts`:
 * fijar a mano es CURACIÓN, no un permiso de venta.
 */
async function runListPinned(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const key = str(args.save_as) || 'pinned';
  if (!ctx.waFlowVars) return 'Esta acción sólo sirve dentro de un recorrido dibujado.';

  // El editor puede guardar el arreglo o —si alguien lo escribió a mano— una lista
  // separada por comas. Las dos formas valen; lo que no es ninguna, queda vacío.
  const raw = args.product_ids;
  const ids = Array.isArray(raw)
    ? raw.map((v) => String(v ?? '').trim()).filter(Boolean)
    : String(raw ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

  if (ids.length === 0) {
    ctx.waFlowVars[key] = [];
    return `No hay productos elegidos. Quedó "${key}" vacío: el paso que los muestre no va a poder mandar el mensaje.`;
  }

  const options = await listWaPinnedProducts(ctx.container, ids).catch(() => []);
  ctx.waFlowVars[key] = options;
  if (options.length === 0) {
    return `Ninguno de los ${ids.length} productos elegidos se puede vender por chat (revisá que estén en el canal de venta del bot). Quedó "${key}" vacío.`;
  }
  if (options.length < ids.length) {
    return `Publiqué ${options.length} de ${ids.length} en vars.${key}. Los que faltan no están en el canal de venta del bot.`;
  }
  return `Publiqué ${options.length} producto/s en vars.${key}.`;
}

async function runClearCart(_args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  await svc(ctx).clearDraft(phone);
  track(ctx, 'cart_cleared');
  return 'OK: vacié el pedido. Confirmale al cliente que arrancamos de cero y preguntale qué querés buscar.';
}

/** Fija la cantidad exacta de una variante y ofrece los próximos pasos con botones. */
async function runSetQuantity(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  const variantId = str(args.variant_id);
  if (!variantId) return 'Error: falta variant_id.';
  const qty = Math.max(0, Math.floor(Number(args.quantity)));
  if (!Number.isFinite(qty)) return 'Error: cantidad inválida.';
  const detail = await getWaVariantDetail(ctx.container, variantId).catch(() => null);
  const items = await svc(ctx).setDraftQuantity(phone, variantId, qty);
  const name = detail?.title ?? 'el producto';
  track(ctx, 'quantity_changed', { variant_id: variantId, quantity: qty, lines: items.length });
  if (ctx.sentUserMessage) {
    return `Actualicé la cantidad (${name} → ${qty}). Ya se envió un mensaje este turno: NO mandes otro.`;
  }
  const body =
    qty <= 0
      ? `Saqué *${name}* del pedido. ¿Querés algo más o cerramos la compra?`
      : `Dejé *${name}* en ${qty} unidad/es. ¿Querés algo más o cerramos la compra?`;
  const sent = await sendWhatsappButtons({
    to: phone,
    body,
    buttons: [
      { id: 'act:more', title: 'Algo más' },
      { id: 'act:close', title: 'Cerrar compra' },
    ],
  }).catch(() => null);
  if (sent) {
    ctx.sentUserMessage = true;
    return `Actualicé la cantidad (${name} → ${qty}). El pedido tiene ${items.length} producto(s). YA le confirmé y le ofrecí los botones. NO respondas nada más.`;
  }
  return `OK: ${name} quedó en ${qty}. Confirmale al cliente y preguntá si quiere *algo más* o *cerrar la compra*. NO enumeres opciones en texto.`;
}

async function runCheckoutLink(_args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  const service = svc(ctx);
  const draft = await service.getDraft(phone);
  if (draft.length === 0) return 'El pedido está vacío: agregá productos antes de generar el link de pago.';

  const row = await service.getOrCreate(phone);
  const oc = await resolveWaOrderContext(ctx.container);
  const country = (row.country_code as string | null) || oc.country_code;

  // Con varios canales configurados, el carrito NO puede crearse en cualquiera:
  // un producto que sólo está en el canal B haría inservible un checkout creado
  // en el A. Se elige el canal que contiene todo el borrador.
  const { sales_channel_id: orderChannelId, mixed } = await resolveOrderSalesChannel(
    ctx.container,
    draft.map((d) => d.variant_id),
    oc,
  );
  if (mixed) {
    const logger = ctx.container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
    logger.warn(
      `[WhatsApp bot] El pedido de ${phone} mezcla productos de varios canales; ` +
        `se usa el principal (${orderChannelId}) y el checkout puede rechazar alguno.`,
    );
  }

  const { result: link } = await createCheckoutLinkWorkflow(ctx.container).run({
    input: {
      items: draft.map((d) => ({ variant_id: d.variant_id, quantity: d.quantity })),
      country_code: country,
      region_id: oc.region_id,
      sales_channel_id: orderChannelId,
      customer_id: (row.customer_id as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      single_use: true,
      metadata: { source: 'whatsapp', phone },
    },
  });

  // Mantener el borrador tras generar el link (por si el cliente vuelve sin pagar y
  // quiere editarlo). Solo se guarda el token; el vaciado real es por pago/inactividad.
  await service.setLastCheckoutToken(phone, link.token);
  track(ctx, 'checkout_generated', {
    token: link.token,
    lines: draft.length,
    units: draft.reduce((a, d) => a + d.quantity, 0),
  });
  const url = checkoutUrl(link.token, country);
  return `Listo. Este es el link para completar el pago (se abre en el navegador):\n${url}`;
}

async function runHandoff(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  const reason = str(args.reason) || null;
  const service = svc(ctx);
  await service.escalate(phone, reason);
  track(ctx, 'handoff', { reason });

  // Resumen comercial para el operador (best-effort): nombre, carrito y último mensaje.
  let customerName: string | null = null;
  let cartSummary: string | null = null;
  let lastMessage: string | null = null;
  try {
    const customer = await resolveWaCustomer(ctx.container, phone);
    customerName = customer?.name || null;
  } catch {
    /* noop */
  }
  try {
    const s = await buildDraftSummary(ctx, phone);
    if (s) cartSummary = `${s.lines.join('\n')}\nSubtotal: ${money(s.subtotal, s.currency)}`;
  } catch {
    /* noop */
  }
  try {
    const hist = await service.getHistory(phone);
    const lastUser = [...hist].reverse().find((m) => m.role === 'user');
    lastMessage = lastUser?.content ?? null;
  } catch {
    /* noop */
  }
  const summary = [
    cartSummary ? `Carrito en armado:\n${cartSummary}` : 'Sin carrito en armado.',
    lastMessage ? `Último mensaje del cliente: "${lastMessage}"` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  // Aviso al staff (best-effort: nunca corta el turno). Email al admin + campana.
  try {
    const notif = ctx.container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
    const data = {
      phone,
      customer_name: customerName,
      reason: reason ?? 'No especificado',
      summary,
      inbox_url: getKapsoSettings().inboxEmbedUrl,
    };
    const adminEmail = await getAdminNotificationEmail(ctx.container);
    if (adminEmail) {
      await notif.createNotifications({
        to: adminEmail,
        channel: 'email',
        template: 'whatsapp-handoff-admin',
        data,
      });
    }
    // Campana del admin (feed): no requiere destinatario/config externa.
    await notif.createNotifications({
      to: 'admin',
      channel: 'feed',
      template: 'whatsapp-handoff-admin',
      data: { ...data, title: 'Atención humana WhatsApp', description: `El bot derivó a ${phone}.` },
    });
  } catch (e) {
    try {
      ctx.container
        .resolve<Logger>('logger')
        .warn(`[WhatsApp bot] No se pudo avisar del handoff de ${phone}: ${(e as Error).message}`);
    } catch {
      /* noop */
    }
  }

  return 'OK: derivado a una persona del equipo. Decile al cliente, con calidez, que en breve lo va a atender alguien del equipo por este mismo chat, y NO sigas respondiendo por tu cuenta.';
}

async function runStartReturn(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  if (ctx.sentUserMessage) {
    return 'Ya le enviaste un mensaje al cliente en este turno: no mandes también la lista de devolución. Terminá el turno.';
  }
  const customer = await resolveWaCustomer(ctx.container, phone);
  if (!customer || customer.orders.length === 0) {
    return 'No encontré pedidos asociados a este número. Pedile al cliente que verifique con su número de pedido o derivá a una persona.';
  }

  const query = ctx.container.resolve(ContainerRegistrationKeys.QUERY);
  const wantId = Number(args.order_display_id) || null;
  // Elegir el pedido: por display_id si lo dio, si no el más reciente.
  const target = wantId
    ? customer.orders.find((o) => o.display_id === wantId)
    : customer.orders[0];
  if (!target) {
    return `No encontré el pedido #${wantId} en tu cuenta. Verificá el número o derivá a una persona.`;
  }

  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: ['id', 'display_id', 'fulfillment_status', 'items.id', 'items.title', 'items.quantity'],
    filters: { id: target.id },
  })) as { data: Array<{ id: string; display_id?: number | null; fulfillment_status?: string; items?: Array<{ id: string; title?: string; quantity?: number }> }> };
  const order = orders?.[0];
  if (!order) return 'No pude leer el pedido. Derivá a una persona del equipo.';
  const eligible = ['delivered', 'shipped', 'partially_shipped', 'partially_delivered'].includes(
    order.fulfillment_status ?? '',
  );
  if (!eligible) {
    return `El pedido #${order.display_id ?? ''} todavía no figura entregado/enviado, así que aún no se puede devolver. Explicáselo con amabilidad.`;
  }
  const items = order.items ?? [];
  if (items.length === 0) return 'Ese pedido no tiene ítems para devolver. Derivá a una persona.';

  // Lista interactiva: id de fila = ret:<order_id>:<line_item_id> (el webhook lo
  // reconoce como selección de devolución, no de compra).
  const sent = await sendWhatsappList({
    to: phone,
    header: 'Devolución',
    body: `¿Qué querés devolver del pedido #${order.display_id ?? ''}? Tocá el producto 👇`,
    button: 'Elegir producto',
    rows: items.map((it) => ({
      id: `ret:${order.id}:${it.id}`,
      title: it.title || 'Producto',
      description: it.quantity ? `Cantidad comprada: ${it.quantity}` : undefined,
    })),
  }).catch(() => null);

  const compact = items
    .map((it) => `• ${it.title || 'Producto'} (x${it.quantity ?? 1}) [line_item_id: ${it.id}]`)
    .join('\n');
  if (sent) {
    ctx.sentUserMessage = true;
    return `Le mostré al cliente los ítems del pedido #${order.display_id ?? ''} (order_id: ${order.id}) para elegir cuál devolver (la lista ya se envió, NO respondas nada más). Cuando elija, te llega el line_item_id: pedí el motivo y confirmá antes de crear la devolución con wa_request_return.`;
  }
  return `Ítems devolvibles del pedido #${order.display_id ?? ''} (order_id: ${order.id}):\n${compact}\nPreguntá cuál y el motivo, y creá la devolución con wa_request_return.`;
}

async function runRequestReturn(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  const orderId = str(args.order_id);
  const lineItemId = str(args.line_item_id);
  if (!orderId || !lineItemId) return 'Error: faltan order_id o line_item_id (vienen de la selección del cliente).';
  const quantity = int(args.quantity, 1);
  const reason = str(args.reason) || null;

  const shippingOptionId = await resolveReturnShippingOption(ctx.container);
  if (!shippingOptionId) {
    return 'No puedo procesar la devolución automáticamente (falta configurar el envío de devolución). Derivá a una persona del equipo con wa_handoff_to_human.';
  }

  try {
    await createOrderReturn(ctx.container, {
      order_id: orderId,
      items: [{ id: lineItemId, quantity, note: reason }],
      return_shipping_option_id: shippingOptionId,
      note: reason,
    });
  } catch (e) {
    return `No se pudo crear la devolución: ${(e as Error).message}. Si persiste, derivá a una persona con wa_handoff_to_human.`;
  }
  return 'OK: registré la solicitud de devolución. Confirmale al cliente que la recibimos y que el equipo lo va a contactar con los pasos del envío de retorno y el reembolso.';
}

/**
 * Arranca el asesor guiado desde el agente (§10). El recorrido en sí no gasta
 * modelo: desde acá en adelante los taps los resuelve el router determinístico.
 *
 * Los filtros que el modelo extrajo de la frase se SANITIZAN: sólo pasan los
 * valores declarados de las dimensiones declaradas. Mismo criterio que con
 * `variant_id` — el modelo no puede inventar filtros.
 */
async function runGuidedStart(args: Record<string, unknown>, ctx: NativeToolContext): Promise<string> {
  const phone = str(ctx.waPhone);
  if (!phone) return 'Error: no hay conversación de WhatsApp asociada.';
  if (ctx.sentUserMessage) {
    return 'Ya le enviaste un mensaje al cliente en este turno: NO arranques también el asesor. Terminá el turno.';
  }
  const seed = sanitizeExtractedFilters(args);
  const started = await startAdvisor(
    ctx.container,
    svc(ctx),
    phone,
    ctx.waSessionId ?? null,
    seed,
    ctx.waSiteId ?? null,
  ).catch(() => false);

  if (!started) {
    return 'No pude arrancar el asesor guiado. Preguntale al cliente qué producto busca y usá wa_search_products.';
  }
  ctx.sentUserMessage = true;
  const applied = Object.entries(seed)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return `Arranqué el asesor guiado${applied ? ` con ${applied} ya resuelto` : ''}. YA le hablé al cliente (pregunta con botones o productos). NO respondas nada más: los próximos taps los maneja el sistema.`;
}

/**
 * Dispatcher de las tools de WhatsApp. Devuelve el texto del resultado, o
 * `undefined` si `name` no es una tool de este set (para que el switch principal
 * siga con las demás).
 */
export async function runWhatsappNativeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string | undefined> {
  switch (name) {
    case NATIVE_TOOL.waSearchProducts:
      return runSearch(args, ctx);
    case NATIVE_TOOL.waAddToCart:
      return runAdd(args, ctx);
    case NATIVE_TOOL.waViewCart:
      return runView(args, ctx);
    case NATIVE_TOOL.waRemoveFromCart:
      return runRemove(args, ctx);
    case NATIVE_TOOL.waCheckoutLink:
      return runCheckoutLink(args, ctx);
    case NATIVE_TOOL.waHandoffToHuman:
      return runHandoff(args, ctx);
    case NATIVE_TOOL.waStartReturn:
      return runStartReturn(args, ctx);
    case NATIVE_TOOL.waRequestReturn:
      return runRequestReturn(args, ctx);
    case NATIVE_TOOL.waProductDetail:
      return runProductDetail(args, ctx);
    case NATIVE_TOOL.waAskButtons:
      return runAskButtons(args, ctx);
    case NATIVE_TOOL.waReviewOrder:
      return runReviewOrder(args, ctx);
    case NATIVE_TOOL.waSetQuantity:
      return runSetQuantity(args, ctx);
    case NATIVE_TOOL.waClearCart:
      return runClearCart(args, ctx);
    case NATIVE_TOOL.waListPresentations:
      return runListPresentations(args, ctx);
    case NATIVE_TOOL.waListPinned:
      return runListPinned(args, ctx);
    case NATIVE_TOOL.waGuidedStart:
      return runGuidedStart(args, ctx);
    default:
      return undefined;
  }
}
