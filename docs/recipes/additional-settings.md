# Configuración adicional (store-config)

Extensión de admin para settings de la tienda con historial **auditable**. El primer setting es el **mínimo de compra**.

## Modelo

Módulo `storeConfig` en `apps/backend/src/modules/store-config`, modelo `minimum_purchase`:

| Campo           | Tipo        | Notas                                  |
| --------------- | ----------- | -------------------------------------- |
| `amount`        | integer     | Monto entero en unidad mayor (NO centavos), > 0 |
| `currency_code` | text        | default `'ars'` (`ars`/`usd`/`eur` en la UI) |
| `starts_at`     | timestamptz | Inicio de vigencia (requerido)         |
| `ends_at`       | timestamptz | Fin de vigencia (nullable = sin fin)   |
| `note`          | text        | Motivo del cambio (nullable)           |

## Auditabilidad (append-only)

No hay update ni delete — ni en el servicio expuesto por las rutas, ni en la API, ni en la UI (la tabla no tiene acciones de fila). **Cada cambio del mínimo = un registro nuevo.** El historial completo queda en la tabla; el "vigente" se deriva con:

- `starts_at <= now` y (`ends_at` null o `>= now`)
- de los vigentes gana el `starts_at` más reciente; desempate por `created_at` DESC.

## Endpoints

- `GET /admin/store-config/minimum-purchase?limit&offset` → `{ minimum_purchases, count, limit, offset }` (orden `created_at` DESC).
- `POST /admin/store-config/minimum-purchase` → crea un registro. Validación zod (`validators.ts`): `amount` entero > 0, `starts_at` ISO requerido, `ends_at` opcional posterior a `starts_at`, `note` opcional.
- `GET /store/minimum-purchase` (público) → `{ minimum_purchase: { amount, currency_code, starts_at, ends_at } | null }` con el mínimo vigente ahora.

## Admin UI

`src/admin/routes/store-config/page.tsx` ("Configuración adicional", icono CogSixTooth, rank 140): card con el mínimo vigente + DataTable paginada del historial + drawer de creación. Hooks en `src/admin/hooks/api/store-config.tsx`, i18n es/en en `src/admin/translations/store-config` (namespace `storeConfig`).

## Migración

`src/modules/store-config/migrations/Migration20260612100000.ts` crea la tabla `minimum_purchase` (mismo formato a mano que `store-location`). El módulo está registrado en `medusa-config.ts` (`STORE_CONFIG_MODULE`). Correr migraciones con `npx medusa db:migrate` cuando corresponda.

## Cómo extender con más settings

1. Agregar un modelo nuevo en `src/modules/store-config/models` y exportarlo en `models/index.ts` y en el `MedusaService({...})` de `service.ts`.
2. Escribir la migración a mano en `src/modules/store-config/migrations`.
3. Crear rutas en `src/api/admin/store-config/<setting>` (y `src/api/store/<setting>` si es público). Si el setting debe ser auditable, exponer solo GET/POST (append-only).
4. Sumar la sección a `src/admin/routes/store-config/page.tsx`, hooks en `hooks/api/store-config.tsx` y claves i18n en `translations/store-config`.
