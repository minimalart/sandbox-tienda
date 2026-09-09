# @minimalart/mercatto-plugin-store-importer-contract

Type-only contract for Mercatto catalog importers. Zero runtime — pure TypeScript declarations that both the multistore extension and the store-importer plugin depend on.

> **Renamed from `@minimalart/mercatto-store-importer-contract`** as part of the `packages/plugins/` consolidation — all npm publishable packages now live under `packages/plugins/`. The previous `v0.1.0` under the old name remains published but unused; this package continues under the new name starting at `v0.2.0`.

## Purpose

The catalog import pipeline in Mercatto has two independent surfaces:

1. The **multistore extension** owns `demo_store` persistence and the `/admin/sites` routes. It needs `SourceType` / `PlatformSourceType` to classify a site's origin, and `NormalizedProduct` / `NormalizedVariant` because its persistence layer consumes them.
2. The **`@minimalart/mercatto-plugin-store-importer`** ships the concrete WooCommerce / VTEX / Shopify strategies. It implements `ProductImporter` and returns `NormalizedProduct[]`.

Neither package should depend on the other. This contract is the single source of truth for the shape they exchange, so they can be versioned and swapped independently — and third-party importers can implement the same signature without importing anything from the host.

## Install

```bash
pnpm add @minimalart/mercatto-plugin-store-importer-contract
```

## Usage

```ts
import type {
  NormalizedProduct,
  NormalizedVariant,
  ProductImporter,
  ImporterContext,
  SourceType,
  PlatformSourceType,
} from '@minimalart/mercatto-plugin-store-importer-contract';

export const myImporter: ProductImporter = async (ctx: ImporterContext) => {
  // fetch + normalize
  return [] as NormalizedProduct[];
};
```

## Semantics

- `NormalizedProduct.variants` absent or empty → the persistence layer falls back to a single `Formato: Único` variant. Sources that expose real variants (apparel) MUST populate `optionTitle` and `variants`.
- `PlatformSourceType` is `Exclude<SourceType, 'sales_channel'>` on purpose: `sales_channel` sites adopt an existing Medusa channel and do not run an importer. Consumers switching on source type must handle that branch explicitly.
- All monetary fields are minor-unit-free integers (rounded), matching the original `scripts/vtex-fetch.ts` convention.
