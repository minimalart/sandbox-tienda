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
 * Etiqueta del color como la lee una persona: `Nombre (CÓDIGO)`, o sólo uno de
 * los dos si el otro viene vacío. Es la MISMA forma que arman el widget del
 * admin y el mapeo de mails a partir de la metadata guardada, para que el color
 * no se diga de tres maneras distintas según dónde se mire.
 */
export function tintColorLabel(selection: TintingSelection): string {
  const name = selection.color.name?.trim() ?? '';
  const code = selection.color.code?.trim() ?? '';
  const label = name || code;
  return code && label !== code ? `${label} (${code})` : label;
}

/**
 * Título de la línea entonada: `<producto> — <color> (<código>)`.
 *
 * POR QUÉ SE PISA EL TÍTULO. El resumen de orden del admin (Medusa 2.18) pinta
 * EXACTAMENTE tres cosas de la línea: `title`, `variant_sku` y los valores de
 * las opciones de la variante — verificado en
 * `@medusajs/dashboard/src/routes/orders/order-detail/components/order-summary-section`,
 * líneas 423-436. `subtitle`, que también seteamos acá abajo, no se renderiza en
 * ningún lado del detalle de orden. Y mover el widget de colores entonados no
 * arregla nada: los sufijos `.before`/`.after` de las zonas son legacy y el
 * layout composer los descarta (`dashboard-app.tsx`, `getWidgetsForSections`),
 * así que todo widget cae en la misma sección y el orden lo decide el usuario
 * por drag & drop. `title` es la ÚNICA palanca que pone el color dentro de la
 * tarjeta del pedido.
 *
 * Es seguro pisarlo porque `title` es un snapshot de la línea, no una lectura
 * del producto: las órdenes ya emitidas conservan el suyo.
 *
 * OJO al agregar consumidores: quien ya pinte el color por su cuenta tiene que
 * leer `product_title`, que queda limpio, y NO `title` — si no lo dice dos
 * veces. Hoy son el payload del ERP (`outbox/build-sale-payload.ts`, del que
 * `adapters/zeus.ts` arma la descripción del remito pegándole el color) y el
 * mapeo de líneas de los mails (`subscribers/order-placed-email.ts`).
 */
export function tintLineTitle(
  productTitle: string | null | undefined,
  selection: TintingSelection
): string | undefined {
  const base = productTitle?.trim();
  // Sin título de producto no se arma nada: devolver `undefined` deja que
  // `prepareLineItemData` caiga al título del producto como siempre, en vez de
  // escribir un "undefined — Color X" en la orden.
  if (!base) return undefined;
  const label = tintColorLabel(selection);
  return label ? `${base} — ${label}` : base;
}

/**
 * Subtítulo de la línea. Se sigue seteando además del título porque hay
 * superficies que sí lo renderizan (los formularios de order-edit, claim y
 * exchange del admin, y remitos de terceros), y ahí el color separado del
 * nombre del producto se lee mejor.
 */
export function tintLineSubtitle(selection: TintingSelection): string {
  return `Color: ${tintColorLabel(selection)}`;
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
