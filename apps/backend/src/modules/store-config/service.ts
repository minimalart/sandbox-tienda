import { MedusaService } from '@medusajs/framework/utils';
import { MinimumPurchase, StoreSetting } from './models';
import { minimumPurchaseFilter, pickEffectiveMinimumPurchase } from './minimum-purchase';
import {
  mergeLegalPages,
  normalizeStoredDoc,
  type LegalPagesResult,
} from './legal/defaults';
import {
  LEGAL_PAGE_SLUGS,
  type LegalPageDocInput,
  type LegalPageSlug,
} from './legal/pages';
import { aiConfigSeed } from './settings';

/** Known store setting keys (managed from the admin "Preferencias" screen). */
export const STORE_SETTING_KEYS = {
  MULTI_BRANCH_ENABLED: 'multi_branch_enabled',
  REQUIRE_BRANCH_COVERAGE: 'require_branch_coverage',
  /**
   * ¿Se dibuja el selector de zona (`BranchGate`) en la tienda?
   *
   * Sub-flag de `MULTI_BRANCH_ENABLED`, y existe porque ese flag gobernaba CINCO
   * comportamientos con un solo booleano: la barra del selector, la resolución de
   * sucursal al guardar dirección, la resolución al loguearse, la del checkout y
   * el gate de cobertura de `/store/shipping-options`. Una tienda que necesita el
   * gate de cobertura no tenía forma de prenderlo sin arrastrar la barra.
   *
   * DEFAULT `true`: quien ya tiene multi-sucursal andando ve exactamente lo mismo
   * después de este cambio. Sólo apagándolo explícitamente desaparece la barra —
   * ojo con esto al leerlo, porque es el ÚNICO de los toggles de esta pantalla
   * cuyo fallback no es `false`.
   */
  BRANCH_GATE_PROMPT_ENABLED: 'branch_gate_prompt_enabled',
  BARCODE_SCANNER_ENABLED: 'barcode_scanner_enabled',
  SHOP_BY_LOOK_ENABLED: 'shop_by_look_enabled',
  PDF_CATALOG_ENABLED: 'pdf_catalog_enabled',
  COOKIE_BANNER_ENABLED: 'cookie_banner_enabled',
  EMAIL_BRANDING: 'email_branding',
  AI_CONFIG: 'ai_config',
  PASSWORD_GATE: 'password_gate',
  COMMERCE_CONFIG: 'commerce_config',
  /**
   * Los textos de las tres páginas legales del storefront. UNA sola clave con las
   * tres adentro, no una por página: `readSetting` resuelve precedencia por CLAVE,
   * así que tres claves harían que una tienda que sólo editó sus términos heredara
   * la privacidad de la fila global — dos capas distintas en la misma pantalla.
   */
  LEGAL_PAGES: 'legal_pages',
} as const;

/**
 * PasswordGate — "página de contraseña" de la TIENDA PRINCIPAL. Cuando está
 * activa, el storefront no se puede navegar sin ingresar `password`: sirve para
 * publicar una tienda que todavía no abrió al público.
 *
 * Las demos NO usan este setting: cada una guarda lo suyo en las columnas
 * `password_gate_enabled` / `password_gate_password` de `demo_store`.
 *
 * `password` nunca se expone en la API pública: GET /store/store-config publica
 * sólo `{ enabled, length }` y la verificación vive en el backend.
 */
export type PasswordGate = { enabled: boolean; password: string };

/**
 * Largo aceptado de la palabra. El formulario del gate dibuja una casilla por
 * carácter en una sola fila, así que el tope es el que entra sin que las casillas
 * wrapeen en mobile.
 */
export const PASSWORD_GATE_MIN_LENGTH = 4;
export const PASSWORD_GATE_MAX_LENGTH = 6;

export const PASSWORD_GATE_DEFAULTS: PasswordGate = { enabled: false, password: '' };

/**
 * Normaliza para GUARDAR: sin espacios y dentro del rango; cualquier otra cosa → ''.
 * Usarla en el camino de escritura (rutas de admin), no al leer.
 */
