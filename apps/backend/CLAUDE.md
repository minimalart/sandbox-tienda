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

