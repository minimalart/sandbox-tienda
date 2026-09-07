# Suscripciones en Medusa — Receta validada para implementación propia

> **Ticket:** MINIM-138 — Validar receta Medusa de suscripciones para implementación propia
> **Medusa:** 2.15.5 (`@medusajs/framework` / `@medusajs/medusa`)
> **Estado:** Validación técnica. No es una implementación productiva; es la guía base para que se construya la primera versión propia.

## 1. Objetivo

Medusa **no trae un módulo de suscripciones**. Lo que ofrece es una **receta** (un patrón arquitectónico) que se arma combinando primitivas que el framework ya provee: módulos custom, module links, workflows, scheduled jobs y subscribers.

Esta guía valida ese camino, define qué se reutiliza, qué hay que construir, cuál es el flujo MVP para la demo del supermercado (Mercatto) y cuáles son los riesgos.

**Referencia oficial:** https://docs.medusajs.com/resources/recipes/subscriptions

## 2. Las dos opciones de la receta

La receta plantea dos caminos. La diferencia central es **quién maneja el cobro recurrente**.

| | Opción A — Lógica custom | Opción B — Stripe Subscriptions |
|---|---|---|
| Cobro recurrente | Lo orquesta Medusa (scheduled job + payment) | Lo delega a Stripe |
| Proveedores de pago | Cualquiera (multi-gateway) | Solo Stripe |
| Control del ciclo de vida | Total | Acotado a lo que Stripe expone |
| Complejidad de implementación | Mayor (escribís el renovador) | Menor en cobro, mayor acople a Stripe |

### Recomendación para Mercatto

**Opción A (lógica custom).** Dos razones de peso:

1. **El repo NO usa Stripe.** El proveedor de pago de este boilerplate es **Mercado Pago** (`src/modules/mercado-pago`). La Opción B exige implementar un provider custom de Stripe Subscriptions, lo que significaría meter Stripe solo para suscripciones — acople innecesario y contradictorio con el stack actual.
2. La Opción A se apoya en primitivas que el repo **ya usa y domina** (módulos custom, workflows, subscribers). El equipo ya tiene cuatro módulos custom funcionando con ese mismo patrón.

> ⚠️ **Límite claro:** la Opción A te obliga a implementar vos el cobro recurrente contra Mercado Pago. No hay "renovación automática" gratis. Ver §6 (riesgos).

## 3. Qué se reutiliza vs. qué hay que construir

### Se reutiliza (primitivas que el repo ya tiene)

| Pieza | Dónde vive hoy en el repo | Para qué sirve en suscripciones |
|---|---|---|
| **Módulo custom** | `src/modules/*` (ej. `points`, `brand`, `wishlist`) | Patrón exacto para el `subscription` module |
| **Module links** | `src/links/product-brand.ts` (`defineLink`) | Conectar `Subscription` ↔ `Order` / `Customer` / `Product` |
| **Workflows** | `src/workflows/*` (`createWorkflow`) | Orquestar alta de suscripción y cada renovación |
| **Subscribers** | `src/subscribers/order-placed-points.ts` | Reaccionar a `order.placed` para crear la suscripción |
| **Payment** | `src/modules/mercado-pago` | Cobro de cada ciclo |
| **Order Module** | core de Medusa | Cada renovación genera una orden real |

### Hay que construir (piezas nuevas)

| Pieza | Estado actual | Esfuerzo |
|---|---|---|
| Módulo `subscription` (modelo + service) | No existe | Medio |
| Module links `subscription ↔ order/customer` | No existen | Bajo |
| Workflow `create-subscription` | No existe | Medio |
| Workflow `renew-subscription` | No existe | **Alto** (es el corazón) |
| **Scheduled job** de renovación | `src/jobs/` **está vacío** — sin precedente en el repo | **Alto** (territorio nuevo) |
| Cobro recurrente contra Mercado Pago | No resuelto | **Alto / riesgo** |
| Rutas API store/admin | No existen | Bajo |

> 🔑 El punto crítico: **`src/jobs/` está vacío**. El repo nunca ejecutó un scheduled job. La renovación recurrente es la parte de mayor riesgo y la que no tiene patrón previo donde apoyarse.

## 4. Diseño del módulo

Seguí el patrón exacto de `src/modules/points`:

```
src/modules/subscription/
├── index.ts          # Module(SUBSCRIPTION_MODULE, { service })
├── service.ts        # MedusaService autogenerado sobre el modelo
├── models/
│   ├── index.ts
│   └── subscription.ts
└── migrations/       # generadas con `medusa db:generate subscription`
```

### Modelo propuesto (`models/subscription.ts`)

```ts
import { model } from '@medusajs/framework/utils';

export const Subscription = model.define('subscription', {
  id: model.id({ prefix: 'sub' }).primaryKey(),
  customer_id: model.text(),                 // dueño de la suscripción
  status: model.enum(['active', 'paused', 'canceled', 'expired']).default('active'),
  interval: model.enum(['weekly', 'biweekly', 'monthly']),
  next_run_at: model.dateTime(),             // cuándo toca la próxima orden
  last_order_id: model.text().nullable(),    // última orden generada
  // snapshot de los items a re-ordenar (variant_id + quantity)
  metadata: model.json().nullable(),
});
```

> El `metadata` con el snapshot de items es deliberado para el MVP: evita resolver "qué pasa si cambia el precio/variant" en la v1. Ver §6.

### Module links (`src/links/subscription-*.ts`)

Mismo `defineLink` que `product-brand.ts`:

