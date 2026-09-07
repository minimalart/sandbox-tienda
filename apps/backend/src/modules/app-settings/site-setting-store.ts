import { MedusaError } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { SITE_REGISTRY_MODULE } from '../../lib/multistore/module-key';
import { encryptSecret } from './crypto';
import type { AppSettingRow } from './resolve';
import type { PlannedWrite } from './write-plan';

/**
 * Adaptador entre `app-settings` (por CLAVE) y `site_setting` (por NAMESPACE).
 *
 * `app_setting` guardaba UNA FILA POR KEY. `site_setting` guarda UNA FILA POR
 * `(site_id, namespace)` con el JSON entero adentro. Los dos modelos no son
 * equivalentes y este archivo es el único lugar donde se traduce uno al otro, para
 * que el resto del módulo siga hablando de claves.
 *
 * Lo que la traducción cuesta, y por qué está resuelto acá y no en cada call site:
 *
 *  1. **Escribir una clave es un read-modify-write del namespace entero.** Dos
 *     pestañas guardando claves distintas del mismo namespace casi a la vez leen el
 *     mismo JSON viejo y la segunda pisa a la primera. Se resuelve con el
 *     `expectedRevision` de `upsertSiteSetting` — ver `applyPlanForSite`.
 *  2. **La fila de la tienda hay que CREARLA, no heredar el id del GET.** Si la
 *     tienda no tiene fila, el valor efectivo viene de la global; guardar sobre esa
 *     fila cambia la configuración de la instancia entera creyendo editar una tienda.
 *     Es la regla 4 de `EXTENSIONES-MULTITIENDA.md`, que apareció tres veces (gift
 *     cards, recurrentes, comments/blog) y las tres se veían idénticas a código
 *     correcto. Acá se paga leyendo la global como BASE y escribiendo siempre con
 *     `siteId`, nunca con un id de fila.
 *
 * Toda la parte decidible —el merge de claves sobre el JSON y la clasificación de
 * una carrera— vive en funciones PURAS exportadas más abajo, porque los tests de
 * este repo no tienen DB (`node:test`). Acá queda el IO y nada más.
 */

/** `NULL` = valor GLOBAL de la instancia. Mismo significado que en `site_setting`. */
export type SiteScopeId = string | null;

/**
 * Contrato mínimo del módulo de tiendas, declarado LOCALMENTE en vez de importar
 * `DemoStoreModuleService`, ni siquiera con `import type`.
 *
 * `project-composer` BORRA `src/modules/demo-store` de los proyectos de cliente
 * (`component-definitions.js`, componente `demo-creator`). Un `import type` se borra
 * en runtime, sí, pero NO se borra para `tsc`: el `pnpm typecheck` del cliente
 * quedaría rojo apuntando a una carpeta que el composer sacó a propósito. Que el
 * módulo hoy sea `required: true` en el catálogo es una política del CATÁLOGO, no del
 * bisturí del composer, así que el desacople se mantiene.
 *
 * La clave del container sí se importa de `lib/multistore/module-key.ts`, que es core
 * y sobrevive al composer: así el literal `'demo_store'` sigue teniendo UN solo dueño
 * y lo sigue vigilando `modules/module-keys.test.ts` sin agregar una copia suelta.
 */
export type SiteSettingsStoreLike = {
  getSiteSetting: (
    namespace: string,
    siteId?: SiteScopeId,
  ) => Promise<{ namespace: string; site_id: SiteScopeId; revision: number; value: Record<string, unknown> }>;
  /** Generado por `MedusaService`. Se usa SÓLO para saber si la fila de la tienda existe. */
  listSiteSettings: (filter: { namespace: string; site_id: SiteScopeId }) => Promise<{ id: string }[]>;
  upsertSiteSetting: (input: {
    namespace: string;
    value: Record<string, unknown>;
    siteId?: SiteScopeId;
    expectedRevision?: number;
    actorId?: string | null;
    note?: string | null;
  }) => Promise<{ namespace: string; site_id: SiteScopeId; revision: number; value: Record<string, unknown> }>;
};

