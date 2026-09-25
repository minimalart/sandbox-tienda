import type { MedusaContainer } from '@medusajs/framework/types';
import { getKapsoSettings } from '../../modules/kapso-whatsapp/settings';
import { NATIVE_TOOL } from '../../modules/ai-assistant/ai/native-tools/names';
import { runWhatsappNativeTool } from '../../modules/ai-assistant/ai/native-tools/whatsapp-tools';
import type WhatsappAgentModuleService from '../../modules/whatsapp-agent/service';
import type { WaEventType } from '../../modules/whatsapp-agent/event-log/types';
import { sendWhatsappButtons, sendWhatsappText } from './send-whatsapp-text';
import { trackWaEvent } from './events';
import { getWaStoreLocations, formatStoreLocationsMessage } from './store-locations';
import {
  formatCustomerOrders,
  formatOrderStatusForCustomer,
  lookupOrderByDisplayIdAndEmail,
  ORDER_NOT_FOUND_MESSAGE,
  parseEmail,
  parseOrderDisplayId,
} from './order-lookup';
import { resolveWaCustomer } from './resolve-customer';
import { advanceAdvisor, answerAdvisor, parseAdvisorButtonId, startAdvisor } from './advisor/flow';
import type { AdvisorAnswers } from './advisor/filters';

/**
 * Router DETERMINÍSTICO del bot de WhatsApp (PRD §23-24).
 *
 * Se ejecuta ANTES del agente: si resuelve el turno, el LLM no se llama. Es el
 * requisito §30.19 — "el recorrido mediante botones puede completarse sin usar
 * IA" — y antes no se cumplía: cada tap de botón se traducía a un *hint* en
 * lenguaje natural ("Quiere cerrar la compra: llamá wa_review_order…") y se le
 * pedía al modelo que llamara la tool correcta. Costaba una llamada por tap, y el
 * modelo desobedecía lo suficiente como para necesitar cinco rondas de guardrails
 * (#541 a #551).
 *
 * Las tools NO se reimplementan: se invocan las mismas `runWhatsappNativeTool`
 * que usa el agente, que ya mandan sus propios mensajes y marcan
 * `ctx.sentUserMessage`. El router sólo decide CUÁL corresponde.
 *
 * Lo que deliberadamente NO resuelve (y por eso cae al agente): texto libre sin
 * intención reconocible, asesoramiento (§19, que es el trabajo del LLM con la base
 * de conocimiento) y las devoluciones, que necesitan conversar motivo y cantidad.
 */

type AnyRecord = Record<string, any>;

export type RouterInput = {
  container: MedusaContainer;
  waSvc: WhatsappAgentModuleService | null;
  phone: string;
  /** Texto del cliente (null si el turno vino de un tap). */
  text: string | null;
  /** Id de la fila/botón tocado (`act:…`, `variant_…`, `ret:…`). */
  selectionId: string | null;
  /** ¿Hay historial previo? Define si el saludo abre el menú. */
  hasHistory: boolean;
  /**
   * Tienda que recibió el mensaje (`?site=` del webhook). Sin esto los eventos del
   * router quedan sin `site_id` y el embudo por tienda mezcla todo.
   */
  siteId?: string | null;
};

/** `true` = el turno quedó resuelto sin IA; `false` = seguí con el agente. */
export type RouterResult = { handled: boolean };

const HANDLED: RouterResult = { handled: true };
const NOT_HANDLED: RouterResult = { handled: false };

// ─── Reconocimiento de texto libre ────────────────────────────────────────────

const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const GREETING_RE =
  /^\s*(hola|holis|buenas|buen dia|buenas tardes|buenas noches|hey|que tal|buenos dias)\b/;
/** Ojo: nada de "otra cosa" suelto — "quiero otra cosa de pintura" no es un reset. */
const RESET_RE =
  /(empezar de nuevo|empezar de cero|arrancar de nuevo|cambiar (la )?busqueda|busco otra cosa|reiniciar|volver al menu|menu principal)/;
const LOCATIONS_RE =
  /(sucursal|sucursales|donde estan|donde queda|direccion|como llego|horario|horarios|a que hora|abren|cierran)/;
