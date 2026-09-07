/**
 * Atributos del ASESOR GUIADO: 5 dimensiones faceteables que se derivan del
 * producto al construir el documento, sin escribir nada en la base.
 *
 * Este archivo es el MOTOR y es genérico: no sabe nada de pinturería ni de
 * ningún rubro. Todo el vocabulario (qué categoría implica qué superficie, qué
 * palabra del título implica base al agua) vive en `AdvisorRules`, que es DATO y
 * se carga de la config del store (`whatsapp_advisor_config`). Otro rubro se
 * habilita cargando otras reglas, sin tocar el indexado.
 *
 * **Por qué derivar al indexar y no escribir los atributos en el producto**: son
 * miles de productos y cada `update` dispara un reindex por producto; además
 * cambiar una regla obligaría a un barrido de escrituras en vez de un re-sync.
 * Mismo criterio con el que `family` se lee de `metadata` en vez de reescribirse.
 * La excepción por producto sigue siendo posible: `metadata.advisor_*` PISA la
 * regla (ver la precedencia en `classifyProduct`).
 */

type AnyRecord = Record<string, any>;

export const ADVISOR_DIMENSIONS = [
  'surface',
  'product_type',
  'environment',
  'special_use',
  'base',
] as const;

export type AdvisorDimension = (typeof ADVISOR_DIMENSIONS)[number];

/** Valores por dimensión, tal como se indexan (`advisor_surface`, …). */
export type AdvisorAttributes = {
  advisor_surface: string[];
  advisor_product_type: string[];
  advisor_environment: string[];
  advisor_special_use: string[];
  advisor_base: string[];
};

export type AdvisorAssignment = Partial<Record<AdvisorDimension, string[]>>;

export type AdvisorRules = {
  /** Sube cuando cambian las reglas: sirve para saber si hace falta re-sincronizar. */
  version: number;
  /**
   * Prefijo del `external_id` de categoría que identifica el código del ERP
   * (`zeus:0209` → código `0209`). Vacío = el `external_id` ES el código.
   */
  category_external_id_prefix: string;
  /** Código de categoría → dimensiones. Con fallback por prefijo (ver abajo). */
  by_category_code: Record<string, AdvisorAssignment>;
  /** Familia del ERP → dimensiones. Exacta, y si no, por prefijo del nombre. */
  by_family: Record<string, AdvisorAssignment>;
  /** Palabras del título → dimensiones. Se evalúan TODAS (se acumulan). */
  by_title_keyword: Array<{ match: string[]; set: AdvisorAssignment }>;
  /**
   * Dimensiones que, si quedaron vacías, se indexan con `unknown_value`. Es lo
   * que permite después ofrecer "al agua o lo que haya" sin excluir en silencio
   * a los productos sin clasificar, y medir la cobertura real.
   * `special_use` NO va acá: vacío significa "sin uso especial", no "no sé".
   */
  fill_unknown: AdvisorDimension[];
  unknown_value: string;
};

/** Minúsculas sin tildes: los títulos del ERP mezclan `látex` y `latex`. */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    // Tolera `"wood, metal"` además de `["wood","metal"]`: la metadata de un
    // producto editada a mano en el admin suele venir como texto.
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

function normalizeAssignment(raw: unknown): AdvisorAssignment {
  const out: AdvisorAssignment = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const dim of ADVISOR_DIMENSIONS) {
    const values = asStringArray((raw as AnyRecord)[dim]);
    if (values.length) out[dim] = values;
  }
  return out;
}

function normalizeAssignmentMap(raw: unknown): Record<string, AdvisorAssignment> {
  const out: Record<string, AdvisorAssignment> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw as AnyRecord)) {
    const assignment = normalizeAssignment(value);
    if (Object.keys(assignment).length) out[key] = assignment;
  }
  return out;
}

/**
 * Normaliza reglas venidas de la config (JSON de origen desconocido) a una forma
 * completa y usable. Devuelve `null` cuando no hay NADA aprovechable, que es la
 * señal para no indexar los campos del asesor (mejor sin campos que con campos
 * vacíos que parezcan "no aplica").
 */