/**
 * Entrada de UNA clave dentro del JSON del namespace.
 *
 * Es `AppSettingRow` sin `key` (la key es la propiedad del objeto). Se guarda el
 * SOBRE completo y no el valor pelado a propósito: `resolveEffectiveValue` y
 * `computeSettingState` necesitan `ciphertext`, `is_secret`, `updated_at` y
 * `updated_by`, y sin ellos habría que tocar `resolve.ts` para que el modelo nuevo
 * entre. El sobre es lo que hace que la mudanza de tabla no se note aguas arriba.
 */
export type StoredSettingEntry = {
  /** Valor en claro. Siempre `null` cuando `is_secret`. */
  value: unknown;
  /** Blob AES-256-GCM `v1:iv:tag:ct`. Sólo cuando `is_secret`. */
  ciphertext: string | null;
  is_secret: boolean;
  updated_at: string | null;
  updated_by: string | null;
};

/** El JSON crudo de un namespace: `{ [KEY]: StoredSettingEntry }` + lo que no es nuestro. */
export type NamespaceBlob = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * `true` si el valor tiene forma de sobre nuestro.
 *
 * El chequeo es ESTRICTO —exige `is_secret` booleano— y no adivina. Un namespace de
 * `site_setting` puede tener adentro config plana de otro dueño: el caso vivo es
 * `extension:fiscal-documentation`, que guarda `{ cuit, punto_venta, ... }` a pelo.
 * Si acá tratáramos un valor plano como si fuera un sobre, un descriptor de tipo
 * `secret` cuya entrada viniera sin `is_secret` se devolvería EN CLARO por la API,
 * porque `computeSettingState` se apoya en esa columna como cinturón. Descartar la
 * entrada hace caer el resolver a env, que es el fallback documentado del módulo.
 */
export function isStoredSettingEntry(value: unknown): value is StoredSettingEntry {
  return isPlainObject(value) && typeof value.is_secret === 'boolean';
}

/**
 * Convierte el JSON de un namespace en las filas que ya sabe consumir `resolve.ts`.
 *
 * Lo que no tiene forma de sobre se SALTEA en silencio (ver `isStoredSettingEntry`):
 * no existe fila → el resolver cae a env → la UI lo muestra con origen `env`. Es la
 * degradación segura; la ruidosa sería inventar un valor.
 */
export function readEntriesFromBlob(blob: unknown): Map<string, AppSettingRow> {
  const out = new Map<string, AppSettingRow>();
  if (!isPlainObject(blob)) return out;
  for (const [key, raw] of Object.entries(blob)) {
    if (!isStoredSettingEntry(raw)) continue;
    out.set(key, {
      key,
      value: raw.value ?? null,
      ciphertext: raw.ciphertext ?? null,
      is_secret: Boolean(raw.is_secret),
      updated_at: raw.updated_at ?? null,
      updated_by: raw.updated_by ?? null,
    });
  }
  return out;
}

export type MergeNamespaceInput = {
  /**
   * El JSON del que se PARTE. Para una tienda sin fila propia es el JSON GLOBAL —
   * ahí está la regla 4: se copia la global y se escribe la fila de la tienda, en vez
   * de editar la global.
   */
  base: unknown;
  writes: readonly PlannedWrite[];
  /** Borrado por NOMBRE de clave. Nunca por posición ni por valor vacío. */
  deletes: readonly string[];
  actorId?: string | null;
  /** Reloj inyectable: sin esto el merge no sería testeable sin congelar el tiempo. */
  now?: Date | string;
  /**
   * Cifrado inyectable. `encryptSecret` usa un IV aleatorio, así que un test que lo
   * llamara de verdad no podría afirmar nada sobre la salida.
   */
  encrypt?: (plain: string) => string;
};

/**
 * EL merge. Función pura: aplica escrituras y borrados POR CLAVE sobre el JSON de un
 * namespace y devuelve el JSON nuevo.
 *
 * Tres invariantes que valen lo que cuesta escribirlas:
 *
 *  - **No muta `base`.** El caller puede estar sosteniendo el JSON GLOBAL cuando la
 *    tienda todavía no tiene fila; mutarlo sería empezar a editar la global en
 *    memoria, que es la versión sutil del error que este archivo existe para evitar.
 *  - **Preserva las claves ajenas.** Lo que no es un sobre nuestro se copia tal cual.
 *    Barrer el namespace "porque no lo reconozco" borraría config de otro dueño (el
 *    caso caro es el CUIT de `extension:fiscal-documentation`).
 *  - **Borrar la última clave deja `{}`, no `null`.** `getSiteSetting` devuelve
 *    `value ?? {}`, así que un namespace vacío y uno inexistente se leen igual: el
 *    namespace queda vacío, nunca roto.
 *
 * Los borrados se aplican ANTES que las escrituras. `buildWritePlan` ya rechaza una
 * clave que esté en `values` y en `unset` a la vez, así que el orden es indistinto —
 * pero si esa regla se aflojara alguna vez, el orden que no pierde datos es éste:
 * gana lo que el usuario escribió.
 */