const ORDERS_RE =
  /(mi pedido|mis pedidos|estado de mi|donde esta mi pedido|seguimiento|tracking|mi compra|mi orden)/;
const HUMAN_RE =
  /(hablar con (alguien|una persona|un humano|un asesor|un vendedor)|atencion humana|con una persona|con un humano)/;
const CART_RE = /(ver (mi )?(pedido|carrito)|que tengo en el (pedido|carrito)|mi carrito)/;
/**
 * Las dos primeras opciones del menú, ESCRITAS. Existen porque el menú también se
 * manda como texto cuando los botones fallan, y un menú que no se puede contestar
 * es un callejón sin salida. Anclados de punta a punta a propósito: "comprar
 * pintura para el techo" es una búsqueda, no un tap en "Comprar productos".
 */
const MENU_BUY_RE = /^(comprar( productos?)?|quiero comprar)$/;
const MENU_HELP_RE = /^(necesito ayuda|ayuda|asesorame|asesoramiento|no se que necesito)$/;

/**
 * ¿La sesión acaba de arrancar? Es lo que define si un saludo abre el menú.
 *
 * Una sesión nueva no tiene intención ni respuestas: `getSession` la crea así
 * cuando venció por inactividad. Con eso, el cliente que vuelve al otro día ve el
 * menú, y el que está a mitad de una compra no se lo come de nuevo.
 */
function isFreshSession(session: { intent?: unknown; step?: unknown; answers?: Record<string, string> }): boolean {
  return !session.intent && !session.step && Object.keys(session.answers ?? {}).length === 0;
}

/** ¿El texto es un saludo? (expuesto para poder testear la decisión). */
export const isGreeting = (folded: string): boolean => GREETING_RE.test(folded);

/**
 * ¿El texto libre que NO se reconoció abre el menú, o cae al agente?
 *
 * Expuesto —como `planGreeting`— porque es una DECISIÓN y no I/O: es la puerta de
 * entrada del bot, y lo único que la separa del bug es esta condición.
 *
 * Ver el recuadro del descriptor `WHATSAPP_GUIDED_ENTRY`: con la compuerta
 * encendida, el primer mensaje de una sesión nueva ve el menú documentado en vez
 * de abrir una conversación libre que no está en ningún árbol.
 */
export function opensMenuOnFreeText(
  session: { intent?: unknown; step?: unknown; answers?: Record<string, string> },
  guidedEntry: boolean,
): boolean {
  return guidedEntry && isFreshSession(session);
}

export type GreetingPlan = 'menu' | 'resume_guided';

/**
 * Qué hacer con un saludo. Un saludo NUNCA cae al modelo (§8, §23).
 *
 * El gate anterior era sólo `isFreshSession`: si la sesión estaba en curso, el
 * "Hola" caía al agente, y el 2026-08-04 el agente devolvió vacío y el cliente no
 * recibió NADA. La sesión dura 12 h (`WA_SESSION_IDLE_HOURS`), así que "en curso"
 * es lo NORMAL: cualquiera que saluda de nuevo el mismo día entra por acá.
 *
 * Con una sesión viva no se pisa lo ya respondido — se retoma la pregunta
 * pendiente. Para arrancar de cero están las frases de reset (§25), que se
 * evalúan antes.
 *
 * Se retoma SÓLO si hay una pregunta pendiente (`pending_dimension`). Si el
 * recorrido ya terminó —mostró productos, o murió en "no encontré nada" y dejó
 * `step: null`— un saludo abre el MENÚ: rehacer una búsqueda que ya dio cero es un
 * callejón sin salida, y contestarle "no encontré productos" a quien dice "Hola"
 * se lee como que el bot sigue roto. Caso real del 2026-08-04.
 */
export function planGreeting(session: {
  intent?: unknown;
  step?: unknown;
  answers?: Record<string, string>;
  pending_dimension?: unknown;
}): GreetingPlan {
  if (isFreshSession(session)) return 'menu';
  return session.intent === 'guided' && session.pending_dimension ? 'resume_guided' : 'menu';
}

