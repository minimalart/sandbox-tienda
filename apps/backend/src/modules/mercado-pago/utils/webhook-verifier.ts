import crypto from 'crypto';

/**
 * Verifies a MercadoPago V2 webhook signature.
 *
 * MP sends these headers on each webhook:
 *   x-signature: "ts=1234567890,v1=<hex_hmac_sha256>"
 *   x-request-id: "<uuid>"
 *
 * The HMAC template is:
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 *
 * Behavior:
 *  - If `secret` is empty, we return { valid: false, reason: "no_secret_configured" }
 *    so callers can choose to allow-with-warning during rollout.
 *  - Otherwise we strictly verify using a timing-safe comparison.
 */
export function verifyMpWebhookSignature(params: {
  secret: string | undefined | null;
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
}): { valid: boolean; reason?: string } {
  const { secret, xSignature, xRequestId, dataId } = params;

  if (!secret) {
    return { valid: false, reason: 'no_secret_configured' };
  }
  if (!xSignature || !xRequestId || !dataId) {
    return { valid: false, reason: 'missing_headers_or_id' };
  }

  const parts = xSignature.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) {
    return { valid: false, reason: 'malformed_signature_header' };
  }

  const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(template).digest('hex');

  try {
    const ok = crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
    return ok ? { valid: true } : { valid: false, reason: 'hmac_mismatch' };
  } catch {
    // Buffer length mismatch (bad v1 hex length) → treat as invalid.
    return { valid: false, reason: 'hmac_mismatch' };
  }
}
