# Changelog

## 1.0.2 - HOTFIX: agregar `src/api/middlewares.ts` root que faltaba en el scaffold Round 1.

- Sin ese archivo, Medusa NO descubre los middlewares anidados en `admin/gift-card-experience/middlewares.ts`. Consecuencias en producción:
  - `POST /admin/gift-card-experience/settings` respondía 500 (validator no corría → `req.validatedBody` undefined → crash en `input.retry_delays_minutes`).
  - `requireGiftCardAdminPermission(...)` NO se aplicaba a ninguna ruta admin de gift-cards — cualquier admin autenticado podía tocar designs/deliveries/settings/analytics sin el guard de permisos.
  - `gift_card_settings.enabled` quedó atascado en `false` (no había forma de flippearlo via admin) → hook `gift-card-cart-validation.ts` tiraba en checkout → **pago 1351272521 cobrado sin orden** (incidente 2026-09-03).
- El archivo agrega `defineMiddlewares([...adminGiftCardExperienceMiddlewares])` como root del api del plugin — mismo patrón que el resto de los plugins (`plugin-fiscal-documentation`, `plugin-blog`, etc.).
- v12 aprendizaje: scaffold agent DEBE crear `src/api/middlewares.ts` cada vez que haya middlewares anidados con `MiddlewareRoute[]`.

## 1.0.1 - Fase B: consumir `ExtensionSettingsCard`, `HelpDrawer` y `SingleColumnLayout` del runtime contract.

- Reemplaza los TODOs Fase B en `src/admin/routes/gift-card-experience/settings/page.tsx` por imports desde `@minimalart/mercatto-plugin-runtime@^0.3.0/admin`. La pantalla de ajustes vuelve a envolverse en `<SingleColumnLayout>`, muestra el `<HelpDrawer slug="gift-cards" />` en el header, y renderiza la card de env-only settings vía `<ExtensionSettingsCard namespace="extension:gift-cards" />`.
- Registra la versión en el runtime (`registerPluginMeta('gift-cards', { version: '1.0.1' })`) vía `src/admin/index.ts` para que el badge del host resuelva sin depender de `EXTENSION_VERSIONS`.

## 1.0.0 - Initial migration from base extension.

All functionality preserved from `apps/backend/src/{modules/gift-card-experience, api/{admin/gift-card-experience, store/gift-card-experience, webhooks/sendgrid-gift-cards}, admin/{routes/gift-card-experience, hooks/api/gift-cards.tsx}, workflows/hooks/gift-card-cart-validation.ts, subscribers/{order-placed,order-canceled,payment-captured}-gift-card.ts, jobs/{process-gift-card-deliveries,process-gift-card-lifecycle,reconcile-gift-card-usage}.ts}`.

- Owns 6 tables (`gift_card_design`, `gift_card_settings`, `gift_card_delivery`, `gift_card_delivery_attempt`, `gift_card_webhook_event`, `gift_card_event`) via the `gift_card_experience` module.
- Ships admin CRUD under `/app/gift-card-experience` (list of deliveries + `settings/` subpage) with vendored `admin/lib/{client,query-key-factory,query-string}` shared across plugins.
- Admin API under `/admin/gift-card-experience/{designs, deliveries, settings, analytics, permissions}` (three middlewares registered from `src/api/admin/gift-card-experience/middlewares.ts`).
- Public API under `/store/gift-card-experience/{designs, landing/:token, landing/:token/claim, wallet}` with customer auth guarded by `src/api/store/gift-card-experience/middlewares.ts`.
- Webhook receiver at `/webhooks/sendgrid-gift-cards` with raw-body preservation for signature verification (`src/api/webhooks/sendgrid-gift-cards/middlewares.ts`).
- Workflow hook `gift-card-cart-validation` (auto-discovered from `src/workflows/hooks/`) that validates gift-card metadata before completing a cart.
- Three subscribers (order.placed / order.canceled / payment.captured) and three jobs (delivery outbox / lifecycle scheduler / usage reconciliation) driving the delivery FSM.
- **Settings downgrade**: the host `app-settings/descriptors/gift-cards.ts` (DB > env > default precedence) is NOT shipped with the plugin. `getGiftCardExperienceSettings()` now reads `GIFT_CARD_EXPERIENCE_ENABLED` and `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY` directly from `process.env`, same pattern as landing-pages / payment-benefits / catalogador. Rotating the SendGrid key via the admin card is a Fase B slot; today it is env-only. `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY` is still passed through `normalizeSendgridPublicKey` (base64 → PEM), which was the reason the extension had its own settings layer.
- **Shared contract**: `packages/shared/gift-cards.ts` (mirror `apps/backend/src/lib/shared/gift-cards.ts`) is vendored into the plugin as `src/lib/gift-cards-shared.ts`. Every gift-card consumer moved here so the plugin is autocontained. The host keeps a minimal shim in `apps/backend/src/lib/shared/gift-cards.ts` — only `assertGiftCardBuyerIsNotRecipient` and `normalizeGiftCardConfig` — for `apps/backend/src/scripts/backfill-gift-card-deliveries.ts`, which is a manual CLI (`pnpm gift-cards:backfill`) and stays in the host.
- **Descriptor + Help preserved in host**: `apps/backend/src/modules/app-settings/descriptors/gift-cards.ts` (aggregate app-settings registry) and `apps/backend/src/admin/help/gift-cards.ts` (help center article) stay in the host by design — they belong to host-wide aggregates.
- **Multistore shim**: `src/lib/multistore/*` vendored from `plugin-shop-by-looks` (7 files). No `storeConfig`, `demo_store` or other foreign module resolves in this plugin (verified by grep). The multistore layer here is used only for per-row `siteId` scoping (`site_id` column on designs and deliveries).
- **Admin UI slots**: the `settings/page.tsx` used to import three host components (`ExtensionSettingsCard`, `HelpDrawer`, `SingleColumnLayout`). Those are marked as TODO Fase B slots via runtime contract, same as payment-benefits / catalogador. The env-only `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY` and `GIFT_CARD_EXPERIENCE_ENABLED` no longer surface in the admin — they are configured in the environment.
- `ExtensionVersion` (host badge) is annotated as TODO Fase B.
