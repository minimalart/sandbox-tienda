import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { decryptWithAnyKey, deriveWriteKey } from '../../lib/shared/encryption-key';

/**
 * Cifrado en reposo de los settings marcados como secretos (API keys, tokens,
 * webhook secrets). AES-256-GCM con clave derivada vía scrypt, mismo esquema que
 * `erp/crypto.ts` y `ai-assistant/crypto.ts` pero con salt propio del módulo.
 * Formato del blob: `v1:<iv b64>:<tag b64>:<ct b64>`.
 *
 * Está COPIADO y no importado de `erp/crypto.ts` a propósito: `erp` es una
 * extensión y puede no estar instalada, mientras que `app-settings` es core.
 *
 * La KEK la resuelve `lib/shared/encryption-key.ts`, que es el MISMO contrato
 * que usa `lib/multistore/credentials.ts`: se cifra con
 * `CREDENTIAL_ENCRYPTION_KEY` y se descifra probando también
 * `APP_SETTINGS_ENC_KEY` y `JWT_SECRET`, en ese orden. Antes cada dominio tenía
 * su propia cadena y `CREDENTIAL_ENCRYPTION_KEY` no la leía nadie; el docblock
 * de ese archivo tiene el porqué y el camino de migración.
 *
 * Lo que NO cambió es el salt (`app-settings-v1`): es lo único que impide que un
 * blob de multitienda se descifre acá aunque la clave sea la misma.
 *
 * El prefijo `v1` deja la puerta abierta a rotación de esquema.
 */

const VERSION = 'v1';
const SALT = 'app-settings-v1';

/** Cifra un secreto en claro. Devuelve el blob versionado `v1:iv:tag:ct`. */
export function encryptSecret(plain: string): string {
  const key = deriveWriteKey(SALT);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Descifra un blob producido por `encryptSecret`. Lanza si el formato es
 * inválido o si NINGUNA de las claves de la cadena valida el tag GCM (p. ej.
 * si se retiró del entorno la clave con la que se había cifrado).
 */
export function decryptSecret(blob: string): string {
  const parts = blob.split(':');
  const [version, ivB64, tagB64, ctB64] = parts;
  if (parts.length !== 4 || version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Setting cifrado con formato inválido.');
  }
  return decryptWithAnyKey(SALT, (key) => {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
    return pt.toString('utf8');
  });
}

/**
 * Variante que devuelve `null` en vez de lanzar. Es el camino normal de lectura:
 * un secreto indescifrable NO es un error, es un estado (`decryptable: false`)
 * que hace caer el resolver a env y que la UI muestra pidiendo reingresarlo.
 */
export function tryDecryptSecret(blob: string | null | undefined): string | null {
  if (!blob) return null;
  try {
    return decryptSecret(blob);
  } catch {
    return null;
  }
}

/**
 * Enmascara un secreto para mostrarlo en el admin: `••••` + los últimos 4.
 * Por debajo de 8 caracteres no se muestra ninguna cola — con un secreto corto,
 * cuatro caracteres son demasiada proporción del total.
 */
export function maskSecret(plain: string | null | undefined): string | null {
  if (!plain) return null;
  return plain.length >= 8 ? `••••${plain.slice(-4)}` : '••••';
}