export function mergeNamespaceBlob(input: MergeNamespaceInput): NamespaceBlob {
  const out: NamespaceBlob = isPlainObject(input.base) ? { ...input.base } : {};

  for (const key of input.deletes) delete out[key];

  const updatedAt = toIso(input.now ?? new Date());
  const updatedBy = input.actorId ?? null;
  const encrypt = input.encrypt ?? encryptSecret;

  for (const write of input.writes) {
    out[write.key] = write.isSecret
      ? {
          // El claro NUNCA toca el JSON: sólo el blob cifrado, igual que en `app_setting`.
          value: null,
          ciphertext: encrypt(String(write.value)),
          is_secret: true,
          updated_at: updatedAt,
          updated_by: updatedBy,
        }
      : {
          // `undefined` desaparecería al serializar y la clave se leería como no
          // configurada; `null` conserva "hay fila, sin valor", que es exactamente lo
          // que hacía la columna nullable de `app_setting`.
          value: write.value ?? null,
          ciphertext: null,
          is_secret: false,
          updated_at: updatedAt,
          updated_by: updatedBy,
        } satisfies StoredSettingEntry;
  }

  return out;
}

/**
 * Clasifica una carrera: ¿el que nos ganó tocó ALGUNA de las claves que queremos
 * escribir, o escribió otras del mismo namespace?
 *
 * Es la decisión que hace que el `expectedRevision` sirva para algo en un modelo por
 * namespace. Ver la discusión completa en `applyPlanForSite`.
 */
export function classifyRevisionConflict(
  previousBase: unknown,
  freshBase: unknown,
  touchedKeys: readonly string[],
): 'disjoint' | 'overlapping' {
  const before = isPlainObject(previousBase) ? previousBase : {};
  const after = isPlainObject(freshBase) ? freshBase : {};
  for (const key of touchedKeys) {
    if (stableStringify(before[key]) !== stableStringify(after[key])) return 'overlapping';
  }
  return 'disjoint';
}

/**
 * Serialización con claves ordenadas: un cambio de orden no es un conflicto.
 *
 * El centinela de `undefined` va escapado (`\u0000`) y NO como carácter literal:
 * un NUL crudo en el fuente vuelve al archivo binario para ripgrep y para los
 * diffs de git, que es un precio alto por un detalle interno. Tiene que ser algo
 * que `JSON.stringify` no pueda producir nunca, para que "la clave no está" no
 * empate con ningún valor real.
 */
