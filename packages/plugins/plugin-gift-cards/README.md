# @minimalart/mercatto-plugin-gift-cards

Gift Card Experience for Mercatto stores (Medusa 2.18+). Owns design catalogue, delivery orchestration, secure landing / claim flow and the SendGrid Signed Event Webhook receiver.

## Ships

- `gift_card_experience` module with 6 tables (`gift_card_design`, `gift_card_settings`, `gift_card_delivery`, `gift_card_delivery_attempt`, `gift_card_webhook_event`, `gift_card_event`).
- Admin route `/app/gift-card-experience` — deliveries list, drawer with retry / cancel / secure-link and `settings/` subpage.
- Admin API `/admin/gift-card-experience/{designs, deliveries, settings, analytics, permissions}` — RBAC guarded, zod-validated bodies.
- Public API `/store/gift-card-experience/{designs, landing/:token, landing/:token/claim, wallet}` — customer session or bearer.
- Webhook receiver `/webhooks/sendgrid-gift-cards` — verifies SendGrid Signed Event Webhook signatures against `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY`.
- Workflow hook `gift-card-cart-validation` — validates gift-card metadata and buyer/recipient invariant before `completeCartWorkflow` runs.
- Three subscribers: `order.placed`, `order.canceled`, `payment.captured` — driving idempotent intent creation + capture reconciliation.
- Three cron jobs: delivery outbox, lifecycle scheduler, and monthly usage reconciliation.

## Install

```
pnpm add @minimalart/mercatto-plugin-gift-cards
```

Register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-gift-cards', options: {} },
]
```

The plugin is issued alongside `@medusajs/loyalty-plugin` (store credit). Gift Card Experience owns issuance intent + delivery + UX; monetary value stays in the official loyalty plugin.

## Environment

| Variable | Purpose |
| --- | --- |
| `GIFT_CARD_EXPERIENCE_ENABLED` | Master switch — combined with AND against `gift_card_settings.enabled`. |
| `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY` | Public key of the SendGrid Signed Event Webhook (base64 or PEM — normalised at read). |
| `GIFT_CARD_TOKEN_SECRET` | KEK for secure landing links (≥ 32 characters). |
| `STOREFRONT_URL` | Base URL used to render gift-card landing links. |
| `DEFAULT_COUNTRY_CODE` | Country segment (`ar`, `mx`, …) for the storefront URL prefix. |

Rotating the SendGrid public key or the master switch through the admin is a Fase B slot — today those settings are read directly from `process.env`.

## Host dependencies

The plugin talks to core Medusa services (`PG_CONNECTION`, `QUERY`, `LOGGER`) and standard modules. **No foreign module resolves.** Multi-tenant `site_id` scoping is handled by the vendored `lib/multistore/*` shim.

## Preserved in host

Two host-wide aggregates stay outside the plugin because they belong to cross-cutting host UI:

- `apps/backend/src/modules/app-settings/descriptors/gift-cards.ts` — descriptor registered in the aggregate `app-settings` catalogue.
- `apps/backend/src/admin/help/gift-cards.ts` — help center article.

The manual backfill script `pnpm gift-cards:backfill` (`apps/backend/src/scripts/backfill-gift-card-deliveries.ts`) stays in the host and reads `assertGiftCardBuyerIsNotRecipient` / `normalizeGiftCardConfig` from a minimal host shim `apps/backend/src/lib/shared/gift-cards.ts`. The full contract lives at `packages/shared/gift-cards.ts` (mirror `src/lib/gift-cards-shared.ts` inside this plugin).
