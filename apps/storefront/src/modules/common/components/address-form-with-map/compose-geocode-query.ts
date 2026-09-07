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

export function composeGeocodeQuery(fields: GeocodeAddressFields): string | null {
  const address1 = fields.address1.trim();
  if (countUsefulChars(address1) < MIN_GEOCODE_QUERY_LENGTH) {
    return null;
  }

  const parts = [address1, fields.city.trim(), fields.province.trim(), fields.postalCode.trim(), 'Argentina'].filter(
    (part) => part.length > 0
  );

  return parts.join(', ');
}
