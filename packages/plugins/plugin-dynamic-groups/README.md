# @minimalart/mercatto-plugin-dynamic-groups

Grupos dinámicos de clientes para tiendas Mercatto (Medusa 2.18+). Un "grupo dinámico" es una regla viva: un conjunto de condiciones sobre los datos del cliente (compras, gasto, geografía, cumpleaños, antigüedad) que el plugin evalúa para agregar/quitar clientes de un `customer_group` NATIVO de Medusa. Todo lo que ya reacciona a customer groups —banners, promos, precios— responde solo.

Ships:

- `dynamic_groups` module con dos modelos: `dynamic_group` (la regla y su `customer_group_id`) y `dynamic_group_membership_log` (auditoría de entradas/salidas).
- Admin route `/app/dynamic-groups` con listado, editor de condiciones (12 campos × 6 operadores) y drawer de historial por grupo.
- Admin API: `GET/POST /admin/dynamic-groups`, `GET/POST/DELETE /admin/dynamic-groups/:id`, `POST /admin/dynamic-groups/:id/recalculate`, `GET /admin/dynamic-groups/:id/logs`.
- Workflows: `create-dynamic-group`, `evaluate-customer-membership` (incremental, por cliente), `recalculate-dynamic-group` (batch, por grupo).

## Los dos motores

- **Tiempo real (subscribers)** — ante `order.placed`, `customer.created` o `customer.updated`, el subscriber ejecuta `evaluate-customer-membership` para el cliente afectado y aplica cambios en todos los grupos activos. Cubre transiciones por compra o alta.
- **Barrido periódico (cron)** — el job `recalculate-dynamic-groups` corre por defecto a las 3am (configurable con `DYNAMIC_GROUPS_RECALC_CRON`) y recalcula TODOS los grupos activos. Necesario para reglas TEMPORALES que no disparan por evento: inactividad, cumpleaños del mes, antigüedad. También reconcilia cualquier deriva.

## Install

```
pnpm add @minimalart/mercatto-plugin-dynamic-groups
```

Then register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-dynamic-groups', options: {} },
]
```

## Environment variables

| Var | Default | Descripción |
| --- | --- | --- |
| `DYNAMIC_GROUPS_RECALC_CRON` | `0 3 * * *` | Cron del barrido periódico. Requiere reiniciar el backend después de cambiarlo. |

## Multi-tenant

Los grupos son POR TIENDA (`dynamic_group.site_id`). `NULL` = global de la instancia. Los logs cuelgan del grupo y heredan la tienda por la FK. En instalaciones mono-tienda la columna queda en `NULL` y todo funciona igual.
