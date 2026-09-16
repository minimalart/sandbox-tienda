import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { verifyKapsoSignature } from '../../../lib/whatsapp/verify-kapso-signature';
import { getKapsoSettings } from '../../../modules/kapso-whatsapp/settings';
import {
  KapsoInboundSchema,
  getKapsoInboundMessage,
  getInboundText,
  getInboundSelection,
} from '../../../lib/whatsapp/kapso-inbound';
import { resolveWaCustomer } from '../../../lib/whatsapp/resolve-customer';
import {
  getWaOrderStatus,
  formatOrderStatusForPrompt,
} from '../../../lib/whatsapp/order-status';
import { sendWhatsappText, sendWhatsappTyping } from '../../../lib/whatsapp/send-whatsapp-text';
import { trackWaEvent } from '../../../lib/whatsapp/events';
import { runFlowTurn } from '../../../lib/whatsapp/flow/runtime';
import { routeInbound, sendMainMenu } from '../../../lib/whatsapp/router';
import { AI_ASSISTANT_MODULE } from '../../../modules/ai-assistant';
import {
  runWhatsappTurn,
  memoryOptionsFromConfig,
  type AiStore,
  type MemoryRuntimeOptions,
} from '../../../modules/ai-assistant/ai/agent';
import { WHATSAPP_AGENT_MODULE } from '../../../modules/whatsapp-agent';
import type WhatsappAgentModuleService from '../../../modules/whatsapp-agent/service';
import { STORE_CONFIG_MODULE } from '../../../modules/store-config';
import type StoreConfigModuleService from '../../../modules/store-config/service';

const WHATSAPP_AGENT_KEY = 'whatsapp';
/** Cuántos pedidos recientes se resumen en el contexto del agente. */
const MAX_ORDERS_IN_CONTEXT = 3;

/**
 * Dedup de mensajes entrantes por `wamid` (defensa contra reintentos/entregas dobles
 * de Kapso: un solo servicio web, así que un Set en memoria alcanza). Evita procesar
 * dos veces el mismo mensaje (que agregaría el ítem por duplicado). Acotado en tamaño.
 */
const processedMessageIds = new Set<string>();
const PROCESSED_IDS_MAX = 500;
function alreadyProcessed(messageId?: string): boolean {
  if (!messageId) return false;
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.add(messageId);
  if (processedMessageIds.size > PROCESSED_IDS_MAX) {
    // Evict del más viejo (orden de inserción del Set).
    const oldest = processedMessageIds.values().next().value;
    if (oldest) processedMessageIds.delete(oldest);
  }
  return false;
}

