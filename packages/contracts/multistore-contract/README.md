# @minimalart/mercatto-multistore-contract

Type-only contract for Mercatto multitenant plugins. Zero runtime beyond canonical container keys and header names.

## Purpose

Plugins in the Mercatto ecosystem need to interact with the host's multi-tenant layer without importing directly from the host's `apps/backend/src/lib/multistore/` code. This package publishes the types + canonical keys so plugins can:

1. Declare a `SiteScopeDescriptor` for their tables
2. Resolve the host from the Medusa container using `MULTISTORE_HOST_KEYS`
3. Implement a local shim that adapts the host to the `MultistoreHost` interface
4. Degrade gracefully to `registryAbsent` when running under a single-tenant host

## Install

```bash
pnpm add @minimalart/mercatto-multistore-contract
```

## Usage

```ts
import type {
  SiteScopeDescriptor,
  SiteResolution,
} from '@minimalart/mercatto-multistore-contract';
import { MULTISTORE_HOST_KEYS, SITE_ID_HEADER } from '@minimalart/mercatto-multistore-contract';

export const MY_TABLE_SCOPE: SiteScopeDescriptor = {
  kind: 'site_column',
  table: 'my_table',
  column: 'site_id',
  empty: 'unassigned',
};

function tryResolveHost(container: any) {
  for (const key of MULTISTORE_HOST_KEYS) {
    try {
      const service = container.resolve(key);
      if (service && typeof service.listDemoStores === 'function') return service;
    } catch { /* keep looking */ }
  }
  return null;
}
```

See `packages/plugins/plugin-contact/src/lib/multistore-shim.ts` in the boilerplate for a complete shim implementation.

## Semantics

- Absence of the host (`registryAbsent`) is a valid state — a plugin authored against this contract runs on vanilla Medusa.
- `unknownSite` MUST throw — a stale tenant id leaks every other tenant's rows.
- `NullMeans` semantics are strict: mixing `all` / `global` / `unassigned` produces fail-open where fail-closed was intended.
