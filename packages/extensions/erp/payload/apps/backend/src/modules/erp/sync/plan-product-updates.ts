import type { ErpCatalogRow } from '../adapters/types';
import type { ErpProductField, ErpSyncLogItemStatus } from '../types';
import { extractColorLabel } from './color-option';
import {
  descriptionRulesFingerprint,
  normalizeProductDescription,
  type NormalizedDescription,
} from './product-description';
import { normalizeProductTitle, titleRulesFingerprint, type TitleRules } from './product-title';

/**
 * Clasificación PURA de la parte de PRODUCTO de un artículo del ERP (testeable
 * sin container): decide si se crea, qué campos se actualizan, o por qué se
 * descarta.
 *
 * El principio es que el ERP es dueño de los datos logísticos y comerciales
 * (dimensiones, peso, código de barras, marca, categoría) pero NO del contenido
 * editorial.
 *
 * `title` y `description` son los casos especiales: el ERP manda los dos como se
 * cargaron en la gestión y ninguno se copia literal — pasan por
 * `product-title.ts` y `product-description.ts`. La diferencia entre ellos es de
 * quién es el campo. El título SIEMPRE es del ERP. La descripción puede ser del
 * catalogador, así que el sync sólo reescribe la que él mismo dejó, y lo
 * reconoce por `zeus_source_description` (ver la política más abajo). El
 * allowlist `description` sigue mandando cuando la normalización está apagada.
 *
 * El título entra crudo como se cargó en la gestión ("EQ ARTE - ACRILICO G2 010
 * PLATEADO X 50 CC"). En un ALTA se normaliza siempre (el alta usa el título del
 * ERP con o sin allowlist); en un producto que ya existe además hace falta
 * `title` en la allowlist, para que actualizar la extensión no arranque a pisar
 * catálogos.
 *
 * El ESTADO del producto creado (`draft` / `published`) y su shipping profile no
 * se deciden acá: son configuración y viven en `apply-product-changes.ts`, que es
 * quien escribe.
 */

export type ExistingProduct = {
  product_id: string;
  variant_id: string;
  title: string | null;
  description: string | null;
  /**
   * Estado de publicación actual del producto. NO lo usa `planProductUpdate` — el
   * estado no es un campo de la allowlist y nunca entra en su patch. Lo consume
   * `planProductStatuses`, que es una fase aparte y opcional (`status_sync`).
   */
  status: string | null;
  weight: number | null;
  length: number | null;
  height: number | null;
  width: number | null;
  barcode: string | null;
  metadata: Record<string, unknown> | null;
  category_ids: string[];
};

export type ProductPlan = {
  status: ErpSyncLogItemStatus;
  /** Patch de producto para `updateProductsWorkflow` (sin `id`, lo pone el caller). */
  product_update?: Record<string, unknown>;
  /**
   * Patch de variante para `updateProductVariantsWorkflow`, con el `id` incluido.
   * NUNCA incluye `prices`: ese workflow borra los precios del price set que no
   * vengan en el payload, y los precios los maneja la fase de precios.
   */
  variant_update?: Record<string, unknown> & { id: string };
  /** Presente solo cuando `status === 'created'`. */
  create?: {
    title: string;
    handle_seed: string;
    description: string | null;
    sku: string;
    /**
     * Presentación normalizada (`1 L`) para el VALOR de la opción de variante.
     * `null` cuando el artículo no trae presentación en el título: ahí va el
     * placeholder, que el storefront esconde a propósito.
     */
    presentation: string | null;
    barcode: string | null;
    weight: number | null;
    length: number | null;
    height: number | null;
    width: number | null;
    metadata: Record<string, unknown>;
    category_code: string | null;
  };
  product_id?: string | null;
  response_payload: Record<string, unknown>;
  error?: string;
};

/**
 * Rastro de la normalización del título, para la política de reescritura y la
 * trazabilidad que pide la especificación ("Título fuente → source_title").
 */
export type ErpTitleMetadata = {
  /** Título CRUDO como lo mandó el ERP, sin ninguna regla aplicada. */
  sourceTitle: string;
  /** Huella de las reglas con las que se normalizó (`titleRulesFingerprint`). */
  fingerprint: string;
  /** Presentación normalizada suelta (`0,25 L`), si el título traía una. */
  presentation: string | null;
  /**
   * Color del vocabulario controlado que aparece en el título (`Roble claro`).
   * Zeus no manda color en ningún campo, así que el título es la única fuente.
   */
  color: string | null;
};