/**
 * Verificación del webhook (challenge estilo Meta). Kapso/Meta hace un GET con
 * `hub.mode=subscribe` + `hub.verify_token`; devolvemos el `hub.challenge` en texto
 * plano si el token coincide con el configurado (Admin → WhatsApp → Ajustes, con
 * fallback a `KAPSO_WEBHOOK_VERIFY_TOKEN`).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = req.query as Record<string, string | undefined>;
  const mode = q['hub.mode'];
  const token = q['hub.verify_token'];
  const challenge = q['hub.challenge'];
  const expected = getKapsoSettings().webhookVerifyToken;
  if (mode === 'subscribe' && expected && token === expected) {
    res.status(200).send(challenge ?? '');
    return;
  }
  res.status(403).send('Forbidden');
};

/**
 * Recepción de mensajes entrantes de WhatsApp (evento `whatsapp.message.received`
 * de Kapso). Verifica la firma HMAC, resuelve el cliente por teléfono, arma el
 * estado de sus pedidos y responde con el agente `whatsapp` (solo lectura).
 *
 * SIEMPRE responde 200 rápido (para que Kapso no reintente) y procesa la respuesta
 * de forma asíncrona: generar la contestación con el LLM tarda unos segundos.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  // Body crudo para la verificación de firma. Lo preserva `middlewares.ts` de esta
  // misma carpeta (`bodyParser.preserveRawBody`); Medusa NO lo hace por defecto.
  const rawBodyRaw = (req as unknown as { rawBody?: Buffer | string }).rawBody;
  const rawBody =
    typeof rawBodyRaw === 'string'
      ? rawBodyRaw
      : rawBodyRaw
        ? Buffer.from(rawBodyRaw).toString('utf8')
        : null;
  const signature =
    (req.headers['x-webhook-signature'] as string | undefined) ??
    (req.headers['x-kapso-signature'] as string | undefined);

  const secret = getKapsoSettings().webhookSecret;
  if (secret) {
    // Sin body crudo NO se puede verificar: re-serializar `req.body` no coincide
    // byte a byte con lo que firmó Kapso, así que compararlo daría "firma
    // inválida" para TODO el tráfico legítimo. Se rechaza igual (fail-closed),
    // pero con un error que dice la causa real en vez de culpar a Kapso.
    if (rawBody === null) {
      logger.error(
        '[WhatsApp bot] No hay body crudo (req.rawBody) y el secreto de firma está configurado: ' +
          'falta el bodyParser.preserveRawBody de api/webhooks/kapso/middlewares.ts. ' +
          'Se descarta el evento.',
      );
      res.status(200).json({ ignored: 'missing_raw_body' });
      return;
    }
    if (!verifyKapsoSignature(rawBody, signature, secret)) {
      logger.warn('[WhatsApp bot] Firma de webhook inválida — se ignora el evento.');
      res.status(200).json({ ignored: 'invalid_signature' });
      return;
    }
  }

  // Parseo tolerante: si no es un mensaje de texto que entendamos, 200 y a otra cosa.
  const parsed = KapsoInboundSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(200).json({ ignored: 'unsupported_event' });
    return;
  }
  const message = getKapsoInboundMessage(parsed.data);
  const from = message.from;
  const text = getInboundText(message);
  const selection = getInboundSelection(message);
  // El input del agente: el texto del cliente, o —si tocó una fila de la lista
  // interactiva— una instrucción con la variante elegida (id = variant_id).
  let userMessage: string | null = text;
  if (!userMessage && selection) {
    if (selection.id.startsWith('ret:')) {
      // Selección de un ítem a DEVOLVER: id = ret:<order_id>:<line_item_id>.
      const [, orderId, lineItemId] = selection.id.split(':');
      userMessage = `El cliente eligió devolver "${selection.title ?? ''}" (order_id: ${orderId}, line_item_id: ${lineItemId}). Preguntá el motivo y la cantidad, confirmá, y creá la devolución con wa_request_return.`;
    } else if (selection.id.startsWith('act:')) {
      // Botón de CONTROL (wa_ask_buttons / tools de compra): id = act:<action>.
      // NUNCA es un producto, así que no dispara add-to-cart.
      //
      // Estos hints son la RED DE SEGURIDAD: casi todas las acciones las resuelve
      // el router determinístico (lib/whatsapp/router.ts) sin llamar al modelo, y
      // sólo llegan acá `help` —que es asesoramiento y le toca al agente— y las
      // acciones desconocidas (botones de una conversación vieja).
      const action = selection.id.slice('act:'.length);
      const hints: Record<string, string> = {
        help:
          'Pidió ayuda para elegir: preguntá qué necesita pintar o para qué es, y respondé con la base de conocimiento. Si podés convertirlo en una búsqueda concreta, ofrecé ver productos con botones.',
        close:
          'Quiere cerrar la compra: llamá wa_review_order para mostrarle el detalle del pedido y los botones de confirmación. NO resumas vos en texto.',
        confirm_pay:
          'Confirmó el pedido: generá el link con wa_checkout_link y enviáselo. Después NO ofrezcas opciones numeradas.',
        change:
          'Quiere cambiar el pedido: preguntá qué querés sacar o agregar (podés usar wa_view_cart, wa_set_quantity y wa_remove_from_cart).',
        more: 'Quiere agregar algo más: preguntá qué producto busca (después usás wa_search_products).',
        // Botones del menú de bienvenida:
        search: 'Quiere buscar un producto: preguntale qué está buscando (después usás wa_search_products).',
        orders:
          'Quiere ver el estado de su pedido: respondé con los datos verificados que te pasa el sistema (o pedí el número de pedido si no hay).',
        returns:
          'Quiere hacer un cambio/devolución: si es devolución, llamá wa_start_return; si es otra cosa, preguntá el detalle y derivá si hace falta.',
      };
      const hint =
        hints[action] ??
        'Interpretá su intención según lo último que le preguntaste. NO agregues productos salvo que sea exactamente lo que pidió.';
      userMessage = `El cliente tocó el botón "${selection.title ?? action}" (acción: ${action}). ${hint}`;
    } else if (selection.id.startsWith('variant_')) {
      // Selección de un producto de la lista interactiva (id = variant_id de Medusa v2).
      userMessage = `El cliente TOCÓ esta opción de la lista: "${selection.title ?? ''}" (variant_id: ${selection.id}). Es exactamente el producto que quiere: agregalo con wa_add_to_cart usando ESE variant_id. Si en su mensaje reciente indicó una cantidad para esto (ej. "3 galletitas", "dos de la Amanda"), pasá esa cantidad en quantity; si no mencionó cantidad, 1. IMPORTANTE: en este turno hacé UNA sola cosa: agregar. NO llames wa_search_products ni mandes otra lista ni otra pregunta; wa_add_to_cart ya le confirma y le ofrece los botones.`;
    } else {
      // Selección desconocida: interpretá sin asumir compra.
      userMessage = `El cliente eligió: "${selection.title ?? selection.id}". Interpretá su intención; NO agregues productos salvo que lo pida explícitamente.`;
    }
  }
  if (!from || !userMessage) {
    res.status(200).json({ ignored: 'no_text' });
    return;
  }

  // Dedup: si ya procesamos este wamid (reintento/entrega doble), no lo repitamos.
  if (alreadyProcessed(message.id)) {
    res.status(200).json({ duplicate: true });
    return;
  }

  // ¿El turno es una SELECCIÓN de producto de la lista? Solo entonces se puede
  // agregar al carrito (ver runAdd). Un botón de control o un texto NO agregan.
  const isVariantSelection = Boolean(selection && selection.id.startsWith('variant_'));

  // Ack inmediato; el trabajo pesado (LLM + envío) sigue en segundo plano.
  res.status(200).json({ ok: true });

  /**
   * `?site=` en la URL del webhook: cada tienda apunta su cuenta de Kapso a la suya.
   *
   * Es el único lugar de donde puede salir — el payload de Kapso trae el teléfono del
   * CLIENTE, no el número al que escribió. Mismo patrón que el `notification_url` de
   * MercadoPago, que el repo ya arma con `?sc=`.
   *
   * Ausente = la cuenta todavía apunta a la URL sin parámetro: los eventos quedan sin
   * tienda y el tablero los muestra en todas. De más, nunca de menos.
   */
  const inboundSiteId =
    typeof (req.query as Record<string, unknown>).site === 'string'
      ? ((req.query as Record<string, string>).site || null)
      : null;

  void handleInbound(req, {
    siteId: inboundSiteId,
    from,
    // Instrucción sintética para el agente (incluye los hints de selección).
    agentMessage: userMessage,
    // Texto CRUDO del cliente: es lo que mira el router determinístico. `null`
    // cuando el turno vino de un tap.
    rawText: text,
    messageId: message.id,
    isVariantSelection,
    selectionId: selection?.id,
  }).catch((err) => {
    logger.error(
      `[WhatsApp bot] Falló el procesamiento del mensaje de ${from}: ${(err as Error).message}`,
    );
  });
};

