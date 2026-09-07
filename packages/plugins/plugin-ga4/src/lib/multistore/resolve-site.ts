import type { MedusaContainer } from '@medusajs/framework/types';
import { SITE_REGISTRY_MODULE } from './module-key';
import type { SiteHint, SiteRef, SiteResolution } from './types';

/**
 * Resolución de la tienda de una request, vía container.
 *
 * Para services de módulo y providers —que reciben un container AISLADO y no pueden
 * resolver otros módulos— existe el gemelo `resolve-site-sql.ts`, que hace lo mismo
 * por knex. Los dos tienen que dar el mismo `SiteRef`; hay un test de paridad.
 */

type SiteRow = {
  id: string;
  slug: string;
  name: string;
  is_main: boolean;
  sales_channel_id: string | null;
  b2b_sales_channel_id: string | null;
  region_id: string | null;
  stock_location_id: string | null;
};

/** Postgres: `relation "..." does not exist`. La tabla puede no existir todavía. */
const UNDEFINED_TABLE = '42P01';

const isUndefinedTable = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === UNDEFINED_TABLE;

export const toSiteRef = (row: SiteRow): SiteRef => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  is_main: Boolean(row.is_main),
  // Los DOS canales. Ver la nota de `SiteRef.channel_ids` en types.ts.
  channel_ids: [...new Set([row.sales_channel_id, row.b2b_sales_channel_id].filter(Boolean))] as string[],
  region_id: row.region_id ?? null,
  stock_location_id: row.stock_location_id ?? null,
});

type SiteService = {
  listDemoStores: (filters?: Record<string, unknown>, config?: Record<string, unknown>) => Promise<SiteRow[]>;
};

/** Resuelve el módulo por string literal. Ver `module-key.ts`. */
function resolveService(container: MedusaContainer): SiteService | null {
  try {
    return container.resolve(SITE_REGISTRY_MODULE) as unknown as SiteService;
  } catch {
    return null;
  }
}

async function findOne(
  service: SiteService,
  filters: Record<string, unknown>,
): Promise<SiteRow | null | 'table-missing'> {
  try {
    const rows = await service.listDemoStores(filters, { take: 1 });
    return rows?.[0] ?? null;
  } catch (error) {
    if (isUndefinedTable(error)) return 'table-missing';
    throw error;
  }
}

/** Deriva el canal de una orden o un carrito, best-effort. */
async function channelOfEntity(
  container: MedusaContainer,
  hint: SiteHint,
): Promise<string | null> {
  const { Modules } = await import('@medusajs/framework/utils');
  try {
    if (hint.orderId) {
      const orders: any = container.resolve(Modules.ORDER);
      const order = await orders.retrieveOrder(hint.orderId, { select: ['sales_channel_id'] });
      return order?.sales_channel_id ?? null;
    }
    if (hint.cartId) {
      const carts: any = container.resolve(Modules.CART);
      const cart = await carts.retrieveCart(hint.cartId, { select: ['sales_channel_id'] });
      return cart?.sales_channel_id ?? null;
    }
  } catch {
    // Entidad inexistente o módulo ausente: la pista no aporta, se sigue.
  }
  return null;
}

/**
 * Resuelve la tienda a partir de las pistas disponibles.
 *
 * Orden: `siteId` → `slug` → `salesChannelId` (matcheando AMBAS columnas de canal)
 * → `orderId`/`cartId` → `is_main` (sólo con `allowMainFallback`) → `allSites`.
 *
 * Nunca tira por una pista que no matchea un formato esperado: la única forma de
 * terminar en `unknownSite` es haber pedido una tienda concreta que no existe.
 */
