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
  /** Las presentaciones comprables del producto que el cliente ya eligió. */
  | { kind: 'presentations'; variantId: string; productId: string }
  /** La ficha de un producto: se lee del catálogo, la foto no se manda. */
  | { kind: 'detail'; variantId: string }
  /**
   * Consultar un pedido con número + email. Es una LECTURA —no le cambia nada a
   * nadie— y la ve sólo quien ya puede ver todos los pedidos desde el admin, así que
   * se corre de verdad: es la única forma de probar la rama "Mi pedido" sin
   * publicarla.
   */
  | { kind: 'order'; orderNumber: string; email: string }
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

/**
 * Lo que NO se puede mostrar porque no hay a quién mirárselo.
 *
 * Separadas de `TIENE_EFECTOS` a propósito: estas no romperían nada si se corrieran,
 * simplemente no tienen sentido fuera de una conversación. Decir CUÁL es el motivo
 * —"no hay carrito", no "todavía no se puede"— es la diferencia entre entender que
 * falta contexto y creer que el editor está incompleto.
 */
const NECESITA_CONVERSACION: Record<string, string> = {
  wa_view_cart: 'Muestra el carrito de ese cliente y en la prueba no hay ninguno. Se ve con una conversación de verdad.',
  wa_review_order: 'Muestra el pedido armado de ese cliente y en la prueba no hay carrito. Se ve con una conversación de verdad.',
  wa_guided_start:
    'Le cede el turno al asesor guiado, que lleva su propia conversación aparte. Desde acá se prueba hasta este paso; el asesor se prueba en su propia pantalla.',
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

  /**
   * Las presentaciones son EL paso que más se traba en la prueba: vienen del producto
   * que el cliente acaba de tocar, así que sin correrlas la pregunta siguiente sale
   * vacía y el operador tenía que escribir a mano el JSON de las opciones.
   */
  if (tool === 'wa_list_presentations') {
    const variantId = texto(args.variant_id);
    const productId = texto(args.product_id);
    return variantId || productId
      ? { kind: 'presentations', variantId, productId }
      : {
          kind: 'unsupported',
          reason: 'Todavía no hay ningún producto elegido: tocá uno en la lista de arriba y probá de nuevo.',
        };
  }

  if (tool === 'wa_product_detail') {
    const variantId = texto(args.variant_id);
    return variantId
      ? { kind: 'detail', variantId }
      : {
          kind: 'unsupported',
          reason: 'Todavía no hay ningún producto elegido: tocá uno en la lista de arriba y probá de nuevo.',
        };
  }

  if (tool === 'wa_lookup_order') {
    const orderNumber = texto(args.order_number);
    const email = texto(args.email);
    if (!orderNumber || !email) {
      return {
        kind: 'unsupported',
        // Pasa cuando el paso está atado a una pregunta que todavía no se contestó, o
        // cuando el operador no configuró de dónde salen los dos datos.
        reason: 'Faltan el número de pedido o el email: contestá las dos preguntas como el cliente, o revisá de qué respuestas los toma el paso.',
      };
    }
    return { kind: 'order', orderNumber, email };
  }

  const sinConversacion = NECESITA_CONVERSACION[tool];
  if (sinConversacion) return { kind: 'unsupported', reason: sinConversacion };

  return {
    kind: 'unsupported',
    reason: 'Esta acción todavía no se puede previsualizar: se muestra lo que haría.',
  };
}
