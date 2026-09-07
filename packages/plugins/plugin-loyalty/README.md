# @minimalart/mercatto-plugin-loyalty

Mercatto's loyalty program plugin. Bundles a **points ledger** (accounts, transactions, balances) with the **loyalty engine** (programs, tiers, rewards, campaigns, earn rules) into a single Medusa plugin.

## What it ships

**Backend modules**
- `points` — the ledger. Owns `points_account`, `points_transaction`. Exposes `POINTS_MODULE` service key and `PointsModuleService`.
- `loyalty` — the engine. Owns `loyalty_program`, `loyalty_tier`, `loyalty_reward`, `loyalty_reward_grant`, `loyalty_earn_rule`, `loyalty_campaign`. Exposes `LOYALTY_MODULE` service key and `LoyaltyModuleService`.

**Admin UI**
- Section `/app/loyalty` in the sidebar with sub-routes: `dashboard`, `campanas`, `canjes`, `configuracion`, `movimientos`, `niveles`, `recompensas`, `reglas`.
- Customer detail widget showing loyalty info.

**Admin API** (`/admin/loyalty/*`)
- Campaigns, customers, dashboard, grants, movements, programs, rewards, rules, tiers.

**Storefront API** (`/store/*`)
- `/store/points`, `/store/points/redeem`
- `/store/loyalty/grants`, `/store/loyalty/redeem`, `/store/loyalty/rewards`, `/store/loyalty/tier`

**Storefront components**
- `loyalty-overview` — customer account overview.
- `loyalty-rewards` — customer rewards listing.
- `loyalty-rewards-checkout` — apply rewards at checkout.

**Workflows**: earn, redeem-reward, reverse.
**Subscribers**: order-placed, order-canceled, customer-created, comment-approved.
**Job**: expire-loyalty-points.
**Script**: reverse-b2b-points.

## Multi-tenant

The plugin is **opt-in multi-tenant by presence of `@minimalart/mercatto-multistore-contract`**. When the contract package is installed and the host has a `demo_store` module registered, the plugin scopes:

- `loyalty_program` by `site_id` column (empty = `all` — programs without a site are visible globally, transitional).
- `loyalty_tier`, `loyalty_reward` via their `program_id` FK (empty = `unassigned` — orphans fail closed).

Without the contract package, the plugin runs single-tenant with no scoping applied.

## Install

```bash
npm i @minimalart/mercatto-plugin-loyalty
```

Register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-loyalty' },
]
```

## Development

```bash
pnpm --filter @minimalart/mercatto-plugin-loyalty build
```
