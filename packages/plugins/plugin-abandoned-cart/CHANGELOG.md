# Changelog

## 1.4.1

- Feature: consumir el slot `SiteScopeBar` de `@minimalart/mercatto-plugin-runtime@^0.2.0` — la barra reaparece en `/app/abandoned-carts` con la implementación del host. Fase B del pattern. También bumpea el badge en el header de v1.3.0 (stale desde antes de la migración) a v1.4.1.

## 1.4.0 - Adopt `@minimalart/mercatto-plugin-runtime` for host coordination.

**BREAKING**: `setAbandonedCartSnapshotReader` and `setKapsoWhatsappTemplateReader` are no longer exported from the plugin's root — the plugin resolves both readers from the runtime contract package. Hosts that were wiring the plugin via per-plugin setters must switch to the generic bridge (register once with `registerAppSettingsSyncReader` and `registerExternalReader` from `@minimalart/mercatto-plugin-runtime`).

## 1.3.0 - Initial migration from base extension. All functionality preserved from packages/extensions/abandoned-cart/ at parity.
