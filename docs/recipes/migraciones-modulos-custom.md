# Migraciones de módulos custom: nombres únicos y reconciliación

## El problema

Todos los módulos del backend (custom y de Medusa) comparten **una sola** tabla
`mikro_orm_migrations`, y umzug/MikroORM registra cada migración ejecutada por
**nombre de archivo, sin el módulo**. Consecuencia: si dos módulos tienen
migraciones homónimas, el módulo que migra primero registra el nombre y la
homónima del otro módulo queda **salteada en silencio** — `db:migrate` la ve
"aplicada" y no la corre nunca. No hay error: el esquema simplemente queda
incompleto ("registrada-pero-sin-tabla").

Qué módulo migra primero depende del orden de `modules` en `medusa-config.ts`
(DB fresca) o del orden histórico de deploys (prod): **la víctima cambia según
el entorno**.

## Las colisiones históricas (ya reconciliadas)

| Nombre | Módulos | Víctima típica |
| --- | --- | --- |
| `Migration20260619120000` | ai-assistant, comments | DB fresca: ai-assistant (chat_thread, chat_message, ai_tool_policy). Prod: comments (llegó a main después). |
| `Migration20260622120000` | ai-assistant, delivery | DB fresca: ai-assistant (columna `ai_tool_policy.resource`). Según deploy: delivery (`delivery_execution`). |
| `Migration20260630120000` | ai-assistant, shop-by-look | DB fresca: ai-assistant (pgvector: `ai_agent_memory`, `ai_memory_document`). Prod: shop_by_look (#368). |

El caso prod de shop_by_look (#368) fue el primero detectado y se reparó con
`shop-by-look/migrations/Migration20260630210000.ts`. El resto se reconcilió
con estas migraciones (2026-07):

- `ai-assistant/migrations/Migration20260625000000AiAssistantReconcileChat.ts`
- `ai-assistant/migrations/Migration20260702130000AiAssistantReconcileMemory.ts`
- `comments/migrations/Migration20260702120000CommentsReconcile.ts`
- `delivery/migrations/Migration20260622121000DeliveryReconcile.ts`

Cada una re-aplica idempotentemente el contenido de su migración en conflicto y
**loguea en el output de `db:migrate` qué le faltaba a esa DB** (`[reconcile …]
a reparar: …` o `esquema completo: no-op`). Ese log en el job predeploy de DO es
la auditoría por entorno: no hace falta (ni se puede, por la allowlist) tocar la
DB de prod a mano.

## Colisiones contra el CORE de Medusa

La tabla global no distingue entre módulos custom y módulos de Medusa: una
migración nuestra puede colisionar con una que trae un `@medusajs/*` en un
upgrade de versión. Es peor que una colisión entre customs, porque **la del core
no se puede renombrar** y aparece de golpe al bumpear.

| Nombre | Módulos | Víctima | Reconciliada con |
| --- | --- | --- | --- |
| `Migration20260626000000` | `@medusajs/cart@2.18.0`, delivery | **Las dos, según el entorno** (ver abajo). | `delivery/migrations/Migration20260803120000DeliveryReconcileCartCollision.ts` |

Esta colisión es el ejemplo más claro de que **la víctima cambia según el entorno**, y
de que hay que verificar el esquema en vez de razonarlo:

- **Base existente** (prod, cualquier dev de antes del upgrade): la de delivery se
  aplicó el 2026-06-26, así que el nombre ya está registrado y la del core queda
  salteada → faltan `cart_line_item_tax_line.data` y
  `cart_shipping_method_tax_line.data`, que el modelo de `@medusajs/cart@2.18.0` SÍ
  mapea → `column "data" does not exist` → **se rompe el checkout**.
- **Base fresca** (dev nuevo, proyecto generado): verificado empíricamente que `cart`
  migra ANTES que `delivery` (en el log, `MODULE: cart` aplica
  `Migration20260626000000` y el batch de `MODULE: delivery` ya no la lista), así que
  la salteada es **la nuestra** → `vehicle` se queda con la columna escalar
  `store_location_id` y sin `store_location_ids` → **se rompe el módulo delivery**.

En los dos casos `db:migrate` sale 0. Por eso la reconciliación repara **las dos
direcciones**, cada una condicionada a lo que falte de verdad, y su auditoría
distingue "columna faltante" de "tabla ausente" para no reportar un falso
`esquema completo`.

Lo hace cumplir el mismo `src/modules/migration-names.test.ts`, que además de
barrer `src/modules` cruza los nombres contra las migraciones de los
`@medusajs/*` instalados (layout plano de `npm ci` y store de pnpm). Las
colisiones ya reparadas se declaran en `CORE_DUPLICATES_RECONCILED`, y el test
verifica que la migración `*Reconcile*` declarada exista de verdad.

**Al bumpear la versión de Medusa, `pnpm test` es el chequeo que avisa.** Si
falla, la decisión es: si la migración custom todavía NO se aplicó en ningún
entorno, renombrala con el sufijo del módulo; si ya está aplicada, escribí la
reconciliación y anotala en el mapa.

Ojo con una trampa: el test cruza contra **todos** los `@medusajs/*` instalados,
pero no todos los módulos del core se registran en este proyecto. Verificado en el
upgrade a 2.18.0: el módulo `rbac` no está en `medusa-config.ts`, no aparece como
`MODULE: rbac` en el log de `db:migrate` y no crea ninguna tabla `rbac_*` — así que
su migración nunca corre y una colisión contra ella sería inofensiva. Si el test
marca una, confirmá primero si ese módulo migra de verdad acá antes de escribir una
reconciliación que no hace falta.

## La convención (obligatoria)

**Toda migración nueva de un módulo custom lleva el módulo en el nombre:**

```
Migration<YYYYMMDDHHmmss><ModuloEnPascal>.ts   →   Migration20260710120000AiAssistant.ts
```

Clase y archivo con el mismo nombre. Así dos módulos no pueden colisionar ni
entre sí ni con nombres autogenerados de plugins/core. Lo hace cumplir
`src/modules/migration-names.test.ts` (corre con `pnpm test`): falla ante
cualquier nombre duplicado nuevo y ante migraciones posteriores a 2026-07-02
sin sufijo de módulo. Las anteriores al cutoff quedan exceptuadas: renombrarlas
las haría re-correr como "pendientes" en DBs donde ya aplicaron.

## Cómo escribir una reconciliación (reparar esquema sin tocar la DB a mano)

1. **Nunca editar una migración ya aplicada** (registrada no se relee) ni
   corregir por consola (la consola web de DO rompe los pastes). Se escribe una
   migración **nueva** con nombre único que re-aplica el estado esperado.
2. **Todo idempotente**: `CREATE TABLE/INDEX IF NOT EXISTS`,
   `ADD/DROP COLUMN IF (NOT) EXISTS`, `ALTER TABLE IF EXISTS`,
   `DROP INDEX IF EXISTS`. `ADD CONSTRAINT` no soporta `IF NOT EXISTS`: usar
   `do $$ begin if not exists (select 1 from pg_constraint where conname = '…')
   then alter table … end if; end $$;` (o `EXCEPTION WHEN duplicate_object`).
   `CREATE EXTENSION` puede fallar por permisos: guarda con
   `pg_available_extensions` + `EXCEPTION WHEN insufficient_privilege`, y todo
   DDL que dependa de la extensión va en `EXECUTE '…'` dentro de un `do $$`
   condicionado a `pg_extension` (difiere el parseo de tipos como `vector`).
3. **Elegir el timestamp mirando el orden DENTRO del módulo**: debe correr
   después de lo que re-aplica y **antes de cualquier migración que haga un
   ALTER duro sobre esos objetos** — si una migración pendiente crashea antes,
   la reconciliación nunca llega a ejecutarse (por eso
   `…DeliveryReconcile` usa 20260622121000 y `…ReconcileChat` 20260625000000).
4. **Auditar y loguear**: un `this.execute()` inicial con `to_regclass()` /
   `information_schema.columns` que liste lo faltante y un `console.log` — queda
   en el log del predeploy como evidencia de qué reparó en cada entorno.
5. **`down()` no-op** documentado: la baja la sigue manejando la migración
   original.