export function normalizeGatePassword(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (/\s/.test(raw)) return '';
  if (raw.length < PASSWORD_GATE_MIN_LENGTH || raw.length > PASSWORD_GATE_MAX_LENGTH) return '';
  return raw;
}

/**
 * Normaliza para LEER: igual que la de arriba pero SIN tope de largo.
 *
 * El máximo bajó de 12 a 6 después de que ya había gates activos con palabras más
 * largas. Aplicar el tope nuevo al leer las habría invalidado, apagando el gate y
 * dejando ESOS SITIOS ABIERTOS AL PÚBLICO sin que nadie toque nada. Una palabra
 * vieja y larga sigue funcionando (con las casillas wrapeadas) hasta que se la
 * reemplace desde el admin, que sí exige el rango nuevo.
 */
export function normalizeStoredGatePassword(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (/\s/.test(raw)) return '';
  if (raw.length < PASSWORD_GATE_MIN_LENGTH) return '';
  return raw;
}

/**
 * Mergea un valor parcial/crudo sobre los defaults. Sin una palabra usable el
 * gate queda APAGADO a la fuerza: un gate prendido sin clave dejaría la tienda
 * inaccesible para todo el mundo, incluido el dueño.
 *
 * `normalize` permite endurecer el criterio en el camino de escritura.
 */
function mergePasswordGate(
  raw: unknown,
  normalize: (value: unknown) => string = normalizeStoredGatePassword,
): PasswordGate {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const password = normalize(v.password);
  return { enabled: password !== '' && v.enabled === true, password };
}

/**
 * EmailBranding — brand presentation injected into every outgoing email.
 *
 * `primary_color_bg` is NOT stored here: it is DERIVED at send time via
 * `hexToRgba(primary_color, 0.1)` so the stored shape stays minimal.
 */
export type EmailBranding = {
  primary_color: string; // hex, default '#2e7d32'
  text_color: string; // hex, default '#111111'
  logo_url: string | null; // public S3 URL
  cde_display_name: string | null; // brand/store name fallback when no logo
  admin_notification_email: string | null;
};

/** Sensible defaults applied when the `email_branding` row is unset/partial. */
export const EMAIL_BRANDING_DEFAULTS: EmailBranding = {
  primary_color: '#2e7d32',
  text_color: '#111111',
  logo_url: null,
  cde_display_name: null,
  admin_notification_email: null,
};

const trimToNull = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
};

/**
 * AiConfig — parámetros de IA gestionados desde la pantalla "Preferencias".
 *
 * Antes vivían en variables de entorno (OPENROUTER_MODEL, CHAT_AI_*,
 * LANDING_AI_MAX_RETRIES). La fuente de verdad de lo EFECTIVO es este setting,
 * que además es por tienda; lo que cambió con `app-settings` es de dónde sale la
 * SEMILLA del default: los seis campos de modelos ya no la sacan del entorno sino
 * de la card de su extensión dueña (Asistente IA y Landings con IA), leída por
 * namespace desde `store-config/settings.ts`. Los seis restantes —validación y
 * memoria— siguen sembrándose del entorno porque no los lee ningún otro módulo y
 * por lo tanto no hay a quién apuntar. Ver `aiConfigDefaults()`.
 */
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';

export type AiConfig = {
  text_model: string; // generación de landings (OpenRouter)
  text_max_retries: number; // reintentos ante JSON inválido (0-5)
  chat_model: string; // Asistente IA del admin
  chat_reasoning_effort: ReasoningEffort;
  chat_max_tokens: number; // tokens de salida por turno (incluye reasoning)
  chat_validation_enabled: boolean; // valida grounding de la respuesta (anti-alucinación)
  image_model: string; // generación de imágenes (nano banana)
  image_quality: number; // calidad WebP (40-90)
  image_max_kb: number; // peso objetivo por imagen en KB (50-1000)
  // Memoria vectorizada (pgvector). Default OFF: rollout seguro (regresión cero).
  memory_enabled: boolean; // recuperar memoria e inyectarla al prompt
  memory_autocapture_enabled: boolean; // ofrecer la tool `remember` al agente
  memory_autocapture_requires_approval: boolean; // auto-capturada entra como 'pending'
  memory_retrieval_topk: number; // memorias a inyectar por turno (1-20)
  memory_min_similarity: number; // umbral de similitud coseno (0-1)
  embeddings_model: string; // modelo de embeddings (OpenRouter)
};

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
};

