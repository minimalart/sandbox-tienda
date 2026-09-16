# Changelog

## 0.6.1 — 2026-09-13

- Share app-settings and external readers across physical package copies using a process-local, versioned contract registry.
- Preserve late registration, replacement, disconnect, missing-reader defaults and the existing admin/cart exports.
- Add a regression loading three independent built copies of the package.

## 0.6.0 — 2026-09-12

- Export `DrawerTabs` and `DrawerTabPanel` from the public admin entrypoint.
- Preserve the canonical Tiendas/B2B scrolling and panel mounting behavior.
- Accept translated previous/next labels; server consumers do not require UI peers.

## 0.2.0

- Nuevo subpath `./admin` con el slot `SiteScopeBar` + registrador
  `registerSiteScopeBar`. Los plugins publicados pueden renderizar la MISMA
  barra de contexto de tienda que el host, sin importar componentes del host
  directamente (que no pueden por vivir en `node_modules`).
- El host registra su implementación concreta como side effect del archivo
  donde la exporta; el plugin la consume via el slot. Cuando el host todavía
  no registró, el slot renderiza `null` y la página sigue funcional.
- Peer dep opcional: `react ^18.3.1`. Los consumidores backend NO necesitan
  React; el subpath `./` sigue siendo Node-only.

## 0.1.0

- Runtime coordination contract inicial: `AppSettingsSyncReader` (register/get)
  para leer el snapshot de `app-settings` desde plugins vía singleton, y
  `registerExternalReader` / `getExternalReader` para módulos del host
  arbitrarios (ej. `kapso-whatsapp/settings`).
