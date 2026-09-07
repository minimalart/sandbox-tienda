# Changelog

## 1.0.1 - Fase B: consumir `ExtensionVersion`, `SiteScopeBar` y `SalesChannelMultiSelect` desde el runtime contract.

- Reemplaza los TODOs Fase B en `src/admin/routes/brands/page.tsx` por imports concretos desde `@minimalart/mercatto-plugin-runtime@^0.4.0/admin`. La overview recupera `<SiteScopeBar screen="brands" />` arriba y el badge `<ExtensionVersion extension="brands" />` junto al título.
- Reemplaza el placeholder "UI temporal — Fase B" en `src/admin/routes/brands/components/brand-create-drawer.tsx` por `<SalesChannelMultiSelect />`; agrega el mismo widget al form del `brand-edit-drawer.tsx` (el estado `salesChannelIds` ya existía sin UI, ahora es editable).
- Registra la versión en el runtime (`registerPluginMeta('brands', { version: '1.0.1' })`) vía `src/admin/index.ts` para que el badge resuelva sin depender de `EXTENSION_VERSIONS` del host.

## 1.0.0 - Initial migration from base extension. All functionality preserved from packages/extensions/brands/ at parity.
