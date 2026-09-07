import type { ErpCatalogRow } from '../adapters/types';
import { normalizeProductTitle, type TitleRules } from '../sync/product-title';
import { parseTintingBase } from './parse-base';

/**
 * Decide QUÉ bases entonables hay que crear en Medusa, sin tocar nada.
 *
 * Por qué una ruta dedicada y no aflojar el filtro del catalog sync: Zeus marca
 * las bases con `publica_en_ecommerce: "2"`, pero ese flag lo comparten 752
 * artículos de los cuales sólo ~134 son bases — el resto son pinceles,
 * `MODIFICA DESCRIPCIÓN` y `Descuento`. Aceptar el flag en general los metería
 * todos; acá se crea únicamente lo que el detector reconoce como base.
 *
 * La regla de publicación (decidida con el cliente): una base se publica SOLO si
 * ya tiene al menos un color validado contra el ERP. Una base sin carta es una
 * pintura sin opción de color, y eso no es un producto vendible.
 *
 * El título visible sale de `sync/product-title.ts`, igual que en el catalog
 * sync: esta ruta es la SEGUNDA puerta de entrada de productos del ERP, y
 * mientras copió el título crudo de Zeus el listado mezclaba
 * `REVEAR - MARBLE COLOR BASE T X 3,6 LTS` con nombres ya normalizados. Las
 * reglas que más se notan acá son las que se escribieron para las bases: R25
 * redondea el envase (`3,6 LTS` → `x4 lt`) y R26 saca la letra de base del
 * nombre, porque en la tienda se elige el COLOR y la base sale sola.
 */

export type BaseProductPlan = {
  sku: string;
  /** Título visible, ya normalizado (R25/R26). Es el que va a Medusa. */
  title: string;
  /**
   * Título crudo del ERP. Va al `title_snapshot` de la base y al
   * `zeus_source_title` de la variante: es la única forma de recalcular el
   * título cuando cambian las reglas, y lo que se cruza contra Zeus a mano.
   */
  source_title: string;
  description: string | null;
  /** Precio de la lista base del ERP. `null` = no se puede vender. */
  price: number | null;
  category_code: string | null;
  base_letter: string | null;
  product_line: string;
  size_label: string;
  size_liters: number | null;
  /** `published` sólo si la línea+letra ya tiene fórmulas cargadas. */
  status: 'published' | 'draft';
  weight: number | null;
};

export type BaseProductSkip = {
  sku: string;
  title: string;
  reason:
    | 'not_a_base'
    | 'already_in_medusa'
    | 'inactive'
    | 'no_price'
    | 'low_confidence';
};

export type BaseProductsPlan = {
  creates: BaseProductPlan[];
  skips: BaseProductSkip[];
  /** Cuántas de las que se crean quedan publicadas. */
  publishable: number;
};

export type PlanBaseProductsInput = {
  rows: ErpCatalogRow[];
  /** SKUs que ya existen en Medusa (no se recrean). */
  existingSkus: Set<string>;
  /**
   * Claves `producto|letra` que YA tienen fórmulas cargadas. La letra vacía
   * representa las líneas con base única.
   */
  formulaKeys: Set<string>;
  /** Índice de lista del ERP que alimenta el precio (default 1). */
  baseListIndex: number;
  /**
   * Reglas de título ya resueltas; `null` apaga la normalización y deja el
   * título literal del ERP. NO es opcional a propósito: que se pueda omitir es
   * exactamente el olvido que dejó estas bases en mayúsculas.
   */
  titleRules: TitleRules | null;
};

export const formulaKeyOf = (productLine: string, baseLetter: string | null): string =>
  `${productLine.toUpperCase()}|${(baseLetter ?? '').toUpperCase()}`;

/**
 * Título visible de una base a partir del crudo del ERP.
 *
 * Se exporta porque el backfill de las bases YA creadas (que nacieron con el
 * título literal) tiene que llegar exactamente al mismo resultado que esta ruta:
 * si la regla vive en dos lados, el backfill arregla una cosa distinta de la que
 * el sync escribe.
 *
 * Con `rules: null` devuelve el crudo, y si la normalización dejara el título
 * vacío también: un producto sin nombre es peor que uno en mayúsculas.
 */
export function normalizeBaseTitle(
  row: Pick<ErpCatalogRow, 'brand'>,
  sourceTitle: string,
  rules: TitleRules | null
): string {
  if (!rules) return sourceTitle;
  return normalizeProductTitle(sourceTitle, { brand: row.brand, rules }).title || sourceTitle;
}

export function planBaseProducts(input: PlanBaseProductsInput): BaseProductsPlan {
  const creates: BaseProductPlan[] = [];
  const skips: BaseProductSkip[] = [];

  for (const row of input.rows) {
    const sku = row.code?.trim();
    if (!sku) continue;
    // Los descartes se reportan con el título CRUDO: quien mira el plan lo cruza
    // contra la pantalla de Zeus, no contra la tienda.
    const title = row.title?.trim() || sku;

    const parsed = parseTintingBase(row.title);
    if (!parsed) {
      skips.push({ sku, title, reason: 'not_a_base' });
      continue;
    }
    if (parsed.confidence !== 'high') {
      skips.push({ sku, title, reason: 'low_confidence' });
      continue;
    }
    if (input.existingSkus.has(sku)) {
      skips.push({ sku, title, reason: 'already_in_medusa' });
      continue;
    }
    if (row.active === false) {
      skips.push({ sku, title, reason: 'inactive' });
      continue;
    }

    const price = row.prices?.[input.baseListIndex] ?? null;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      // Sin precio no se puede vender, y crear el producto igual dejaría una
      // ficha rota en la tienda.
      skips.push({ sku, title, reason: 'no_price' });
      continue;
    }

    const hasColors = input.formulaKeys.has(formulaKeyOf(parsed.product_line, parsed.base_letter));

    creates.push({
      sku,
      title: normalizeBaseTitle(row, title, input.titleRules),
      source_title: title,
      description: row.description?.trim() || null,
      price,
      category_code: row.category_code?.trim() || null,
      base_letter: parsed.base_letter,
      product_line: parsed.product_line,
      size_label: parsed.size_label,
      size_liters: parsed.size_liters,
      status: hasColors ? 'published' : 'draft',
      weight: typeof row.weight === 'number' ? row.weight : null,
    });
  }

  return {
    creates,
    skips,
    publishable: creates.filter((c) => c.status === 'published').length,
  };
}

/** Handle a partir del título del ERP: minúsculas, sin tildes ni símbolos. */
export function baseHandleSeed(title: string, sku: string): string {
  const slug = title
    .normalize('NFD')
    // Marcas combinantes (las tildes que deja NFD), por escape unicode para no
    // depender de cómo esté guardado este archivo.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  // El SKU al final evita colisiones entre tamaños de la misma línea, que sólo
  // se diferencian por el número.
  return slug ? `${slug}-${sku.toLowerCase()}` : sku.toLowerCase();
}