function stableStringify(value: unknown): string {
  if (value === undefined) return '\\u0000undefined';
  return JSON.stringify(value, (_k, v) =>
    isPlainObject(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

/**
 * El módulo de tiendas, o `null` si no está en el container.
 *
 * Devuelve `null` en vez de tirar porque la LECTURA de configuración degrada a env
 * —es el mismo comportamiento que `APP_SETTINGS_DISABLE=true`— y dejar el backend
 * caído porque no se pudo leer un ajuste opcional sería peor que leer el env.
 * Para ESCRIBIR se usa `requireSiteSettingsStore`, que sí tira.
 */
export function resolveSiteSettingsStore(container: MedusaContainer): SiteSettingsStoreLike | null {
  try {
    return container.resolve(SITE_REGISTRY_MODULE) as unknown as SiteSettingsStoreLike;
  } catch {
    return null;
  }
}

/** Igual, pero para escribir: un guardado que se pierde en silencio no es una opción. */
export function requireSiteSettingsStore(container: MedusaContainer): SiteSettingsStoreLike {
  const store = resolveSiteSettingsStore(container);
  if (!store) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'El módulo de tiendas no está disponible: no se puede guardar la configuración.',
    );
  }
  return store;
}

/** Lo leído de UN scope. Sin precedencia: es exactamente la fila que se pidió. */
export type NamespaceScopeRead = {
  namespace: string;
  site_id: SiteScopeId;
  /** Revisión actual del scope. `0` si nunca se escribió. Es el token del CAS. */
  revision: number;
  /** Las claves ya en forma de `AppSettingRow`, listas para `resolve.ts`. */
  rows: Map<string, AppSettingRow>;
  /** El JSON crudo, para poder mergear encima sin releer. */
  raw: NamespaceBlob;
};

const emptyRead = (namespace: string, siteId: SiteScopeId): NamespaceScopeRead => ({
  namespace,
  site_id: siteId,
  revision: 0,
  rows: new Map(),
  raw: {},
});

/**
 * Los valores de un namespace para UN scope. NO cae al global por su cuenta.
 *
 * La precedencia (tienda gana, global es fallback) la arma otra pieza, con las dos
 * lecturas en la mano. Mezclarla acá es el fail-open que documenta
 * `lib/multistore/scope.ts` y que `getSiteSetting` evita con la misma decisión.
 */
export async function readSiteNamespace(
  container: MedusaContainer,
  namespace: string,
  siteId: SiteScopeId,
): Promise<NamespaceScopeRead> {
  const store = resolveSiteSettingsStore(container);
  if (!store) return emptyRead(namespace, siteId);
  const current = await store.getSiteSetting(namespace, siteId);
  return {
    namespace,
    site_id: siteId,
    revision: current.revision,
    rows: readEntriesFromBlob(current.value),
    raw: isPlainObject(current.value) ? current.value : {},
  };
}

/** La fila GLOBAL de la instancia (`site_id IS NULL`). */
export function readGlobalNamespace(
  container: MedusaContainer,
  namespace: string,
): Promise<NamespaceScopeRead> {
  return readSiteNamespace(container, namespace, null);
}

/**
 * Las dos lecturas que hace falta tener a la vez para decidir precedencia AFUERA.
 *
 * Con `siteId === null` devuelve el mismo objeto en las dos puntas y hace UNA sola
 * consulta: pedir "la global y la global" dos veces sería puro ruido en el log.
 *
 * No usa `listSiteSettingWithGlobal` a propósito: aquél trae las dos filas en un
 * viaje pero NO trae las revisiones, y sin revisión no hay CAS posible.
 */
export async function readNamespaceScopes(
  container: MedusaContainer,
  namespace: string,
  siteId: SiteScopeId,
): Promise<{ own: NamespaceScopeRead; global: NamespaceScopeRead }> {
  const global = await readGlobalNamespace(container, namespace);
  if (siteId === null) return { own: global, global };
  const own = await readSiteNamespace(container, namespace, siteId);
  return { own, global };
}

export type ApplyPlanForSiteInput = {
  /** Import-only guard, checked against the fresh CAS base. */
  onlyMissing?: boolean;
  namespace: string;
  /** `null` escribe la fila GLOBAL. Cualquier otra cosa, la fila de ESA tienda. */
  siteId: SiteScopeId;
  /** Un `WritePlan` ya validado encaja estructuralmente. */
  plan: { writes: readonly PlannedWrite[]; deletes: readonly string[] };
  actorId?: string | null;
  note?: string | null;
  /** Intentos totales ante carreras DISJUNTAS. Ver la nota de la carrera. */
  attempts?: number;
  now?: () => Date;
  encrypt?: (plain: string) => string;
};

export type ApplyPlanForSiteResult = {
  namespace: string;
  site_id: SiteScopeId;
  revision: number;
  value: NamespaceBlob;
  /** `true` si la tienda no tenía fila y ésta se creó partiendo del JSON global. */
  seeded_from_global: boolean;
  /** Cuántas vueltas costó ganar la carrera. `1` es el caso normal. */
  attempts: number;
};

const DEFAULT_ATTEMPTS = 3;

/**
 * Aplica escrituras y borrados POR CLAVE sobre `(namespace, siteId)`.
 *
 * ## La carrera, y por qué se reintenta SÓLO cuando es disjunta
 *
 * En `app_setting` cada clave era una fila: dos pestañas guardando `HOST` y `PORT`
 * no se cruzaban. Con el JSON por namespace se cruzan siempre, y ahí hay que elegir.
 *
 *  - **Reintentar todo** convierte el modelo en last-writer-wins. Dos operadores
 *    editando la MISMA credencial: uno la pisa sin enterarse y el otro cree que la
 *    suya quedó. Es exactamente lo que el locking optimista existe para no hacer.
 *  - **Propagar todo** le tira un 409 en la cara al usuario por un conflicto que no
 *    causó: él editó `HOST`, el otro editó `PORT`, y las dos ediciones son
 *    compatibles. Un 409 acá enseña a apretar "guardar" de nuevo hasta que salga,
 *    que es peor que no tener locking.
 *
 * Por eso la decisión es por CONTENIDO, no por revisión: se relee el JSON fresco y se
 * compara SÓLO en las claves de nuestro plan (`classifyRevisionConflict`).
 *
 *  - **Disjunta** (el otro tocó otras claves) → se remergea sobre el JSON fresco y se
 *    reintenta. El resultado es el que el usuario esperaba: sobreviven los dos.
 *  - **Superpuesta** (el otro tocó una de las nuestras) → 409. No hay merge posible
 *    de dos ediciones del mismo secreto, y elegir una en silencio es adivinar.
 *
 * Un empate donde el otro escribió EL MISMO valor también da 409, porque cambia el
 * `updated_at` del sobre. Es conservador a propósito: el falso positivo cuesta un
 * reload; el falso negativo cuesta una credencial.
 *
 * ## La fila de la tienda se CREA, no se hereda del GET
 *
 * Si la tienda no tiene fila propia, se parte del JSON GLOBAL y se escribe con
 * `siteId`. Nunca se pasa el id de la fila global a ningún lado — es la regla 4 de
 * `EXTENSIONES-MULTITIENDA.md`, que ya se pagó tres veces. `upsertSiteSetting` crea
 * la fila del scope que le pidas, así que alcanza con no mentirle el scope.
 *
 * Un plan vacío es un NO-OP que no escribe nada: sin esto, apretar "guardar" sin
 * cambios en la pantalla de una tienda forkearía la config de la global por nada.
 */
export async function applyPlanForSite(
  container: MedusaContainer,
  input: ApplyPlanForSiteInput,
): Promise<ApplyPlanForSiteResult> {
  const store = requireSiteSettingsStore(container);
  const { namespace, siteId } = input;
  const writes = input.plan.writes ?? [];
  const deletes = input.plan.deletes ?? [];
  const touchedKeys = [...writes.map((w) => w.key), ...deletes];

  if (touchedKeys.length === 0) {
    const current = await store.getSiteSetting(namespace, siteId);
    return {
      namespace,
      site_id: siteId,
      revision: current.revision,
      value: isPlainObject(current.value) ? current.value : {},
      seeded_from_global: false,
      attempts: 0,
    };
  }

  const maxAttempts = Math.max(1, input.attempts ?? DEFAULT_ATTEMPTS);
  const clock = input.now ?? (() => new Date());
  let previousBase: Record<string, unknown> | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { base, expectedRevision, seeded } = await readWriteBase(store, namespace, siteId);
    if (input.onlyMissing && touchedKeys.some(key => Object.hasOwn(base, key))) {
      throw conflictError(namespace, siteId, touchedKeys);
    }

    if (previousBase && classifyRevisionConflict(previousBase, base, touchedKeys) === 'overlapping') {
      throw conflictError(namespace, siteId, touchedKeys);
    }

    /**
     * El snapshot se saca ACÁ y clonado, no en el `catch`.
     *
     * `getSiteSetting` devuelve el `value` de la entidad tal cual. Con el identity map
     * de MikroORM, dos lecturas del mismo scope en el mismo request pueden devolver LA
     * MISMA instancia, y entonces guardar la referencia y compararla después contra
     * "lo fresco" sería compararla contra sí misma: toda carrera daría disjunta y el
     * locking no serviría para nada. Clonando lo que nos importa, la comparación es
     * contra el estado que de verdad leímos.
     */
    previousBase = snapshotTouched(base, touchedKeys);

    const value = mergeNamespaceBlob({
      base,
      writes,
      deletes,
      actorId: input.actorId ?? null,
      now: clock(),
      encrypt: input.encrypt,
    });

    try {
      const saved = await store.upsertSiteSetting({
        namespace,
        value,
        siteId,
        expectedRevision,
        actorId: input.actorId ?? null,
        note: input.note ?? defaultNote(seeded),
      });
      return {
        namespace,
        site_id: siteId,
        revision: saved.revision,
        value,
        seeded_from_global: seeded,
        attempts: attempt,
      };
    } catch (error) {
      if (!isRevisionConflict(error)) throw error;
    }
  }

  throw conflictError(namespace, siteId, touchedKeys);
}

