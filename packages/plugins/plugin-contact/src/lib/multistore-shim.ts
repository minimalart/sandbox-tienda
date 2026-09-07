/**
 * Multistore adapter — the plugin's local implementation of the multistore
 * contract, resolving against Mercatto's `demo_store` module (a MedusaService
 * that exposes `listDemoStores`).
 *
 * The contract package (`@minimalart/mercatto-multistore-contract`) is
 * type-only. The runtime side of the contract does NOT exist in the host as a
 * single `MultistoreHost` service — Mercatto has the demo_store CRUD service
 * plus a scattered set of functions in `apps/backend/src/lib/multistore/*`
 * that are compiled into the host, not the plugin. So the plugin implements
 * the lookups locally against the demo_store service, and degrades to
 * `registryAbsent` when the module is not registered (single-tenant hosts,
 * vanilla Medusa).
 */
import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import {
  ALL_SITES,
  MULTISTORE_HOST_KEYS,
  SITE_ID_HEADER,
  SITE_SLUG_HEADER,
  type SiteHint,
  type SiteRef,
  type SiteResolution,
  type SiteScopeDescriptor,
} from '@minimalart/mercatto-multistore-contract';

const UNDEFINED_TABLE = '42P01';

type PgError = { code?: string };

function isUndefinedTable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as PgError).code === UNDEFINED_TABLE
  );
}

type DemoStoreRow = {
  id: string;
  slug: string;
  name: string;
  is_main: boolean | null;
  sales_channel_id: string | null;
  b2b_sales_channel_id: string | null;
  region_id: string | null;
  stock_location_id: string | null;
};

type DemoStoreService = {
  listDemoStores(
    filters?: Record<string, unknown>,
    options?: { take?: number; skip?: number },
  ): Promise<DemoStoreRow[]>;
};

function toSiteRef(row: DemoStoreRow): SiteRef {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    is_main: Boolean(row.is_main),
    channel_ids: [
      ...new Set(
        [row.sales_channel_id, row.b2b_sales_channel_id].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ],
    region_id: row.region_id ?? null,
    stock_location_id: row.stock_location_id ?? null,
  };
}

function tryResolveDemoStoreService(container: MedusaContainer): DemoStoreService | null {
  for (const key of MULTISTORE_HOST_KEYS) {
    try {
      const service = container.resolve<DemoStoreService>(key);
      if (service && typeof service.listDemoStores === 'function') {
        return service;
      }
    } catch {
      // key not registered, try next
    }
  }
  return null;
}

async function findOne(
  service: DemoStoreService,
  filters: Record<string, unknown>,
): Promise<DemoStoreRow | 'table-missing' | null> {
  try {
    const rows = await service.listDemoStores(filters, { take: 1 });
    return rows?.[0] ?? null;
  } catch (error) {
    if (isUndefinedTable(error)) return 'table-missing';
    throw error;
  }
}

