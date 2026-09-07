/**
 * Lectura de los datos tintométricos que viajan en el documento de Typesense y
 * en la metadata del producto de Medusa.
 *
 * Vive acá y no en cada componente porque lo consumen tres lugares con formas de
 * dato distintas: la card del listado (documento de Typesense), el quick view
 * (que recibe uno u otro según de dónde se abra) y el PDP (producto de Medusa).
 * Todo tolerante: un producto sin estos campos simplemente no es entonable.
 */

type MetadataLike = Record<string, unknown> | null | undefined;

type TintableLike = {
  tintable?: unknown;
  tint_optional?: unknown;
  tint_swatches?: unknown;
  tint_color_count?: unknown;
  metadata?: MetadataLike;
};

const readFlag = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1';

/** `true` si el producto es una base a la que se le elige color. */
export function isTintableProduct(product: TintableLike | null | undefined): boolean {
  if (!product) return false;
  if (readFlag(product.tintable)) return true;
  return readFlag(product.metadata?.tintable);
}

/**
 * `true` si el color es OPCIONAL: la base también se vende terminada.
 *
 * Es la pista del primer render, antes de que `/store/tinting/colors` conteste.
 * Sin ella el blanco que además hace de base arranca con el botón de comprar
 * bloqueado y parpadea. Sólo tiene sentido leerla cuando `isTintableProduct` da
 * `true`; en un producto común no está y devuelve `false`.
 */
export function isOptionalTintProduct(product: TintableLike | null | undefined): boolean {
  if (!product) return false;
  if (readFlag(product.tint_optional)) return true;
  return readFlag(product.metadata?.tint_optional);
}

/** Hex de muestra para la card. Devuelve como máximo `limit`. */
export function tintSwatchesOf(
  product: TintableLike | null | undefined,
  limit = 6
): string[] {
  const raw = product?.tint_swatches ?? product?.metadata?.tint_swatches;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((hex): hex is string => typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex))
    .slice(0, limit);
}

/** Cantidad de colores validados, para el badge. `0` si no se sabe. */
export function tintColorCountOf(product: TintableLike | null | undefined): number {
  const raw = product?.tint_color_count ?? product?.metadata?.tint_color_count;
  const count = Number(raw);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

/**
 * Etiqueta del badge. Con muchos colores se redondea hacia abajo al centenar
 * ("+3.500 colores") porque el número exacto cambia con cada import y no aporta;
 * con pocos se dice el número tal cual para no exagerar.
 */
export function tintBadgeLabel(count: number): string {
  if (count <= 0) return 'Elegí tu color';
  if (count < 100) return `${count} ${count === 1 ? 'color' : 'colores'}`;
  const rounded = Math.floor(count / 100) * 100;
  return `+${rounded.toLocaleString('es-AR')} colores`;
}