/** Cantidad al principio del texto ("3 latas de látex" → 3). */
export function parseLeadingQuantity(text: string): number | null {
  const match = /^\s*(\d{1,2})\s*(x\s*)?[a-záéíóúñ]/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value >= 1 && value <= 99 ? value : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Ctx = {
  input: RouterInput;
  svc: WhatsappAgentModuleService;
  sessionId: string;
  track: (type: WaEventType, payload?: AnyRecord) => void;
};

/**
 * Contexto para invocar una tool. `waUsedAi: false` es lo que hace que los eventos
 * del embudo queden marcados como recorrido sin modelo (criterio §30.19).
 */
function toolCtx(ctx: Ctx, overrides: AnyRecord = {}): AnyRecord {
  return {
    container: ctx.input.container,
    waPhone: ctx.input.phone,
    waUsedAi: false,
    waSessionId: ctx.sessionId,
    waSiteId: ctx.input.siteId ?? null,
    ...overrides,
  };
}

const callTool = (name: string, args: AnyRecord, toolContext: AnyRecord): Promise<string | undefined> =>
  runWhatsappNativeTool(name, args, toolContext as never);

const send = (phone: string, body: string): Promise<boolean> =>
  sendWhatsappText(phone, body)
    .then((r) => Boolean(r))
    .catch(() => false);

const result = (sent: boolean): RouterResult => (sent ? HANDLED : NOT_HANDLED);

// ─── Mensajes del recorrido ───────────────────────────────────────────────────

const MAIN_MENU_BODY = '¡Hola! 👋 ¿En qué puedo ayudarte?';

/**
 * El mismo menú en texto, para cuando los botones no se pueden enviar. Las tres
 * opciones se escriben tal cual porque el router las reconoce escritas
 * (`MENU_BUY_RE` / `MENU_HELP_RE`): sin eso, el menú en texto sería un callejón
 * sin salida.
 */
const MAIN_MENU_AS_TEXT = [
  MAIN_MENU_BODY,
  '',
  'Escribime una de estas opciones:',
  '• *Comprar productos*',
  '• *Necesito ayuda* (te hago unas preguntas y te recomiendo)',
  '• *Mi pedido*',
].join('\n');

/**
 * Menú inicial (§8). Son las tres opciones del PRD: WhatsApp admite sólo 3
 * botones, así que sucursales y el resto se ofrecen dentro de cada recorrido o por
 * texto libre (que el router también reconoce).
 */
export async function sendMainMenu(phone: string): Promise<boolean> {
  const sent = await sendWhatsappButtons({
    to: phone,
    body: MAIN_MENU_BODY,
    buttons: [
      { id: 'act:buy', title: 'Comprar productos' },
      { id: 'act:help', title: 'Necesito ayuda' },
      { id: 'act:orders', title: 'Mi pedido' },
    ],
  }).catch(() => null);
  if (sent) return true;
  // Si los botones no salen (Kapso rechaza el interactivo, 5xx transitorio), el
  // menú se manda como TEXTO. Antes se devolvía `false` y el turno caía al modelo:
  // un fallo de envío terminaba en silencio, que es la peor salida posible.
  return Boolean(await sendWhatsappText(phone, MAIN_MENU_AS_TEXT).catch(() => null));
}

/** §9.1 — antes de buscar, se pregunta si ya sabe qué quiere. */
async function sendKnowsProductQuestion(phone: string): Promise<boolean> {
  const sent = await sendWhatsappButtons({
    to: phone,
    body: '¿Sabés qué producto estás buscando?',
    buttons: [
      { id: 'act:known_product', title: 'Sí, sé cuál' },
      { id: 'act:help', title: 'Necesito ayuda' },
    ],
  }).catch(() => null);
  return Boolean(sent);
}

const SEARCH_PROMPT = 'Escribime el nombre, la marca o la presentación 👇';

// ─── Router ───────────────────────────────────────────────────────────────────

export async function routeInbound(input: RouterInput): Promise<RouterResult> {
  const { container, waSvc, phone, text, selectionId } = input;

  // Sin el módulo de estado no hay sesión, y sin sesión el recorrido no puede ser
  // determinístico entre turnos: se deja pasar al agente (degradación, no error).
  if (!waSvc) return NOT_HANDLED;

  const session = await waSvc.getSession(phone);
  const ctx: Ctx = {
    input,
    svc: waSvc,
    sessionId: session.session_id,
    track: (type, payload) =>
      trackWaEvent(container, {
        phone,
        type,
        payload: payload ?? null,
        usedAi: false,
        sessionId: session.session_id,
        siteId: input.siteId ?? null,
      }),
  };

  // ── 1. Taps de botón / lista ────────────────────────────────────────────────
  if (selectionId) {
    if (selectionId.startsWith('variant_')) return handleVariantTap(ctx, selectionId);
    if (selectionId.startsWith('act:')) return handleAction(ctx, selectionId.slice('act:'.length));
    // Respuesta a una pregunta del asesor guiado.
    const advisorAnswer = parseAdvisorButtonId(selectionId);
    if (advisorAnswer) {
      const handled = await answerAdvisor(
        container,
        waSvc,
        phone,
        ctx.sessionId,
        advisorAnswer.dimension,
        advisorAnswer.value,
        input.siteId ?? null,
      );
      return handled ? HANDLED : NOT_HANDLED;
    }
    // `ret:` (ítem a devolver) sigue yendo al agente.
    return NOT_HANDLED;
  }

  if (!text) return NOT_HANDLED;
  const folded = fold(text);

  // ── 2. Pasos pendientes ────────────────────────────────────────────────────
  // Van ANTES del reconocimiento de intención: si se pidió el número de pedido, un
  // "1234" es la respuesta, no una búsqueda.
  if (session.step === 'awaiting_order_number') return handleOrderNumber(ctx, text);
  if (session.step === 'awaiting_order_email') {
    return handleOrderEmail(ctx, text, session.pending_order_display_id ?? null);
  }

  // ── 3. Intenciones reconocibles en texto libre ─────────────────────────────
  if (RESET_RE.test(folded)) {
    await waSvc.resetSession(phone);
    ctx.track('menu_shown', { reason: 'reset' });
    return result(await sendMainMenu(phone));
  }
  if (HUMAN_RE.test(folded)) {
    await callTool(
      NATIVE_TOOL.waHandoffToHuman,
      { reason: 'El cliente pidió hablar con una persona.' },
      toolCtx(ctx),
    );
    return HANDLED;
  }
  // Se le pasa el texto ENTERO, no sólo la palabra que matcheó: es de ahí de donde
  // sale la ciudad o la provincia por la que está preguntando.
  if (LOCATIONS_RE.test(folded)) return handleLocations(ctx, text);
  if (ORDERS_RE.test(folded)) return handleOrders(ctx);
  if (CART_RE.test(folded)) {
    await callTool(NATIVE_TOOL.waReviewOrder, {}, toolCtx(ctx));
    return HANDLED;
  }

  // ── 4. Búsqueda pedida explícitamente ──────────────────────────────────────
  if (session.step === 'awaiting_search_query') return handleSearchQuery(ctx, text);

  // ── 5. Opciones del menú escritas a mano ───────────────────────────────────
  // Ancladas a propósito: "comprar" suelto sí, pero "quiero comprar pintura blanca"
  // tiene que ir a la búsqueda, no al menú.
  if (MENU_BUY_RE.test(folded)) return handleAction(ctx, 'buy');
  if (MENU_HELP_RE.test(folded)) return handleAction(ctx, 'help');

  // ── 6. Saludo → SIEMPRE respuesta determinística (§8, §23) ─────────────────
  //
  // La condición mira si la SESIÓN recién arrancó, no si alguna vez hubo
  // mensajes. `hasHistory` es el historial de por vida y la fila de conversación
  // nunca se borra, así que un cliente que escribió una vez no volvía a ver el
  // menú NUNCA: su "Hola" caía al LLM, que contestaba con una pregunta abierta
  // en vez de las tres opciones del §8. Medido en una conversación real.
  //
  // Y con la sesión EN CURSO tampoco puede caer al modelo: ahí el saludo retoma
  // la pregunta pendiente del asesor. Ver `planGreeting`.
  if (isGreeting(folded)) {
    if (planGreeting(session) === 'resume_guided') {
      const resumed = await advanceAdvisor({
        container,
        svc: waSvc,
        phone,
        sessionId: ctx.sessionId,
        answers: (session.answers ?? {}) as AdvisorAnswers,
        siteId: input.siteId ?? null,
      });
      if (resumed) return HANDLED;
    }
    ctx.track('menu_shown', { reason: isFreshSession(session) ? 'greeting' : 'greeting_midsession' });
    if (await sendMainMenu(phone)) {
      await waSvc.patchSession(phone, { step: null });
      return HANDLED;
    }
  }

  /**
   * LA PUERTA DE ENTRADA (§8/§23, DESDEELSUR-72 TC-000).
   *
   * Hasta acá el turno es texto libre sin intención reconocible, y el destino
   * histórico era el agente. Eso convertía al PRIMER mensaje del cliente en la
   * decisión de en qué bot entra: "Hola" abría el menú y "busco algo para el
   * techo" abría una conversación libre que no está en ningún árbol, con otro
   * formato de opciones y sin las garantías del recorrido. QA lo midió como
   * bifurcación no controlada y lo marcó crítico.
   *
   * Con la compuerta encendida, una sesión NUEVA ve el menú: la misma respuesta
   * que ya recibe un saludo, por la misma razón. No es un caso raro — es la
   * puerta por la que entra cualquiera que escriba algo antes de saludar.
   *
   * Y NO se extiende a la sesión en curso a propósito: adentro del recorrido el
   * agente sigue siendo el que atiende lo que el router deliberadamente no
   * resuelve (asesoramiento §19, devoluciones). Mandar el menú ahí sería
   * contestarle con un cuestionario a quien está preguntando algo concreto.
   */
  if (opensMenuOnFreeText(session, getKapsoSettings().guidedEntry)) {
    ctx.track('menu_shown', { reason: 'fresh_session_free_text' });
    if (await sendMainMenu(phone)) return HANDLED;
    // El menú no salió (ni botones ni texto): que lo atienda el agente antes que
    // dejar el turno mudo, que es la peor salida posible.
  }

  // Texto libre sin intención clara → el agente.
  return NOT_HANDLED;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * El cliente tocó un producto. Se agrega con la cantidad que había pedido por
 * texto ("3 latas de látex" → tap → 3): el LLM lo hacía leyendo el historial y acá
 * se preserva guardando la cantidad en la sesión al momento de la búsqueda.
 */
async function handleVariantTap(ctx: Ctx, variantId: string): Promise<RouterResult> {
  const { phone } = ctx.input;
  const session = await ctx.svc.getSession(phone);
  const quantity = Number(session.pending_quantity) || 1;

  ctx.track('product_selected', { variant_id: variantId, quantity });
  // `isVariantSelection` es el guardrail que habilita el add (y sólo una vez por
  // turno); `didSearch` en false porque acá el cliente YA eligió.
  await callTool(
    NATIVE_TOOL.waAddToCart,
    { variant_id: variantId, quantity },
    toolCtx(ctx, { isVariantSelection: true, didSearch: false }),
  );
  await ctx.svc.patchSession(phone, { pending_quantity: null, step: null });
  return HANDLED;
}

async function handleAction(ctx: Ctx, action: string): Promise<RouterResult> {
  const { phone } = ctx.input;

  switch (action) {
    // §9.1 — arranque de compra.
    case 'buy':
      await ctx.svc.patchSession(phone, { intent: 'buy', step: null });
      return result(await sendKnowsProductQuestion(phone));

    // §9.2 — pedir el texto de búsqueda y quedar esperándolo.
    case 'known_product':
    case 'search':
    case 'more':
      await ctx.svc.patchSession(phone, { intent: 'buy', step: 'awaiting_search_query' });
      return result(await send(phone, SEARCH_PROMPT));

    // §18 — revisión y pago.
    case 'close':
      await callTool(NATIVE_TOOL.waReviewOrder, {}, toolCtx(ctx));
      return HANDLED;
    /**
     * `wa_checkout_link` CREA el link pero NO se lo manda al cliente: devuelve el
     * texto para que lo envíe quien la llamó. El modelo lo hacía; el router no, así
     * que el cliente tocaba "Confirmar pago", el link se generaba, se guardaba el
     * token, se emitía `checkout_generated`… y del otro lado no llegaba NADA. Y
     * como devolvía `HANDLED`, tampoco caía al modelo, que podría haberlo salvado.
     *
     * La venta moría en el último paso, con el carrito ya armado.
     */
    case 'confirm_pay': {
      const message = await callTool(NATIVE_TOOL.waCheckoutLink, {}, toolCtx(ctx));
      if (!message) return NOT_HANDLED;
      return result(await send(phone, message));
    }

    /**
     * "Cambiar" del pre-pago. NO puede volver a `wa_review_order`: eso vuelve a
     * mostrar el mismo detalle con los mismos dos botones y el cliente queda en
     * un bucle. Se ofrecen las salidas reales.
     */
    case 'change': {
      const sent = await sendWhatsappButtons({
        to: phone,
        body: '¿Qué querés cambiar del pedido?',
        buttons: [
          { id: 'act:more', title: 'Agregar algo más' },
          { id: 'act:clear', title: 'Empezar de nuevo' },
          { id: 'act:close', title: 'Dejarlo así' },
        ],
      }).catch(() => null);
      return result(Boolean(sent));
    }

    case 'clear':
      await callTool(NATIVE_TOOL.waClearCart, {}, toolCtx(ctx));
      await ctx.svc.patchSession(phone, { step: 'awaiting_search_query', pending_quantity: null });
      return result(await send(phone, `Listo, arrancamos de cero. ${SEARCH_PROMPT}`));

    case 'orders':
      return handleOrders(ctx);
    case 'locations':
      return handleLocations(ctx);
    case 'returns':
      await callTool(NATIVE_TOOL.waStartReturn, {}, toolCtx(ctx));
      return HANDLED;
    case 'human':
      await callTool(
        NATIVE_TOOL.waHandoffToHuman,
        { reason: 'El cliente pidió hablar con una persona.' },
        toolCtx(ctx),
      );
      return HANDLED;

    /**
     * "Necesito ayuda" (§8/§10) → filtrado guiado, sin pasar por el modelo. Se
     * arranca de cero: si el cliente ya venía respondiendo, "Cambiar filtros"
     * tiene que devolverlo a la primera pregunta y no dejarlo donde estaba.
     */
    case 'help': {
      const started = await startAdvisor(
        ctx.input.container,
        ctx.svc,
        phone,
        ctx.sessionId,
        {},
        ctx.input.siteId ?? null,
      );
      if (started) return HANDLED;

      // La tienda no tiene asesor (o falló arrancarlo). Antes esto caía al modelo:
      // el cliente tocaba un botón del menú y el turno terminaba en una llamada al
      // LLM, o en nada. Preguntarle qué busca sirve en cualquier rubro y deja la
      // sesión lista para buscar con lo que escriba.
      await ctx.svc.patchSession(phone, { intent: 'buy', step: 'awaiting_search_query' });
      return result(
        await send(phone, 'Contame qué estás buscando y te muestro lo que tenemos. 🔎'),
      );
    }

    /**
     * Acción DESCONOCIDA. Vuelve al menú en vez de caer al agente.
     *
     * `wa_ask_buttons` deja que el modelo acuñe ids arbitrarios, y en una
     * conversación real inventó `act:interior` / `act:exterior` / `act:both`
     * (armando su propia versión del asesor en vez de llamar `wa_guided_start`).
     * Como el router no los conocía, caían al LLM, que volvía a mandar la MISMA
     * pregunta: el cliente tocaba "Ambos" y recibía otra vez "¿interior,
     * exterior o ambos?". Bucle, y una llamada al modelo por tap.
     *
     * Reabrir el menú corta el ciclo y deja al cliente en un estado conocido.
     */
    default: {
      ctx.track('menu_shown', { reason: 'unknown_action', action });
      await ctx.svc.patchSession(phone, { step: null, pending_dimension: null });
      return result(await sendMainMenu(phone));
    }
  }
}

/** §9.2/§9.3 — búsqueda determinística: sin LLM entre el texto y el carrusel. */
async function handleSearchQuery(ctx: Ctx, text: string): Promise<RouterResult> {
  const { phone } = ctx.input;
  const quantity = parseLeadingQuantity(text);
  // La cantidad se guarda para aplicarla cuando toque el producto (handleVariantTap).
  await ctx.svc.patchSession(phone, { step: null, pending_quantity: quantity ?? null });
  await callTool(NATIVE_TOOL.waSearchProducts, { query: text }, toolCtx(ctx, { didSearch: false }));
  return HANDLED;
}

/**
 * §21 — sucursales y horarios desde datos estructurados, sin consultar Maps.
 *
 * El texto del cliente se usa para ACOTAR: "¿tienen sucursales en pba?" tiene que
 * devolver las de provincia, no las cinco primeras del abecedario. Cuando llega por
 * un tap (`act:locations`) no hay texto y se muestran las primeras con el total,
 * para que el cliente sepa que puede pedir la suya.
 */
async function handleLocations(ctx: Ctx, near: string | null = null): Promise<RouterResult> {
  const { locations, total, narrowed } = await getWaStoreLocations(ctx.input.container, 5, near);
  ctx.track('store_locations', { count: locations.length, total, narrowed });
  return result(
    await send(ctx.input.phone, formatStoreLocationsMessage(locations, { total, narrowed })),
  );
}

/**
 * §20 — estado de pedidos. Si el teléfono resuelve a un cliente se muestran sus
 * pedidos; si no, se pide número y después email, y no se muestra NADA hasta que
 * los dos coincidan.
 */
async function handleOrders(ctx: Ctx): Promise<RouterResult> {
  const { container, phone } = ctx.input;
  const customer = await resolveWaCustomer(container, phone).catch(() => null);

  if (customer && customer.orders.length > 0) {
    const ids = customer.orders.slice(0, 3).map((o) => o.id);
    const message = await formatCustomerOrders(container, ids);
    ctx.track('order_status', { orders: ids.length, identified: true });
    await ctx.svc.patchSession(phone, { intent: 'order_status', step: null });
    return result(await send(phone, message));
  }

  await ctx.svc.patchSession(phone, { intent: 'order_status', step: 'awaiting_order_number' });
  ctx.track('order_status', { identified: false, asked: 'display_id' });
  return result(
    await send(phone, 'Para buscar tu pedido necesito el *número de pedido*. ¿Me lo pasás?'),
  );
}

async function handleOrderNumber(ctx: Ctx, text: string): Promise<RouterResult> {
  const { phone } = ctx.input;
  const displayId = parseOrderDisplayId(text);
  if (displayId == null) {
    return result(
      await send(phone, 'No pude leer el número. Mandame sólo los números del pedido (por ejemplo 1234).'),
    );
  }
  await ctx.svc.patchSession(phone, {
    step: 'awaiting_order_email',
    pending_order_display_id: displayId,
  });
  return result(
    await send(
      phone,
      `Perfecto. Ahora pasame el *email* con el que hiciste el pedido #${displayId} para poder confirmarlo.`,
    ),
  );
}

async function handleOrderEmail(
  ctx: Ctx,
  text: string,
  displayId: number | null,
): Promise<RouterResult> {
  const { container, phone } = ctx.input;
  const email = parseEmail(text);
  if (!email || displayId == null) {
    return result(
      await send(phone, 'Eso no parece un email. Mandámelo completo (por ejemplo nombre@mail.com).'),
    );
  }

  const status = await lookupOrderByDisplayIdAndEmail(container, displayId, email).catch(() => null);
  await ctx.svc.patchSession(phone, { step: null, pending_order_display_id: null });

  if (!status) {
    // MISMA respuesta si el pedido no existe o si el email no coincide: confirmar
    // la existencia de un pedido ajeno ya sería filtrar información (§28).
    ctx.track('order_status', { identified: false, matched: false });
    return result(await send(phone, ORDER_NOT_FOUND_MESSAGE));
  }

  ctx.track('order_status', { identified: false, matched: true, display_id: displayId });
  return result(await send(phone, formatOrderStatusForCustomer(status)));
}