const clampFloat = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const asBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const normalizeEffort = (value: unknown): ReasoningEffort | null => {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return v === 'minimal' || v === 'low' || v === 'medium' || v === 'high' ? v : null;
};

const trimToDefault = (value: unknown, fallback: string): string => {
  const v = typeof value === 'string' ? value.trim() : '';
  return v === '' ? fallback : v;
};

/**
 * Defaults sobre los que mergea `ai_config`.
 *
 * FUNCIÓN Y NO `const`, y el cambio no es de estilo. Esto era un `const` de nivel
 * superior que se evaluaba al IMPORTAR el módulo —durante el arranque— leyendo
 * `process.env`. Ahora seis de sus campos se siembran desde `site_setting`
 * (`store-config/settings.ts`), y el snapshot de `app-settings` todavía no está
 * lleno en ese momento: congelarlo arriba habría dejado los defaults pegados al
 * entorno del boot y las cards del Asistente IA y de Landings habrían mentido.
 * Se resuelve por llamada; son unos lookups en un Map y `mergeAiConfig` no está
 * en ningún camino caliente.
 *
 * De dónde sale cada campo, que es lo que hace falta saber para tocarlo:
 *
 *  - `text_*`        → los edita la card de Landings con IA.
 *  - `chat_*`, `embeddings_model` → los edita la card del Asistente IA.
 *  - `chat_validation_enabled` y los cinco `memory_*` → NO los edita ninguna
 *    card: siguen leyéndose del entorno como semilla, y el valor efectivo se
 *    edita acá abajo, en `ai_config`, desde Preferencias → IA. No hay otro módulo
 *    que los lea, así que no hay dueño externo al que apuntar.
 *  - `image_*`       → nunca vinieron del entorno.
 *
 * La normalización (rangos, trim) queda ACÁ y no en `settings.ts` a propósito:
 * un solo lugar decide qué rango es válido para cada campo de `ai_config`.
 */
export function aiConfigDefaults(): AiConfig {
  const seed = aiConfigSeed();
  return {
    text_model: seed.textModel || 'openai/gpt-4.1-mini',
    text_max_retries: clampInt(seed.textMaxRetries, 2, 0, 5),
    chat_model: seed.chatModel || 'openai/gpt-5-mini',
    chat_reasoning_effort: normalizeEffort(seed.chatReasoningEffort) ?? 'low',
    chat_max_tokens: clampInt(seed.chatMaxTokens, 6000, 500, 32000),
    chat_validation_enabled: process.env.CHAT_AI_VALIDATION === 'true',
    image_model: 'google/gemini-2.5-flash-image',
    image_quality: 72,
    image_max_kb: 200,
    memory_enabled: process.env.AI_MEMORY_ENABLED === 'true',
    memory_autocapture_enabled: process.env.AI_MEMORY_AUTOCAPTURE === 'true',
    // La ÚNICA de las cinco que arranca prendida: sólo un "false" explícito la
    // apaga, para que una memoria auto-capturada no entre como aprobada de onda.
    memory_autocapture_requires_approval: process.env.AI_MEMORY_AUTOCAPTURE_APPROVAL !== 'false',
    memory_retrieval_topk: clampInt(process.env.AI_MEMORY_TOPK, 5, 1, 20),
    memory_min_similarity: clampFloat(process.env.AI_MEMORY_MIN_SIMILARITY, 0.35, 0, 1),
    embeddings_model: seed.embeddingsModel || 'openai/text-embedding-3-small',
  };
}

