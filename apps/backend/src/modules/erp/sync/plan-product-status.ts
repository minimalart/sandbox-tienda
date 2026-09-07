import type { ErpCatalogRow } from '../adapters/types';

/**
 * Clasificación PURA del ESTADO de publicación: decide qué productos de Medusa
 * hay que pasar a `published` y cuáles a `draft` según lo que dice el ERP.
 *
 * Por qué existe: `only_published` nunca fue una sincronización, es un FILTRO de
 * entrada. Un artículo que el ERP dejó de publicar caía en `not_published`, se
 * contaba en el log y no se escribía nada — el producto seguía `published` y a la
 * venta. El barrido completo diario existía justamente porque "Zeus no informa
 * bajas", pero no había nadie del otro lado que actuara sobre esa información.
 *
 * Los flags YA llegan en cada corrida: `getCatalogChanges` no filtra por
 * publicable, así que `row.active` y `row.published` están disponibles sin pedirle
 * nada nuevo al ERP.
 *
 * Reglas, y el motivo de cada una:
 *
 *  1. Publicable en el ERP + producto en `draft` → `publish`. Es lo que despierta
 *     a los que entraron como borrador por `created_product_status: 'draft'`.
 *  2. No publicable en el ERP + producto en `published` → `unpublish` (a `draft`).
 *  3. Producto en `archived`, `rejected` o `proposed` → NUNCA se toca. Esos tres
 *     estados los puso una persona y el ERP no tiene por qué revertirlos: solo se
 *     mueve entre `draft` y `published`.
 *  4. Solo productos que el sync creó (variante con `source_product_id` en la
 *     metadata). Un producto cargado a mano en el admin no se despublica jamás,
 *     ni aunque comparta SKU con un artículo del ERP.
 *  5. `unpublishMissing` + barrido completo: producto del ERP cuyo código no vino
 *     → `unpublish`. Es el artículo BORRADO de la gestión, que no llega ni con los
 *     flags en false. Solo en barrido completo: en un delta "no vino" significa
 *     "no cambió", y aplicarlo ahí vaciaría la tienda cada 15 minutos.
 *
 * El guard de volumen (`max_unpublish_pct`) NO vive acá: esta función dice qué
 * correspondería hacer, y quien decide si el volumen es aceptable es el motor, que
 * es el que conoce el tamaño del lote.
 */

/** Estado de publicación de Medusa, tal como llega de `product.status`. */
export type MedusaProductStatus = 'draft' | 'published' | 'proposed' | 'rejected' | string;

/**
 * Lo mínimo que hace falta saber de un producto para decidir su estado. Lo cumple
 * `ExistingProduct` de `plan-product-updates.ts` tal como viene de
 * `readExistingProducts`, así que el motor no necesita traducir nada.
 */
export type StatusCandidate = {
  product_id: string;
  status: MedusaProductStatus | null;
  /** Metadata de la VARIANTE: es donde el sync deja `source_product_id`. */
  metadata: Record<string, unknown> | null;
};

export type StatusChangeReason =
  /** El ERP lo marca activo y publicable, y estaba en borrador. */
  | 'erp_publishable'
  /** El ERP lo marca inactivo o no publicable, y estaba publicado. */
  | 'erp_not_publishable'
  /** No vino en el barrido completo: borrado de la gestión. */
  | 'missing_in_full_sweep';

export type StatusChange = {
  product_id: string;
  /** Códigos del ERP que apuntan a este producto (puede ser más de uno). */
  codes: string[];
  reason: StatusChangeReason;
};

export type ProductStatusPlan = {
  publish: StatusChange[];
  unpublish: StatusChange[];
  /** Productos del ERP cuyo estado ya coincidía con el del ERP. */
  unchanged: number;
  /** Salteados por no ser del ERP (regla 4). */
  skipped_not_owned: number;
  /**
   * Salteados porque su estado lo puso una persona: `archived`, `rejected`,
   * `proposed`. El ERP solo se mueve entre `draft` y `published` (regla 3).
   */
  skipped_manual_state: number;
};

/**
 * ¿La variante la creó el sync del ERP?
 *
 * `source_product_id` es la señal canónica: la escribe `erpVariantMetadata` y
 * NADIE más pone esa clave en la metadata de una variante. `source === 'zeus'` se
 * acepta además por si alguna fila vieja quedó sin el código.
 *
 * El import de VTEX no cuenta: escribe `source` en la metadata del PRODUCTO, no de
 * la variante, y nunca `source_product_id`.
 */
