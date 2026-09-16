# Backend (Medusa) — reglas

## Migraciones de módulos custom

- `mikro_orm_migrations` es UNA tabla global y umzug registra por NOMBRE de
  archivo, sin módulo: dos migraciones homónimas en módulos distintos → la del
  módulo que migra después se saltea EN SILENCIO (esquema incompleto sin error).
- Esto incluye a los módulos de **Medusa**: un upgrade de versión puede traer una
  migración homónima de una nuestra, y la del core no se puede renombrar. Al
  bumpear Medusa, `pnpm test` es el chequeo que avisa —
  `migration-names.test.ts` cruza los nombres del repo contra los de
  `@medusajs/*` instalados. Precedente: `Migration20260626000000` (delivery vs
  `@medusajs/cart@2.18.0`), reparada con
  `delivery/migrations/Migration20260803120000DeliveryReconcileCartCollision.ts`.
- Toda migración nueva DEBE llevar el módulo en el nombre:
  `Migration<YYYYMMDDHHmmss><ModuloEnPascal>.ts`
  (ej. `Migration20260710120000AiAssistant.ts`), clase homónima. Lo hace cumplir
  `src/modules/migration-names.test.ts` (`pnpm test`).
- Nunca editar una migración ya aplicada ni arreglar esquema por consola: se
  escribe una migración NUEVA idempotente (`IF NOT EXISTS`, `ALTER TABLE IF
  EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object` para constraints). Elegir
  el timestamp para que corra antes de cualquier ALTER duro que dependa de lo
  que repara. Patrón completo: `docs/recipes/migraciones-modulos-custom.md`.

## El admin se rompe con la traducción del navegador

Síntoma reportado como "no me da opciones en el select y el guardado tira error":
etiquetas **duplicadas** en los `Select` (`"Carousel with arrowsCarousel with arrows"`)
y, al guardar,
`NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is
not a child of this node.` desde el bundle de `/app/assets/index-*.js`.

**No es del backend ni de los datos.** Es Google Translate del navegador (o una
extensión) reescribiendo los nodos de texto que React después intenta remover: el
árbol queda inconsistente y los `Select` no abren, los `Switch` no responden y el
submit revienta. Las opciones de esos selects son `<Select.Item>` **hardcodeados**
(`src/admin/routes/sites/components/content-config-fields.tsx`), así que "faltan
datos" nunca es la explicación.

La config de traducción de Chrome es **por dominio**, y buena parte del admin está
en inglés con el sidebar en español — la mezcla que dispara el ofrecimiento de
traducir. Por eso aparece en cada dominio nuevo de cliente y no en el de siempre.
**Fix: "Nunca traducir este sitio" en el dominio del admin.** Confirmarlo en
incógnito antes de abrir un ticket.

## Event bus sobre Redis: el worker está supervisado

- `event_bus` en `medusa-config.ts` apunta a `./src/modules/event-bus-redis`, que
  HEREDA de `@medusajs/medusa/event-bus-redis` y le agrega
  `src/lib/event-bus-worker-supervisor.ts`. Motivo: Medusa arranca el Worker de
  BullMQ UNA vez (`event-bus-redis.js:21`, `void run().catch(log)`) y si `run()`
  rechaza no lo vuelve a arrancar nunca. Con el proceso sano (HTTP, crons) el bus
  queda mudo: sin mails de orden, sin WhatsApp, sin outbox del ERP. Pasó tres
  veces en producción (2026-08-31, 09-03, 09-09).
- La causa medida es la conexión que BullMQ DUPLICA para su comando bloqueante:
  si su primer `connect()` falla (TLS que agota `connectTimeout`, Valkey al tope
  durante un deploy), `RedisConnection.initializing` queda RECHAZADA para siempre y
  ese Worker no arranca más aunque el socket se recupere. Por eso el supervisor
  no reintenta `run()` sobre el mismo objeto: cierra el muerto (`close(true)`, que
  libera su conexión) y construye un Worker nuevo con backoff 1 s → 60 s.
- Reglas: NO volver a apuntar `event_bus` al paquete pelado; NO exportar
  `discoveryPath` desde ese módulo (el cargador usaría el servicio de Medusa y
  no el envuelto); el prefijo de cola `RedisEventBusService` se pasa explícito y
  no puede cambiar (es el namespace de las claves ya existentes en Redis).
- El job `event-bus-monitor` sigue midiendo la cola y avisando por mail; cuando
  detecta el worker apagado le pide al supervisor que reconstruya ya en vez de
  llamar a `run()` por su cuenta. Perillas: `EVENT_BUS_WORKER_SUPERVISOR=false`
  (apaga el supervisor), `EVENT_BUS_WORKER_RESTART_MIN_MS` / `_MAX_MS` (backoff).
- Tests: `src/lib/event-bus-worker-supervisor.test.ts` (lógica con dobles) y
  `src/modules/event-bus-redis/index.test.ts` (reproduce el envenenamiento contra
  el `bullmq` instalado y prueba la reconstrucción). Si Medusa renombra
  `bullWorker_`/`worker_`/`workerOptions_`/`eventBusRedisConnection_`, el segundo
  es el que avisa.

