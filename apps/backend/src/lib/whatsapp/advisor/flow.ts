import type { MedusaContainer } from '@medusajs/framework/types';
import type { AdvisorDimension } from '../../../modules/typesense/advisor';
import type WhatsappAgentModuleService from '../../../modules/whatsapp-agent/service';
import type { WaEventType } from '../../../modules/whatsapp-agent/event-log/types';
import { getKapsoSettings } from '../../../modules/kapso-whatsapp/settings';
import { trackWaEvent } from '../events';
import { resolveWaOrderContext } from '../order-context';
import { hydrateWaProductIds } from '../search-products';
import { sendWhatsappButtons, sendWhatsappCarousel, sendWhatsappList, sendWhatsappText } from '../send-whatsapp-text';
import { getAdvisorConfig } from './config';
import { ADVISOR_FLOW, answerLabel, dimensionByKey, neutralValue, optionByValue } from './dimensions';
import { describeAnswers, impliedAnswers, nextStep } from './engine';
import { relaxableDimensions, type AdvisorAnswers } from './filters';
import { runAdvisorSearch } from './search';

/**
 * Orquestación del filtrado guiado (PRD §10-14, §16).
 *
 * Un turno del asesor = UNA búsqueda a Typesense + CERO llamadas al modelo. El
 * motor (`engine.ts`) decide preguntar o mostrar; acá se hace el I/O: mandar los
 * botones, relajar cuando no hay resultados, y validar precio y stock contra
 * Medusa antes de ofrecer un producto.
 */

type AnyRecord = Record<string, any>;

export type AdvisorFlowInput = {
  container: MedusaContainer;
  svc: WhatsappAgentModuleService;
  phone: string;
  sessionId: string;
  /** Respuestas acumuladas (la nueva ya incluida). */
  answers: AdvisorAnswers;
  /** Tienda que recibió el mensaje, para que los eventos no queden sin `site_id`. */
  siteId?: string | null;
};

const money = (amount: number | null, currency: string): string => {
  if (amount == null) return 's/precio';
  return `$${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${currency.toUpperCase()}`;
};

/** Ids de botón del asesor: `adv:<dimension>:<valor>`. */
export const advisorButtonId = (dimension: string, value: string): string =>
  `adv:${dimension}:${value}`;

export function parseAdvisorButtonId(
  id: string,
): { dimension: AdvisorDimension; value: string } | null {
  if (!id.startsWith('adv:')) return null;
  const [, dimension, value] = id.split(':');
  if (!dimension || !value) return null;
  if (!dimensionByKey(dimension)) return null;
  return { dimension: dimension as AdvisorDimension, value };
}

/**
 * Manda la pregunta de una dimensión. Con hasta 3 opciones van botones (más
 * cómodos de tocar); con más, lista interactiva — que es el límite de WhatsApp y
 * lo que el §16 pide como alternativa.
 */
async function askDimension(
  phone: string,
  dimension: ReturnType<typeof dimensionByKey>,
  options: Array<{ value: string; label: string }>,
): Promise<boolean> {
  if (!dimension) return false;
  if (options.length <= 3) {
    const sent = await sendWhatsappButtons({
      to: phone,
      body: dimension.question,
      buttons: options.map((o) => ({ id: advisorButtonId(dimension.key, o.value), title: o.label })),
    }).catch(() => null);
    return Boolean(sent);
  }
  const sent = await sendWhatsappList({
    to: phone,
    body: dimension.question,
    button: 'Ver opciones',
    rows: options.map((o) => ({ id: advisorButtonId(dimension.key, o.value), title: o.label })),
  }).catch(() => null);
  return Boolean(sent);
}

