import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework';

/**
 * Rate limit mínimo in-memory por IP para el lookup de ARCA (endpoint público
 * que gasta llamadas al padrón). Límite por container: con N réplicas el
 * efectivo es N×MAX, suficiente para MVP porque el cache por CUIT absorbe
 * repeticiones.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const MAX_ENTRIES = 5_000;

const hits = new Map<string, { count: number; windowStart: number }>();

export function arcaRateLimit(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();

  // Prune perezoso para acotar memoria bajo abuso distribuido.
  if (hits.size > MAX_ENTRIES) {
    for (const [key, entry] of hits) {
      if (now - entry.windowStart > WINDOW_MS) hits.delete(key);
    }
  }

  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > MAX_PER_WINDOW) {
    res
      .status(429)
      .json({ message: 'Demasiadas consultas a ARCA. Esperá un minuto y volvé a intentar.' });
    return;
  }
  next();
}
