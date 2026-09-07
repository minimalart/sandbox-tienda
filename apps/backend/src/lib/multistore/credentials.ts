import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ContainerRegistrationKeys, generateEntityId } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { decryptWithAnyKey, deriveWriteKey } from '../shared/encryption-key';
import type { SiteResolution } from './types';

/**
 * Credenciales de terceros POR TIENDA, cifradas en reposo.
 *
 * Por qué en DB y no en env, que era la regla original del proyecto
 * (`packages/site-manager/src/contract.json` declara `secrets_are_environment_only`):
 * con las credenciales en env, dar de alta una tienda con cuenta propia de Andreani
 * exige editar el App Spec y redeployar. Para una plataforma cuyo pitch es "creá una
 * tienda desde el backoffice", eso rompe el flujo entero.
 *
 * La propiedad de seguridad se conserva igual: el secreto RAÍZ sigue siendo env-only.
 * Lo que se guarda es ciphertext AES-256-GCM con clave derivada vía scrypt, con salt
 * propio para que un blob de un dominio no se pueda descifrar con la clave del otro.
 *
 * La KEK la resuelve `lib/shared/encryption-key.ts`, el MISMO contrato que usa
 * `modules/app-settings/crypto.ts`: se cifra con `CREDENTIAL_ENCRYPTION_KEY` y se
 * descifra probando también `APP_SETTINGS_ENC_KEY` y `JWT_SECRET`, en ese orden.
 *
 * Antes esto derivaba de `JWT_SECRET` A SECAS, y ahí estaba el problema: `JWT_SECRET`
 * firma las sesiones, y rotarlo para invalidarlas volvía indescifrables TODAS las
 * credenciales de tienda sin un solo error al arrancar. Con la clave dedicada los dos
 * calendarios de rotación se despegan; el docblock de `encryption-key.ts` tiene el
 * camino de migración de los blobs que ya están cifrados con `JWT_SECRET`.
 *
 * El prefijo `v1` deja abierta la rotación de esquema.
 */

const VERSION = 'v1';
const SALT = 'multistore-credentials-v1';

/** Cifra un objeto de credenciales. Devuelve el blob versionado `v1:iv:tag:ct`. */
export function encryptCredentials(payload: Record<string, unknown>): string {
  const key = deriveWriteKey(SALT);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Descifra un blob de `encryptCredentials`.
 *
 * Tira si el formato es inválido o si NINGUNA clave de la cadena valida el tag GCM
 * (típicamente porque se retiró del entorno la clave con la que se había cifrado).
 * El caller decide: para un listado, degradar; para cobrar o despachar, NO — ahí hay
 * que fallar y pedir que se re-ingresen.
 */
export function decryptCredentials<T extends Record<string, unknown>>(blob: string): T {
  const parts = blob.split(':');
  const [version, ivB64, tagB64, ctB64] = parts;
  if (parts.length !== 4 || version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Credenciales de tienda con formato inválido.');
  }
  return decryptWithAnyKey(SALT, (key) => {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plain = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
    return JSON.parse(plain.toString('utf8')) as T;
  });
}

/** Tabla propia y no una columna en `demo_store`: un SELECT de tiendas no debe traer secretos. */
export const SITE_CREDENTIAL_TABLE = 'site_credential';

type PgLike = { raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: any[] }> };

const UNDEFINED_TABLE = '42P01';
const isUndefinedTable = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { code?: string }).code === UNDEFINED_TABLE;

export type SiteCredentialsResult<T> =
  | { status: 'found'; source: 'site' | 'env'; value: T }
  | { status: 'missing'; reason: 'no_site' | 'no_row' | 'undecryptable' };

/**
 * Credenciales de una integración para la tienda de esta request.
 *
 * Va por SQL crudo a propósito: los consumidores naturales son los providers de
 * fulfillment y payment, que reciben un container AISLADO y no pueden resolver otros
 * módulos — el mismo motivo por el que `email/service.ts` lee `store_setting` así.
 *
 * `envFallback` es lo que permite migrar sin romper: mientras una tienda no tenga
 * credenciales propias, se usan las de entorno, que es el comportamiento de hoy.
 */
