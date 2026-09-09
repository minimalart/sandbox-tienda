/**
 * Lectura del `response_payload` de un item de sync log, para la tabla y para el
 * drawer del detalle.
 *
 * POR QUÉ EXISTE. La versión anterior vivía como `payloadSummary()` dentro de
 * `logs/[id]/page.tsx` y sólo conocía claves de **stock_sync** (`erp_quantity`,
 * `previous_stocked`, `reserved_quantity`…). Los items de **catalog_sync**
 * guardan otra forma entera, así que ni una clave matcheaba y la columna
 * "Detalle" devolvía `—`. Medido en desdeelsur (log
 * `erpsl_01M1Y8Q9GJM8KMNTNJCXQ13BGS`): **2463 de 2463** filas en `—`.
 *
 * Y LA COLUMNA "ERROR" ESTÁ VACÍA PORQUE NO HAY ERROR. El `error` del item se
 * puebla sólo con fallos reales (`productError`, el error del chunk de precios o
 * `plan.error`). El MOTIVO de un item que no falló pero tampoco hizo nada vive en
 * el payload: los 723 `variant_not_found` de esa corrida traen
 * `product: { active: false, published: false, status: 'not_published' }` — o sea
 * "el ERP no lo publica", no un bug. Por eso el resumen ARRANCA por el motivo:
 * el operador tiene que poder leer qué pasó sin abrir nada.
 *
 * Las etiquetas van en castellano literal, igual que hacía `payloadSummary`: es
 * un volcado de datos del ERP, no chrome de la pantalla. Lo que sí pasa por i18n
 * son los títulos del drawer.
 */

/** Un dato del payload, ya legible. */
export type PayloadField = {
  label: string;
  value: string;
  /** `error` pinta rojo, `muted` gris; el resto, color de texto normal. */
  tone?: 'default' | 'muted' | 'error';
};

/** Un bloque del drawer (Producto, Precios, Título…). */
export type PayloadSection = {
  title: string;
  fields: PayloadField[];
};

type Dict = Record<string, unknown>;

const isDict = (value: unknown): value is Dict =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asDict = (value: unknown): Dict | null => (isDict(value) ? value : null);

const asText = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  return null;
};

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(asText).filter((item): item is string => Boolean(item)) : [];

/** Monto con separadores es-AR. Los precios llegan como number del bigNumber. */
const money = (value: unknown): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value
  );
};

/**
 * Los enums que el backend guarda crudos. Sin esto la pantalla dice
 * `create_products_disabled`, que es una clave de código, no una explicación.
 */
const REASONS: Record<string, string> = {
  unchanged: 'sin cambios',
  created: 'alta del producto',
  create_products_disabled: 'el alta de productos está apagada en la configuración',
  no_base_price: 'el ERP no manda precio en la lista base',
  never_normalized: 'nunca se había normalizado',
  source_changed: 'cambió el texto en el ERP',
  rules_changed: 'cambiaron las reglas de normalización',
  no_price_in_erp: 'el ERP no manda precio para esa lista',
  invalid_price: 'el ERP mandó un precio inválido',
};

const PRODUCT_STATUS: Record<string, string> = {
  created: 'creado',
  updated: 'actualizado',
  skipped: 'sin cambios',
  not_published: 'el ERP no lo publica',
  variant_not_found: 'no existe en Medusa',
  failed: 'falló',
  price_unchanged: 'sin cambios',
};

/** Campos del producto que el sync sabe escribir, en castellano. */
const FIELDS: Record<string, string> = {
  title: 'título',
  description: 'descripción',
  metadata: 'metadatos',
  barcode: 'código de barras',
  weight: 'peso',
  length: 'largo',
  height: 'alto',
  width: 'ancho',
};

const ATTRIBUTION_STATUS: Record<string, string> = {
  linked: 'vinculada',
  unchanged: 'sin cambios',
  no_product: 'el artículo no tiene producto en Medusa',
  no_category: 'el artículo no trae categoría',
  no_brand: 'el artículo no trae marca',
  unknown_code: 'código desconocido para la tienda',
};

const PUBLICATION_ACTION: Record<string, string> = {
  publish: 'se publicó',
  unpublish: 'se despublicó',
  unpublish_blocked_by_guard: 'despublicación BLOQUEADA por el guard',
};

const label = (table: Record<string, string>, key: unknown): string | null => {
  const raw = asText(key);
  if (!raw) return null;
  return table[raw] ?? raw;
};

