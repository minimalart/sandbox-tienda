import type { MedusaContainer } from '@medusajs/framework/types';
import type { Link } from '@medusajs/framework/modules-sdk';
import type { RemoteQueryFunction } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { BUNDLE_MODULE } from './index';

/**
 * Hardcoded as a string constant instead of `import { DEMO_STORE_MODULE }` on
 * purpose: the `bundle` module must remain independent from a `demo_store`
 * folder existing in the project. Projects that don't opt into demo-store
 * would fail at compile time on that static import (plan §5.2 fallback).
 * The value must match `apps/backend/src/modules/demo-store/index.ts`.
 */
const DEMO_STORE_MODULE = 'demo_store' as const;

/**
 * Link shape for `bundle_demo_store`. Order matches `src/links/bundle-demo-store.ts`
 * — Bundle first, DemoStore second — because `remoteLink` builds its lookup key
 * from `Object.keys(link)` and mismatched order fails silently with
 * "Module to type ... was not found". See `provision-branch.ts` for the same
 * precedent on the branch↔channel link.
 */
export type BundleDemoStoreLink = {
  [BUNDLE_MODULE]: { bundle_id: string };
  [DEMO_STORE_MODULE]: { demo_store_id: string };
};

export const buildBundleDemoStoreLink = (
  bundleId: string,
  demoStoreId: string,
): BundleDemoStoreLink => ({
  [BUNDLE_MODULE]: { bundle_id: bundleId },
  [DEMO_STORE_MODULE]: { demo_store_id: demoStoreId },
});

/**
 * Sync the set of Stores a Bundle is linked to.
 *
 * Idempotent: reads the current links, computes the diff and only calls
 * `link.create` / `link.dismiss` for the delta. Returns the actual delta so
 * callers (workflows, routes) can log / audit.
 *
 * When the `demo_store` module is NOT registered in the running project (link
 * unresolvable, Query throws), returns a `skipped: true` flag instead of
 * failing — matches the plan §5.2 fallback.
 */
export const syncBundleStores = async (
  container: MedusaContainer,
  bundleId: string,
  desiredStoreIds: string[],
): Promise<{ added: string[]; removed: string[]; skipped?: boolean }> => {
  const link = container.resolve<Link>(ContainerRegistrationKeys.LINK);
  const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(
    ContainerRegistrationKeys.QUERY,
  );

  let currentIds: string[] = [];
  try {
    const { data } = await query.graph({
      entity: 'bundle',
      fields: ['id', 'demo_stores.id'],
      filters: { id: bundleId },
    });
    const bundle = data?.[0] as { id: string; demo_stores?: { id: string }[] } | undefined;
    currentIds = (bundle?.demo_stores ?? []).map((s) => s.id);
  } catch {
    // demo_store module not registered → treat as no current links and skip
    // writes to avoid tripping the link resolver.
    return { added: [], removed: [], skipped: true };
  }

  const desired = new Set(desiredStoreIds);
  const current = new Set(currentIds);
  const toAdd = [...desired].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !desired.has(id));

  if (toAdd.length) {
    await link.create(toAdd.map((id) => buildBundleDemoStoreLink(bundleId, id)));
  }
  if (toRemove.length) {
    await link.dismiss(toRemove.map((id) => buildBundleDemoStoreLink(bundleId, id)));
  }
  return { added: toAdd, removed: toRemove };
};

export const listBundleStoreIds = async (
  container: MedusaContainer,
  bundleId: string,
): Promise<string[]> => {
  const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(
    ContainerRegistrationKeys.QUERY,
  );
  try {
    const { data } = await query.graph({
      entity: 'bundle',
      fields: ['id', 'demo_stores.id'],
      filters: { id: bundleId },
    });
    const bundle = data?.[0] as { id: string; demo_stores?: { id: string }[] } | undefined;
    return (bundle?.demo_stores ?? []).map((s) => s.id);
  } catch {
    return [];
  }
};

/**
 * Reverse lookup: given a demo_store_id, list bundle ids linked to it.
 * Used by GET /store/bundles to scope the listing to the active Store.
 */
export const listBundleIdsForStore = async (
  container: MedusaContainer,
  demoStoreId: string,
): Promise<string[]> => {
  const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(
    ContainerRegistrationKeys.QUERY,
  );
  try {
    const { data } = await query.graph({
      entity: 'demo_store',
      fields: ['id', 'bundles.id'],
      filters: { id: demoStoreId },
    });
    const store = data?.[0] as { id: string; bundles?: { id: string }[] } | undefined;
    return (store?.bundles ?? []).map((b) => b.id);
  } catch {
    return [];
  }
};

export const isBundleAvailableInStore = async (
  container: MedusaContainer,
  bundleId: string,
  demoStoreId: string | null,
): Promise<boolean> => {
  // If we have no Store to scope by (project without demo_store module), fall
  // back to "available everywhere" — plan §5.2 single-tenant fallback.
  if (!demoStoreId) return true;
  const linkedStores = await listBundleStoreIds(container, bundleId);
  if (linkedStores.length === 0) return true; // unscoped bundle → global
  return linkedStores.includes(demoStoreId);
};