export async function readSiteCredentialsViaSql<T extends Record<string, unknown>>(
  pg: PgLike | undefined,
  integration: string,
  resolution: SiteResolution,
  envFallback?: () => T | null,
): Promise<SiteCredentialsResult<T>> {
  const fallback = (): SiteCredentialsResult<T> => {
    const value = envFallback?.() ?? null;
    return value ? { status: 'found', source: 'env', value } : { status: 'missing', reason: 'no_row' };
  };

  if (resolution.status !== 'site' || !pg) return fallback();

  try {
    const result = await pg.raw(
      `SELECT "credentials_enc" FROM "${SITE_CREDENTIAL_TABLE}"
         WHERE "site_id" = ? AND "integration" = ? AND "deleted_at" IS NULL
         LIMIT 1`,
      [resolution.site.id, integration],
    );
    const blob = result?.rows?.[0]?.credentials_enc as string | undefined;
    if (!blob) return fallback();

    try {
      return { status: 'found', source: 'site', value: decryptCredentials<T>(blob) };
    } catch {
      // Blob ilegible (una clave de cifrado que ya no está en el entorno). NO se
      // cae al env: si la tienda declaró credenciales propias y no se pueden leer,
      // usar las de otra cuenta sería peor que fallar — es facturar o despachar
      // con la cuenta ajena.
      return { status: 'missing', reason: 'undecryptable' };
    }
  } catch (error) {
    if (isUndefinedTable(error)) return fallback();
    throw error;
  }
}

/** Igual que el anterior, para código que sí tiene el container completo. */
export async function readSiteCredentials<T extends Record<string, unknown>>(
  scope: MedusaContainer,
  integration: string,
  resolution: SiteResolution,
  envFallback?: () => T | null,
): Promise<SiteCredentialsResult<T>> {
  let pg: PgLike | undefined;
  try {
    pg = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as PgLike;
  } catch {
    pg = undefined;
  }
  return readSiteCredentialsViaSql<T>(pg, integration, resolution, envFallback);
}

// ─────────────────────────────────────────────────────────────────────────────
// Escritura
//
// La tabla nació con cinco lectores y cero escritores: la única forma de cargar
// una credencial por tienda era un INSERT a mano con el blob de
// `encryptCredentials`. Esto es la contraparte, y arrastra dos lecciones que ya
// se pagaron en `modules/erp/service.ts`:
//
//   1. MERGE, no reemplazo. El blob es un mapa de VARIAS claves por integración.
//      Guardar `{ apiKey }` no puede borrar `{ baseUrl }`: rotar una credencial
//      dejaría al provider a medio configurar y sin un solo error visible.
//   2. Borrar es EXPLÍCITO y por nombre de clave. Mandar un string vacío
//      significa "no toqué el campo enmascarado" —que es lo único que la UI
//      puede mostrar de un secreto write-only— y por lo tanto NO borra nada.
// ─────────────────────────────────────────────────────────────────────────────

/** El contenido del blob: un mapa PLANO de credenciales, no un JSON cualquiera. */
export type CredentialBag = Record<string, string>;

export type CredentialWriteInput = {
  /** Valores a guardar. Un string vacío (o no-string) se IGNORA, nunca borra. */
  set?: Record<string, unknown>;
  /** Claves a borrar, POR NOMBRE. Única vía de borrado: "mandar vacío" no borra. */
  unset?: string[];
};

export type CredentialMerge = {
  /** El bag resultante, listo para cifrar. */
  next: CredentialBag;
  /** Claves cuyo valor cambió (alta o rotación). */
  written: string[];
  /** Claves que existían y se borraron. */
  removed: string[];
  /** Claves descartadas por venir vacías: la UI mandó el placeholder sin tocarlo. */
  ignored: string[];
  changed: boolean;
};

/**
 * Normaliza lo descifrado a un bag de strings.
 *
 * Descarta valores no-string en vez de tirar: un blob viejo o cargado a mano
 * puede tener un número o un objeto, y perder ESA clave es mejor que dejar la
 * pantalla de credenciales inutilizable para la tienda entera.
 */
export function sanitizeCredentialBag(value: unknown): CredentialBag {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const bag: CredentialBag = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string') bag[key] = raw;
  }
  return bag;
}

/**
 * Aplica un patch sobre el bag actual. Pura: es el corazón testeable de todo esto.
 *
 * Los valores se trimean. Un secreto con espacios al borde es, en la práctica,
 * siempre un pegado con basura; y un espacio invisible en un token produce un 401
 * que nadie puede diagnosticar mirando la UI, porque el valor no se muestra nunca.
 *
 * Si una clave viene en `set` y en `unset` a la vez, gana `unset`: la intención
 * destructiva es la explícita. La ruta igual rechaza esa combinación con 400,
 * porque casi siempre es un bug del cliente y no una intención.
 */
