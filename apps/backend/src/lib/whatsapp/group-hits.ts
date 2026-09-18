import type { WaProductHit } from './search-products';

/**
 * UNA TARJETA POR PRODUCTO, NO POR VARIANTE.
 *
 * La búsqueda devuelve una fila por variante comprable, y eso está bien para el
 * carrito —1 l y 20 l son cosas distintas— pero es lo peor posible para el CARRUSEL:
 * WhatsApp muestra hasta 10 tarjetas, así que una pinturería que vende cada pintura en
 * cuatro presentaciones le ofrece al cliente dos productos y media docena de repetidos
 * con la misma foto. Buscar "látex" y recibir cuatro veces el mismo balde no se lee
 * como variedad, se lee como que el bot está roto.
 *
 * Agrupado, el carrusel muestra diez PRODUCTOS distintos y la presentación se elige
 * después — que es justo para lo que existe el paso "Buscar las presentaciones de un
 * producto".
 *
 * La variante que queda detrás de la tarjeta sigue siendo una variante de verdad, así
 * que el tap del botón manda un `variant_id` y agregar al carrito funciona igual que
 * antes. Es la parte que no se puede romper.
 */

export type WaGroupedHit = WaProductHit & {
  /** Cuántas variantes comprables tiene el producto. 1 = no hay nada que elegir. */
  variant_count: number;
};

/**
 * Colapsa las filas a una por producto, conservando el orden de relevancia.
 *
 * La representante es la primera CON STOCK y, si ninguna tiene, la primera a secas:
 * mostrar el producto marcado "sin stock" es mejor que esconderlo, pero mandar a
 * alguien a una presentación agotada teniendo otra disponible es un error evitable.
 *
 * El orden de salida es el de la PRIMERA aparición de cada producto, no el de la
 * representante: la lista viene ordenada por relevancia y reordenar por stock movería
 * el producto más buscado al fondo.
 */
export function groupHitsByProduct(hits: readonly WaProductHit[]): WaGroupedHit[] {
  const porProducto = new Map<string, { hit: WaProductHit; orden: number; total: number }>();

  hits.forEach((hit, index) => {
    const actual = porProducto.get(hit.product_id);
    if (!actual) {
      porProducto.set(hit.product_id, { hit, orden: index, total: 1 });
      return;
    }
    actual.total += 1;
    // Sólo se reemplaza para GANAR stock. Entre dos con stock gana la primera, que es
    // la más relevante.
    if (!actual.hit.in_stock && hit.in_stock) actual.hit = hit;
  });

  return [...porProducto.values()]
    .sort((a, b) => a.orden - b.orden)
    .map(({ hit, total }) => ({
      ...hit,
      // El título pasa a ser el del PRODUCTO: "Látex interior — 20 L" en una tarjeta
      // que representa a las cuatro presentaciones diría una mentira chica.
      title: hit.product_title || hit.title,
      variant_count: total,
    }));
}
