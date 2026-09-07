# @minimalart/mercatto-plugin-abandoned-cart

Recuperación de carritos abandonados para tiendas Mercatto (Medusa 2.18+). Un "carrito abandonado" es un carrito de Medusa con `completed_at IS NULL`, items dentro y última actividad más allá del umbral de inactividad. El plugin NO duplica el carrito: mantiene una fila de *tracking* por `cart_id` para orquestar la secuencia de recordatorios y evitar reenvíos, y relee el estado real del carrito en vivo desde el módulo core.

Ships:

- `abandonedCart` module con dos modelos: `abandoned_cart` (una fila por carrito trackeado con su estado y `next_eligible_at`) y `abandoned_cart_notification` (una fila por intento de envío, único por `abandoned_cart_id + step + channel`).
- Job `scan-abandoned-carts` con tres fases: detección con ventana en SQL (`updated_at BETWEEN oldest_allowed AND idle_before`), reconciliación de carritos ya convertidos en orden, y notificación de los tracking `due`.
- Subscriber a `order.placed` con reintento del link cart→order para cortar la secuencia apenas se detecta la conversión.
- Workflow `notify-abandoned-cart` que arma el payload (nombre, total, moneda, link de recupero) y despacha por email/WhatsApp vía el notification module.
- Admin route `/app/abandoned-carts` con listado, métricas por moneda y canal, y acción de reenvío manual.

## Cadencia por defecto

Secuencia de tres pasos, con horas de inactividad ACUMULADAS desde la última actividad del carrito (no entre pasos):

1. **1h** — recordatorio (email).
2. **24h** — segundo recordatorio (email + WhatsApp opcional si hay template configurado).
3. **72h** — cierre con incentivo (email).

El barrido corre por defecto cada 15 minutos (`ABANDONED_CART_SCAN_CRON=*/15 * * * *`).

## Install

```
pnpm add @minimalart/mercatto-plugin-abandoned-cart
```

Then register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-abandoned-cart', options: {} },
]
```

## Environment variables

| Var | Default | Descripción |
| --- | --- | --- |
| `ABANDONED_CART_ENABLED` | `true` | Kill switch del barrido. Con `false`/`0` el cron corre pero no procesa. |
| `ABANDONED_CART_STEP1_HOURS` | `1` | Horas de inactividad para disparar el paso 1. |
| `ABANDONED_CART_STEP2_HOURS` | `24` | Horas de inactividad para el paso 2 (acumuladas desde la última actividad). |
| `ABANDONED_CART_STEP3_HOURS` | `72` | Horas de inactividad para el paso 3. |
| `ABANDONED_CART_MAX_AGE_HOURS` | `336` (14 días) | Cierra la ventana de recuperación: no se molesta a carritos más viejos. |
| `ABANDONED_CART_BATCH_SIZE` | `100` | Carritos por página en la detección. |
| `ABANDONED_CART_MAX_PAGES` | `20` | Tope de páginas por corrida (`batchSize × maxPages` carritos). |
| `ABANDONED_CART_SCAN_CRON` | `*/15 * * * *` | Cron del barrido. Requiere reiniciar el backend después de cambiarlo. |
| `ABANDONED_CART_WHATSAPP_TEMPLATE_1..3` | *(vacío)* | Key de template de WhatsApp por paso; sin valor, el paso no manda WhatsApp. |
| `NEXT_PUBLIC_BASE_URL` | *(vacío)* | Base del storefront para construir el link de recupero. |
| `STOREFRONT_DEFAULT_COUNTRY` | `cl` | Country code por defecto cuando el carrito no tiene shipping address. |

## Multi-tenant

El tracking se guarda por canal (`sales_channel_id`) y el listado/métricas del admin filtran por los canales de la tienda activa (los dos si es B2B). En instalaciones mono-tienda funciona igual: la columna queda en `NULL` y no se filtra.