export function mergeCredentialValues(
  current: unknown,
  input: CredentialWriteInput,
): CredentialMerge {
  const next = sanitizeCredentialBag(current);
  const written: string[] = [];
  const ignored: string[] = [];
  const removed: string[] = [];

  for (const [key, raw] of Object.entries(input.set ?? {})) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) {
      ignored.push(key);
      continue;
    }
    if (next[key] === value) continue; // mismo valor: no es un cambio
    next[key] = value;
    written.push(key);
  }

  for (const key of input.unset ?? []) {
    if (!(key in next)) continue;
    delete next[key];
    removed.push(key);
  }

  const effectiveWrites = written.filter((key) => key in next);
  return {
    next,
    written: effectiveWrites,
    removed,
    ignored,
    changed: effectiveWrites.length > 0 || removed.length > 0,
  };
}

export type SiteCredentialWrite =
  /** Se persistió el blob. `keys` son los NOMBRES que quedaron, nunca los valores. */
  | { status: 'saved'; keys: string[]; written: string[]; removed: string[] }
  /** No quedó ninguna clave: la fila se borra y la tienda vuelve a heredar del entorno. */
  | { status: 'cleared'; removed: string[] }
  /** El patch no cambiaba nada. No se re-cifra: sería un IV nuevo para el mismo dato. */
  | { status: 'unchanged'; keys: string[] }
  /** Hay fila pero su blob no se puede leer, y no se pidió reemplazarla. */
  | { status: 'undecryptable' };

/**
 * Upsert de las credenciales de `(site_id, integration)`, mergeando sobre lo guardado.
 *
 * `onUndecryptable` es el único caso que obliga a decidir. Si el blob existente no
 * se puede descifrar (una clave de cifrado retirada del entorno) no hay sobre qué
 * mergear: las otras claves de esa integración son irrecuperables. El default es
 * `'fail'` —el caller se entera y avisa— porque hacerlo callado convertiría "roté
 * el apiKey" en "perdí el baseUrl" sin que nadie lo note. Con `'replace'` el
 * operador confirma que arranca de cero, que es la única salida real: la fila vieja
 * ya no sirve para nada.
 *
 * El `ON CONFLICT` respeta el índice único PARCIAL (`WHERE deleted_at IS NULL`) del
 * esquema; sin repetir el predicado, Postgres no infiere ese índice y el INSERT
 * concurrente rompería con 23505 en vez de resolver.
 */
export async function writeSiteCredentialsViaSql(
  pg: PgLike,
  integration: string,
  siteId: string,
  input: CredentialWriteInput,
  opts: { onUndecryptable?: 'fail' | 'replace' } = {},
): Promise<SiteCredentialWrite> {
  const found = await pg.raw(
    `SELECT "id", "credentials_enc" FROM "${SITE_CREDENTIAL_TABLE}"
       WHERE "site_id" = ? AND "integration" = ? AND "deleted_at" IS NULL
       LIMIT 1`,
    [siteId, integration],
  );
  const row = found?.rows?.[0] as { id?: string; credentials_enc?: string } | undefined;

  let current: CredentialBag = {};
  if (row?.credentials_enc) {
    try {
      current = sanitizeCredentialBag(decryptCredentials(row.credentials_enc));
    } catch {
      if (opts.onUndecryptable !== 'replace') return { status: 'undecryptable' };
      current = {};
    }
  }

  const merge = mergeCredentialValues(current, input);
  const keys = Object.keys(merge.next).sort();

  if (keys.length === 0) {
    // Sin claves no se guarda una fila vacía: el provider trata "sin fila" como
    // "heredá del entorno", y una fila con `{}` sería lo mismo pero opaco.
    if (!row?.id) return { status: 'unchanged', keys: [] };
    await pg.raw(
      `UPDATE "${SITE_CREDENTIAL_TABLE}" SET "deleted_at" = now(), "updated_at" = now()
         WHERE "id" = ?`,
      [row.id],
    );
    return { status: 'cleared', removed: merge.removed };
  }

  if (row?.id && !merge.changed) return { status: 'unchanged', keys };

  const blob = encryptCredentials(merge.next);

  if (row?.id) {
    await pg.raw(
      `UPDATE "${SITE_CREDENTIAL_TABLE}"
          SET "credentials_enc" = ?, "updated_at" = now()
        WHERE "id" = ?`,
      [blob, row.id],
    );
  } else {
    await pg.raw(
      `INSERT INTO "${SITE_CREDENTIAL_TABLE}" ("id", "site_id", "integration", "credentials_enc")
       VALUES (?, ?, ?, ?)
       ON CONFLICT ("site_id", "integration") WHERE "deleted_at" IS NULL
       DO UPDATE SET "credentials_enc" = EXCLUDED."credentials_enc", "updated_at" = now()`,
      [generateEntityId(undefined, 'sitecred'), siteId, integration, blob],
    );
  }

  return { status: 'saved', keys, written: merge.written, removed: merge.removed };
}

