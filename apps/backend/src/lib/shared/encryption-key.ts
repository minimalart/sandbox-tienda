import { scryptSync } from 'crypto';

/**
 * La KEK (key encryption key) de todo lo que este backend cifra en reposo.
 *
 * ─── El problema que resuelve ────────────────────────────────────────────────
 *
 * Había DOS contratos distintos para lo mismo, y una tercera variable que no
 * hacía nada:
 *
 *   - `lib/multistore/credentials.ts` derivaba de `JWT_SECRET` a secas.
 *   - `modules/app-settings/crypto.ts` derivaba de `APP_SETTINGS_ENC_KEY` con
 *     fallback a `JWT_SECRET`.
 *   - `CREDENTIAL_ENCRYPTION_KEY` estaba en los `.env` de los proyectos y NO LA
 *     LEÍA NADIE. Es el peor de los tres estados: el operador cree que las
 *     credenciales están protegidas por una clave dedicada, y no lo están.
 *
 * La consecuencia del primero es la grave: `JWT_SECRET` es el firmante de las
 * sesiones, y rotarlo es la maniobra estándar para invalidarlas a todas. Hacer
 * eso hoy vuelve INDESCIFRABLES todas las credenciales de tienda guardadas
 * —cuentas de Andreani, de MercadoPago, del ERP— sin un solo error al arrancar:
 * el síntoma aparece recién cuando alguien intenta despachar o cobrar.
 *
 * ─── El contrato ─────────────────────────────────────────────────────────────
 *
 * La clave dedicada se llama `CREDENTIAL_ENCRYPTION_KEY`. Se eligió ese nombre
 * y no `APP_SETTINGS_ENC_KEY` por dos razones:
 *
 *   1. Ya existe en los `.env` de la gente. Un nombre que el operador ya puso
 *      esperando que hiciera algo tiene que hacer ese algo; dejarlo muerto y
 *      pedirle que ponga otro es la peor combinación.
 *   2. Ahora cubre DOS dominios (settings de app y credenciales por tienda), y
 *      `APP_SETTINGS_ENC_KEY` sería un nombre mentiroso en la mitad de sus usos.
 *
 * `APP_SETTINGS_ENC_KEY` sigue siendo válida como clave de LECTURA (ver abajo);
 * lo que deja de ser es el nombre canónico.
 *
 * ─── Camino de migración ─────────────────────────────────────────────────────
 *
 * `deriveKeys()` no devuelve UNA clave: devuelve una lista ordenada. Se cifra
 * SIEMPRE con la primera y se intenta descifrar con todas, en orden. AES-GCM
 * autentica, así que una clave equivocada falla limpio — nunca devuelve basura.
 *
 * Eso hace que el cambio sea no-destructivo en los dos sentidos:
 *
 *   - Un proyecto que hoy tiene `CREDENTIAL_ENCRYPTION_KEY` en el `.env` (y sus
 *     blobs cifrados con `JWT_SECRET`, porque la variable no se leía) NO se
 *     rompe al deployar esto: la clave nueva pasa a ser la de escritura, y los
 *     blobs viejos se siguen leyendo con `JWT_SECRET`.
 *   - Un proyecto que tiene `APP_SETTINGS_ENC_KEY` tampoco: sus blobs se
 *     siguen leyendo con ella aunque las escrituras nuevas usen la dedicada.
 *
 * Los blobs migran de a uno, cuando se los reescribe. No hay backfill y no hace
 * falta: `writeSiteCredentialsViaSql()` y el upsert de settings ya descifran y
 * vuelven a cifrar en cada guardado. Para forzar la migración completa alcanza
 * con re-guardar cada credencial desde el admin.
 *
 * Lo que SÍ es destructivo, y sigue siéndolo: sacar del entorno una clave con la
 * que todavía haya blobs cifrados. Antes de retirar `JWT_SECRET` de la cadena
 * hay que haber reescrito todo.
 *
 * ─── Lo que este módulo NO unifica ───────────────────────────────────────────
 *
 * El SALT sigue siendo de cada dominio y se pasa por parámetro
 * (`multistore-credentials-v1` vs `app-settings-v1`). Es lo único que impide que
 * un blob de un dominio se descifre con la clave del otro, y unificarlo
 * convertiría dos compartimentos en uno solo.
 *
 * `modules/erp/crypto.ts` y `modules/ai-assistant/crypto.ts` todavía derivan de
 * `JWT_SECRET` a secas. Son extensiones que pueden no estar instaladas, así que
 * su migración a este helper es aparte.
 */

/** Orden de precedencia. La primera definida es la clave de ESCRITURA. */
const SECRET_VARS = ['CREDENTIAL_ENCRYPTION_KEY', 'APP_SETTINGS_ENC_KEY', 'JWT_SECRET'] as const;

/** Mismo fallback que `medusa-config.ts`, para que dev/local no explote sin env. */
const DEV_FALLBACK = 'supersecret';

/**
 * Los secretos configurados, en orden de precedencia y sin repetidos.
 *
 * Deduplica porque poner el mismo valor en dos variables es común (copiar el
 * `JWT_SECRET` a `CREDENTIAL_ENCRYPTION_KEY` "por las dudas") y derivar dos
 * veces la misma clave sólo agrega intentos de descifrado inútiles.
 */
export function resolveEncryptionSecrets(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const secrets: string[] = [];
  for (const name of SECRET_VARS) {
    const value = env[name]?.trim();
    if (value && !secrets.includes(value)) secrets.push(value);
  }
  return secrets.length > 0 ? secrets : [DEV_FALLBACK];
}

/** Cache por `salt` + los secretos vigentes: si rotan, se re-deriva sola. */
const cache = new Map<string, { fingerprint: string; keys: Buffer[] }>();

/**
 * Claves AES-256 para un dominio. `[0]` es con la que se cifra; todas se
 * prueban al descifrar, en orden.
 *
 * `scryptSync` es caro a propósito (es lo que hace la derivación resistente a
 * fuerza bruta), así que el cache no es una optimización cosmética: sin él,
 * cada lectura de credencial pagaría hasta tres derivaciones.
 */
export function deriveKeys(salt: string, env: Record<string, string | undefined> = process.env): Buffer[] {
  const secrets = resolveEncryptionSecrets(env);
  const fingerprint = secrets.join('\u0000');
  const hit = cache.get(salt);
  if (hit && hit.fingerprint === fingerprint) return hit.keys;

  const keys = secrets.map((secret) => scryptSync(secret, salt, 32));
  cache.set(salt, { fingerprint, keys });
  return keys;
}

/** La clave de ESCRITURA del dominio. */
export function deriveWriteKey(salt: string, env?: Record<string, string | undefined>): Buffer {
  return deriveKeys(salt, env)[0]!;
}

/**
 * Corre `attempt` con cada clave hasta que una funcione.
 *
 * Sólo tiene sentido con un cifrado AUTENTICADO (acá, AES-256-GCM): con uno que
 * no valide el tag, la clave equivocada devolvería plaintext basura en vez de
 * tirar, y esto elegiría la primera basura que aparezca.
 */
export function decryptWithAnyKey<T>(salt: string, attempt: (key: Buffer) => T): T {
  const keys = deriveKeys(salt);
  let lastError: unknown;
  for (const key of keys) {
    try {
      return attempt(key);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No se pudo descifrar el blob.');
}
