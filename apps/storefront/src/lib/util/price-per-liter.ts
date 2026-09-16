/**
 * Precio por litro: el dato que decide entre dos pinturas.
 *
 * El comparador mostraba Disponibilidad, SKU, Categoría y Presentación. QA lo
 * señaló como inútil para decidir (DESDEELSUR-61 / BUG-09): son datos de
 * identificación, no de comparación. Un ejemplo real del catálogo de desdeelsur:
 *
 *   Albalatex design mate interior amarillo latino x1 lt → $16.535
 *   Albalatex design mate interior amarillo latino x4 lt → $53.989
 *
 * Con el precio absoluto al lado no se puede decidir; con el precio por litro
 * ($16.535/L contra $13.497/L) se decide de un vistazo. Es el mismo producto en
 * dos envases, que es exactamente el caso en que alguien abre un comparador de
 * pinturería.
 *
 * Los atributos técnicos que también pidió QA (rendimiento, acabado, secado,
 * durabilidad) NO existen en la base: la metadata que manda Zeus es
 * `zeus_color`, `zeus_familia`, `zeus_presentacion`, `zeus_categoria` y
 * `zeus_codigo_fabrica`, y `description` viene en null. Agregar esas filas daría
 * columnas vacías, no comparación — hace falta traerlas del ERP primero.
 *
 * El parseo es DELIBERADAMENTE conservador: ante cualquier ambigüedad devuelve
 * `null` y el comparador no muestra la fila. Un precio por litro equivocado es
 * peor que no tenerlo — es un número que parece autoridad y manda a comprar mal.
 */

/**
 * Unidades de VOLUMEN y su factor a litros. El peso queda afuera a propósito:
 * un producto en kg (masilla, cemento) no tiene litros, y dividir por kilos y
 * rotularlo "por litro" sería inventar el dato.
 */
const VOLUME_UNITS: ReadonlyArray<{ pattern: RegExp; toLiters: number }> = [
  { pattern: /^(?:lts?|l|litros?)$/, toLiters: 1 },
  { pattern: /^(?:ml|cc|cm3)$/, toLiters: 1 / 1000 },
];

/**
 * Litros que declara una etiqueta de presentación ("1 lt", "8,7 lts", "500 ml").
 *
 * Devuelve `null` cuando no hay una única lectura posible: sin número, sin unidad
 * de volumen reconocida, con más de una cantidad ("pack 2 x 4 lt") o con un
 * valor que no tiene sentido físico.
 */
export function parseLiters(label: string | null | undefined): number | null {
  if (!label || typeof label !== "string") return null;

  const normalized = label.toLowerCase().trim();

  // Se acepta coma y punto: el catálogo es es-AR y las bases entonables vienen
  // con litrajes como "8,7 lt".
  const NUMBER = /\d+(?:[.,]\d+)?/g;

  // Un número que no se pueda atribuir al volumen significa que la etiqueta dice
  // algo más que no entendemos: un pack ("2 x 4 lt" son 8 litros, no 4), un
  // rango ("de 1 a 4 lt"), un nombre con números. Exigir EXACTAMENTE una
  // cantidad es lo que mantiene la regla honesta sin tener que enumerar cada
  // forma rara. Las presentaciones reales del catálogo — "1 lt", "4 lt",
  // "8,7 lt", "17,4 lt", "20 lts", "x 1 lt", "500 ml" — traen una sola.
  if ((normalized.match(NUMBER) ?? []).length !== 1) return null;

  // `exec` en un while en vez de spread de `matchAll`: el target del storefront
  // no habilita iterar un `RegExpStringIterator` (TS2802), y el resto del
  // storefront ya recorre matches así (ver `FaqAccordion.parseAnswer`).
  const QUANTITY = /(\d+(?:[.,]\d+)?)\s*([a-z0-9]+)/g;
  const volumes: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = QUANTITY.exec(normalized)) !== null) {
    const [, rawAmount, rawUnit] = match;
    const unit = VOLUME_UNITS.find((candidate) =>
      candidate.pattern.test(rawUnit),
    );
    if (!unit) continue;

    const amount = Number(rawAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    volumes.push(amount * unit.toLiters);
  }

  // Ninguna cantidad de volumen, o más de una (un pack, un rango): no hay una
  // única respuesta y no se adivina.
  if (volumes.length !== 1) return null;

  return volumes[0];
}

/**
 * Precio por litro, o `null` si falta cualquiera de las dos mitades.
 *
 * `amount` va en la misma unidad que entra (el storefront maneja el monto ya
 * escalado por Medusa); esta función sólo divide.
 */
export function pricePerLiter(
  amount: number | null | undefined,
  presentationLabel: string | null | undefined,
): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const liters = parseLiters(presentationLabel);
  if (liters === null) return null;

  // Un envase de menos de 100 ml en una pinturería es casi seguro una etiqueta
  // mal parseada, y el precio por litro saldría inflado 10x. Preferimos no
  // mostrar nada.
  if (liters < 0.1) return null;

  return amount / liters;
}
