# Changelog

## 1.2.0 - 2026-09-08

Borrado lógico de corridas: el listado del catalogador se puede limpiar sin
perder nada (`DESDEELSUR-46`).

### Added

- **Papelera de corridas.** `DELETE /admin/catalogador/executions/:id` pasó de
  borrado destructivo a `deleted_at` (`softDelete`), y
  `POST /admin/catalogador/executions/:id/undelete` la devuelve al listado. En el
  admin: menú de acciones por fila, un modo **Papelera** en la misma pantalla
  (`GET /admin/catalogador/executions?deleted=only`) y un botón **Eliminar** en el
  detalle. El nombre `undelete` es deliberado: `POST /:id/restore` ya existía y
  significa otra cosa —crear una corrida que REESCRIBE el catálogo con los valores
  previos—, y dos verbos homónimos en la misma entidad, uno inocuo y el otro no,
  es un accidente esperando a pasar.
- **`modules/catalogador/deletable.ts`** — la regla de qué se puede borrar, pura y
  con tests (`deletable.test.ts`, 6 casos). Uno recorre `EXECUTION_STATUSES` entero
  y falla si un estado nuevo queda sin decisión.

### Changed

- **El gate de borrado se amplió de 3 estados a 6.** Antes sólo
  `draft`/`cancelled`/`error`, porque el borrado era irreversible. Ahora también
  `pending_review`, `partially_reviewed` y `restored`. Siguen bloqueados
  `ready_to_apply`, `applied` y `partially_applied` —trabajo humano ya decidido, o
  la única trazabilidad de productos que hoy están distintos— y, por decisión
  técnica, los dos estados EN VUELO: con la fila soft-deleted, el workflow de
  `applying` relee la corrida, MikroORM la filtra y el apply queda a mitad de
  camino con el catálogo escrito. Para esos dos, la salida es **Cancelar** y
  después borrar.
- **Los archivos del storage ya NO se barren al borrar.** Barrerlos haría que
  restaurar devolviera una corrida con propuestas de imagen apuntando a blobs
  inexistentes, o sea un borrado irreversible justo en el caso en que alguien se
  arrepiente.
- **El listado y el detalle mandan el gate CALCULADO** (`deletable`,
  `delete_block_reason`) en vez de que la UI lo reimplemente sobre `status`.
- **El scope de tienda del listado dejó de usar `siteFilter`** en favor de
  `executionSiteFilter` (`modules/catalogador/site-scope.ts`). `siteFilter`
  resuelve la pertenencia con SQL que lleva `AND "deleted_at" IS NULL` cableado:
  con él, la papelera se veía llena en la tienda principal y **vacía en toda
  secundaria**, sin ningún error. El helper nuevo usa el `$or` de dos ramas —y no
  el `{ site_id: [id, null] }` que la copia sincronizada de
  `lib/multistore/scope.ts` todavía devuelve, que nunca matchea `IS NULL` y
  esconde las corridas globales—.
- **`EXECUTION_STATUSES` se movió a `modules/catalogador/statuses.ts`**, sin
  imports del framework; el modelo lo re-exporta, así que ningún call site cambia.
  Vivía dentro del `model.define`, y eso dejaba cualquier regla escrita sobre la
  lista fuera del alcance de `node --test`.
## 1.1.2 - 2026-09-08

Arregla que una propuesta editada a mano volviera a mostrar el texto de la IA
(`DESDEELSUR-46`).

### Fixed

- **La edición de un campo se guardaba y la pantalla no la mostraba.** El drawer
  de revisión renderizaba siempre `proposed_changes[field].value`, así que al
  guardar una edición y salir del modo edición volvía a aparecer el texto
  generado por la IA. El backend guardaba BIEN —verificado contra producción:
  `POST …/products/:pid` con `decision: 'edit'` devolvió 200 con
  `accepted_changes.alt_text` = el texto del usuario y `status: 'accepted'`—, o
  sea que era un bug de VISUALIZACIÓN y no de persistencia: nada de lo editado se
  perdió, y al aplicar se hubiera escrito el texto correcto. Ahora el bloque
  muestra el valor EFECTIVO (el aceptado si existe, si no la propuesta), con un
  badge **Editado** y la propuesta original de la IA debajo, en gris, para
  comparar.
- **"Aceptar" pisaba la edición sin avisar.** Con el campo ya editado, el botón
  decía "Aceptado" en `primary` —se leía como el estado actual, no como una
  acción— y un click hacía `decision: 'accept'`, que es
  `accepted[field] = proposed[field].value`: reemplazaba el texto propio por el
  de la IA, en silencio. Combinado con el bug de arriba era una trampa: la
  pantalla mostraba el texto de la IA, el usuario concluía que no se había
  guardado y apretaba Aceptar, y ESE click era el que perdía el trabajo. Ahora,
  con el campo editado, ese botón es **"Usar la propuesta de la IA"** y pide
  confirmación.