export function normalizeAdvisorRules(raw: unknown): AdvisorRules | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as AnyRecord;

  const byCategoryCode = normalizeAssignmentMap(src.by_category_code);
  const byFamily = normalizeAssignmentMap(src.by_family);
  const byTitleKeyword = Array.isArray(src.by_title_keyword)
    ? src.by_title_keyword
        .map((entry: unknown) => {
          const e = (entry ?? {}) as AnyRecord;
          return { match: asStringArray(e.match).map(foldText), set: normalizeAssignment(e.set) };
        })
        .filter((e) => e.match.length > 0 && Object.keys(e.set).length > 0)
    : [];

  if (
    Object.keys(byCategoryCode).length === 0 &&
    Object.keys(byFamily).length === 0 &&
    byTitleKeyword.length === 0
  ) {
    return null;
  }

  const fillUnknown = asStringArray(src.fill_unknown).filter((d): d is AdvisorDimension =>
    (ADVISOR_DIMENSIONS as readonly string[]).includes(d),
  );

  return {
    version: Number.isFinite(Number(src.version)) ? Number(src.version) : 1,
    category_external_id_prefix:
      typeof src.category_external_id_prefix === 'string' ? src.category_external_id_prefix : '',
    by_category_code: byCategoryCode,
    by_family: byFamily,
    by_title_keyword: byTitleKeyword,
    fill_unknown: fillUnknown,
    unknown_value: typeof src.unknown_value === 'string' && src.unknown_value ? src.unknown_value : 'unknown',
  };
}

/**
 * Códigos de ERP del producto: el `external_id` de cada categoría (sacándole el
 * prefijo) más `metadata.erp_category_code`. Los productos cuelgan de niveles
 * MIXTOS del árbol, así que hace falta mirar todas sus categorías.
 */
function collectCategoryCodes(product: AnyRecord, rules: AdvisorRules): string[] {
  const prefix = rules.category_external_id_prefix;
  const codes: string[] = [];

  const categories = Array.isArray(product?.categories) ? (product.categories as AnyRecord[]) : [];
  for (const category of categories) {
    const externalId = typeof category?.external_id === 'string' ? category.external_id : '';
    if (!externalId) continue;
    if (prefix) {
      if (externalId.startsWith(prefix)) codes.push(externalId.slice(prefix.length));
    } else {
      codes.push(externalId);
    }
  }

  const metaCode = product?.metadata?.erp_category_code;
  if (typeof metaCode === 'string' && metaCode) codes.push(metaCode);
  else if (typeof metaCode === 'number') codes.push(String(metaCode));

  return Array.from(new Set(codes.map((c) => c.toUpperCase())));
}

/**
 * Busca la regla del código, y si no hay, la del ancestro: los códigos del ERP
 * son JERÁRQUICOS por prefijo de 2 chars (`02` → `0201` → `020101`), así que
 * `020101` sin regla propia hereda la de `0201` y después la de `02`. Evita
 * tener que enumerar el árbol entero y que un nodo nuevo del ERP quede sin
 * clasificar.
 */
function assignmentForCode(code: string, rules: AdvisorRules): AdvisorAssignment | null {
  for (let len = code.length; len >= 2; len -= 2) {
    const candidate = code.slice(0, len);
    const hit = rules.by_category_code[candidate];
    if (hit) return hit;
  }
  return null;
}

/** Familia exacta, y si no, la regla cuyo nombre sea PREFIJO (ej. `TEXTURADO`). */
function assignmentForFamily(family: string, rules: AdvisorRules): AdvisorAssignment | null {
  const folded = foldText(family);
  for (const [key, assignment] of Object.entries(rules.by_family)) {
    if (foldText(key) === folded) return assignment;
  }
  let best: { length: number; assignment: AdvisorAssignment } | null = null;
  for (const [key, assignment] of Object.entries(rules.by_family)) {
    const foldedKey = foldText(key);
    if (folded.startsWith(foldedKey) && (!best || foldedKey.length > best.length)) {
      best = { length: foldedKey.length, assignment };
    }
  }
  return best?.assignment ?? null;
}