- `subscription ↔ customer` (a quién pertenece)
- `subscription ↔ order` (isList: las órdenes que generó)

No linkees a `cart`: el cart es efímero, solo sirve en el alta.

## 5. Flujo MVP para la demo (Mercatto)

Objetivo de la demo: el cliente compra "el cajón semanal de frutas y verduras" y se le repite solo. **MVP = el camino más corto que demuestra el valor**, no el sistema completo.

```
┌─ ALTA ──────────────────────────────────────────────────────┐
│ 1. Cliente arma el cart y hace checkout normal              │
│ 2. Marca "repetir cada semana" (flag en metadata del cart)  │
│ 3. Subscriber escucha `order.placed`                        │
│ 4. → workflow create-subscription:                          │
│      crea Subscription(status=active,                       │
│         interval=weekly, next_run_at = hoy + 7d,            │
│         metadata = snapshot de items)                       │
└─────────────────────────────────────────────────────────────┘

┌─ RENOVACIÓN (scheduled job, corre 1×/día) ──────────────────┐
│ 1. Busca subscriptions con status=active                    │
│    AND next_run_at <= now                                   │
│ 2. Por cada una → workflow renew-subscription:              │
│      a. crea un cart con el snapshot de items               │
│      b. completa el cart → genera Order                     │
│      c. cobra contra Mercado Pago                           │
│      d. next_run_at += interval; last_order_id = nueva order│
│ 3. Si el cobro falla → status=paused + notificar (no reintenta en MVP) │
└─────────────────────────────────────────────────────────────┘

┌─ GESTIÓN (mínima para la demo) ─────────────────────────────┐
│ - Cancelar: ruta store que setea status=canceled            │
│ - Pausar/reanudar: opcional, baja prioridad                 │
└─────────────────────────────────────────────────────────────┘
```

### Scope del MVP (lo que SÍ entra)

- Alta vía flag en checkout + subscriber.
- Un solo `interval` real demostrable (weekly).
- Renovación por scheduled job diario.
- Generación de orden real por ciclo.
- Cancelación.

### Fuera del MVP (lo que NO entra)

- Reintentos de cobro / dunning.
- Cambios de items o cantidades en una suscripción activa.
- Recálculo de precios/stock entre ciclos (se usa el snapshot).
- Prorrateo, cupones recurrentes, trials.
- UI de admin rica (alcanza con leer la tabla).

## 6. Dependencias, limitaciones y riesgos

### Dependencias

- **Redis en producción.** Sin Redis, el workflow engine corre in-memory (ver `medusa-config.ts`). Para scheduled jobs confiables en prod **necesitás Redis** (`@medusajs/medusa/workflow-engine-redis`). En la demo local funciona in-memory, pero documentalo como requisito de prod.
- **Mercado Pago con cobro off-session.** Este es el mayor desconocido — ver riesgos.

### Riesgos técnicos (ordenados por gravedad)

1. **🔴 Cobro recurrente con Mercado Pago.** Medusa captura el pago con el cliente presente (on-session). La renovación cobra **sin el cliente** (off-session). Hay que validar si el provider de MP del repo soporta tokenización / cobro recurrente, o si MP exige usar su propio producto de *preapproval*/suscripciones. **Esto se valida ANTES de escribir el job** — es el supuesto que puede tumbar la Opción A.
2. **🟠 Scheduled jobs sin precedente.** `src/jobs/` está vacío. Primera vez que el repo corre jobs: validar idempotencia (que un job que corre dos veces no genere dos órdenes) y observabilidad.
3. **🟠 Idempotencia de la renovación.** Si el job se cae a mitad, no debe duplicar órdenes ni cobros. Usá `next_run_at` como lock lógico y avanzá la fecha **antes** de cerrar el ciclo, o un flag `processing`.
4. **🟡 Stock e inventario.** Entre ciclos un item puede quedar sin stock. En MVP: si no hay stock, pausá la suscripción y notificá. No lo resuelvas con lógica compleja en la v1.
5. **🟡 Precio congelado.** El snapshot en `metadata` congela el precio del alta. Decisión consciente para el MVP; documentá que la v2 deberá re-resolver precios.

## 7. Pasos mínimos para arrancar la v1

1. **Validar el cobro off-session de Mercado Pago** (spike, sin código de suscripciones). Si no se puede, replantear (Opción B / proveedor alterno) antes de seguir.
2. Crear el módulo `subscription` (modelo + service + migración) copiando `points`.
3. Crear los module links a `customer` y `order`.
4. Workflow `create-subscription` + subscriber sobre `order.placed`.
5. Workflow `renew-subscription` (cart → order → pago → avanzar fecha).
6. Scheduled job diario que dispara `renew-subscription`. **Validar idempotencia.**
7. Ruta store de cancelación.
8. Demo: alta semanal + forzar `next_run_at` a hoy para ver una renovación en vivo.

> **Tip de demo:** no esperes 7 días. Exponé una ruta admin (o un script) que setee `next_run_at = now` para disparar la renovación on-demand frente al cliente.

## 8. Conclusión de la validación

El camino está **validado**: la Opción A (lógica custom) es viable y encaja con el stack del repo (módulos custom + workflows + Mercado Pago), reutilizando patrones que el equipo ya domina.

El **único bloqueante real a despejar primero** es el cobro off-session contra Mercado Pago (§6, riesgo 1). Todo lo demás es trabajo conocido sobre primitivas existentes. Con esta guía hay base suficiente para construir la primera versión propia del MVP.