/** Mergea un valor parcial/crudo sobre los defaults, normalizando cada campo. */
function mergeAiConfig(raw: unknown): AiConfig {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  // Una sola resolución por merge: llamar `aiConfigDefaults()` campo por campo
  // haría 16 pasadas por el snapshot para obtener siempre lo mismo.
  const defaults = aiConfigDefaults();
  return {
    text_model: trimToDefault(v.text_model, defaults.text_model),
    text_max_retries: clampInt(v.text_max_retries, defaults.text_max_retries, 0, 5),
    chat_model: trimToDefault(v.chat_model, defaults.chat_model),
    chat_reasoning_effort:
      normalizeEffort(v.chat_reasoning_effort) ?? defaults.chat_reasoning_effort,
    chat_max_tokens: clampInt(v.chat_max_tokens, defaults.chat_max_tokens, 500, 32000),
    chat_validation_enabled:
      typeof v.chat_validation_enabled === 'boolean'
        ? v.chat_validation_enabled
        : defaults.chat_validation_enabled,
    image_model: trimToDefault(v.image_model, defaults.image_model),
    image_quality: clampInt(v.image_quality, defaults.image_quality, 40, 90),
    image_max_kb: clampInt(v.image_max_kb, defaults.image_max_kb, 50, 1000),
    memory_enabled: asBool(v.memory_enabled, defaults.memory_enabled),
    memory_autocapture_enabled: asBool(
      v.memory_autocapture_enabled,
      defaults.memory_autocapture_enabled,
    ),
    memory_autocapture_requires_approval: asBool(
      v.memory_autocapture_requires_approval,
      defaults.memory_autocapture_requires_approval,
    ),
    memory_retrieval_topk: clampInt(v.memory_retrieval_topk, defaults.memory_retrieval_topk, 1, 20),
    memory_min_similarity: clampFloat(
      v.memory_min_similarity,
      defaults.memory_min_similarity,
      0,
      1,
    ),
    embeddings_model: trimToDefault(v.embeddings_model, defaults.embeddings_model),
  };
}

/** Merges a partial/raw value over the defaults, normalizing each field. */
function mergeEmailBranding(raw: unknown): EmailBranding {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    primary_color:
      typeof v.primary_color === 'string' && v.primary_color.trim() !== ''
        ? v.primary_color.trim()
        : EMAIL_BRANDING_DEFAULTS.primary_color,
    text_color:
      typeof v.text_color === 'string' && v.text_color.trim() !== ''
        ? v.text_color.trim()
        : EMAIL_BRANDING_DEFAULTS.text_color,
    logo_url: trimToNull(v.logo_url),
    cde_display_name: trimToNull(v.cde_display_name),
    admin_notification_email: trimToNull(v.admin_notification_email),
  };
}

/**
 * StoreConfigModuleService — additional store-wide settings.
 *
 * NOTE: `minimum_purchase` is a HISTORY (one row per validity window; the API
 * layer creates, edits and deletes rows, and the effective minimum is resolved by
 * date). `store_setting` is a simple current-value key/value store.
 */
