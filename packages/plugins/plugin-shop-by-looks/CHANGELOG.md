# Changelog

## 1.0.3 - Fix: el click en la fila abría el drawer de edición con el wrapper de TanStack.

- `useDataTable` de `@medusajs/ui` tipa el segundo argumento de `onRowClick` como el registro, pero en runtime entrega la `Row` de TanStack (`instance.onRowClick(e, row)` en `data-table-table.js`). Ahora se desenvuelve `.original`.
- Mismo síntoma que en brands: el form arrancaba vacío hasta que resolvía `useShopByLook`.

## 1.0.1 - Fase B: consumir `ExtensionVersion` y `SiteScopeBar` desde el runtime contract.

- Reemplaza los TODOs Fase B en `src/admin/routes/shop-by-looks/page.tsx` por imports concretos desde `@minimalart/mercatto-plugin-runtime@^0.3.0/admin`. El badge de versión + alcance multitienda ya no queda pelado, y la SiteScopeBar del host vuelve a renderizarse debajo del toolbar.
- Registra la versión en el runtime (`registerPluginMeta('shop-by-looks', { version: '1.0.1' })`) vía `src/admin/index.ts` para que el badge resuelva sin depender de `EXTENSION_VERSIONS` del host.

## 1.0.0 - Initial migration from base extension.

All functionality preserved from `apps/backend/src/{modules/shop-by-look, api/{admin/shop-by-looks, store/shop-by-look}, workflows/{create-shop-by-look, steps/create-shop-by-look}, admin/{routes/shop-by-looks, hooks/api/shop-by-looks, translations/shop-by-looks}}`. The public `GET /store/shop-by-look` route keeps the multistore-aware toggle (per-store `shop_by_look_enabled` via `readSetting` + `siteIdFromPublishableKey`, with global fallback) that the host had evolved beyond the extension source. The `SiteScopeBar` (host component) is documented as a TODO Fase B slot; the row-level scoping via `assertRowInSite` / `siteFilter` / `siteDefaults` is preserved through the vendored `lib/multistore` shim. The `storeConfig` module (host) is resolved by string literal at runtime — the plugin talks to it via `readSetting(STORE_SETTING_KEYS.SHOP_BY_LOOK_ENABLED, false, siteId)`. `ExtensionVersion` (host badge) is annotated as a TODO Fase B slot, same pattern as catalogador/brands.
