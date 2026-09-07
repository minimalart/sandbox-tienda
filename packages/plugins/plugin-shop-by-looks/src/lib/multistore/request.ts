import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { resolveSite } from './resolve-site';
import type { SiteHint, SiteResolution } from './types';

/**
 * Puente entre una request HTTP y el seam multitienda.
 *
 * El middleware NO hace I/O: sólo parsea headers y cuelga las pistas. El lookup es
 * perezoso —lo dispara la primera ruta que pregunte— y memoizado por request, así
 * cinco helpers en el mismo handler no producen cinco queries.
 */

/** Se memoiza la PROMESA, no el valor: si no, dos llamadas concurrentes hacen dos queries. */
const HINT = Symbol.for('multistore.hint');
const PENDING = Symbol.for('multistore.pending');

type Carrier = {
  [HINT]?: SiteHint;
  [PENDING]?: Promise<SiteResolution>;
};

/** El admin manda el id, que es inmutable. El slug se acepta sólo para debug con curl. */
export const SITE_ID_HEADER = 'x-site-id';
export const SITE_SLUG_HEADER = 'x-site-slug';

/** Valor explícito para "todas las tiendas". Ver la nota de abajo. */
export const ALL_SITES = '*';

const headerValue = (req: MedusaRequest, name: string): string | null => {
  const raw = req.headers?.[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Cuelga las pistas de la request. Registrado para `/admin/*`.
 *
 * `x-site-id: *` es explícito y NO es lo mismo que no mandar el header, aunque hoy
 * los dos resuelvan a `allSites`: distinguirlos es lo que va a permitir prender
 * fail-closed más adelante sin romper a quien todavía no manda nada.
 *
 * `allowMainFallback` es SIEMPRE false en el admin: "sin tienda elegida" significa
 * "todas", no "la principal". Un operador de tres tiendas que ve sólo la principal
 * sin haberlo pedido está viendo un tercio de su data sin ninguna señal.
 */
export const attachSiteHint = (
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) => {
  const rawId = headerValue(req, SITE_ID_HEADER);
  const carrier = req as unknown as Carrier;

  carrier[HINT] = {
    siteId: rawId === ALL_SITES ? null : rawId,
    slug: headerValue(req, SITE_SLUG_HEADER),
    allowMainFallback: false,
  };

  return next();
};

/**
 * La tienda de esta request. Perezoso y memoizado.
 *
 * Deliberadamente NO deriva de `orderId`/`cartId` en el admin: eso haría que una
 * pantalla de detalle "esté de acuerdo" con la fila que muestra en vez de con lo que
 * el operador eligió, y escondería justo el caso que querés ver — una orden que
 * pertenece a otra tienda.
 */
export function siteFromRequest(req: MedusaRequest): Promise<SiteResolution> {
  const carrier = req as unknown as Carrier;
  const pending = carrier[PENDING];
  if (pending) return pending;

  const hint = carrier[HINT] ?? { allowMainFallback: false };
  const promise = resolveSite(req.scope, hint);
  carrier[PENDING] = promise;
  return promise;
}

/** Sólo para tests: leer las pistas sin disparar el lookup. */
export const siteHintOf = (req: MedusaRequest): SiteHint | undefined =>
  (req as unknown as Carrier)[HINT];