class StoreConfigModuleService extends MedusaService({
  MinimumPurchase,
  StoreSetting,
}) {
  /**
   * El mínimo de compra VIGENTE para una tienda, o `null` si no hay ninguno.
   *
   * La regla vive en `minimum-purchase.ts` —ventana de fechas en JS, `$or` para
   * alcanzar la fila global y precedencia tienda → global, cada tramo con su
   * porqué— porque este archivo no se puede importar en un test. Acá queda sólo
   * la query.
   *
   * Lo comparten el storefront, el "Mínimo vigente" del admin y el checkout del
   * bot de WhatsApp: antes la resolución estaba escrita únicamente en la ruta
   * pública y el bot generaba el link de pago sin mirarla.
   */
  async getEffectiveMinimumPurchase(siteId?: string | null, at: Date = new Date()) {
    const records = await this.listMinimumPurchases(minimumPurchaseFilter(siteId), {
      order: { starts_at: 'DESC', created_at: 'DESC' },
      take: 200,
    });
    return pickEffectiveMinimumPurchase(records, siteId, at);
  }

  /** Reads a boolean setting by key (defaults to `fallback` when unset). */
  async getBooleanSetting(key: string, fallback = false, siteId?: string | null): Promise<boolean> {
    const row = await this.readSetting(key, siteId);
    if (!row) return fallback;
    const value = row.value as unknown;
    return value === true || value === 'true';
  }

  /**
   * Reads the `email_branding` setting, merged over sensible defaults so the
   * returned object is always complete (never partial).
   */
  async getEmailBranding(siteId?: string | null): Promise<EmailBranding> {
    const row = await this.readSetting(STORE_SETTING_KEYS.EMAIL_BRANDING, siteId);
    return mergeEmailBranding(row?.value);
  }

  /**
   * Validates/normalizes and persists the `email_branding` setting, returning
   * the merged result. Caller-supplied fields win; missing fields fall back to
   * defaults (colors) or null.
   */
  async upsertEmailBranding(
    value: Partial<EmailBranding>,
    siteId?: string | null,
  ): Promise<EmailBranding> {
    const normalized = mergeEmailBranding(value);
    await this.upsertSetting(STORE_SETTING_KEYS.EMAIL_BRANDING, normalized, siteId);
    return normalized;
  }

  /**
   * Reads the `ai_config` setting, merged over defaults (env-seeded), so the
   * returned object is always complete.
   */
  async getAiConfig(siteId?: string | null): Promise<AiConfig> {
    const row = await this.readSetting(STORE_SETTING_KEYS.AI_CONFIG, siteId);
    return mergeAiConfig(row?.value);
  }

  /**
   * Validates/normalizes and persists the `ai_config` setting (parcial), y
   * devuelve el resultado mergeado.
   */
  async upsertAiConfig(value: Partial<AiConfig>, siteId?: string | null): Promise<AiConfig> {
    // Mergea sobre el valor EFECTIVO de la tienda (el suyo, o el global si no tiene),
    // no sobre el global a secas. El operador abre la pantalla, ve el valor efectivo,
    // cambia un campo y guarda: espera que el resto quede como lo estaba viendo.
    const row = await this.readSetting(STORE_SETTING_KEYS.AI_CONFIG, siteId);
    const current = mergeAiConfig(row?.value);
    const normalized = mergeAiConfig({ ...current, ...value });
    await this.upsertSetting(STORE_SETTING_KEYS.AI_CONFIG, normalized, siteId);
    return normalized;
  }

  /**
   * Lee el `password_gate` de la tienda principal, mergeado sobre los defaults
   * (apagado) para que el resultado siempre esté completo.
   */
  async getPasswordGate(siteId?: string | null): Promise<PasswordGate> {
    const row = await this.readSetting(STORE_SETTING_KEYS.PASSWORD_GATE, siteId);
    return mergePasswordGate(row?.value);
  }

  /**
   * Normaliza y persiste el `password_gate`, devolviendo el resultado mergeado.
   * Mergea sobre lo guardado para que prender/apagar el switch no obligue a
   * reenviar la palabra.
   */
  async upsertPasswordGate(
    value: Partial<PasswordGate>,
    siteId?: string | null,
  ): Promise<PasswordGate> {
    const current = await this.getPasswordGate(siteId);
    // Palabra NUEVA: se exige el rango completo (incluido el tope). Palabra que ya
    // estaba (sólo se movió el switch): se conserva sin tope, así prender/apagar el
    // gate de una tienda configurada antes de que el máximo bajara no borra su clave.
    const normalized = mergePasswordGate(
      {
        enabled: value.enabled ?? current.enabled,
        password: value.password ?? current.password,
      },
      value.password !== undefined ? normalizeGatePassword : normalizeStoredGatePassword,
    );
    await this.upsertSetting(STORE_SETTING_KEYS.PASSWORD_GATE, normalized, siteId);
    return normalized;
  }

  /**
   * Los textos de las tres páginas legales, siempre COMPLETOS (default donde no haya
   * nada guardado) y con `customized` diciendo cuáles siguen siendo el de ejemplo.
   */
  async getLegalPages(siteId?: string | null): Promise<LegalPagesResult> {
    const row = await this.readSetting(STORE_SETTING_KEYS.LEGAL_PAGES, siteId);
    return mergeLegalPages(row?.value);
  }

  /**
   * Guarda una o varias páginas legales (parcial por página y por campo).
   *
   * ─── MERGEA SOBRE LO GUARDADO, NO SOBRE LO EFECTIVO ────────────────────────
   *
   * `getLegalPages` devuelve las tres páginas completas porque rellena con los
   * defaults. Escribir ESE objeto sería el bug: guardar la privacidad copiaría los
   * términos y los cambios de ejemplo a la fila como si alguien los hubiera escrito,
   * y `customized` pasaría a `true` en las tres. O sea: apagaría para siempre el
   * único aviso que le dice al operador que está publicando el texto del boilerplate.
   * Por eso el base es `row.value` crudo y no el resultado de `mergeLegalPages`.
   *
   * Sobre `readSetting` con precedencia: una tienda sin fila propia arranca de la
   * GLOBAL, igual que `upsertAiConfig`. Es deliberado — el operador está viendo el
   * valor heredado y espera que lo que no toca quede como lo estaba viendo.
   */
  async upsertLegalPages(
    patch: Partial<Record<LegalPageSlug, LegalPageDocInput>>,
    siteId?: string | null,
  ): Promise<LegalPagesResult> {
    const row = await this.readSetting(STORE_SETTING_KEYS.LEGAL_PAGES, siteId);
    const stored = (
      row?.value && typeof row.value === 'object' ? row.value : {}
    ) as Record<string, unknown>;

    const next: Record<string, unknown> = { ...stored };
    for (const slug of LEGAL_PAGE_SLUGS) {
      const incoming = patch[slug];
      if (!incoming) continue;
      const current = (stored[slug] ?? {}) as Record<string, unknown>;
      next[slug] = normalizeStoredDoc({ ...current, ...incoming });
    }

    await this.upsertSetting(STORE_SETTING_KEYS.LEGAL_PAGES, next, siteId);
    return mergeLegalPages(next);
  }

  /** Upserts a setting by key (one row per key). */
  /**
   * El valor efectivo de una clave para una tienda: el suyo si lo tiene, el global
   * si no.
   *
   * Es PRECEDENCIA, no unión. Traer las dos filas y quedarse con `rows[0]` daría un
   * resultado que depende del plan de ejecución — a veces el de la tienda, a veces el
   * global. Es exactamente el fail-open que el seam separa en dos funciones.
   */
  /**
   * PÚBLICO a propósito: es la única forma correcta de leer una clave.
   *
   * `listStoreSettings({ key })` a secas ahora puede devolver DOS filas —la de la
   * tienda y la global— y quedarse con `rows[0]` da un resultado que depende del plan
   * de ejecución. Todo lector de config tiene que pasar por acá.
   */
  async readSetting(key: string, siteId?: string | null) {
    if (siteId) {
      const [own] = await this.listStoreSettings({ key, site_id: siteId });
      if (own) return own;
    }
    const [global] = await this.listStoreSettings({ key, site_id: null });
    return global;
  }

  /**
   * Escribe el valor de una clave para UNA tienda, o el global si no se pasa tienda.
   *
   * Sin `siteId` escribe la fila global — que es lo que pasa en una instalación
   * mono-tienda y en cualquier pantalla que todavía no mande la tienda activa. Así
   * el comportamiento por defecto es byte por byte el de antes.
   */
  async upsertSetting(key: string, value: unknown, siteId?: string | null) {
    const site_id = siteId ?? null;
    const [row] = await this.listStoreSettings({ key, site_id });
    if (row) {
      return this.updateStoreSettings({ id: row.id, value: value as Record<string, unknown> });
    }
    return this.createStoreSettings({ key, site_id, value: value as Record<string, unknown> });
  }
}

export default StoreConfigModuleService;
