import type { WaEvent } from '../../../hooks/api/whatsapp-sessions';

/**
 * Cómo se lee cada evento del recorrido. Vive aparte de `page.tsx` para poder
 * probarlo: la regresión que arregló este módulo —líneas vacías porque el emisor y
 * el renderer no usaban las mismas claves— no la ve ningún tipo, sólo un test.
 */

/** Por qué no hubo resultados, en castellano. Las claves las emite `advisor/flow.ts`. */
const NO_RESULTS_REASON: Record<string, string> = {
  filters_empty: 'ningún producto pasó los filtros',
  hydration_empty: 'los productos no se pudieron cargar',
  show_failed: 'no se pudieron mostrar',
};

/** La línea de "el bot preguntó", compartida con las filas viejas mal tipadas. */
const askedLine = (dimension: string, remaining: unknown): string =>
  `Preguntó ${dimension}${remaining != null ? ` — quedaban ${String(remaining)} productos` : ''}`;

/** Qué decir de cada evento, en castellano y sin volcar el json crudo. */
export function describeEvent(event: WaEvent): string {
  const p = event.payload ?? {};
  switch (event.type) {
    case 'inbound':
      return `El cliente escribió (${String(p.kind ?? 'texto')})${
        p.selection_id ? `: ${String(p.selection_id)}` : ''
      }`;
    case 'node_entered':
      return `Paso: ${event.step ?? String(p.node_id ?? '—')}`;
    case 'menu_shown':
      return `Se mostró el menú (${String(p.reason ?? '—')})`;
    case 'search':
      return `Buscó "${String(p.query ?? '')}" — ${String(p.count ?? 0)} resultados`;
    case 'no_results': {
      // Los tres emisores del asesor mandan `reason` y ninguno manda `query`: sin
      // esto la línea salía pelada y no distinguía "no pasó los filtros" de "no se
      // pudo mostrar", que son problemas distintos.
      if (p.query) return `Sin resultados para "${String(p.query)}"`;
      const reason = p.reason ? String(p.reason) : null;
      return reason ? `Sin resultados (${NO_RESULTS_REASON[reason] ?? reason})` : 'Sin resultados';
    }
    case 'products_shown':
      return `Se mostraron ${String(p.count ?? 0)} productos`;
    case 'product_selected':
      return 'Eligió un producto';
    case 'added_to_cart':
      return `Agregó ${String(p.quantity ?? 1)} × ${String(p.title ?? 'un producto')}`;
    case 'cart_reviewed':
      return `Revisó el pedido (${String(p.lines ?? 0)} ítems)`;
    case 'checkout_generated':
      return 'Se generó el link de pago';
    case 'checkout_blocked':
      return `No se generó el link: ${p.reason === 'minimum_purchase' ? `falta $${String(p.missing ?? '')} para el mínimo` : String(p.reason ?? '')}`;
    case 'guided_started':
      return 'Arrancó el asesor guiado';
    case 'guided_asked':
      return askedLine(event.step ?? 'una dimensión', p.remaining);
    case 'guided_answered': {
      // Filas VIEJAS: hasta el fix, preguntar se emitía como `guided_answered` con
      // `payload.asked` y sin `step`. Se leen como lo que siempre fueron, en vez de
      // quedar como un "Respondió" vacío para siempre — el event log no se migra.
      if (!event.step && p.asked) return askedLine(String(p.asked), p.remaining);
      // El valor va sin la dimensión cuando no llega, en vez de dejar el ':' colgado.
      return `Respondió ${event.step ? `${event.step}: ` : ''}${String(p.label ?? p.value ?? '—')}`;
    }
    case 'guided_relaxed':
      return `Se relajó un filtro (${String(p.dropped ?? '')})`;
    case 'handoff':
      return `Derivado a una persona: ${String(p.reason ?? '')}`;
    case 'paused_drop':
      return 'El bot calló: lo está atendiendo una persona';
    case 'send_failed':
      return `NO se pudo enviar (${String(p.kind ?? '')})`;
    case 'error':
      return `Error: ${String(p.where ?? p.message ?? '')}`;
    case 'order_status':
      return 'Consultó el estado de un pedido';
    case 'store_locations':
      return 'Consultó sucursales';
    default:
      return event.type;
  }
}