/** Motivos que el planner registra por artículo dentro de `product`. */
const productReason = (product: Dict | null): string | null => {
  if (!product) return null;
  const status = asText(product.status);
  // `not_published` trae los dos flags del ERP y son lo que hay que ir a mirar.
  if (status === 'not_published') {
    const flags: string[] = [];
    if (product.active === false) flags.push('inactivo');
    if (product.published === false) flags.push('no publicado');
    const detail = flags.length ? ` (${flags.join(' y ')} en el ERP)` : '';
    return `el ERP no lo publica${detail}`;
  }
  const reason = label(REASONS, product.reason);
  const statusText = status ? PRODUCT_STATUS[status] ?? status : null;
  if (statusText && reason && reason !== statusText) return `${statusText} — ${reason}`;
  return statusText ?? reason;
};

/** `changed: ['title','metadata']` → "título, metadatos". */
const changedFields = (product: Dict | null): string | null => {
  const changed = asList(product?.changed);
  if (!changed.length) return null;
  return changed.map((field) => FIELDS[field] ?? field).join(', ');
};

/**
 * Normalización de texto (título o descripción). Es el dato por el que se abre
 * esta pantalla cuando alguien toca el diccionario de títulos: sin el
 * "recibido → normalizado" no hay forma de saber si la regla mordió.
 *
 * OJO: en `catalog_sync` vive en `product.title_rules`, no en la raíz. La
 * versión anterior lo buscaba en la raíz —donde sólo está en `stock_sync`— así
 * que en el catálogo nunca se veía.
 */
const rulesLine = (rules: unknown, kind: 'título' | 'descripción'): string | null => {
  const detail = asDict(rules);
  if (!detail) return null;
  const received = asText(detail.received);
  const normalized = asText(detail.normalized);
  if (!received && !normalized) return null;
  const written = detail.written === undefined ? true : detail.written === true;
  const head = written ? kind : `${kind} (sin escribir)`;
  return `${head}: ${received ?? '—'} → ${normalized ?? '—'}`;
};

const priceLine = (base: Dict | null): string | null => {
  if (!base) return null;
  const amount = money(base.amount);
  if (!amount) return null;
  const previous = money(base.previous);
  if (previous && previous !== amount) return `precio: ${previous} → ${amount}`;
  return `precio: ${amount}${previous ? ' (sin cambio)' : ''}`;
};

const priceListLine = (entry: Dict): string => {
  const title = asText(entry.title) ?? `lista ${asText(entry.list_index) ?? '?'}`;
  const created = money(entry.created);
  if (created) return `${title}: alta ${created}`;
  const unchanged = money(entry.unchanged);
  if (unchanged) return `${title}: ${unchanged} (sin cambio)`;
  const amount = money(entry.amount);
  if (amount) {
    const previous = money(entry.previous);
    return previous ? `${title}: ${previous} → ${amount}` : `${title}: ${amount}`;
  }
  const skipped = label(REASONS, entry.skipped);
  if (skipped) {
    const kept = money(entry.kept);
    return `${title}: salteada — ${skipped}${kept ? ` (queda ${kept})` : ''}`;
  }
  return `${title}: —`;
};

/**
 * Una línea para la celda "Detalle" de la tabla.
 *
 * Cubre las DOS formas de payload —`stock_sync` y `catalog_sync`— porque la
 * misma tabla muestra las dos, y el tipo del log no viaja en el item.
 */