/** Muestra los productos finales: carrusel con fotos, o lista si falta alguna. */
async function showProducts(
  input: AdvisorFlowInput,
  productIds: string[],
  limit: number,
  track: (type: WaEventType, payload?: AnyRecord) => void,
): Promise<boolean> {
  const { container, phone } = input;
  const ctx = await resolveWaOrderContext(container);
  // Precio calculado y stock REAL contra Medusa: el índice no es fuente de verdad
  // para vender (§5.5).
  const { hits } = await hydrateWaProductIds(container, productIds, { limit, ctx });

  if (hits.length === 0) {
    track('no_results', { reason: 'hydration_empty', product_ids: productIds.length });
    return false;
  }

  const summary = describeAnswers(input.answers);
  const body = summary
    ? `Para ${summary}, te recomiendo estas opciones 👇`
    : 'Te recomiendo estas opciones 👇';

  const placeholder = getKapsoSettings().placeholderImageUrl ?? '';
  let sent = false;
  let mode: 'carousel' | 'list' = 'list';

  if (hits.every((h) => h.image_url || placeholder)) {
    const res = await sendWhatsappCarousel({
      to: phone,
      body,
      cards: hits.map((h) => ({
        imageUrl: (h.image_url || placeholder) as string,
        title: `${h.title} — ${money(h.unit_price, ctx.currency_code)}`,
        buttonId: h.variant_id,
        buttonTitle: 'Agregar',
      })),
    }).catch(() => null);
    sent = Boolean(res);
    if (sent) mode = 'carousel';
  }
  if (!sent) {
    const res = await sendWhatsappList({
      to: phone,
      header: 'Opciones',
      body,
      button: 'Ver opciones',
      rows: hits.map((h) => ({
        id: h.variant_id,
        title: h.title,
        description: money(h.unit_price, ctx.currency_code),
      })),
    }).catch(() => null);
    sent = Boolean(res);
  }

  if (sent) {
    await input.svc.rememberShownVariants(phone, hits.map((h) => h.variant_id));
    track('products_shown', {
      count: hits.length,
      mode,
      source: 'advisor',
      variant_ids: hits.map((h) => h.variant_id),
      answers: input.answers,
    });
  }
  return sent;
}

/** §14 — sin resultados: cambiar filtros, buscar por nombre o hablar con alguien. */
async function offerNoResultsExits(phone: string): Promise<boolean> {
  const sent = await sendWhatsappButtons({
    to: phone,
    body: 'No encontré productos con esa combinación. ¿Cómo seguimos?',
    buttons: [
      { id: 'act:help', title: 'Cambiar filtros' },
      { id: 'act:search', title: 'Buscar por nombre' },
      { id: 'act:human', title: 'Hablar con alguien' },
    ],
  }).catch(() => null);
  return Boolean(sent);
}

/**
 * Avanza el recorrido un paso. Se llama al arrancar el asesor y con cada respuesta.
 *
 * Devuelve `true` si le habló al cliente (el turno queda resuelto sin IA).
 */
export async function advanceAdvisor(input: AdvisorFlowInput): Promise<boolean> {
  const { container, svc, phone, sessionId } = input;
  const siteId = input.siteId ?? null;
  const track = (type: WaEventType, payload?: AnyRecord) =>
    trackWaEvent(container, {
      phone,
      type,
      payload: payload ?? null,
      usedAi: false,
      sessionId,
      siteId,
    });

  const config = await getAdvisorConfig(container);
  const ctx = await resolveWaOrderContext(container);
  let answers = input.answers;

  let search = await runAdvisorSearch(container, {
    answers,
    salesChannelIds: ctx.sales_channel_ids,
    limit: config.max_results,
  });

  // Typesense caído: se degrada a búsqueda por nombre (§29), no se miente.
  if (!search) {
    track('error', { where: 'advisor_search', message: 'typesense_unavailable' });
    await svc.patchSession(phone, { step: 'awaiting_search_query' });
    const sent = await sendWhatsappText(
      phone,
      'Ahora no puedo filtrar el catálogo. Decime el nombre o la marca de lo que buscás y lo busco igual 👇',
    ).catch(() => null);
    return Boolean(sent);
  }

  // ── §14: relajación. SÓLO las no restrictivas, de a una y en orden. ──────────
  const dropped: AdvisorDimension[] = [];
  if (search.found === 0) {
    for (const dimension of relaxableDimensions(answers)) {
      dropped.push(dimension);
      const retry = await runAdvisorSearch(container, {
        answers,
        salesChannelIds: ctx.sales_channel_ids,
        limit: config.max_results,
        dropped,
      });
      if (retry && retry.found > 0) {
        track('guided_relaxed', { dropped: [...dropped], found: retry.found });
        // El PRD pide avisarlo con palabras, no relajar en silencio.
        await sendWhatsappText(
          phone,
          'No encontré opciones con esa preferencia. Te muestro productos compatibles sin filtrar por agua o solvente.',
        ).catch(() => null);
        search = retry;
        // Las dimensiones relajadas quedan con su valor NEUTRO ("me da igual"), no
        // borradas: si se borraran, el motor las vería como sin responder y las
        // volvería a preguntar — el cliente contestaría lo mismo, se relajaría de
        // nuevo y el recorrido quedaría en un bucle.
        answers = { ...answers };
        for (const d of dropped) {
          const neutral = neutralValue(d);
          if (neutral) answers[d] = neutral;
          else delete answers[d];
        }
        break;
      }
    }
  }

  if (search.found === 0) {
    track('no_results', { answers, filter_by: search.filterBy });
    await svc.patchSession(phone, { step: null, pending_dimension: null });
    return offerNoResultsExits(phone);
  }

  // Dimensiones con una sola opción posible: se asumen y no se preguntan (§13).
  const implied = impliedAnswers(answers, search.facets);
  if (Object.keys(implied).length > 0) answers = { ...answers, ...implied };

  const step = nextStep(answers, search.found, search.facets, {
    showThreshold: config.show_threshold,
    maxQuestions: config.max_questions,
  });

  if (step.kind === 'ask') {
    await svc.patchSession(phone, {
      intent: 'guided',
      step: 'advisor_question',
      pending_dimension: step.dimension.key,
      answers: answers as Record<string, string>,
    });
    track('guided_answered', { asked: step.dimension.key, remaining: search.found });
    const sent = await askDimension(phone, step.dimension, step.options);
    if (sent) return true;
    // Si no se pudo mandar la pregunta, mejor mostrar productos que cortar.
  }

  await svc.patchSession(phone, {
    intent: 'guided',
    step: null,
    pending_dimension: null,
    answers: answers as Record<string, string>,
  });
  const shown = await showProducts({ ...input, answers }, search.productIds, config.max_results, track);
  if (shown) return true;

  track('no_results', { reason: 'show_failed', answers });
  return offerNoResultsExits(phone);
}

