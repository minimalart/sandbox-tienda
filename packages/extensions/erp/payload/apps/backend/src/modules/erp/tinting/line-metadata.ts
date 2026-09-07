import type { TintingSelection } from '../service';

/**
 * `metadata.tint` de la línea del carrito: la única memoria de que esa línea va
 * entonada. La escribe SÓLO la ruta store de tintometría (nunca el navegador) y
 * la leen el carrito, el checkout y el outbox del ERP.
 *
 * Va versionado (`version: 1`) por la misma razón que la config de gift cards:
 * es un objeto que queda guardado en carritos y ÓRDENES viejas, así que cambiar
 * su forma sin poder distinguir versiones rompería pedidos históricos.
 *
 * Ojo con `metadata`: el merge de líneas del core compara la metadata completa
 * para decidir si dos adds son la misma línea. Eso es justo lo que queremos
 * (dos colores distintos = dos líneas; el mismo color dos veces = suma
 * cantidad), pero implica que la base SIN entonar tiene que agregarse sin este
 * objeto — ni siquiera vacío — o mergearía con una línea entonada.
 */
export const TINT_METADATA_VERSION = 1 as const;

export type TintLineMetadata = {
  version: typeof TINT_METADATA_VERSION;
  /** `codBase`: artículo base en el ERP (= SKU de la variante). */
  cod_base: string;
  /** `codFormula` como lo muestra Gestión, CON espacios (se normaliza al llamar). */
  cod_formula: string;
  color_code: string;
  color_name: string;
  collection: string;
  color_hex: string | null;
  /** Lista del ERP con la que se cotizó, para auditar. */
  lista: number;
  /** Precio unitario cotizado, para comparar en la re-cotización del checkout. */
  quoted_unit_price: number;
};

export function buildTintMetadata(input: {
  selection: TintingSelection;
  list_index: number;
  unit_price: number;
}): { tint: TintLineMetadata } {
  const { selection } = input;
  return {
    tint: {
      version: TINT_METADATA_VERSION,
      cod_base: selection.base.article_code,
      cod_formula: selection.formula.zeus_formula_code,
      color_code: selection.color.code,
      color_name: selection.color.name,
      collection: selection.color.collection,
      color_hex: selection.color.hex,
      lista: input.list_index,
      quoted_unit_price: input.unit_price,
    },
  };
}

/**
 * Subtítulo de la línea. Se setea además de la metadata para que cualquier cosa
 * que ya renderice `subtitle` (mails, panel de admin, remitos) muestre el color
 * sin tocar nada.
 */
export function tintLineSubtitle(selection: TintingSelection): string {
  return `Color: ${selection.color.name} (${selection.color.code})`;
}

/** Lee `metadata.tint` con validación defensiva: viene de un carrito, no de nosotros. */
export function readTintMetadata(
  metadata: Record<string, unknown> | null | undefined
): TintLineMetadata | null {
  const tint = metadata?.tint;
  if (!tint || typeof tint !== 'object') return null;
  const candidate = tint as Partial<TintLineMetadata>;
  if (typeof candidate.cod_base !== 'string' || !candidate.cod_base.trim()) return null;
  if (typeof candidate.cod_formula !== 'string' || !candidate.cod_formula.trim()) return null;
  return {
    version: TINT_METADATA_VERSION,
    cod_base: candidate.cod_base,
    cod_formula: candidate.cod_formula,
    color_code: typeof candidate.color_code === 'string' ? candidate.color_code : '',
    color_name: typeof candidate.color_name === 'string' ? candidate.color_name : '',
    collection: typeof candidate.collection === 'string' ? candidate.collection : '',
    color_hex: typeof candidate.color_hex === 'string' ? candidate.color_hex : null,
    lista: typeof candidate.lista === 'number' ? candidate.lista : 0,
    quoted_unit_price:
      typeof candidate.quoted_unit_price === 'number' ? candidate.quoted_unit_price : 0,
  };
}
