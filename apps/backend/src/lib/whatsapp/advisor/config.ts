import {
  ADVISOR_RULES_SETTING_KEY,
  normalizeAdvisorRules,
  type AdvisorRules,
} from '../../../modules/typesense/advisor';
import { PAINT_ADVISOR_RULES } from './vocabulary';

type AnyRecord = Record<string, any>;

/**
 * Configuración del asesor guiado. Vive en el `store_setting`
 * `whatsapp_advisor_config` y se lee/escribe con el `upsertSetting` GENÉRICO de
 * store-config, sin agregar la clave a `STORE_SETTING_KEYS` — así no hay que
 * tocar (ni versionar) la extensión store-config. Mismo camino que usó
 * `catalogador_config`.
 *
 * `rules` es lo único que consume el indexado; el resto lo consume el flujo
 * guiado y se agrega en el PR del asesor (orden de preguntas, umbral para
 * mostrar productos anticipadamente, máximo de resultados).
 */
export type AdvisorConfig = {
  /**
   * `false` = esta tienda NO ofrece el asesor guiado.
   *
   * Las preguntas del asesor (`ADVISOR_FLOW`) son de PINTURERÍA y viven en código:
   * superficie, base, ambiente. Una tienda de otro rubro que nunca configuró esto
   * se lo comía igual, porque el default cae en `PAINT_ADVISOR_RULES`: en un
   * mayorista de almacén, tocar "Necesito ayuda" contestaba "¿sobre qué superficie
   * lo vas a aplicar?". Hasta que las dimensiones sean administrables (§26),
   * poder apagarlo es la única salida honesta.
   *
   * Default `true` para no cambiarle el comportamiento a quien ya lo usa.
   */
  enabled: boolean;
  /** Reglas de clasificación que aplica el indexado de Typesense. */
  rules: AdvisorRules;
  /** Cuántos productos como máximo se ofrecen de una (§16). */
  max_results: number;
  /** Con esta cantidad de resultados o menos, se muestran sin más preguntas (§13). */
  show_threshold: number;
  /** Tope de preguntas antes de mostrar algo igual (§13). */
  max_questions: number;
};

export const ADVISOR_CONFIG_DEFAULTS: AdvisorConfig = {
  enabled: true,
  rules: PAINT_ADVISOR_RULES,
  max_results: 5,
  show_threshold: 5,
  max_questions: 3,
};

const positiveInt = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

/**
 * Devuelve una config COMPLETA a partir de lo guardado (que puede ser parcial,
 * viejo o basura). Mismo patrón que `mergeAiConfig` / `mergePasswordGate` de
 * store-config: el llamador nunca tiene que chequear campos.
 */
export function mergeAdvisorConfig(raw: unknown): AdvisorConfig {
  const src = (raw ?? {}) as AnyRecord;
  return {
    // Sólo un `false` explícito lo apaga: cualquier otra cosa —ausente, basura—
    // deja el asesor como estaba.
    enabled: src.enabled !== false,
    // Si lo guardado no tiene reglas usables, se cae a las del rubro por defecto
    // en vez de quedar sin asesor.
    rules: normalizeAdvisorRules(src.rules) ?? ADVISOR_CONFIG_DEFAULTS.rules,
    max_results: positiveInt(src.max_results, ADVISOR_CONFIG_DEFAULTS.max_results),
    show_threshold: positiveInt(src.show_threshold, ADVISOR_CONFIG_DEFAULTS.show_threshold),
    max_questions: positiveInt(src.max_questions, ADVISOR_CONFIG_DEFAULTS.max_questions),
  };
}

type StoreConfigLike = {
  /**
   * `readSetting` y NO `listStoreSettings({ key })`: desde que `store_setting` tiene
   * `site_id`, el listado puede devolver DOS filas —la de la tienda y la global— y
   * quedarse con la primera da un resultado que depende del plan de ejecución.
   */
  readSetting: (key: string, siteId?: string | null) => Promise<{ value?: unknown } | undefined>;
  upsertSetting: (key: string, value: unknown, siteId?: string | null) => Promise<unknown>;
};

/** Resuelve store-config defensivamente: sin él, se usan los defaults. */
function resolveStoreConfig(container: AnyRecord): StoreConfigLike | null {
  try {
    return container.resolve('storeConfig') as StoreConfigLike;
  } catch {
    return null;
  }
}

/**
 * La fila CRUDA del setting, o `null` si no existe.
 *
 * Hace falta aparte de `getAdvisorConfig` porque ésa mergea sobre los defaults y
 * devuelve una config completa incluso sin nada guardado: con ella es imposible
 * distinguir "todavía no se cargó" de "ya está cargado con la misma versión".
 */
export async function readStoredAdvisorConfig(
  container: AnyRecord,
  siteId?: string | null,
): Promise<AdvisorConfig | null> {
  const storeConfig = resolveStoreConfig(container);
  if (!storeConfig) return null;
  try {
    const row = await storeConfig.readSetting(ADVISOR_RULES_SETTING_KEY, siteId);
    if (!row || row.value == null) return null;
    return mergeAdvisorConfig(row.value);
  } catch {
    return null;
  }
}

export async function getAdvisorConfig(
  container: AnyRecord,
  siteId?: string | null,
): Promise<AdvisorConfig> {
  const storeConfig = resolveStoreConfig(container);
  if (!storeConfig) return ADVISOR_CONFIG_DEFAULTS;
  try {
    const row = await storeConfig.readSetting(ADVISOR_RULES_SETTING_KEY, siteId);
    return mergeAdvisorConfig(row?.value);
  } catch {
    return ADVISOR_CONFIG_DEFAULTS;
  }
}

/** Guarda la config (mergeada sobre lo que ya había) y devuelve el resultado. */
export async function upsertAdvisorConfig(
  container: AnyRecord,
  value: Partial<AdvisorConfig>,
): Promise<AdvisorConfig> {
  const storeConfig = resolveStoreConfig(container);
  if (!storeConfig) throw new Error('store-config no está disponible: no se puede guardar la config del asesor.');
  const current = await getAdvisorConfig(container);
  const merged = mergeAdvisorConfig({ ...current, ...value });
  await storeConfig.upsertSetting(ADVISOR_RULES_SETTING_KEY, merged);
  return merged;
}