export function isErpOwnedVariant(metadata: Record<string, unknown> | null): boolean {
  if (!metadata) return false;
  if (typeof metadata.source_product_id === 'string' && metadata.source_product_id.trim()) return true;
  return metadata.source === 'zeus';
}

/** El ERP considera el artículo vendible en la tienda. */
const isPublishableRow = (row: Pick<ErpCatalogRow, 'active' | 'published'>): boolean =>
  Boolean(row.active) && Boolean(row.published);

export function planProductStatuses(input: {
  /** TODAS las filas del ERP de esta corrida, publicables o no. */
  rows: Array<Pick<ErpCatalogRow, 'code' | 'active' | 'published'>>;
  /** Productos que matchean esas filas, por código del ERP. */
  existing: Map<string, StatusCandidate>;
  /**
   * Todos los productos del ERP que existen en Medusa, por código. Solo hace falta
   * para la regla 5; sin esto, "ausente" no se puede detectar.
   */
  erpOwned?: Map<string, StatusCandidate>;
  unpublishMissing: boolean;
  fullSweep: boolean;
}): ProductStatusPlan {
  const { rows, existing, erpOwned, unpublishMissing, fullSweep } = input;

  const plan: ProductStatusPlan = {
    publish: [],
    unpublish: [],
    unchanged: 0,
    skipped_not_owned: 0,
    skipped_manual_state: 0,
  };

  /**
   * Se agrega por `product_id` y no por código porque varios artículos del ERP
   * pueden caer en el MISMO producto de Medusa (una variante cada uno). Si uno
   * solo de ellos sigue publicable, el producto se queda publicado: despublicar
   * porque una de las presentaciones se dio de baja sacaría de la tienda a las
   * otras, que están perfectamente vendibles.
   */
  type Aggregate = {
    product_id: string;
    status: MedusaProductStatus | null;
    codes: string[];
    anyPublishable: boolean;
    /** Todos sus códigos vinieron por ausencia (regla 5) y ninguno por flags. */
    onlyMissing: boolean;
  };
  const byProduct = new Map<string, Aggregate>();

  const track = (
    code: string,
    candidate: StatusCandidate,
    publishable: boolean,
    fromMissing: boolean
  ): void => {
    const current = byProduct.get(candidate.product_id);
    if (!current) {
      byProduct.set(candidate.product_id, {
        product_id: candidate.product_id,
        status: candidate.status,
        codes: [code],
        anyPublishable: publishable,
        onlyMissing: fromMissing,
      });
      return;
    }
    current.codes.push(code);
    current.anyPublishable = current.anyPublishable || publishable;
    current.onlyMissing = current.onlyMissing && fromMissing;
  };

  const seenCodes = new Set<string>();
  for (const row of rows) {
    seenCodes.add(row.code);
    const candidate = existing.get(row.code);
    if (!candidate) continue;
    if (!isErpOwnedVariant(candidate.metadata)) {
      plan.skipped_not_owned += 1;
      continue;
    }
    track(row.code, candidate, isPublishableRow(row), false);
  }

  // Regla 5: los que el ERP ya no conoce. Solo en barrido completo, porque solo
  // ahí "no vino" quiere decir "no existe".
  if (unpublishMissing && fullSweep && erpOwned) {
    for (const [code, candidate] of erpOwned) {
      if (seenCodes.has(code)) continue;
      if (!isErpOwnedVariant(candidate.metadata)) {
        plan.skipped_not_owned += 1;
        continue;
      }
      track(code, candidate, false, true);
    }
  }

  for (const aggregate of byProduct.values()) {
    const change: StatusChange = {
      product_id: aggregate.product_id,
      codes: aggregate.codes,
      reason: aggregate.anyPublishable
        ? 'erp_publishable'
        : aggregate.onlyMissing
          ? 'missing_in_full_sweep'
          : 'erp_not_publishable',
    };

    if (aggregate.anyPublishable) {
      if (aggregate.status === 'published') plan.unchanged += 1;
      // Regla 3: solo se despierta un BORRADOR. `archived`, `rejected` y
      // `proposed` los puso una persona y el ERP no los revierte.
      else if (aggregate.status === 'draft') plan.publish.push(change);
      else plan.skipped_manual_state += 1;
      continue;
    }
    // Se despublica a `draft`, nunca a `archived`: la baja en el ERP puede ser
    // temporal (reposición, error de carga) y `draft` es reversible sin perder
    // links, imágenes ni precios.
    if (aggregate.status === 'published') plan.unpublish.push(change);
    else if (aggregate.status === 'draft') plan.unchanged += 1;
    else plan.skipped_manual_state += 1;
  }

  return plan;
}
