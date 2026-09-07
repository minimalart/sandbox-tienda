# Changelog

## 1.0.1 - Fase B: consumir `ExtensionVersion`, `SiteScopeBar` y `SalesChannelMultiSelect` desde el runtime contract.

- Reemplaza los TODOs Fase B en `src/admin/routes/blog/articles/page.tsx` por imports concretos desde `@minimalart/mercatto-plugin-runtime@^0.4.0/admin`. La overview de artículos recupera `<SiteScopeBar screen="blog" />` arriba y el badge `<ExtensionVersion extension="blog" />` junto al título.
- Reemplaza el mensaje "Canales de venta: integración pendiente (Fase B)" en `src/admin/routes/blog/articles/[id]/page.tsx` por `<SalesChannelMultiSelect />` real; el estado `salesChannelIds`/`setSalesChannelIds` ya estaba conectado al payload y ahora es editable.
- Registra la versión en el runtime (`registerPluginMeta('blog', { version: '1.0.1' })`) vía `src/admin/index.ts` para que el badge resuelva sin depender de `EXTENSION_VERSIONS` del host.

## 1.0.0 - Initial migration from base extension. All functionality preserved from packages/extensions/blog/ at parity.
