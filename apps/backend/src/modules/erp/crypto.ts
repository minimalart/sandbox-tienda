import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Cifrado en reposo de las credenciales del ERP (API keys, client secrets).
 * AES-256-GCM con clave derivada de `JWT_SECRET` vía scrypt, mismo esquema que
 * `ai-assistant/crypto.ts` pero con salt propio del módulo. Formato del blob:
 * `v1:<iv b64>:<tag b64>:<ct b64>`.
 *
 * La clave se cachea por valor de `JWT_SECRET`: si el secreto rota, se re-deriva
 * sola (y los blobs viejos dejan de poder desencriptarse — eso es esperado, hay
 * que re-ingresar las credenciales). El prefijo `v1` deja la puerta abierta a
 * rotación de esquema en el futuro.
 */

const VERSION = 'v1';

let cache: { secret: string; key: Buffer } | null = null;

function deriveKey(): Buffer {
  // Mismo fallback que medusa-config.ts para que dev/local no explote sin env.
  const secret = process.env.JWT_SECRET || 'supersecret';
  if (!cache || cache.secret !== secret) {
    cache = { secret, key: scryptSync(secret, 'erp-credentials-v1', 32) };
  }
  return cache.key;
}

/** Cifra un secreto en claro. Devuelve el blob versionado `v1:iv:tag:ct`. */
export function encryptSecret(plain: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Descifra un blob producido por `encryptSecret`. Lanza si el formato es inválido
 * o el tag GCM no valida (p. ej. si `JWT_SECRET` rotó): el caller debe capturarlo
 * y pedir que se re-ingresen las credenciales.
 */
export function decryptSecret(blob: string): string {
  const parts = blob.split(':');
  const [version, ivB64, tagB64, ctB64] = parts;
  if (parts.length !== 4 || version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Credenciales ERP con formato inválido.');
  }
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
  return pt.toString('utf8');
}

/** Variante que devuelve `null` en vez de lanzar (paths no críticos). */
export function tryDecryptSecret(blob: string | null | undefined): string | null {
  if (!blob) return null;
  try {
    return decryptSecret(blob);
  } catch {
    return null;
  }
}