/**
 * Rastro de la normalización de la DESCRIPCIÓN. Espeja `ErpTitleMetadata`: es lo
 * que permite recalcularla cuando sube `DESCRIPTION_RULES_VERSION` sin volver a
 * pedirle el catálogo al ERP, y —sobre todo— lo que distingue una descripción
 * que escribió el sync de una que redactó el catalogador.
 */
export type ErpDescriptionMetadata = {
  /** Descripción CRUDA como la mandó el ERP. */
  sourceDescription: string;
  /** Huella de las reglas con las que se normalizó. */
  fingerprint: string;
};

/**
 * Metadatos que el sync mantiene en la variante. Prefijo `zeus_` para no chocar.
 *
 * `titleMeta` llega solo cuando el camino de escritura de título está vivo
 * (normalización prendida + `title` en la allowlist, o un alta). Sin ese gate,
 * las tres claves nuevas dispararían un diff de metadata en TODAS las variantes
 * de TODAS las instalaciones ERP en el primer barrido después de actualizar, que
 * es exactamente el update masivo inútil que este módulo evita.
 */
export function erpVariantMetadata(
  row: ErpCatalogRow,
  titleMeta?: ErpTitleMetadata | null,
  descriptionMeta?: ErpDescriptionMetadata | null
): Record<string, unknown> {
  return {
    source: 'zeus',
    source_product_id: row.code,
    zeus_por_iva: row.tax_rate,
    // Referencia interna de fábrica. Va acá y NO al `barcode` de la variante: no es
    // un código de barras y contaminaría el checkout por escáner.
    ...(row.factory_code ? { zeus_codigo_fabrica: row.factory_code } : {}),
    ...(row.brand ? { brand: row.brand } : {}),
    ...(row.family ? { zeus_familia: row.family } : {}),
    ...(row.category_code ? { zeus_categoria: row.category_code } : {}),
    ...(titleMeta
      ? {
          zeus_source_title: titleMeta.sourceTitle,
          zeus_title_rules_v: titleMeta.fingerprint,
          ...(titleMeta.presentation ? { zeus_presentacion: titleMeta.presentation } : {}),
          ...(titleMeta.color ? { zeus_color: titleMeta.color } : {}),
        }
      : {}),
    ...(descriptionMeta
      ? {
          zeus_source_description: descriptionMeta.sourceDescription,
          zeus_description_rules_v: descriptionMeta.fingerprint,
        }
      : {}),
  };
}

/**
 * Metadatos del ERP que viven en el PRODUCTO (no en la variante).
 *
 * Están acá y no en `erpVariantMetadata` porque el índice de búsqueda lee
 * `product.metadata`: la metadata de VARIANTE no se indexa (ver
 * `modules/typesense/product-mapper.ts`), así que la marca que el sync escribía
 * en la variante nunca llegaba al filtro del storefront.
 *
 * `erpVariantMetadata` se mantiene igual a propósito: sacarle `brand` /
 * `zeus_familia` dispararía un diff de metadata en todas las variantes del
 * catálogo y un update masivo inútil.
 */
export function erpProductMetadata(row: ErpCatalogRow): Record<string, unknown> {
  return {
    ...(row.brand ? { brand: row.brand } : {}),
    ...(row.family ? { family: row.family } : {}),
    // Código crudo del ERP, para soporte: "¿por qué este producto cayó acá?".
    ...(row.category_code ? { erp_category_code: row.category_code.toUpperCase() } : {}),
  };
}

/**
 * Patch de `product.metadata`, o `null` si no hay nada que escribir. Mergea:
 * nunca borra claves que no son del ERP, y nunca borra un valor existente
 * porque el ERP lo mandó vacío.
 */
export function planProductMetadata(input: {
  row: ErpCatalogRow;
  current: Record<string, unknown> | null;
  fields: ErpProductField[];
}): Record<string, unknown> | null {
  const { row, current, fields } = input;
  const desired = erpProductMetadata(row);

  const allowed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(desired)) {
    if (key === 'brand' && !fields.includes('brand')) continue;
    if (key === 'family' && !fields.includes('family')) continue;
    allowed[key] = value;
  }

  const changed = Object.entries(allowed).some(
    ([key, value]) => (current?.[key] ?? null) !== (value ?? null)
  );
  if (!changed) return null;
  return { ...(current ?? {}), ...allowed };
}