export function summarizeItemPayload(payload: Record<string, unknown> | null): string {
  if (!payload) return '—';
  const parts: string[] = [];

  // ── stock_sync ────────────────────────────────────────────────────────────
  if (payload.erp_quantity !== undefined) parts.push(`ERP: ${String(payload.erp_quantity)}`);
  if (
    payload.normalized_quantity !== undefined &&
    payload.normalized_quantity !== payload.erp_quantity
  ) {
    parts.push(`→ ${String(payload.normalized_quantity)}`);
  }
  if (payload.previous_stocked !== undefined) parts.push(`antes: ${String(payload.previous_stocked)}`);
  if (payload.reserved_quantity !== undefined) {
    parts.push(`reservado: ${String(payload.reserved_quantity)}`);
  }

  // ── catalog_sync ──────────────────────────────────────────────────────────
  const product = asDict(payload.product);
  // El motivo va PRIMERO: es la respuesta a "¿qué pasó con este artículo?", que
  // es lo que se venía a buscar y lo que la columna "Error" no puede dar.
  const reason = productReason(product) ?? label(REASONS, payload.reason);
  if (reason) parts.push(reason);

  const changed = changedFields(product);
  if (changed) parts.push(`campos: ${changed}`);

  // En `catalog_sync` la normalización vive bajo `product`; en `stock_sync`, en
  // la raíz. Se miran las dos y gana la que exista.
  const titleRules = asDict(product?.title_rules ?? payload.title_rules);
  const title = rulesLine(titleRules, 'título');
  if (title) parts.push(title);
  const description = rulesLine(product?.description_rules, 'descripción');
  if (description) parts.push(description);

  const price = priceLine(asDict(payload.base));
  if (price) parts.push(price);

  const lists = Array.isArray(payload.price_lists) ? payload.price_lists.filter(isDict) : [];
  for (const entry of lists) parts.push(priceListLine(entry));

  // Categoría y marca sólo se muestran cuando hicieron algo o cuando explican
  // por qué no: `unchanged` en las 2696 filas de un barrido es puro ruido.
  const category = asDict(payload.category);
  if (category && asText(category.status) !== 'unchanged') {
    const text = label(ATTRIBUTION_STATUS, category.status);
    const code = asText(category.code);
    if (text) parts.push(`categoría${code ? ` ${code}` : ''}: ${text}`);
  }
  const brand = asDict(payload.brand);
  if (brand && asText(brand.status) !== 'unchanged') {
    const text = label(ATTRIBUTION_STATUS, brand.status);
    const handle = asText(brand.handle);
    if (text) parts.push(`marca${handle ? ` ${handle}` : ''}: ${text}`);
  }

  const publication = asDict(payload.publication);
  if (publication) {
    const action = label(PUBLICATION_ACTION, publication.action);
    const why = asText(publication.reason);
    if (action) parts.push(`publicación: ${action}${why ? ` (${why})` : ''}`);
  }

  // ── comunes ───────────────────────────────────────────────────────────────
  parts.push(...asList(titleRules?.warnings));
  const barcodeWarning = asText(product?.barcode_warning ?? payload.barcode_warning);
  if (barcodeWarning) parts.push(`código de barras: ${barcodeWarning}`);
  const warning = asText(payload.warning);
  if (warning) parts.push(warning);
  if (payload.dry_run_writes !== undefined) {
    parts.push(`simulación: ${String(payload.dry_run_writes)} escrituras`);
  }

  return parts.length ? parts.join(' · ') : '—';
}

/**
 * El payload abierto en bloques, para el drawer.
 *
 * Se arma desde el mismo lugar que el resumen a propósito: si la tabla y el
 * drawer leyeran el payload por separado, dirían cosas distintas al primer
 * cambio de forma en el backend.
 */