function mergeInto(target: Record<AdvisorDimension, Set<string>>, assignment: AdvisorAssignment): void {
  for (const dim of ADVISOR_DIMENSIONS) {
    for (const value of assignment[dim] ?? []) target[dim].add(value);
  }
}

/**
 * Deriva los 5 atributos del asesor para un producto.
 *
 * Precedencia — la primera fuente que aporta valores para una dimensión GANA, y
 * dentro de una misma fuente los valores se acumulan (un producto en "Paredes
 * interior" y "Paredes exterior" queda apto para los dos ambientes, §11.3):
 *
 *   1. `metadata.advisor_<dim>` — corrección manual por producto.
 *   2. categorías del ERP (con herencia por prefijo).
 *   3. familia del ERP.
 *   4. palabras del título.
 *   5. `unknown` para las dimensiones de `fill_unknown` que quedaron vacías.
 *
 * Devuelve `null` si no hay reglas: el documento entonces no lleva los campos.
 */
export function classifyProduct(product: AnyRecord, rules: AdvisorRules | null): AdvisorAttributes | null {
  if (!rules) return null;

  const acc = {
    surface: new Set<string>(),
    product_type: new Set<string>(),
    environment: new Set<string>(),
    special_use: new Set<string>(),
    base: new Set<string>(),
  } as Record<AdvisorDimension, Set<string>>;

  // 1. Override por producto. La CLAVE PRESENTE gana, incluso vacía.
  //
  // Que un override vacío sea autoritativo no es un detalle: cuando el
  // merchant carga los atributos desde su planilla, "no aplica" (una lija no
  // tiene base agua/solvente) y "no sirve para piso" son AFIRMACIONES, no
  // ausencia de dato. Si un array vacío cayera a las reglas, la regla de
  // categoría volvería a marcar como apto para piso un producto que el
  // merchant marcó explícitamente que no lo es.
  const explicit = new Set<AdvisorDimension>();
  for (const dim of ADVISOR_DIMENSIONS) {
    if (product?.metadata?.[`advisor_${dim}`] === undefined) continue;
    explicit.add(dim);
    for (const value of asStringArray(product.metadata[`advisor_${dim}`])) {
      acc[dim].add(value);
    }
  }

  // 2. Categorías (se acumulan entre todas las del producto).
  const fromCategories: Record<AdvisorDimension, Set<string>> = {
    surface: new Set(), product_type: new Set(), environment: new Set(),
    special_use: new Set(), base: new Set(),
  };
  for (const code of collectCategoryCodes(product, rules)) {
    const assignment = assignmentForCode(code, rules);
    if (assignment) mergeInto(fromCategories, assignment);
  }
  for (const dim of ADVISOR_DIMENSIONS) {
    if (explicit.has(dim)) continue;
    if (acc[dim].size === 0) for (const v of fromCategories[dim]) acc[dim].add(v);
  }

  // 3. Familia.
  const rawFamily = product?.metadata?.family ?? product?.metadata?.zeus_familia;
  if (typeof rawFamily === 'string' && rawFamily) {
    const assignment = assignmentForFamily(rawFamily, rules);
    if (assignment) {
      for (const dim of ADVISOR_DIMENSIONS) {
        if (explicit.has(dim)) continue;
        if (acc[dim].size === 0) for (const v of assignment[dim] ?? []) acc[dim].add(v);
      }
    }
  }

  // 4. Palabras del título (todas las que matcheen).
  const foldedTitle = foldText(typeof product?.title === 'string' ? product.title : '');
  if (foldedTitle) {
    const fromTitle: Record<AdvisorDimension, Set<string>> = {
      surface: new Set(), product_type: new Set(), environment: new Set(),
      special_use: new Set(), base: new Set(),
    };
    for (const entry of rules.by_title_keyword) {
      if (entry.match.some((needle) => foldedTitle.includes(needle))) mergeInto(fromTitle, entry.set);
    }
    for (const dim of ADVISOR_DIMENSIONS) {
      if (explicit.has(dim)) continue;
      if (acc[dim].size === 0) for (const v of fromTitle[dim]) acc[dim].add(v);
    }
  }

  // 5. `unknown` explícito donde corresponda — salvo que el merchant haya dicho
  //    que está vacío a propósito: ahí NO es "no sé", es "no aplica".
  for (const dim of rules.fill_unknown) {
    if (explicit.has(dim)) continue;
    if (acc[dim].size === 0) acc[dim].add(rules.unknown_value);
  }

  return {
    advisor_surface: [...acc.surface],
    advisor_product_type: [...acc.product_type],
    advisor_environment: [...acc.environment],
    advisor_special_use: [...acc.special_use],
    advisor_base: [...acc.base],
  };
}