/** Copia PROFUNDA de las claves que nos importan, para comparar contra la relectura. */
function snapshotTouched(
  blob: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    // `hasOwn` y no `!== undefined`: "la clave no estaba" y "estaba en undefined" son
    // estados distintos, y el segundo también es un cambio si el otro la creó.
    if (Object.hasOwn(blob, key)) out[key] = structuredClone(blob[key]);
  }
  return out;
}

/**
 * De dónde parte el merge y contra qué revisión se hace el CAS.
 *
 * `expectedRevision` es SIEMPRE la del scope que se va a escribir, aunque el JSON
 * base venga de la global: la global puede ir por la revisión 12 y la tienda arrancar
 * en 0, y el CAS tiene que arbitrar sobre la fila que se toca.
 *
 * La existencia de la fila se pregunta con `listSiteSettings` y no se infiere de
 * `getSiteSetting`, que devuelve `{}` tanto para "no hay fila" como para "hay fila
 * vacía". Confundirlas resucitaría las claves globales en una tienda que las borró a
 * mano.
 */
async function readWriteBase(
  store: SiteSettingsStoreLike,
  namespace: string,
  siteId: SiteScopeId,
): Promise<{ base: Record<string, unknown>; expectedRevision: number; seeded: boolean }> {
  const own = await store.getSiteSetting(namespace, siteId);
  const ownBase = isPlainObject(own.value) ? own.value : {};
  if (siteId === null) return { base: ownBase, expectedRevision: own.revision, seeded: false };

  const rows = await store.listSiteSettings({ namespace, site_id: siteId });
  if (rows.length > 0) return { base: ownBase, expectedRevision: own.revision, seeded: false };

  const global = await store.getSiteSetting(namespace, null);
  return {
    base: isPlainObject(global.value) ? global.value : {},
    expectedRevision: own.revision,
    seeded: true,
  };
}

