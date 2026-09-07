# Puntos y Loyalty en Medusa — Plugin oficial + extensión propia

> **Ticket:** MINIM-139 — Implementar plugin oficial para puntos y loyalty
> **Medusa:** 2.18.0 (`@medusajs/framework` / `@medusajs/medusa`)
> **Plugin:** `@medusajs/loyalty-plugin` (mismo pin de versión que el core)
> **Estado:** Plugin oficial instalado, configurado y con flujo mínimo validado para la demo Mercatto.

## 1. Cuál es el plugin oficial (AC #1)

El plugin oficial de Medusa para esta familia de features es **`@medusajs/loyalty-plugin`**, publicado por el equipo de Medusa (`packages/plugins/loyalty` en el monorepo oficial). Su descripción literal es **"Medusa Plugin: Loyalty - Gift Cards"**.

**Dato central que define el alcance del ticket:** el plugin oficial cubre **gift cards + store credit**. NO trae un programa de puntos por compra (acumular puntos al comprar y canjearlos por descuento). Verificado en el código del plugin:

- Módulo `loyalty` → su único modelo es `GiftCard` (tabla `loyalty_gift_card`).
- Módulo `store-credit` → cuentas de saldo (`store_credit_account`) por moneda.

No existe, al día de hoy, un plugin oficial de Medusa para "puntos de fidelización". Eso lo cubre el módulo `points` custom del repo (ver §6).

## 2. Instalación y configuración (AC #2)

Ya está integrado en el boilerplate. Las dos piezas:

**Dependencia** — `apps/backend/package.json`:

```json
"@medusajs/loyalty-plugin": "2.18.0"
```

> ⚠️ La versión del plugin debe quedar **pineada a la misma versión del core de Medusa**. Es un plugin construido (`medusa plugin:build`) que se distribuye con su `.medusa/server`; un desfasaje de versión rompe la resolución de módulos.

**Registro** — `apps/backend/medusa-config.ts`, en `plugins`:

```ts
plugins: [
  {
    resolve: '@medusajs/loyalty-plugin',
    options: {},
  },
],
```

El plugin trae **sus propias migraciones, modelos, rutas store/admin y UI de admin**. Tras instalar, correr migraciones:

```bash
cd apps/backend && npx medusa db:migrate
```

Esto crea, entre otras, `loyalty_gift_card` y `store_credit_account`.

## 3. Qué expone el plugin

| Pieza | Ruta / módulo | Para qué |
|---|---|---|
| Listar saldo del cliente | `GET /store/store-credit-accounts` | Cuentas de store credit del customer autenticado |
| Canjear gift card | `POST /store/store-credit-accounts/claim` | Suma el valor de la gift card al saldo del cliente |
| Gift cards (admin) | `GET/POST /admin/gift-cards` | Crear y gestionar gift cards desde el dashboard |
| Aplicar al carrito | `/store/carts/:id/gift-cards`, `/store/carts/:id/store-credits` | Usar saldo en checkout |
| Módulo `loyalty` | modelo `GiftCard` | Emisión y estado de gift cards |
| Módulo `store-credit` | `store_credit_account` + `retrieveAccountStats` | Saldo agregado por cuenta |

## 4. Flujo mínimo validado (AC #3)

Camino del cliente en la demo (`/[countryCode]/account/.../gift-cards`):

1. El cliente ingresa un código en **"Canjear una tarjeta de regalo"**.
2. El BFF del storefront (`apps/storefront/src/app/api/store/gift-cards/route.ts`) hace `POST /store/store-credit-accounts/claim` con `{ code }`.
3. El plugin acredita el valor en una `store_credit_account` del cliente, en la moneda de la gift card.
4. **"Mis saldos"** lista las cuentas vía `GET /store/store-credit-accounts` y muestra el total.

### Gotcha resuelto: `currency_code` obligatorio

El validador del plugin para `GET /store/store-credit-accounts` exige `currency_code` como query param **obligatorio** (`z.string()`, no opcional):

```ts
// @medusajs/loyalty-plugin — store-credit-accounts/validators
StoreGetStoreCreditAccountsParams = z.strictObject({
  ...createFindParams({ limit: 15, offset: 0 }).shape,
  currency_code: z.string(),
  // ...
})
```

Llamar al endpoint sin ese parámetro devuelve **`Invalid request: Field 'currency_code' is required`** — el error que rompía "Mis saldos".

**Fix:** el BFF resuelve el `currency_code` desde la región activa (`getRegion(countryCode).currency_code`) y lo pasa como query param. El cliente envía su `countryCode` (de la URL) al BFF; con el fallback `NEXT_PUBLIC_DEFAULT_REGION` (`ar` → `ars`) el endpoint queda region-aware en un setup single-region.

> Store credit está **scopeado por moneda**. La consulta siempre filtra por una moneda; en un futuro multi-moneda hay que listar por cada `currency_code` del cliente.

## 5. Dependencias

- `@medusajs/loyalty-plugin` pineado al core (§2).
- Region/currency del store seedeada: la tienda corre en `ars` por default (`apps/backend/src/scripts/seed.ts`), región Argentina (`ar`).
- Auth de customer (`_medusa_jwt`) — todas las rutas store del plugin requieren cliente autenticado (`authenticate("customer", ["session", "bearer"])`).

## 6. ¿Cubre el MVP o requiere extensión? (AC #5)

**Cubre el MVP de gift cards + store credit.** El flujo de canje y visualización de saldo funciona end-to-end con el plugin oficial, sin código custom de negocio.

**NO cubre puntos por compra.** El programa de puntos (acumular al comprar, ver balance e historial, canjear) **no existe en el plugin oficial** y se resuelve con el módulo custom del repo:

| Pieza | Dónde vive | Rol |
|---|---|---|
| Módulo `points` | `apps/backend/src/modules/points` | `PointsAccount` + `PointsTransaction`, `earnPoints` / `redeemPoints` |
| Subscriber | `apps/backend/src/subscribers/order-placed-points.ts` | Acredita puntos al confirmarse una orden |
| Rutas store | `apps/backend/src/api/store/points/*` | Balance, ledger y canje |
| UI storefront | `apps/storefront/src/modules/account/components/loyalty-overview` | "Mis puntos" en la cuenta |

### Conclusión

- **Gift cards / store credit** → resuelto por el plugin oficial. No requiere extensión para el MVP de la demo.
- **Puntos de fidelización** → requiere el módulo `points` custom como **extensión** (no hay plugin oficial). No es un reemplazo del plugin: son features distintas que conviven.

## 7. Limitaciones (AC #4)

- El plugin es **gift cards + store credit**, no un motor de loyalty configurable (sin reglas de earn/burn, tiers ni multiplicadores).
- `GET /store/store-credit-accounts` filtra por **una** moneda; multi-moneda por cliente requiere una consulta por moneda.
- La versión del plugin debe seguir al core de Medusa en cada upgrade (es un plugin compilado, no source).
- El programa de puntos custom (§6) usa balance denormalizado con read-modify-write; ante escritura concurrente por cliente hay que promoverlo a un workflow con lock (ya anotado en `points/service.ts`).