/**
 * Borra TODAS las credenciales de `(site_id, integration)`: la tienda vuelve a
 * heredar las del entorno. Soft-delete, que es lo que el índice parcial contempla.
 *
 * Distinto de `unset`: eso quita claves sueltas. Esto es "desconectá esta cuenta".
 */
export async function deleteSiteCredentialsViaSql(
  pg: PgLike,
  integration: string,
  siteId: string,
): Promise<boolean> {
  const result = await pg.raw(
    `UPDATE "${SITE_CREDENTIAL_TABLE}" SET "deleted_at" = now(), "updated_at" = now()
       WHERE "site_id" = ? AND "integration" = ? AND "deleted_at" IS NULL
       RETURNING "id"`,
    [siteId, integration],
  );
  return (result?.rows?.length ?? 0) > 0;
}

/** Lo que el admin puede saber de una credencial guardada. NUNCA incluye valores. */
export type SiteCredentialSummary = {
  integration: string;
  /** Los NOMBRES de las claves definidas. Vacío si el blob no se puede descifrar. */
  keys: string[];
  /** `false` = blob ilegible. Para los providers eso NO es "sin credenciales": cortan. */
  decryptable: boolean;
  updated_at: string | null;
};

/**
 * Qué integraciones tienen credencial propia en esta tienda, y con qué claves.
 *
 * Devuelve `[]` si la tabla todavía no existe, igual que la lectura: una instancia
 * sin la migración aplicada tiene que poder abrir la pantalla, no ver un 500.
 */
export async function listSiteCredentialsViaSql(
  pg: PgLike | undefined,
  siteId: string,
): Promise<SiteCredentialSummary[]> {
  if (!pg) return [];
  try {
    const result = await pg.raw(
      `SELECT "integration", "credentials_enc", "updated_at"
         FROM "${SITE_CREDENTIAL_TABLE}"
        WHERE "site_id" = ? AND "deleted_at" IS NULL
        ORDER BY "integration" ASC`,
      [siteId],
    );
    return (result?.rows ?? []).map((row: any) => {
      let keys: string[] = [];
      let decryptable = true;
      try {
        keys = Object.keys(sanitizeCredentialBag(decryptCredentials(row.credentials_enc))).sort();
      } catch {
        decryptable = false;
      }
      return {
        integration: String(row.integration),
        keys,
        decryptable,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      };
    });
  } catch (error) {
    if (isUndefinedTable(error)) return [];
    throw error;
  }
}

/**
 * Cuántas tiendas tienen credencial propia de cada integración.
 *
 * Es la única vista útil cuando el admin está en "todas las tiendas": no se puede
 * mostrar ni editar la credencial de nadie, pero sí decir dónde hay algo cargado.
 * Usa el índice `IDX_site_credential_integration`.
 */
export async function countSiteCredentialsByIntegrationViaSql(
  pg: PgLike | undefined,
): Promise<Record<string, number>> {
  if (!pg) return {};
  try {
    const result = await pg.raw(
      `SELECT "integration", COUNT(DISTINCT "site_id")::int AS "sites"
         FROM "${SITE_CREDENTIAL_TABLE}"
        WHERE "deleted_at" IS NULL
        GROUP BY "integration"`,
    );
    const counts: Record<string, number> = {};
    for (const row of result?.rows ?? []) counts[String(row.integration)] = Number(row.sites) || 0;
    return counts;
  } catch (error) {
    if (isUndefinedTable(error)) return {};
    throw error;
  }
}
