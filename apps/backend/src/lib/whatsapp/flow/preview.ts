/**
 * QUÉ SE PUEDE MOSTRAR DE VERDAD EN LA PRUEBA, Y QUÉ NO.
 *
 * El simulador mostraba una tarjeta que DESCRIBÍA lo que una acción haría: "Acción:
 * Buscar productos · query: remera". Sirve para entender el dibujo y no sirve para lo
 * que uno realmente quiere saber antes de publicar —si hay productos, si las fotos
 * están, si el título entra, si el precio se lee— que es exactamente lo que el cliente
 * va a ver en el teléfono.
 *
 * La línea que separa lo que se ejecuta de lo que no NO es "¿es importante?", es
 * **¿tiene efectos?**. Buscar en el catálogo no le cambia nada a nadie y se puede
 * correr todas las veces que haga falta. Agregar al carrito, generar un link de pago o
 * escalar a una persona SÍ: correrlos en una prueba tocaría el carrito de un teléfono
 * real y despertaría a alguien del equipo. Esos se siguen describiendo.
 *
 * Este archivo decide y no ejecuta: es dato puro, así que la lista de lo que es seguro
 * se puede leer —y testear— sin levantar nada.
 */

import { isEmptyCatalogFilter, type WaCatalogFilter } from './catalog-filter';

export type PreviewPlan =
  /** Buscar en el catálogo con el texto que ya resolvió el motor. */
  | { kind: 'search'; query: string }
  /** Mostrar productos elegidos a mano, en el orden en que se eligieron. */
  | { kind: 'pinned'; productIds: string[] }
  /** Mostrar los que cumplen una condición del catálogo. */
  | { kind: 'filtered'; filter: WaCatalogFilter }
  /** Se describe, no se ejecuta. `reason` es lo que se le muestra al operador. */
  | { kind: 'unsupported'; reason: string };

const TIENE_EFECTOS: Record<string, string> = {
  wa_add_to_cart: 'Agrega al carrito de verdad, así que en la prueba no se ejecuta.',
  wa_set_quantity: 'Cambia el carrito de verdad, así que en la prueba no se ejecuta.',
  wa_clear_cart: 'Vacía el carrito de verdad, así que en la prueba no se ejecuta.',
  wa_checkout_link: 'Genera un link de pago real, así que en la prueba no se ejecuta.',
  wa_start_return: 'Abre una devolución de verdad, así que en la prueba no se ejecuta.',
  wa_handoff_to_human: 'Avisa a una persona del equipo, así que en la prueba no se ejecuta.',
};

const texto = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Traduce una acción del recorrido a lo que la vista previa puede hacer sin
 * consecuencias.
 *
 * Lo que no está en la lista cae en `unsupported` y se sigue describiendo: agregar una
 * tool nueva no puede hacer que se ejecute sola en una prueba por haberse olvidado de
 * pensarlo. La lista es corta a propósito y se amplía a mano, tool por tool.
 */
export function previewPlan(tool: string | undefined, args: Record<string, unknown>): PreviewPlan {
  if (!tool) return { kind: 'unsupported', reason: 'El paso no tiene elegida ninguna acción.' };

  const conEfectos = TIENE_EFECTOS[tool];
  if (conEfectos) return { kind: 'unsupported', reason: conEfectos };

  if (tool === 'wa_search_products') {
    const query = texto(args.query);
    return query
      ? { kind: 'search', query }
      : {
          kind: 'unsupported',
          // Pasa cuando el paso busca `{{text}}` y el cliente todavía no escribió nada.
          reason: 'Todavía no hay texto para buscar: escribí algo como el cliente y probá de nuevo.',
        };
  }

  if (tool === 'wa_list_pinned') {
    const ids = Array.isArray(args.product_ids)
      ? args.product_ids.map(texto).filter((v) => v !== '')
      : [];
    return ids.length > 0
      ? { kind: 'pinned', productIds: ids }
      : { kind: 'unsupported', reason: 'El paso todavía no tiene productos elegidos.' };
  }

  if (tool === 'wa_list_filtered') {
    const filter = (args.filter && typeof args.filter === 'object' ? args.filter : {}) as WaCatalogFilter;
    return isEmptyCatalogFilter(filter)
      ? {
          kind: 'unsupported',
          // Un filtro vacío traería el catálogo entero: mostrarlo haría creer que el
          // paso funciona cuando en producción no va a publicar nada.
          reason: 'El filtro está vacío: elegí una categoría, un precio o las promociones.',
        }
      : { kind: 'filtered', filter };
  }

  return {
    kind: 'unsupported',
    reason: 'Esta acción todavía no se puede previsualizar: se muestra lo que haría.',
  };
}