/**
 * Resuelve al cliente, arma el contexto de sus pedidos, corre el agente y envía la
 * respuesta. Best-effort: cualquier error se loguea, nunca se propaga al webhook.
 */
type InboundTurn = {
  from: string;
  /**
   * La tienda que recibió el mensaje, tomada de `?site=` en la URL del webhook.
   *
   * Va acá y no se re-lee de `req` en cada `trackWaEvent` porque el turno se procesa
   * de forma asíncrona: para cuando se registran los eventos del final, la request ya
   * no está.
   */
  siteId?: string | null;
  /** Mensaje que ve el agente (con los hints de selección ya inyectados). */
  agentMessage: string;
  /** Texto crudo del cliente; `null` si el turno vino de un tap. */
  rawText: string | null;
  messageId?: string;
  isVariantSelection?: boolean;
  selectionId?: string;
};

async function handleInbound(req: MedusaRequest, turn: InboundTurn): Promise<void> {
  const {
    from,
    agentMessage: text,
    rawText,
    messageId,
    isVariantSelection = false,
    selectionId,
  } = turn;
  const container = req.scope;
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const store = container.resolve<AiStore>(AI_ASSISTANT_MODULE);
  // El módulo de estado es opcional: si no está registrado, el bot sigue
  // funcionando sin historial ni borrador (las tools de compra avisan que no
  // está disponible). Así el webhook no depende de que el módulo esté activo.
  let waSvc: WhatsappAgentModuleService | null = null;
  try {
    waSvc = container.resolve<WhatsappAgentModuleService>(WHATSAPP_AGENT_MODULE);
  } catch {
    waSvc = null;
  }

  const siteId = turn.siteId ?? null;

  // La sesión se resuelve ACÁ, antes del primer evento, y no dentro del router.
  //
  // Antes el `inbound` se escribía sin `session_id`, así que `sessionKeyOf` del
  // analytics lo agrupaba bajo una clave `legacy:phone:fecha` distinta de la que
  // usaban los eventos comerciales: cada conversación se partía en DOS sesiones que
  // no se cruzaban y los `percent_of_total` del embudo comparaban poblaciones
  // disjuntas. `legacy_sessions` no era tráfico viejo, era todo el tráfico.
  //
  // `getSession` además renueva la sesión vencida (12 h). Llamarlo también en el
  // camino pausado es deliberado: cuando la conversación vuelva al bot, arranca con
  // una sesión fresca en vez de arrastrar la de antes del handoff.
  //
  // Sí, `routeInbound` la vuelve a pedir: necesita la sesión ENTERA (`step`,
  // `intent`, `answers`), no sólo el id, y para cuando llega ya está renovada, así
  // que la segunda lectura no reescribe nada. Un SELECT de más por turno es más
  // barato que enhebrar el objeto por las seis firmas que hoy no lo reciben.
  let sessionId: string | null = null;
  if (waSvc) {
    try {
      sessionId = (await waSvc.getSession(from)).session_id;
    } catch {
      sessionId = null;
    }
  }

  // Handoff: si un humano está atendiendo esta conversación, el bot NO responde
  // (evalúa auto-resume por inactividad adentro). Igual persiste el mensaje entrante.
  if (waSvc && (await waSvc.isPaused(from))) {
    logger.info(
      `[WhatsApp bot] ${from} en ATENCIÓN MANUAL — el turno no se atiende (el silencio es a propósito; se devuelve al bot desde Admin → WhatsApp → Asesor).`,
    );
    // Sin este evento la pausa es el ÚNICO camino que no deja rastro: ni un `inbound`
    // en el embudo. Un bot pausado y un bot roto se veían exactamente igual.
    trackWaEvent(container, {
      siteId,
      sessionId,
      phone: from,
      type: 'paused_drop',
      payload: { kind: selectionId ? 'selection' : 'text', text: text.slice(0, 120) },
    });
    try {
      await waSvc.appendInbound(from, text);
    } catch {
      /* noop */
    }
    return;
  }

  // Primer evento del embudo: todo mensaje entrante que el bot va a atender.
  // `kind` separa el recorrido interactivo (botón/lista) del texto libre, que es
  // el que obliga a gastar modelo.
  trackWaEvent(container, {
    siteId,
    sessionId,
    phone: from,
    type: 'inbound',
    payload: {
      kind: isVariantSelection ? 'variant' : selectionId ? 'selection' : 'text',
      selection_id: selectionId ?? null,
    },
  });
  // `product_selected` lo emite el router, que además conoce la cantidad pedida y
  // el id de sesión.

  // Efecto "escribiendo…" en el chat del cliente mientras el bot prepara la
  // respuesta (el LLM tarda unos segundos). Best-effort, no bloquea.
  if (messageId) void sendWhatsappTyping(messageId).catch(() => {});

  // Si la conversación estuvo inactiva mucho tiempo, descartar el borrador viejo
  // (evita arrastrar ítems de una sesión anterior / de pruebas → "producto fantasma").
  if (waSvc) {
    try {
      await waSvc.resetDraftIfStale(from);
    } catch {
      /* noop */
    }
  }

  // Estado conversacional (historial + borrador de carrito) por teléfono.
  const history = waSvc ? await waSvc.getHistory(from) : [];

  // ── Router determinístico (PRD §23-24) ──────────────────────────────────────
  // Antes de gastar una llamada al modelo: si el turno es un tap de botón, una
  // selección de la lista o un texto con intención reconocible, se resuelve acá y
  // el LLM no se llama. Antes TODO turno pasaba por el modelo, incluso los taps
  // (se traducían a un hint en lenguaje natural para que llamara la tool correcta).
  // ── Grafo configurable ──────────────────────────────────────────────────────
  // Va ANTES del router determinístico: es el que va a absorberlo. Mientras no
  // haya un grafo publicado, `runFlowTurn` devuelve `handled: false` sin tocar
  // nada y todo sigue exactamente como antes — publicar es lo único que cambia el
  // comportamiento, y despublicar lo devuelve.
  try {
    const flowed = await runFlowTurn({
      container,
      waSvc,
      phone: from,
      sessionId,
      siteId,
      text: rawText,
      selectionId: selectionId ?? null,
    });
    if (flowed.handled) {
      if (waSvc) {
        try {
          await waSvc.appendTurn(from, rawText ?? text, '(respondido por el grafo)');
        } catch {
          /* noop */
        }
      }
      return;
    }
    // El grafo activo está marcado como EXCLUSIVO: atiende todo, así que no se cae
    // al router ni al modelo. Que no haya resuelto el turno significa que el grafo
    // tiene un hueco, y la respuesta es el menú —nunca el silencio—.
    //
    // Es el apagado del LLM, y vive en la versión del grafo en vez de en un ajuste:
    // volver atrás es publicar la versión anterior, sin tocar configuración ni
    // deployar.
    if (flowed.exclusive) {
      logger.warn(
        `[WhatsApp bot] El grafo exclusivo no resolvió el turno de ${from}: se responde con el menú.`,
      );
      trackWaEvent(container, {
        siteId,
        sessionId,
        phone: from,
        type: 'error',
        payload: { where: 'flow_exclusive_gap' },
      });
      await sendMainMenu(from);
      if (waSvc) {
        try {
          await waSvc.appendTurn(from, rawText ?? text, '(el grafo no resolvió: se ofreció el menú)');
        } catch {
          /* noop */
        }
      }
      return;
    }
  } catch (err) {
    // Mismo criterio que el router: el grafo NUNCA puede voltear un turno de
    // venta. Si falla, se sigue con el camino de siempre.
    logger.warn(`[WhatsApp bot] El grafo falló para ${from}: ${(err as Error).message}`);
  }

  try {
    const routed = await routeInbound({
      container,
      waSvc,
      phone: from,
      text: rawText,
      selectionId: selectionId ?? null,
      hasHistory: history.length > 0,
      siteId,
    });
    if (routed.handled) {
      if (waSvc) {
        try {
          await waSvc.appendTurn(from, rawText ?? text, '(respondido sin IA por el router)');
        } catch {
          /* noop */
        }
      }
      return;
    }
  } catch (err) {
    // El router nunca puede voltear el turno: si falla, sigue el agente.
    logger.warn(`[WhatsApp bot] El router falló para ${from}: ${(err as Error).message}`);
  }

  // Config de memoria (RAG de FAQ/knowledge). Sin store-config → sin RAG.
  let memory: MemoryRuntimeOptions | undefined;
  try {
    const storeConfig = container.resolve<StoreConfigModuleService>(STORE_CONFIG_MODULE);
    memory = memoryOptionsFromConfig(await storeConfig.getAiConfig());
  } catch {
    memory = undefined;
  }

  // Contexto: datos YA verificados y scoped al teléfono del remitente.
  let context: string | undefined;
  const customer = await resolveWaCustomer(container, from);
  if (customer) {
    // Cachear identidad para prefijar el checkout link (Fase 2).
    if (waSvc) await waSvc.setIdentity(from, { customer_id: customer.id, email: customer.email });
    const recent = customer.orders.slice(0, MAX_ORDERS_IN_CONTEXT);
    const blocks: string[] = [`Cliente: ${customer.name || '(sin nombre)'}`];
    if (customer.email) blocks.push(`Email: ${customer.email}`);
    if (recent.length === 0) {
      blocks.push('El cliente no tiene pedidos registrados.');
    } else {
      for (const o of recent) {
        const status = await getWaOrderStatus(container, o.id);
        blocks.push(status ? formatOrderStatusForPrompt(status) : `Pedido #${o.display_id ?? '—'}: sin datos.`);
      }
      if (customer.orders.length > recent.length) {
        blocks.push(`(y ${customer.orders.length - recent.length} pedido/s más antiguos)`);
      }
      trackWaEvent(container, {
        siteId,
        sessionId,
        phone: from,
        type: 'order_status',
        payload: { orders: recent.length, identified: true },
      });
    }
    context = blocks.join('\n\n');
  } else {
    logger.info(`[WhatsApp bot] Teléfono ${from} sin cliente asociado — se pide verificación.`);
  }

  // Contexto de tools nativas. Se mantiene la referencia para leer, tras el turno,
  // si alguna tool ya le envió un mensaje al cliente (lista/botones/imagen).
  // `waUsedAi: true` porque acá el turno lo resuelve el LLM: las tools que emitan
  // eventos del embudo quedan marcadas como "gastó modelo". El router
  // determinístico (que resuelve los botones sin LLM) pasa `false`.
  //
  // `waSessionId`/`waSiteId` no estaban: todo evento comercial resuelto por el
  // modelo (search, added_to_cart, checkout_generated…) se escribía huérfano, y el
  // embudo sólo veía los que pasaban por el router.
  const nativeCtx = {
    container,
    store,
    waPhone: from,
    isVariantSelection,
    waUsedAi: true,
    waSessionId: sessionId,
    waSiteId: siteId,
  } as {
    container: typeof container;
    store: typeof store;
    waPhone: string;
    isVariantSelection?: boolean;
    sentUserMessage?: boolean;
    waUsedAi?: boolean;
    waSessionId?: string | null;
    waSiteId?: string | null;
  };

  let reply: string;
  try {
    reply = await runWhatsappTurn({
      store,
      agentKey: WHATSAPP_AGENT_KEY,
      message: text,
      context,
      history,
      nativeCtx,
      memory,
    });
  } catch (err) {
    logger.error(`[WhatsApp bot] El agente falló para ${from}: ${(err as Error).message}`);
    trackWaEvent(container, {
      siteId,
      sessionId,
      phone: from,
      type: 'error',
      payload: { message: (err as Error).message },
      usedAi: true,
    });
    reply =
      'Perdón, tuve un problema para responderte en este momento. Probá de nuevo en un rato y, si seguís con la duda, te contacta una persona del equipo. 🙏';
  }

  const trimmed = (reply ?? '').trim();

  // Si una tool YA le habló al cliente (mandó lista/botones/imagen con su próximo
  // paso), NO mandamos además el texto del modelo: sería un mensaje duplicado. Igual
  // persistimos el turno para dar continuidad al historial.
  if (nativeCtx.sentUserMessage) {
    if (waSvc) {
      try {
        await waSvc.appendTurn(from, text, trimmed || '(respondí con un mensaje interactivo)');
      } catch {
        /* noop */
      }
    }
    return;
  }

  // El modelo no devolvió texto y ninguna tool le habló al cliente. Esto NO puede
  // terminar en un `return` mudo: el cliente escribe y no pasa absolutamente nada,
  // sin rastro en el embudo ni en los logs. Pasó en producción el 2026-08-04 — un
  // "Hola" a mitad de un recorrido guiado cayó al modelo, el modelo devolvió vacío
  // y la conversación quedó muerta. Un bot que se calla es peor que uno que se
  // equivoca: el cliente no sabe si insistir o irse.
  if (!trimmed) {
    logger.error(`[WhatsApp bot] El agente no devolvió texto para ${from}: se responde con el menú.`);
    trackWaEvent(container, {
      siteId,
      sessionId,
      phone: from,
      type: 'error',
      payload: { where: 'empty_reply', message: 'el agente no devolvió texto' },
      usedAi: true,
    });
    await sendMainMenu(from);
    if (waSvc) {
      try {
        await waSvc.appendTurn(from, text, '(el agente no respondió: se ofreció el menú)');
      } catch {
        /* noop */
      }
    }
    return;
  }

  const sent = await sendWhatsappText(from, trimmed);
  logger.info(`[WhatsApp bot] Respuesta enviada a ${from} (id ${sent?.id ?? 'log-only'}).`);

  // Persistir el turno para dar continuidad multi-turno.
  if (waSvc) {
    try {
      await waSvc.appendTurn(from, text, trimmed);
    } catch (err) {
      logger.warn(`[WhatsApp bot] No se pudo persistir el turno de ${from}: ${(err as Error).message}`);
    }
  }
}