const readHeader = (req: { headers?: Record<string, unknown> }, name: string): string | null => {
  const raw = req.headers?.[name];
  const value = Array.isArray(raw) ? (raw[0] as unknown) : raw;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Resolve the tenant from an inbound request. Reads `x-site-id` and
 * `x-site-slug` headers, plus the publishable key's sales_channel_ids from
 * the store context if present. Delegates the actual lookup to
 * `resolveSite` below.
 */
export async function siteFromRequest(
  req: {
    headers?: Record<string, unknown>;
    scope: MedusaContainer;
    publishable_key_context?: { sales_channel_ids?: string[] };
  },
): Promise<SiteResolution> {
  const rawId = readHeader(req, SITE_ID_HEADER);
  const rawSlug = readHeader(req, SITE_SLUG_HEADER);
  const salesChannelId = req.publishable_key_context?.sales_channel_ids?.[0] ?? null;
  return resolveSite(req.scope, {
    siteId: rawId === ALL_SITES ? null : rawId,
    slug: rawSlug,
    salesChannelId,
  });
}

/**
 * Resolve the tenant from an explicit hint.
 *
 * Order: siteId → slug → salesChannelId → allSites (when no hint, multi-tenant)
 * / singleSite (when no hint, one tenant registered) / registryAbsent (module
 * missing or empty registry).
 */
export async function resolveSite(
  container: MedusaContainer,
  hint: SiteHint,
): Promise<SiteResolution> {
  const service = tryResolveDemoStoreService(container);
  if (!service) {
    if (hint.siteId || hint.slug) {
      return { status: 'unknownSite', hint };
    }
    return { status: 'registryAbsent', reason: 'module' };
  }

  const asked = Boolean(hint.siteId || hint.slug);

  if (hint.siteId) {
    const row = await findOne(service, { id: hint.siteId });
    if (row === 'table-missing') return { status: 'registryAbsent', reason: 'table' };
    if (row) return { status: 'site', site: toSiteRef(row) };
  }

  if (hint.slug) {
    const row = await findOne(service, { slug: hint.slug });
    if (row === 'table-missing') return { status: 'registryAbsent', reason: 'table' };
    if (row) return { status: 'site', site: toSiteRef(row) };
  }

  if (hint.salesChannelId) {
    const row = await findOne(service, {
      $or: [
        { sales_channel_id: hint.salesChannelId },
        { b2b_sales_channel_id: hint.salesChannelId },
      ],
    });
    if (row === 'table-missing') return { status: 'registryAbsent', reason: 'table' };
    if (row) return { status: 'site', site: toSiteRef(row) };
  }

  let all: DemoStoreRow[];
  try {
    all = (await service.listDemoStores({}, { take: 2 })) ?? [];
  } catch (error) {
    if (isUndefinedTable(error)) return { status: 'registryAbsent', reason: 'table' };
    throw error;
  }

  if (all.length === 0) return { status: 'registryAbsent', reason: 'empty' };
  if (asked) return { status: 'unknownSite', hint };
  if (all.length === 1) return { status: 'singleSite', site: toSiteRef(all[0]) };
  return { status: 'allSites' };
}

/**
 * Produce a MikroORM filter for a `site_column` descriptor.
 *
 * Contract by resolution status:
 *   'site' / 'singleSite' → filter by column = tenant's id (respecting `empty`)
 *   'allSites'            → no filter (admin viewing all)
 *   'registryAbsent'      → no filter (single-tenant fallback)
 *   'unknownSite'         → throw (stale id, don't leak)
 *
 * `empty` semantics for the NULL rows in a `site_column` table:
 *   'all'         NULL means visible-everywhere (transitional data, no backfill
 *                 yet). Scoped view MUST include NULLs alongside its own rows.
 *   'global'      NULL is the fallback row. Same OR-with-null shape as 'all'
 *                 for LIST semantics; PRECEDENCE resolution is a separate
 *                 concern handled outside this filter.
 *   'unassigned'  NULL means orphaned. Fail-closed — a scoped view MUST NOT
 *                 see rows the tenant doesn't own.
 */
export async function siteFilter(
  _container: MedusaContainer,
  resolution: SiteResolution,
  descriptor: SiteScopeDescriptor,
): Promise<Record<string, unknown>> {
  if (resolution.status === 'site' || resolution.status === 'singleSite') {
    if (descriptor.kind === 'site_column') {
      if (descriptor.empty === 'all' || descriptor.empty === 'global') {
        return {
          $or: [
            { [descriptor.column]: resolution.site.id },
            { [descriptor.column]: null },
          ],
        };
      }
      return { [descriptor.column]: resolution.site.id };
    }
    return {};
  }
  if (resolution.status === 'unknownSite') {
    // Mirror the host's semantics: 404 (not 403) so the caller cannot confirm
    // whether the id exists in a different tenant. Using a plain Error here
    // bubbles as an opaque 500 and breaks admin UIs that expect a graceful
    // NOT_FOUND when the active-site selector points at a stale/removed demo.
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'La tienda solicitada no existe o fue eliminada.');
  }
  return {};
}

/**
 * Guard for mutation endpoints: verify that `id` belongs to the current tenant
 * BEFORE running the mutation. Throws 404 (not 403) so the caller cannot
 * confirm whether the id exists in a different tenant.
 *
 * Mirrors the host's `assertIdInSite` from `apps/backend/src/lib/multistore/scope.ts`
 * for `site_column` descriptors, using a raw pg query resolved from the
 * Medusa container.
 *
 * The `empty` semantics are honored: with `'all'` / `'global'`, NULL rows are
 * considered visible-everywhere, so they pass the guard. With `'unassigned'`,
 * NULL rows are orphans and the mutation is rejected.
 */
export async function assertIdInSite(
  container: MedusaContainer,
  resolution: SiteResolution,
  descriptor: SiteScopeDescriptor,
  id: string,
): Promise<void> {
  // No filter needed — admin viewing all sites, single-tenant fallback, etc.
  if (resolution.status === 'allSites' || resolution.status === 'registryAbsent') {
    return;
  }
  if (resolution.status === 'unknownSite') {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');
  }

  // Only `site_column` is supported by this shim. Other kinds (`channel_array`,
  // `via_parent`, `join_table`) require the host's richer scoping helpers.
  if (descriptor.kind !== 'site_column') {
    throw new Error(
      `assertIdInSite shim supports only 'site_column' descriptors, got '${descriptor.kind}'.`,
    );
  }

  const includesEmpty = descriptor.empty === 'all' || descriptor.empty === 'global';
  const siteId = resolution.site.id;

  const pgConnection = container.resolve<{
    raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }>;
  }>(ContainerRegistrationKeys.PG_CONNECTION);

  const sql = includesEmpty
    ? `SELECT 1 FROM "${descriptor.table}" WHERE "id" = ? AND "deleted_at" IS NULL AND ("${descriptor.column}" = ? OR "${descriptor.column}" IS NULL) LIMIT 1`
    : `SELECT 1 FROM "${descriptor.table}" WHERE "id" = ? AND "deleted_at" IS NULL AND "${descriptor.column}" = ? LIMIT 1`;

  const result = await pgConnection.raw(sql, [id, siteId]);
  if (!result?.rows?.length) {
    // 404 (not 403) is deliberate: a 403 would confirm the id exists in another tenant.
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');
  }
}
