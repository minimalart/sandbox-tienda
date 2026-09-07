# Changelog

## 1.0.2 - Fase B: consumir `ExtensionVersion`, `SiteScopeBar` y `ExtensionSettingsCard` desde el runtime contract.

- Reemplaza los TODOs Fase B en `src/admin/routes/checkout-links/page.tsx` por imports concretos desde `@minimalart/mercatto-plugin-runtime@^0.4.0/admin`. El badge de versión, la SiteScopeBar y la card de settings (`extension:checkout-links`, con el copy sobre `NEXT_PUBLIC_BASE_URL`) vuelven a renderizarse en la overview del plugin.
- Registra la versión en el runtime (`registerPluginMeta('checkout-links', { version: '1.0.2' })`) vía `src/admin/index.ts` para que el badge resuelva sin depender de `EXTENSION_VERSIONS` del host.

## 1.0.1 - Fix: modal edición muestra `/undefined/c/undefined` al abrir por click en fila. `onRowClick` seteaba el wrapper de tanstack en vez de `row.original`. Menú de acciones ya usaba el original — bug solo disparaba al click directo en la fila.

## 1.0.0 - Initial migration from base extension. All functionality preserved from packages/extensions/checkout-links/ at parity.
