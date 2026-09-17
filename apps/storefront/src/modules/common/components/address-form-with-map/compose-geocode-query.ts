/**
 * Compone la query de geocoding a partir de los campos del formulario de
 * dirección (calle + altura, ciudad, provincia, código postal). Función
 * pura: no toca el DOM ni el SDK de Google, sólo arma el string que
 * `google.maps.Geocoder` va a resolver.
 *
 * Devuelve `null` cuando la query es "pobre" — sin calle, o con muy pocos
 * caracteres útiles en la calle — para no quemar cuota de geocoding en algo
 * que Google de todos modos no va a poder ubicar (p. ej. mientras el
 * usuario todavía está tipeando "Av").
 */

export type GeocodeAddressFields = {
  address1: string;
  city: string;
  province: string;
  postalCode: string;
};

/**
 * Cantidad mínima de caracteres alfanuméricos que tiene que tener
 * `address1` (calle + altura) para considerar la query digna de
 * geocodificar. Menos que esto es casi siempre una calle a medio escribir
 * ("Av", "Call") y sólo devuelve resultados basura o `ZERO_RESULTS`.
 */
export const MIN_GEOCODE_QUERY_LENGTH = 6;

/**
 * Cuenta caracteres "útiles" descartando espacios y puntuación típica de
 * direcciones (comas, puntos, guiones, símbolo de piso/depto). Letras
 * acentuadas cuentan igual — no hace falta `\p{L}` (target es5, sin flag
 * `u`) porque acá sólo se descarta lo que NO aporta información.
 */
function countUsefulChars(value: string): number {
  return value.replace(/[\s.,°ºª#-]/g, '').length;
}

/**
 * Normaliza un segmento para compararlo: sin tildes, sin mayúsculas, sin
 * espacios de más. "Neuquén" y "neuquen" tienen que contar como el mismo
 * lugar, o la comparación no sirve para nada en direcciones argentinas.
 */
function normalizeSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Segmentos que `address1` ya trae adentro, separados por coma.
 *
 * Se compara por SEGMENTO ENTERO y no por substring a propósito: "Av. Lima
 * 500" no debe hacer desaparecer la ciudad "Lima" de la query, pero "San
 * Martín 300, 25 de Mayo, Neuquén" sí tiene que reconocer que ya dice
 * "25 de Mayo" y "Neuquén".
 */
function segmentsOf(address1: string): Set<string> {
  return new Set(
    address1
      .split(',')
      .map(normalizeSegment)
      .filter((segment) => segment.length > 0)
  );
}

export function composeGeocodeQuery(fields: GeocodeAddressFields): string | null {
  const address1 = fields.address1.trim();
  if (countUsefulChars(address1) < MIN_GEOCODE_QUERY_LENGTH) {
    return null;
  }

  // Sin el autocompletado de Places, `address1` no queda en "calle + altura":
  // el comprador pega o escribe la dirección entera ("San Martín 300, 25 de
  // Mayo, Neuquén") y ciudad/provincia se repiten al final de la query. Esa
  // repetición no es inocua — con "San Martín 300, 25 de Mayo, Neuquén, 25 de
  // Mayo, Neuquén, Q8319, Argentina" Google resuelve a Veinticinco de Mayo de
  // MISIONES, a 1500 km de la dirección que el comprador escribió
  // (DESDEELSUR-70). Cada componente se agrega UNA sola vez.
  const alreadyInAddress1 = segmentsOf(address1);

  const parts = [address1];
  for (const component of [fields.city, fields.province, fields.postalCode]) {
    const trimmed = component.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const normalized = normalizeSegment(trimmed);
    if (alreadyInAddress1.has(normalized)) {
      continue;
    }
    // Un componente repetido entre sí (ciudad "Neuquén" y provincia "Neuquén")
    // tampoco se duplica.
    alreadyInAddress1.add(normalized);
    parts.push(trimmed);
  }
  parts.push('Argentina');

  return parts.join(', ');
}
