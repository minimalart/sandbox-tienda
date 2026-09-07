/**
 * Construye un query string a partir de un objeto, OMITIENDO los valores
 * `undefined`/`null`/'' (cadena vacía).
 *
 * `new URLSearchParams(obj)` stringifica cada valor con `String()`, así que un
 * `{ q: undefined }` termina como el literal `q=undefined` y el backend filtra por
 * el texto "undefined" → la lista aparece vacía por defecto y solo muestra datos
 * al tipear. Este helper evita ese bug (afectaba el buscador de varias extensiones).
 */
export function toQueryString(query?: Record<string, unknown>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  return params.toString();
}
