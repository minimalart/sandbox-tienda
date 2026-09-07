import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework';

/**
 * Rate limit in-memory por IP para las rutas de tintometría. Son endpoints
 * públicos que gastan llamadas al ERP; la caché por (base, fórmula, lista)
 * absorbe las repeticiones, así que esto es contra el abuso, no contra el uso
 * normal (elegir 10 colores seguidos en el PDP tiene que entrar cómodo).
 *
 * Límite por container: con N réplicas el efectivo es N×MAX. Igual que el de
 * ARCA, alcanza para el MVP.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const MAX_ENTRIES = 5_000;

const hits = new Map<string, { count: number; windowStart: number }>();

export function tintingRateLimit(
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
    res.status(429).json({ message: 'Demasiadas consultas de color. Esperá un momento.' });
    return;
  }
  next();
}