const defaultNote = (seeded: boolean): string | null =>
  seeded ? 'Primera configuración propia de la tienda, partiendo de la global' : null;

function conflictError(namespace: string, siteId: SiteScopeId, keys: readonly string[]): MedusaError {
  return new MedusaError(
    MedusaError.Types.CONFLICT,
    `Alguien más guardó ${keys.length === 1 ? 'este ajuste' : 'estos ajustes'} de "${namespace}"` +
      `${siteId ? ' en esta tienda' : ''} mientras editabas: ${keys.join(', ')}. ` +
      'Recargá para ver el valor actual y volvé a aplicar tu cambio.',
  );
}

/**
 * Reconoce una carrera perdida contra `upsertSiteSetting`.
 *
 * Llega por DOS caminos distintos y hay que atajar los dos:
 *
 *  - El chequeo explícito de `expectedRevision`, que tira un `Error` pelado con un
 *    mensaje en castellano. Matchear un mensaje es frágil y es deuda declarada: lo
 *    correcto sería que el service tirara un `MedusaError` de tipo `conflict` o un
 *    error con `code`. Mientras no lo haga, el match es lo único que hay.
 *  - El índice único `(site_id, namespace, revision)`, que es el árbitro REAL cuando
 *    los dos writers pasan el chequeo a la vez. Llega como violación 23505 de
 *    Postgres, y como `upsertSiteSetting` crea la revisión ANTES de tocar el valor,
 *    el perdedor falla sin haber escrito: reintentar es seguro.
 */
export function isRevisionConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; constraint?: string; message?: string; type?: string };
  if (e.type === MedusaError.Types.CONFLICT) return true;
  if (typeof e.message === 'string' && /conflicto de revisi/i.test(e.message)) return true;
  const target = `${e.constraint ?? ''} ${e.message ?? ''}`;
  if (e.code === '23505' || /duplicate key value/i.test(target)) {
    return /site_setting/i.test(target);
  }
  return false;
}
