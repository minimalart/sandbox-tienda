## 1.0.4 - text_color + cta_text_color separados, ambos visibles en hero y cards

- Fix: `ALL_FIELDS` en `placement-config.ts` no incluía `text_color`, entonces
  el campo no se renderizaba en la UI del admin para hero (`banner_1`) ni
  cards (`banner_2..6`). En 1.0.3 el mapper ya lo persistía si venía, pero
  como no había input en el form el operador no podía cargarlo.
- Feature: nuevo campo `cta_text_color` (persistido como
  `metadata.cta_color_font`), separado del `text_color` general. El texto del
  banner (título/subtítulo) va sobre la imagen (fondo oscuro/reservado);
  el CTA va sobre `card_color` (posiblemente claro). Un único campo acoplaba
  los dos: seteabas oscuro para arreglar el CTA y el título quedaba invisible.
  Ambos son opcionales; sin config el consumer usa `#FFFFFF` para los dos
  (comportamiento previo preservado).
- Aplica a placements `banner_1..6` (hero + cards) y `sticky_footer`.

## 1.0.3 - text_color persiste en todos los placements

- Fix: el mapper del form admin persistía `metadata.color_font` sólo cuando el
  placement era `top_bar`, `welcome_splash` o `sticky_footer` — dejaba fuera
  al hero (`banner_1`) y otros, aunque el field estaba visible en la UI. Si
  el operador ponía un `card_color` claro y el consumer del storefront
  hardcodeaba texto blanco (era el caso del `hero-banners`), el texto quedaba
  invisible sobre el fondo. Ahora `text_color` se guarda para cualquier
  placement; el consumer decide si respetarlo o no (fallback a su default).

## 1.0.1 - Fase B: consumir `ExtensionVersion`, `SiteScopeBar` y `SalesChannelMultiSelect` desde el runtime contract.

- Reemplaza los TODOs Fase B en `src/admin/routes/banners/page.tsx` por imports concretos desde `@minimalart/mercatto-plugin-runtime@^0.4.0/admin`. La overview recupera `<SiteScopeBar screen="banners" />` arriba y el badge `<ExtensionVersion extension="banners" />` junto al título.
- Reemplaza el fallback de input de ids separados por coma en `src/admin/routes/banners/components/banner-form.tsx` por `<SalesChannelMultiSelect />` del runtime. La segmentación por canal vuelve al checkbox list compartido.
- Registra la versión en el runtime (`registerPluginMeta('banners', { version: '1.0.1' })`) vía `src/admin/index.ts` para que el badge resuelva sin depender de `EXTENSION_VERSIONS` del host.

## 1.0.0

Initial migration from `packages/extensions/banners/` (v1.6.0). All functionality preserved at parity minus two Fase B holdouts that keep the plugin self-contained:

- The overview page loses the `SiteScopeBar` and the `ExtensionVersion` badge (both live in the host `apps/backend/src/admin/components/common/`). They will re-appear when `@minimalart/mercatto-plugin-runtime` exposes the shared admin toolkit.
- The banner form falls back to a comma-separated ids input in place of `SalesChannelMultiSelect` (also a host-only component) so segmentation by sales channel keeps working end-to-end.

Landing-page AI helpers (`callOpenRouter`, `getAiConfig`, `generateImage`, `optimizeToWebp`, `LandingAiError`) plus the `settings.ts` wrapper are vendored under `src/lib/landing-ai/` so the plugin does not depend on the host `landing-page` dormant shim.

`storeConfig` (host module) is resolved by string key at runtime via `src/lib/foreign-modules.ts` for AI overrides, matching the pattern already used by `@minimalart/mercatto-plugin-landing-pages`.

The AI compose drawer vendors `admin/components/blog/product-selector.tsx` and `admin/translations/blog/index.ts` from the host so it keeps working without a runtime dependency on `@minimalart/mercatto-plugin-blog`.