- **Reeditar un campo arrancaba del texto de la IA.** El botón Editar hacía
  `setEditValue(String(prop?.value ?? ''))`, así que abrir el editor por segunda
  vez descartaba la edición anterior en cuanto se apretaba Guardar. Ahora arranca
  del valor efectivo.
- Los badges de confianza dejan de aparecer al lado de un texto escrito por una
  persona: describen a la propuesta de la IA, así que con el campo editado bajan
  al bloque de la propuesta original. Dejar "Requiere revisión" junto al texto
  propio afirmaba que falta revisar algo que el usuario acaba de escribir.
- Los dos bloques de texto pasan a `whitespace-pre-wrap`: una descripción con
  saltos de línea se veía como un solo párrafo corrido, distinto de lo que el
  editor mostraba.

### Added

- **`admin/routes/catalogador/[id]/lib.ts`** — `resolveProposalView()`, la regla
  de qué valor se muestra y si es propio o de la IA, pura y con 7 tests
  (`lib.test.ts`). Misma convención que `admin/routes/sites/lib.ts` y que
  `api/…/products/[pid]/lib.ts`. `isEdited` compara los textos ya FORMATEADOS y
  no por identidad: los campos de array (`categories`, `keywords`) nunca son
  `===` aunque tengan los mismos elementos, así que comparar referencias marcaría
  como editado cualquier campo simplemente aceptado.

## 1.1.0 - 2026-09-03

Paga la deuda que 1.0.0 dejó anotada ("minus the `app-settings`-backed override
of catalogador credentials ... Credentials fall back to env-only") y baja el
umbral del gate de revisión.

### Fixed

- **Las credenciales vuelven a leerse de la base (`DESDEELSUR-46`).** El host
  publica un lector de `app-settings` en `globalThis` desde el loader del módulo
  (`plugin-bridge.ts`) y el plugin lo consume por `lib/host-settings.ts`, con
  precedencia **DB cifrada > env** y degradación al entorno cuando ese puente no
  está. Sin esto, una `OPENROUTER_API_KEY` guardada desde la card del Asistente
  IA era invisible para el plugin: en desdeelsur estaba en la base desde el
  19/08 con `env_present: false`, y `POST /admin/catalogador/executions/:id/generate`
  contestaba `503 "OPENROUTER_API_KEY no está configurada en el backend"` en cada
  intento de generar textos — mientras el chat del asistente, que sí lee la base,
  funcionaba. Alcanza a `ai/openrouter.ts` (las dos claves de OpenRouter, del
  namespace `extension:ai-assistant`) y a `modules/catalogador/settings.ts` (las
  6 claves editables de `extension:catalogador`). `CATALOGADOR_JOB_SCHEDULE`
  sigue siendo `envOnly`: Medusa hornea el schedule al arrancar.

### Changed

- **`rules.low_confidence_threshold` por default pasa de `0.7` a `0.5`**, y con
  él los tres fallbacks que lo espejaban: el `??` del endpoint de decisiones y
  las dos pantallas del admin (config y detalle de ejecución). Eran cuatro copias
  del mismo número sin nada que las obligara a moverse juntas.

  Consecuencia a tener presente: el piso de `evidenceConfidence()` es `0.55`, así
  que con el umbral en `0.5` el gate **no difiere ningún campo** — "aceptar todo"
  acepta todo. Es lo pedido (se venía aceptando campo por campo), pero significa
  que `require_review_low_confidence: true` ya no cambia el resultado. Para
  recuperar el gate hay que subir el umbral por encima de `0.55` y no más de
  `0.7`, que es el techo alcanzable sin barcode ni scraping.

  Es un DEFAULT: una fila ya guardada en `catalogador_config` le gana
  (`mergeCatalogadorConfig`), así que las tiendas existentes necesitan además un
  `POST /admin/catalogador/config` para tomarlo.

## 1.0.0 - Initial migration from base extension.

All functionality preserved from packages/extensions/catalogador at parity, minus the `app-settings`-backed override of catalogador credentials and the shared host admin components (ExtensionSettingsCard / HelpDrawer / ExtensionVersion / SingleColumnLayout). Credentials fall back to env-only, matching pre-`app-settings` behaviour; the missing admin cosmetics are annotated with TODOs. The storeConfig read/upsert used to persist `catalogador_config` is resolved from the host by string key. Editable-lifestyle-editor moved into the plugin.