const numbersDiffer = (a: number | null, b: number | null): boolean => {
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return Math.abs(a - b) > 0.0001;
};

const textDiffers = (a: string | null, b: string | null): boolean => (a ?? '') !== (b ?? '');

export function planProductUpdate(input: {
  row: ErpCatalogRow;
  existing: ExistingProduct | undefined;
  fields: ErpProductField[];
  createProducts: boolean;
  onlyPublished: boolean;
  /** Reglas de título resueltas; `null` apaga la normalización (título literal). */
  titleRules?: TitleRules | null;
  /**
   * Códigos de barras que más de un artículo del lote reclama (`findDuplicateBarcodes`).
   * No se escriben en NINGUNO: elegir al primero sería arbitrario y le pondría a un
   * producto el código de otro.
   */
  duplicateBarcodes?: Map<string, string[]> | null;
}): ProductPlan {
  const { row, existing, fields, createProducts, onlyPublished } = input;
  const titleRules = input.titleRules ?? null;
  const allows = (field: ErpProductField): boolean => fields.includes(field);

  if (onlyPublished && (!row.active || !row.published)) {
    return {
      status: 'not_published',
      response_payload: { active: row.active, published: row.published },
    };
  }

  if (!existing) {
    if (!createProducts) {
      return {
        status: 'variant_not_found',
        response_payload: { erp_code: row.code, reason: 'create_products_disabled' },
      };
    }
    const received = row.title?.trim();
    // El alta normaliza SIEMPRE: es el título del ERP con o sin allowlist, así que
    // un producto nuevo tiene que entrar ya con el formato de la tienda.
    const normalized = titleRules
      ? normalizeProductTitle(row.title, { brand: row.brand, factoryCode: row.factory_code, rules: titleRules })
      : null;
    const title = normalized?.title ?? received;
    if (!title) {
      return {
        status: 'failed',
        error: 'El artículo del ERP no tiene descripción; no se puede crear el producto sin título.',
        response_payload: { erp_code: row.code },
      };
    }
    const titleMeta: ErpTitleMetadata | null =
      titleRules && received
        ? {
            sourceTitle: received,
            fingerprint: titleRulesFingerprint(titleRules),
            presentation: normalized?.presentation ?? null,
            color: extractColorLabel(normalized?.title ?? received),
          }
        : null;
    // La descripción del alta pasa por las mismas reglas que el título y por el
    // mismo motivo: hasta acá se copiaba el volcado crudo de la gestión y era lo
    // que el PDP mostraba. Puede volver `null` — dos tercios de lo que manda el
    // ERP es un código interno o el nombre del artículo repetido.
    const describedAs: NormalizedDescription | null = titleRules
      ? normalizeProductDescription(row.description, { title, rules: titleRules })
      : null;
    const descriptionMeta: ErpDescriptionMetadata | null =
      titleRules && row.description?.trim()
        ? {
            sourceDescription: row.description,
            fingerprint: descriptionRulesFingerprint(titleRules),
          }
        : null;
    return {
      status: 'created',
      create: {
        title,
        handle_seed: row.code,
        description: describedAs ? describedAs.description : row.description,
        sku: row.code,
        presentation: normalized?.presentation ?? null,
        // Un barcode compartido tampoco entra en un alta: el constraint único de
        // Medusa haría fallar la creación entera del producto.
        barcode:
          allows('barcode') && row.barcode && !input.duplicateBarcodes?.has(row.barcode)
            ? row.barcode
            : null,
        weight: row.weight,
        length: row.length,
        height: row.height,
        width: row.width,
        metadata: erpVariantMetadata(row, titleMeta, descriptionMeta),
        category_code: allows('category') ? row.category_code : null,
      },
      response_payload: {
        erp_code: row.code,
        title,
        category_code: row.category_code,
        ...(normalized && received && normalized.title !== received
          ? {
              title_rules: {
                received,
                normalized: normalized.title,
                reason: 'created',
                written: true,
                applied: normalized.applied,
                ...(normalized.warnings.length ? { warnings: normalized.warnings } : {}),
              },
            }
          : {}),
      },
    };
  }

  const productUpdate: Record<string, unknown> = {};
  const variantUpdate: Record<string, unknown> & { id: string } = { id: existing.variant_id };
  const changed: string[] = [];

  /**
   * Título visible. Con las reglas prendidas rige la política de reescritura: el
   * título se recalcula en cada corrida (es una función pura del dato del ERP)
   * pero solo se ESCRIBE cuando hay motivo, y son tres:
   *
   *  1. `zeus_source_title` ausente → nunca se normalizó. Es lo que arregla el
   *     catálogo existente en el primer barrido.
   *  2. el título crudo del ERP cambió → Zeus renombró el artículo de verdad.
   *  3. la huella de las reglas cambió → alguien editó el diccionario o subió
   *     `TITLE_RULES_VERSION`.
   *
   * Sin motivo, el título guardado no se toca: una corrección hecha a mano en el
   * admin sobrevive a las corridas siguientes. Y como `normalizeProductTitle` es
   * idempotente, después de la primera pasada los tres motivos dan `false` y el
   * sync deja de escribir títulos — no hace falta ningún flag para que "no los
   * vuelva a romper".
   */
  let titleDetail: Record<string, unknown> | null = null;
  let titleMeta: ErpTitleMetadata | null = null;
  let descriptionDetail: Record<string, unknown> | null = null;
  let descriptionMeta: ErpDescriptionMetadata | null = null;
  if (allows('title') && row.title) {
    if (!titleRules) {
      // Normalización apagada: comportamiento histórico, título literal del ERP.
      if (textDiffers(row.title, existing.title)) {
        productUpdate.title = row.title;
        changed.push('title');
      }
    } else {
      const received = row.title;
      const fingerprint = titleRulesFingerprint(titleRules);
      const normalized = normalizeProductTitle(received, { brand: row.brand, factoryCode: row.factory_code, rules: titleRules });
      titleMeta = {
        sourceTitle: received,
        fingerprint,
        presentation: normalized.presentation,
        color: extractColorLabel(normalized.title),
      };

      const storedSource = existing.metadata?.zeus_source_title;
      const reason =
        typeof storedSource !== 'string'
          ? 'never_normalized'
          : storedSource !== received
            ? 'source_changed'
            : existing.metadata?.zeus_title_rules_v !== fingerprint
              ? 'rules_changed'
              : null;

      const rewrites = Boolean(reason) && Boolean(normalized.title) && textDiffers(normalized.title, existing.title);
      if (rewrites) {
        productUpdate.title = normalized.title;
        changed.push('title');
      }
      // Los warnings se dejan asentados incluso sin reescritura: una unidad
      // desconocida es justamente lo que alguien tiene que ir a mirar (R15).
      if (rewrites || normalized.warnings.length) {
        titleDetail = {
          received,
          normalized: normalized.title,
          reason: reason ?? 'unchanged',
          written: rewrites,
          applied: normalized.applied,
          ...(normalized.warnings.length ? { warnings: normalized.warnings } : {}),
        };
      }
    }
  }
  /**
   * Descripción visible. Rige la MISMA política de reescritura que el título
   * —nunca normalizada / la fuente cambió / cambiaron las reglas— con una
   * condición extra que el título no necesita, y que es la que hace segura toda
   * esta rama:
   *
   * el título SIEMPRE es del ERP; la descripción, no. En desdeelsur hay 37
   * productos con texto redactado por el catalogador y 363 con el volcado crudo
   * de la gestión, y los dos grupos llegan acá sin `zeus_source_description`.
   * Por eso `never_normalized` sólo escribe cuando lo guardado es EXACTAMENTE el
   * crudo del ERP: es la firma de "esto lo escribió el sync", y deja intacto
   * tanto lo redactado como una descripción vacía a propósito.
   *
   * Una vez que la variante tiene `zeus_source_description`, el campo es del
   * sync y se comporta igual que el título. Nada de esto pasa por la allowlist:
   * el ERP no se está quedando con el contenido editorial, está limpiando lo que
   * él mismo dejó.
   */
  if (!titleRules) {
    // Normalización apagada: comportamiento histórico, descripción literal del
    // ERP y sólo si alguien la puso en la allowlist.
    if (allows('description') && row.description && textDiffers(row.description, existing.description)) {
      productUpdate.description = row.description;
      changed.push('description');
    }
  } else if (row.description?.trim()) {
    const fingerprint = descriptionRulesFingerprint(titleRules);
    const storedSource = existing.metadata?.zeus_source_description;
    const reason =
      typeof storedSource !== 'string'
        ? textDiffers(row.description, existing.description)
          ? null // lo guardado no es el crudo del ERP: no es nuestro, no se toca.
          : 'never_normalized'
        : storedSource !== row.description
          ? 'source_changed'
          : existing.metadata?.zeus_description_rules_v !== fingerprint
            ? 'rules_changed'
            : null;

    if (reason) {
      const normalized = normalizeProductDescription(row.description, {
        title: (productUpdate.title as string | undefined) ?? existing.title,
        rules: titleRules,
      });
      descriptionMeta = { sourceDescription: row.description, fingerprint };
      if (textDiffers(normalized.description ?? '', existing.description ?? '')) {
        productUpdate.description = normalized.description;
        changed.push('description');
        descriptionDetail = {
          received: row.description,
          normalized: normalized.description,
          reason,
          ...(normalized.discarded ? { discarded: normalized.discarded } : {}),
          ...(normalized.applied.length ? { applied: normalized.applied } : {}),
        };
      }
    }
  }
  for (const dim of ['weight', 'length', 'height', 'width'] as const) {
    if (allows(dim) && row[dim] !== null && numbersDiffer(row[dim], existing[dim])) {
      productUpdate[dim] = row[dim];
      changed.push(dim);
    }
  }
  // Un GTIN que reclaman varios artículos no se escribe en ninguno: Medusa tiene
  // constraint único en `variant.barcode`, así que dárselo al primero haría fallar
  // a los demás Y le pondría a ese producto un código que puede no ser el suyo.
  const sharedWith = row.barcode ? (input.duplicateBarcodes?.get(row.barcode) ?? null) : null;
  if (allows('barcode') && row.barcode && !sharedWith && textDiffers(row.barcode, existing.barcode)) {
    variantUpdate.barcode = row.barcode;
    changed.push('barcode');
  }
  // Un valor inválido NO borra el barcode que ya está guardado (política del cron:
  // "conservar el último válido y avisar"), pero sí queda asentado para poder
  // corregir el dato en el ERP.
  const barcodeRejected = !allows('barcode')
    ? null
    : sharedWith
      ? `El código ${row.barcode} está cargado en ${sharedWith.length} artículos del ERP ` +
        `(${sharedWith.slice(0, 6).join(', ')}${sharedWith.length > 6 ? '…' : ''}); no se escribe ` +
        'en ninguno hasta que quede en uno solo.'
      : (row.barcode_rejected ?? null);

  // Los metadatos del ERP se mergean siempre (no son contenido editorial y
  // `zeus_por_iva` lo necesita `notifySale` para calcular el neto por línea).
  const desiredMetadata = erpVariantMetadata(row, titleMeta, descriptionMeta);
  const metadataChanged = Object.entries(desiredMetadata).some(
    ([key, value]) => (existing.metadata?.[key] ?? null) !== (value ?? null)
  );
  if (metadataChanged) {
    variantUpdate.metadata = { ...(existing.metadata ?? {}), ...desiredMetadata };
    changed.push('metadata');
  }

  if (!changed.length) {
    return {
      status: 'skipped',
      product_id: existing.product_id,
      response_payload: {
        reason: 'unchanged',
        erp_code: row.code,
        ...(titleDetail ? { title_rules: titleDetail } : {}),
        ...(descriptionDetail ? { description_rules: descriptionDetail } : {}),
        ...(barcodeRejected ? { barcode_warning: barcodeRejected } : {}),
      },
    };
  }

  return {
    status: 'updated',
    ...(Object.keys(productUpdate).length ? { product_update: productUpdate } : {}),
    // `variant_update` arranca con `id`, así que "tiene cambios" es > 1 clave.
    ...(Object.keys(variantUpdate).length > 1 ? { variant_update: variantUpdate } : {}),
    product_id: existing.product_id,
    response_payload: {
      erp_code: row.code,
      changed,
      ...(titleDetail ? { title_rules: titleDetail } : {}),
        ...(descriptionDetail ? { description_rules: descriptionDetail } : {}),
      ...(barcodeRejected ? { barcode_warning: barcodeRejected } : {}),
    },
  };
}
