import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getRecommendationsSettings } from '../settings';

/**
 * `request_id` firmado (PRD §14.1/§19).
 *
 * El id lleva una parte aleatoria y una firma HMAC truncada:
 *
 *     recq_<base64url(12 bytes aleatorios)>.<base64url(10 bytes de HMAC)>
 *
 * La firma NO reemplaza a la fila `served` persistida —esa sigue siendo la fuente
 * de verdad de qué productos se sirvieron— sino que es el portero baratísimo que
 * va antes: un `request_id` forjado se rechaza sin tocar la base. Sin eso,
 * cualquiera puede hacernos gastar una lectura indexada por request basura.
 *
 * Es deliberadamente un token OPACO: no codifica los ids servidos. Un token que
 * los llevara adentro crecería con el `limit` (se reenvía en cada beacon), no
 * daría idempotencia ni permitiría anular la atribución al cancelarse una orden, y
 * de todos modos haría falta la fila `served` para la métrica de servidos.
 */

const PREFIX = 'recq_';
const RANDOM_BYTES = 12;
const SIGNATURE_BYTES = 10;

/** Longitudes esperadas en base64url (sin padding). */
const RANDOM_CHARS = Math.ceil((RANDOM_BYTES * 4) / 3); // 16
const SIGNATURE_CHARS = Math.ceil((SIGNATURE_BYTES * 4) / 3); // 14

const sign = (random: string, secret: string): string =>
  createHmac('sha256', secret).update(random).digest().subarray(0, SIGNATURE_BYTES).toString('base64url');

/** Genera un `request_id` firmado. */
export function mintRequestId(secret: string): string {
  const random = randomBytes(RANDOM_BYTES).toString('base64url');
  return `${PREFIX}${random}.${sign(random, secret)}`;
}

/**
 * Verifica forma y firma. Devuelve `false` ante cualquier anomalía; nunca lanza,
 * porque corre sobre input no confiable en el camino de ingesta de eventos.
 */
export function verifyRequestId(requestId: unknown, secret: string): boolean {
  if (typeof requestId !== 'string' || !secret) return false;
  if (!requestId.startsWith(PREFIX)) return false;

  const body = requestId.slice(PREFIX.length);
  const separator = body.indexOf('.');
  if (separator === -1) return false;

  const random = body.slice(0, separator);
  const signature = body.slice(separator + 1);

  // Chequeo de longitud ANTES del HMAC: `timingSafeEqual` lanza si los buffers
  // difieren en tamaño, y así un token deforme no llega a computar nada.
  if (random.length !== RANDOM_CHARS || signature.length !== SIGNATURE_CHARS) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(random) || !/^[A-Za-z0-9_-]+$/.test(signature)) return false;

  const expected = Buffer.from(sign(random, secret), 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * Secreto de firma. El de `app-settings` si está —fila global, env o nada, con la
 * precedencia de siempre—; si no, el `COOKIE_SECRET` del proyecto, que ya existe en
 * todo entorno desplegado.
 *
 * El fallback sigue leyéndose de `process.env` a mano y NO tiene descriptor: es una
 * variable del CORE, la declara el App Spec para todo proyecto y ya la gobierna
 * Medusa. Darle un descriptor acá sería que la card de recomendaciones pueda rotar
 * la clave con la que se firman las sesiones del admin.
 *
 * Si no hay ninguno de los dos (sólo pasa en desarrollo sin .env) devuelve null y
 * el llamador desactiva la verificación de firma: el motor sigue funcionando y la
 * fila `served` sigue validando qué productos se sirvieron. Nunca se cae de vuelta
 * a un secreto hardcodeado, que sería equivalente a no firmar pero pareciendo que
 * sí — por eso el descriptor de `RECOMMENDATIONS_EVENT_SECRET` no lleva `default`.
 */
export function resolveEventSecret(): string | null {
  const explicit = getRecommendationsSettings().eventSecret;
  if (explicit) return explicit;
  const cookieSecret = process.env.COOKIE_SECRET?.trim();
  if (cookieSecret) return cookieSecret;
  return null;
}
