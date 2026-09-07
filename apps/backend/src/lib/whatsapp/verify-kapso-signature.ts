import crypto from 'crypto';

import { getKapsoSettings } from '../../modules/kapso-whatsapp/settings';

/**
 * Verifica la firma HMAC-SHA256 del body crudo de un webhook de Kapso.
 *
 * Kapso firma el payload con el secreto de webhook (Admin → WhatsApp → Ajustes,
 * con fallback a `KAPSO_WEBHOOK_SECRET`) y manda el hex en el header
 * (`x-webhook-signature`). Comparación timing-safe para no filtrar información por
 * tiempo. Devuelve `false` si falta el secret o la firma (fail-closed): sin firma
 * válida el webhook ignora el mensaje.
 *
 * Portado de llorente-logistica-next/lib/whatsapp/webhook-auth.ts.
 */
export function verifyKapsoSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret?: string,
): boolean {
  const resolvedSecret = secret || getKapsoSettings().webhookSecret;
  if (!resolvedSecret || !signature) return false;

  const expected = crypto
    .createHmac('sha256', resolvedSecret)
    .update(rawBody)
    .digest('hex');

  // Padding a longitud común para que `timingSafeEqual` no tire por longitudes
  // distintas (y no filtre la longitud esperada).
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  const maxLen = Math.max(a.byteLength, b.byteLength);
  const aPadded = Buffer.alloc(maxLen);
  const bPadded = Buffer.alloc(maxLen);
  a.copy(aPadded);
  b.copy(bPadded);

  return a.byteLength === b.byteLength && crypto.timingSafeEqual(aPadded, bPadded);
}
