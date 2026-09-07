import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { getRecommendationsSettings } from '../../../modules/recommendations/settings';

/**
 * Rate limit in-memory por IP para las rutas públicas de recomendaciones.
 *
 * El límite es generoso porque una sola PDP dispara varios placements (similares,
 * complementarios, comprados juntos, vistos recientemente) y un usuario navegando
 * rápido es legítimo. Lo que corta es el abuso: el endpoint hace una query con
 * window function y un batch de hidratación, así que es caro comparado con un GET
 * estático.
 *
 * Límite por container, igual que el de ARCA: con N réplicas el efectivo es N×MAX.
 * Alcanza para el objetivo, que es acotar el daño de un script, no hacer cuotas.
 */

const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;

const hits = new Map<string, { count: number; windowStart: number }>();

/** Sólo para tests: limpia el estado entre casos. */
export const __resetRateLimit = (): void => hits.clear();

export function recommendationsRateLimit(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
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
  // El tope se resuelve POR REQUEST y no una vez al importar el módulo: es una
  // lectura de un `Map` en memoria (el snapshot de `app-settings`), no una query, y
  // es lo que permite aflojar o apretar el límite durante un incidente sin
  // reiniciar. Se compara contra el contador ya incrementado, igual que antes.
  if (entry.count > getRecommendationsSettings().rateLimitPerMinute) {
    res.status(429).json({ message: 'Demasiadas consultas. Reintentá en un minuto.' });
    return;
  }
  next();
}