export async function resolveSite(
  container: MedusaContainer,
  hint: SiteHint = {},
): Promise<SiteResolution> {
  const service = resolveService(container);
  if (!service) return { status: 'registryAbsent', reason: 'module' };

  const asked = Boolean(hint.siteId || hint.slug);

  const lookups: Array<Record<string, unknown>> = [];
  if (hint.siteId) lookups.push({ id: hint.siteId });
  if (hint.slug) lookups.push({ slug: hint.slug });
  if (hint.salesChannelId) {
    // Ambas columnas: una tienda B2B tiene dos canales.
    lookups.push({
      $or: [{ sales_channel_id: hint.salesChannelId }, { b2b_sales_channel_id: hint.salesChannelId }],
    });
  }

  for (const filters of lookups) {
    const row = await findOne(service, filters);
    if (row === 'table-missing') return { status: 'registryAbsent', reason: 'table' };
    if (row) return { status: 'site', site: toSiteRef(row) };
  }

  // Pistas indirectas: sólo si no pidieron una tienda concreta.
  if (!asked) {
    const channelId = await channelOfEntity(container, hint);
    if (channelId) {
      const row = await findOne(service, {
        $or: [{ sales_channel_id: channelId }, { b2b_sales_channel_id: channelId }],
      });
      if (row === 'table-missing') return { status: 'registryAbsent', reason: 'table' };
      if (row) return { status: 'site', site: toSiteRef(row) };
    }
  }

  // Cuántas tiendas hay: distingue "registro vacío" de "una sola" de "no matcheó".
  let all: SiteRow[];
  try {
    all = (await service.listDemoStores({}, { take: 2 })) ?? [];
  } catch (error) {
    if (isUndefinedTable(error)) return { status: 'registryAbsent', reason: 'table' };
    throw error;
  }

  if (all.length === 0) return { status: 'registryAbsent', reason: 'empty' };

  // Pidieron una tienda concreta y no existe (o fue borrada): romper, no degradar.
  if (asked) return { status: 'unknownSite', hint };

  if (all.length === 1) return { status: 'singleSite', site: toSiteRef(all[0]!) };

  if (hint.allowMainFallback) {
    const row = await findOne(service, { is_main: true });
    if (row && row !== 'table-missing') return { status: 'site', site: toSiteRef(row) };
  }

  return { status: 'allSites' };
}

/**
 * El `site_id` de un canal, o `null` si no hay eje de tienda que aplicar.
 *
 * Es el puente que necesita todo el trabajo SIN request: un `order.placed` trae
 * `sales_channel_id`, pero las tablas que llevan tienda propia —`loyalty_program`,
 * `gift_card_settings`— se filtran por `site_id`. Traducir a mano en cada call site
 * es exactamente cómo aparecen las variantes: una que colapsa `singleSite` en la
 * tienda y otra que no, y las dos "funcionan" hasta que hay dos tiendas.
 *
 * `null` significa LA FILA GLOBAL (`site_id IS NULL`), no "la principal". Se llega
 * ahí con `singleSite`, `allSites` y `registryAbsent`, y es deliberado: con una sola
 * tienda —o sin registro— la global no es "la de otra", es la única que hay. Es el
 * mismo criterio que `pickBySitePrecedence` con `inherit-global`, y el que ya usan
 * `siteOf(req)` en el admin y `store/gift-card-experience/designs`.
 *
 * `unknownSite` también cae en `null` y NO rompe: acá no hay operador que eligió mal
 * una tienda —hay una orden ya cobrada— y abortar el earn o la emisión por un canal
 * huérfano sería castigar al cliente por una fila del registro.
 */
export async function siteIdOfChannel(
  container: MedusaContainer,
  salesChannelId: string | null | undefined,
): Promise<string | null> {
  if (!salesChannelId) return null;
  const resolution = await resolveSite(container, { salesChannelId });
  return resolution.status === 'site' ? resolution.site.id : null;
}

/** Todas las tiendas. Lo usan los jobs que hacen fan-out. */
export async function listSites(
  container: MedusaContainer,
  options: { includeMain?: boolean } = {},
): Promise<SiteRef[]> {
  const service = resolveService(container);
  if (!service) return [];
  try {
    const rows = (await service.listDemoStores({}, {})) ?? [];
    const refs = rows.map(toSiteRef);
    return options.includeMain === false ? refs.filter((site) => !site.is_main) : refs;
  } catch (error) {
    if (isUndefinedTable(error)) return [];
    throw error;
  }
}
