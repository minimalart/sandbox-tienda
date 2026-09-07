# Changelog

## 1.1.0 - 2026-09-03

Paga la deuda que 1.0.0 dejó anotada ("minus the `app-settings`-backed override
of catalogador credentials ... Credentials fall back to env-only") y baja el
umbral del gate de revisión.

### Fixed

- **Las credenciales vuelven a leerse de la base (`DESDEELSUR-46`).** El host
  publica un lector de `app-settings` en `globalThis` desde el loader del módulo
  (`plugin-bridge.ts`) y el plugin lo consume por `lib/host-settings.ts`, con
  precedencia **DB cifrada > env** y degradación al entorno cuando ese puente no
  está. Sin esto, una `OPENROUTER_API_KEY` guardada desde la card del Asistente
  IA era invisible para el plugin: en desdeelsur estaba en la base desde el
  19/08 con `env_present: false`, y `POST /admin/catalogador/executions/:id/generate`
  contestaba `503 "OPENROUTER_API_KEY no está configurada en el backend"` en cada
  intento de generar textos — mientras el chat del asistente, que sí lee la base,
  funcionaba. Alcanza a `ai/openrouter.ts` (las dos claves de OpenRouter, del
  namespace `extension:ai-assistant`) y a `modules/catalogador/settings.ts` (las
  6 claves editables de `extension:catalogador`). `CATALOGADOR_JOB_SCHEDULE`
  sigue siendo `envOnly`: Medusa hornea el schedule al arrancar.

### Changed

- **`rules.low_confidence_threshold` por default pasa de `0.7` a `0.5`**, y con
  él los tres fallbacks que lo espejaban: el `??` del endpoint de decisiones y
  las dos pantallas del admin (config y detalle de ejecución). Eran cuatro copias
  del mismo número sin nada que las obligara a moverse juntas.

  Consecuencia a tener presente: el piso de `evidenceConfidence()` es `0.55`, así
  que con el umbral en `0.5` el gate **no difiere ningún campo** — "aceptar todo"
  acepta todo. Es lo pedido (se venía aceptando campo por campo), pero significa
  que `require_review_low_confidence: true` ya no cambia el resultado. Para
  recuperar el gate hay que subir el umbral por encima de `0.55` y no más de
  `0.7`, que es el techo alcanzable sin barcode ni scraping.

  Es un DEFAULT: una fila ya guardada en `catalogador_config` le gana
  (`mergeCatalogadorConfig`), así que las tiendas existentes necesitan además un
  `POST /admin/catalogador/config` para tomarlo.

## 1.0.0 - Initial migration from base extension.

All functionality preserved from packages/extensions/catalogador at parity, minus the `app-settings`-backed override of catalogador credentials and the shared host admin components (ExtensionSettingsCard / HelpDrawer / ExtensionVersion / SingleColumnLayout). Credentials fall back to env-only, matching pre-`app-settings` behaviour; the missing admin cosmetics are annotated with TODOs. The storeConfig read/upsert used to persist `catalogador_config` is resolved from the host by string key. Editable-lifestyle-editor moved into the plugin.
