/**
 * Imagen de fondo de un diseño de gift card.
 *
 * El diseño semilla `brand-default` que crea el plugin
 * (`ensureDefaultDesign`) apunta a `/images/gift-card-default.svg`: un SVG con
 * el verde y el wordmark de Mercatto QUEMADOS. En cualquier tienda que no sea
 * Mercatto eso se ve como una tarjeta verde con una marca ajena — que es
 * exactamente lo que pasaba en el configurador del PDP.
 *
 * Como ese asset ya está guardado en la fila de la base de datos de las tiendas
 * que existen, no alcanza con cambiar el default del plugin: hay que
 * reconocerlo al LEER. Tratarlo como "sin imagen" hace que la vista previa caiga
 * en el degradado derivado de `--primary-color`, que sí sigue el branding del
 * tenant, y arregla las tiendas ya creadas sin migrar datos.
 *
 * Un diseño que el merchant sube desde el admin nunca cae acá: tiene su propia
 * URL y se respeta tal cual.
 */

/** El asset con la marca Mercatto hardcodeada. */
const LEGACY_BRAND_DEFAULT = "/images/gift-card-default.svg";

/**
 * URL de fondo a usar, o `null` cuando corresponde pintar el degradado de marca.
 */
export function giftCardDesignImage(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  return url === LEGACY_BRAND_DEFAULT ? null : url;
}