// ─── Reglas activas del proceso ───────────────────────────────────────────────

/**
 * Las reglas se cargan UNA vez por corrida y quedan en estado de módulo, no se
 * pasan por parámetro: `ProductMapper.toTypesenseObject` es síncrono y lo llaman
 * cuatro caminos distintos (full-sync, incremental, bulkSync del CLI y el resync
 * de demo-store). Con un parámetro, el que se olvidara de pasarlo produciría
 * documentos SIN los campos del asesor y degradaría el índice en silencio —
 * exactamente la divergencia que `reindex.ts` existe para evitar.
 */
const RULES_TTL_MS = 30_000;
let rulesCache: { value: AdvisorRules | null; expires: number } | null = null;
let rulesInflight: Promise<AdvisorRules | null> | null = null;

/** Clave del `store_setting` donde vive la configuración del asesor. */
export const ADVISOR_RULES_SETTING_KEY = 'whatsapp_advisor_config';

type StoreConfigLike = {
  /**
   * `readSetting` y NO `listStoreSettings({ key })`: desde que `store_setting` tiene
   * `site_id`, el listado puede devolver DOS filas —la de la tienda y la global— y
   * quedarse con la primera da un resultado que depende del plan de ejecución.
   */
  readSetting: (key: string, siteId?: string | null) => Promise<{ value?: unknown } | undefined>;
};

async function readAdvisorRules(container: AnyRecord, siteId?: string | null): Promise<AdvisorRules | null> {
  try {
    // Resuelto por CLAVE y no importando el módulo: `store-config` es otra
    // extensión y typesense no la declara como dependencia. Si no está, el
    // asesor simplemente no se indexa.
    const storeConfig = container.resolve('storeConfig') as StoreConfigLike;
    const row = await storeConfig.readSetting(ADVISOR_RULES_SETTING_KEY, siteId);
    const raw = row?.value;
    const config = (raw ?? {}) as AnyRecord;
    // Las reglas van bajo `rules` para que la config pueda crecer con lo del
    // flujo guiado (orden de preguntas, umbrales) sin romper esta lectura.
    return normalizeAdvisorRules(config.rules ?? config);
  } catch {
    return null;
  }
}

/**
 * Carga (con caché de 30 s) las reglas activas. Llamar UNA vez antes de mapear
 * un lote. No lanza nunca: sin reglas, el documento va sin campos del asesor.
 */
export async function loadAdvisorRules(container: AnyRecord): Promise<AdvisorRules | null> {
  const now = Date.now();
  if (rulesCache && rulesCache.expires > now) return rulesCache.value;
  if (rulesInflight) return rulesInflight;

  rulesInflight = readAdvisorRules(container)
    .then((value) => {
      rulesCache = { value, expires: Date.now() + RULES_TTL_MS };
      return value;
    })
    .finally(() => {
      rulesInflight = null;
    });
  return rulesInflight;
}

/** Reglas activas del proceso (síncrono, para el mapper). */
export function getAdvisorRules(): AdvisorRules | null {
  return rulesCache?.value ?? null;
}

/** Invalida la caché — la usa el admin al guardar la config. */
export function invalidateAdvisorRules(): void {
  rulesCache = null;
}