export function describeItemPayload(payload: Record<string, unknown> | null): PayloadSection[] {
  if (!payload) return [];
  const sections: PayloadSection[] = [];
  const push = (title: string, fields: Array<PayloadField | null>): void => {
    const clean = fields.filter((field): field is PayloadField => Boolean(field));
    if (clean.length) sections.push({ title, fields: clean });
  };

  const product = asDict(payload.product);
  const reason = productReason(product) ?? label(REASONS, payload.reason);

  push('Qué pasó', [
    reason ? { label: 'Resultado', value: reason } : null,
    changedFields(product) ? { label: 'Campos escritos', value: changedFields(product)! } : null,
    asText(payload.erp_code ?? product?.erp_code)
      ? { label: 'Código del ERP', value: asText(payload.erp_code ?? product?.erp_code)! }
      : null,
    asText(payload.variant_id) ? { label: 'Variante', value: asText(payload.variant_id)!, tone: 'muted' } : null,
  ]);

  // ── stock ─────────────────────────────────────────────────────────────────
  push('Stock', [
    payload.erp_quantity !== undefined
      ? { label: 'Cantidad del ERP', value: String(payload.erp_quantity) }
      : null,
    payload.normalized_quantity !== undefined
      ? { label: 'Normalizada', value: String(payload.normalized_quantity) }
      : null,
    payload.previous_stocked !== undefined
      ? { label: 'Antes', value: String(payload.previous_stocked), tone: 'muted' }
      : null,
    payload.reserved_quantity !== undefined
      ? { label: 'Reservado', value: String(payload.reserved_quantity), tone: 'muted' }
      : null,
  ]);

  // ── normalización ─────────────────────────────────────────────────────────
  const titleRules = asDict(product?.title_rules ?? payload.title_rules);
  const descriptionRules = asDict(product?.description_rules);
  push('Normalización de texto', [
    titleRules && asText(titleRules.received)
      ? { label: 'Título recibido', value: asText(titleRules.received)!, tone: 'muted' }
      : null,
    titleRules && asText(titleRules.normalized)
      ? { label: 'Título normalizado', value: asText(titleRules.normalized)! }
      : null,
    titleRules
      ? {
          label: '¿Se escribió?',
          value:
            titleRules.written === true
              ? 'sí'
              : `no${label(REASONS, titleRules.reason) ? ` — ${label(REASONS, titleRules.reason)}` : ''}`,
          tone: titleRules.written === true ? 'default' : 'muted',
        }
      : null,
    // `applied` son los IDs de las reglas que mordieron (R10, R19, R25…). Es lo
    // que se mira para saber si el diccionario hizo algo.
    asList(titleRules?.applied).length
      ? { label: 'Reglas aplicadas', value: asList(titleRules!.applied).join(', '), tone: 'muted' }
      : null,
    asList(titleRules?.warnings).length
      ? { label: 'Avisos', value: asList(titleRules!.warnings).join(' · '), tone: 'error' }
      : null,
    descriptionRules && asText(descriptionRules.received)
      ? { label: 'Descripción recibida', value: asText(descriptionRules.received)!, tone: 'muted' }
      : null,
    descriptionRules && asText(descriptionRules.normalized)
      ? { label: 'Descripción normalizada', value: asText(descriptionRules.normalized)! }
      : null,
    descriptionRules && asText(descriptionRules.discarded)
      ? { label: 'Descartada', value: asText(descriptionRules.discarded)!, tone: 'muted' }
      : null,
  ]);

  // ── precios ───────────────────────────────────────────────────────────────
  const base = asDict(payload.base);
  const lists = Array.isArray(payload.price_lists) ? payload.price_lists.filter(isDict) : [];
  push('Precios', [
    priceLine(base) ? { label: 'Base', value: priceLine(base)!.replace('precio: ', '') } : null,
    asText(payload.tax_rate) ? { label: 'IVA', value: `${asText(payload.tax_rate)}%`, tone: 'muted' } : null,
    asText(payload.erp_price) ? { label: 'Precio crudo del ERP', value: asText(payload.erp_price)! } : null,
    ...lists.map((entry) => ({
      label: asText(entry.title) ?? `Lista ${asText(entry.list_index) ?? '?'}`,
      value: priceListLine(entry).replace(/^[^:]+:\s*/, ''),
    })),
  ]);

  // ── atribución y publicación ──────────────────────────────────────────────
  const category = asDict(payload.category);
  const brand = asDict(payload.brand);
  const publication = asDict(payload.publication);
  push('Categoría, marca y publicación', [
    category
      ? {
          label: `Categoría${asText(category.code) ? ` ${asText(category.code)}` : ''}`,
          value: label(ATTRIBUTION_STATUS, category.status) ?? '—',
        }
      : null,
    brand
      ? {
          label: `Marca${asText(brand.handle) ? ` ${asText(brand.handle)}` : ''}`,
          value: label(ATTRIBUTION_STATUS, brand.status) ?? '—',
        }
      : null,
    publication
      ? {
          label: 'Publicación',
          value: `${label(PUBLICATION_ACTION, publication.action) ?? '—'}${
            asText(publication.reason) ? ` (${asText(publication.reason)})` : ''
          }`,
          tone: asText(publication.action) === 'unpublish_blocked_by_guard' ? 'error' : 'default',
        }
      : null,
  ]);

  // ── el resto ──────────────────────────────────────────────────────────────
  push('Avisos', [
    asText(product?.barcode_warning ?? payload.barcode_warning)
      ? {
          label: 'Código de barras',
          value: asText(product?.barcode_warning ?? payload.barcode_warning)!,
          tone: 'error',
        }
      : null,
    asText(payload.warning) ? { label: 'Aviso', value: asText(payload.warning)!, tone: 'error' } : null,
    asList(payload.variant_ids).length
      ? { label: 'Variantes con el mismo SKU', value: asList(payload.variant_ids).join(', '), tone: 'error' }
      : null,
    payload.dry_run_writes !== undefined
      ? { label: 'Simulación', value: `${String(payload.dry_run_writes)} escrituras que no se hicieron` }
      : null,
  ]);

  return sections;
}