/**
 * Arranca el asesor desde cero (§10).
 *
 * `sessionId` es opcional porque el agente también puede arrancarlo (tool
 * `wa_guided_start`) y ahí no viene en el contexto: se resuelve de la sesión, que
 * es la fuente de verdad.
 */
export async function startAdvisor(
  container: MedusaContainer,
  svc: WhatsappAgentModuleService,
  phone: string,
  sessionId: string | null,
  seedAnswers: AdvisorAnswers = {},
  siteId: string | null = null,
): Promise<boolean> {
  const resolvedSessionId = sessionId ?? (await svc.getSession(phone)).session_id;
  trackWaEvent(container, {
    phone,
    type: 'guided_started',
    payload: { seeded: Object.keys(seedAnswers) },
    usedAi: false,
    sessionId: resolvedSessionId,
    siteId,
  });
  await svc.patchSession(phone, {
    intent: 'guided',
    answers: seedAnswers as Record<string, string>,
    step: null,
    pending_dimension: null,
  });
  // Sólo se explica el recorrido cuando hay preguntas por delante; si la frase del
  // cliente ya resolvió todo, mandar "te voy a hacer algunas preguntas" y después
  // los productos queda raro.
  if (Object.keys(seedAnswers).length === 0) {
    await sendWhatsappText(
      phone,
      'Te voy a hacer algunas preguntas para mostrarte productos adecuados 👇',
    ).catch(() => null);
  }
  return advanceAdvisor({
    container,
    svc,
    phone,
    sessionId: resolvedSessionId,
    answers: seedAnswers,
    siteId,
  });
}

/** Registra la respuesta a una dimensión y sigue (§13). */
export async function answerAdvisor(
  container: MedusaContainer,
  svc: WhatsappAgentModuleService,
  phone: string,
  sessionId: string,
  dimension: AdvisorDimension,
  value: string,
  siteId: string | null = null,
): Promise<boolean> {
  const session = await svc.getSession(phone);
  const previous = (session.answers ?? {}) as AdvisorAnswers;
  const answers: AdvisorAnswers = { ...previous, [dimension]: value };

  trackWaEvent(container, {
    phone,
    type: 'guided_answered',
    step: dimension,
    payload: { value, label: answerLabel(dimension, value) },
    usedAi: false,
    sessionId,
    siteId,
  });

  return advanceAdvisor({ container, svc, phone, sessionId, answers, siteId });
}

/**
 * Valida los filtros que el modelo extrajo de una frase abierta (§13: "necesito
 * una pintura al agua para madera exterior" no debe volver a preguntar nada).
 *
 * Se descarta todo lo que no sea un valor declarado de una dimensión declarada: el
 * modelo no puede inventar filtros, igual que no puede inventar `variant_id`.
 */
export function sanitizeExtractedFilters(raw: unknown): AdvisorAnswers {
  const out: AdvisorAnswers = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const dimension of ADVISOR_FLOW) {
    const value = (raw as AnyRecord)[dimension.key];
    if (typeof value !== 'string') continue;
    if (optionByValue(dimension, value)) out[dimension.key] = value;
  }
  return out;
}
