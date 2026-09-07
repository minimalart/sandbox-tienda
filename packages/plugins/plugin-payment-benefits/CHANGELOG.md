# Changelog

## 1.0.1 - Fase B: consumir `ExtensionVersion`, `HelpDrawer`, `SiteScopeBar`, `ExtensionSettingsCard` y `SingleColumnLayout` desde el runtime contract.

- Reemplaza los TODOs Fase B en `src/admin/routes/payment-benefits/settings/page.tsx` y `src/admin/routes/payment-benefits/benefits/page.tsx` por imports concretos desde `@minimalart/mercatto-plugin-runtime@^0.4.0/admin`. La settings vuelve a envolverse en `<SingleColumnLayout>`, el header vuelve a mostrar `<ExtensionVersion />` + `<HelpDrawer />`, y la card de credenciales del sync (`extension:payment-benefits`) vuelve a renderizarse debajo. La overview de beneficios recupera el badge y la `<SiteScopeBar screen="payment-benefits" />`.
- Registra la versión en el runtime (`registerPluginMeta('payment-benefits', { version: '1.0.1' })`) vía `src/admin/index.ts` para que el badge resuelva sin depender de `EXTENSION_VERSIONS` del host.

## 1.0.0 - Initial migration from base extension. All functionality preserved from packages/extensions/payment-benefits/ at parity, including host drift (multistore integration, HelpDrawer/SiteScopeBar in admin, siteFromPublishableKey in store/payment-methods).
