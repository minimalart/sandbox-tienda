# Pulido de UI del backoffice

## Contexto

El admin creció a 37 grupos de rutas y 43 extensiones, y cada una resolvió a su manera
las mismas cuatro preguntas: dónde va la configuración, dónde va el selector de tienda,
cuánto texto explicativo se muestra y cuánto aire va entre las cards. El resultado son
cinco patrones conviviendo, y en algunos casos **promesas rotas**: la barra de
Preferencias muestra el badge "Filtra por tienda" mientras tres de sus siete pestañas
listan datos de todas.

Esto no es cosmética. Una UI que dice "esta tienda" y muestra las tres no confunde: engaña.

Rama: `ui-polish` (ya creada desde `main`, `cb28418f`).

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Pestaña Comercio | Declararla **de instancia** + panel read-only con la región/moneda/canal de la tienda activa |
| Sub-páginas | Extensiones cuya página principal es una **lista** → "Configuración" en el sidebar. Las que ya *son* la card (Videos) quedan |
| Ayuda | Drawer en la UI **y** doc en `docs/`, mismo contenido, **una sola fuente**, en las 43 extensiones |

### Hallazgo que amplió el alcance: el bug de Fiscal no era de Fiscal

El punto 3 del PR 1 estaba escrito como un bug puntual: `fiscal-docs-card.tsx` tenía un
`fetchJson` local que no mandaba `x-site-id`. **No era puntual.** Al cablear el selector
en los formularios a mano aparecieron otras tres pantallas con exactamente la misma forma
—`blog-settings`, `loyalty/programs`, `comments/settings`—: las tres declaradas `scoped`
en el registro, las tres con el backend haciendo bien las dos mitades, y las tres con un
`fetchJson` propio que mandaba sólo `Content-Type`. Sin el header, `siteOf(req)` resuelve
`null` y la pantalla lee y escribe la fila GLOBAL elija el operador la tienda que elija.

`lib/http.ts` ya documentaba la deuda: **22 copias** del helper repartidas por `hooks/api/`,
con la firma calcada a propósito para que migrar sea borrar el local y agregar un import.

El peor de los tres era Loyalty: sin filtrar, la pantalla hace
`programs.find(p => p.status === 'active')` y agarra el primer programa activo de CUALQUIER
tienda; "Guardar" lo edita por id. Elegir Norte y editarle el programa a Sur, sin un error.

**Corolario para el registro:** que una ruta diga `scoped` en `scoped-routes.ts` sólo
prueba la mitad de servidor. El ratchet `admin-site-scope.test.ts` verifica que el backend
invoque `siteFromRequest`, y **no puede ver el transporte del cliente**. Por eso el registro
puede estar entero en verde mientras la mitad del admin no filtra.

### Auditoría del transporte — el agujero es mucho más grande que estas cuatro pantallas

Medido sobre el repo, no estimado. Quedan **19 copias locales de `fetchJson`** en
`hooks/api/`, y **14 de ellas sirven rutas declaradas `scoped`**. Ninguna de las 14 manda
`x-site-id` por ninguna vía (ni helper propio, ni `sdk.client`, ni header suelto):

`abandoned-carts`, `banners`, `checkout-links`, `companies`, `contact-submissions`,
`corporates`, `delivery`, `delivery-routes`, `dynamic-groups`, `email-templates`,
`landing-pages`, `payment-benefits`, `recommendations`, `recurring-orders`.

Verificado punta a punta en Companies: `api/admin/companies/route.ts:36` hace
`siteFilter(req.scope, await siteFromRequest(req), COMPANY_SITE_SCOPE)` —el backend está
listo— y `hooks/api/companies.tsx:33` pega con un `fetch` que sólo manda `Content-Type`.
Sin header, `siteFromRequest` resuelve `allSites` y el filtro es un **no-op**.

O sea: el aislamiento por tienda de catorce pantallas está escrito, testeado del lado del
servidor, y desactivado por el cliente.

**Migradas.** Las catorce pasaron al `fetchJson` de `lib/http.ts` y el techo del ratchet
quedó en **0**: dejó de ser un contador de deuda y pasó a ser una invariante. No hizo falta
`siteHeaders` en ninguna —se buscaron explícitamente las llamadas no-JSON (blobs, FormData,
descargas) y no había—.

El precio, y por qué no se manda solo: **25 pantallas empezaron a filtrar de un día para el
otro sin barra de tienda que lo explicara**. Un operador que ve menos filas y no tiene dónde
leer por qué está peor que antes. Por eso las barras van en el mismo árbol que la migración,
no después.

Las query keys de esos catorce hooks NO se scopearon con `siteScopedKey`, y es correcto:
`SiteScopeBar` recarga por default y la recarga tira el cache. El día que alguna de esas
pantallas pase a modo caliente, hay que scopearlas — y `soft-site-change.test.ts` lo va a
exigir.

**El ratchet que faltaba, ya construido.** `src/admin/hooks/api/site-transport.test.ts` es
la contracara de `admin-site-scope.test.ts` para el lado del navegador: cruza cada hook con
el registro y cuenta los que pegan a una ruta `scoped` sin mandar el header. Tres tests:

1. **La deuda no sube** — techo en 14, mismo mecanismo que `MAX_PENDING`. Probado en
   negativo: un hook nuevo con una URL `scoped` y un `fetch` pelado lo lleva a 15 y falla
   en el acto.
2. **El techo sigue a la realidad hacia abajo** — exige igualdad, no `<=`. Sin esto, migrar
   las catorce dejaría un tope de 14 que vuelve a permitir catorce nuevas, y el número pasa
   a ser decorativo.
3. **Las migradas siguen migradas** — tripwire sobre `blog`, `loyalty` y `comments`, para
   el día que alguien "saque la dependencia de `lib/http`" sin ver que con eso la pantalla
   vuelve a mostrar las tres tiendas.

El conteo de 14 sale del test, no de una estimación a ojo.

### Hallazgo que corrigió una decisión

Se descartó "regions por tienda": **Medusa no lo permite**. Un país pertenece a UNA sola
región globalmente, así que dos tiendas argentinas no pueden tener regions distintas.
Está documentado en `apps/backend/src/modules/demo-store/provision.ts:183-189`, y por eso
`commerce/apply/route.ts:9-17` declara explícitamente que es config de instancia. El
aislamiento por tienda ya existe y pasa por el **sales channel**, no por la region.

---

## PR 1 — Preferencias: que el filtrado sea verdad, pestaña por pestaña

El registro `admin/src/admin/lib/site-scope.ts:49` declara `'store-config': 'scoped'`
para toda la pantalla, pero el scope real difiere por pestaña.

**Estado real por pestaña** (`apps/backend/src/admin/routes/store-config/page.tsx`):

| Pestaña | Hoy | Causa | Acción |
|---|---|---|---|
| Sucursales, Tienda, IA, Mínimo de compra | filtra ✅ | pasan por `siteOf(req)` | — |
| **Acceso** | muestra todas ❌ | `site-gate/route.ts` nunca recibe el request, sólo `req.scope` | filtrar en backend |
| **Documentación Fiscal** | no filtra ❌ | `fetchJson` **local** en `fiscal-docs-card.tsx:71-82` que no manda `x-site-id` | usar el `fetchJson` compartido |
| **Comercio** | no filtra ❌ | escribe Store/Region globales de Medusa | declarar de instancia + panel read-only |

**Cambios:**

1. **Scope por pestaña.** `src/admin/lib/site-scope.ts`: reemplazar la entrada
   `store-config` por siete (`store-config.access`, `store-config.commerce`, …), con
   `commerce` en `instance` y el resto en `scoped`. En `store-config/page.tsx` volver
   `<Tabs>` controlado y pasar `screen={`store-config.${tab}`}` a `<SiteScopeBar>`
   (línea 135), para que el badge diga la verdad de la pestaña que se está mirando.

2. **Acceso filtra de verdad.** `src/api/admin/store-config/site-gate/route.ts`:
   el `GET` (`:16`) y el `POST` (`:52`) pasan a leer `siteFromRequest(req)` y filtrar
   `listGateSites` (`src/modules/store-config/site-gate.ts:131-184`). Con tienda activa
   se devuelve sólo su fila (`scope: 'site:<slug>'`, o `'store'` si es la principal);
   sin tienda (capa de instancia) se devuelven todas. El `POST` rechaza un `scope` que
   no pertenezca a la tienda activa — si no, la lista filtra pero la escritura no, que es
   la media migración que el propio repo documenta como peor que nada.
   Actualizar `src/lib/multistore/scoped-routes.ts:335` de `not-applicable` a `scoped`.

3. **Fiscal.** Borrar el `fetchJson` local de `fiscal-docs-card.tsx:71-82` y usar el de
   `src/admin/lib/http.ts`, que ya inyecta `siteHeader()`. El backend ya es site-aware
   (`fiscalSiteOf()` en `_helpers.ts:205-208`); es un bug de una línea de import.
   Meter `activeId` en la query key `['fiscal-config']` (`:219`).

4. **Comercio.** Nuevo componente read-only en `routes/store-config/components/` que
   muestre, para la tienda activa, contra qué region / moneda / sales channel opera.
   Los datos ya existen: `demo_store.region_id`, `currency_code`, `sales_channel_id`
   (`src/modules/demo-store/models/demo-store.ts:24,71,72`) y `main-store.ts:82-94`
   para la principal. Exponerlos extendiendo `GET /admin/multistore/manifest` en vez de
   crear una ruta nueva.

**Verificación:** el ratchet `src/api/admin-site-scope.test.ts` exige que toda ruta `scoped`
invoque `siteFromRequest`, así que valida el punto 2 solo. Ver comandos en «Verificación».

---

## PR 2 — La configuración siempre es una sub-página

Patrón de referencia ya correcto: **GA4** — `routes/ga4/page.tsx` redirige y
`routes/ga4/config/page.tsx` exporta `defineRouteConfig({ label: 'Configuración', rank: 1 })`.
Mismo patrón en Andreani, Correo Argentino, AI Assistant, ERP, Loyalty, SEO-GEO,
Recomendaciones, Payment Benefits, WhatsApp, Blog, Recurring Orders (13 en total).

**A convertir:**

- **Catalogador** — ya tiene la sub-página `routes/catalogador/config/page.tsx`, pero sin
  `defineRouteConfig`, así que es invisible en el sidebar y se entra por un botón
  (`routes/catalogador/page.tsx:160`). Exportar el `config` y borrar el botón.
- **10 con la card inline al pie de una lista** → mover la card a `<ext>/settings/page.tsx`
  con su `defineRouteConfig`, y la página padre pasa a redirigir: Typesense,
  Abandoned Carts, Checkout Links, Delivery, Dynamic Groups, Media Library, Companies,
  Corporates, Sites, Email Templates. En Email Templates además se absorbe el drawer de
  branding (`page.tsx:132,366-368`) dentro de la sub-página.
- **2 con pestaña de configuración** — Comments (`routes/comments/page.tsx:15-26`) y
  Gift Cards (`routes/gift-card-experience/page.tsx:226-241`): su página principal también
  es una lista, así que aplica la misma regla y la pestaña "Configuración" se vuelve sub-página.

**Se quedan como están:** Videos (la card *es* la página; una página padre que sólo
redirige sería un click de más para nada) y Preferencias (pantalla de ajustes con pestañas,
no una extensión con lista).

---

## PR 3 — Un solo selector de tienda, integrado en la card

El patrón que pediste ya existe y está bien argumentado: `SettingsSiteContext`
(`components/app-settings/settings-site-context.tsx`), montado **dentro** de
`ExtensionSettingsCard` (`extension-settings-card.tsx:268`), que deriva el scope del
descriptor (`d.scope === 'site'`) en vez de un registro paralelo. Ya cubre las ~27 páginas
que usan la card.

**Los huecos son los formularios a mano**, que no pasan por la card y por eso no tienen
selector: `catalogador/config`, `erp/configuracion`, `loyalty/configuracion`,
`seo-geo/configuracion`, `blog/settings`, `comments/components/comments-settings.tsx`, y
las cinco cards propias de `store-config/components/`.

**Cambio:** extraer la franja de `settings-site-context.tsx:107-150` a un
`<CardSiteContext scope="site" | "instance" />` reutilizable en `components/common/`.
`SettingsSiteContext` pasa a ser el envoltorio que deriva `scope` de los descriptores; los
formularios a mano lo montan declarando su scope explícitamente. Misma franja, mismo lugar
(bajo el título, borde inferior, `bg-ui-bg-subtle`), en todos lados.

`SiteScopeBar` **sigue existiendo** para las pantallas de LISTA: ahí la pregunta es otra
("¿esta lista filtra?") y su segundo badge es lo que evita que la barra mienta. Sólo se
alinea visualmente con la franja de la card.

---

## PR 4 — Ayuda: drawer y documentación con una sola fuente

Hoy hay ~27 `description` de 2-4 oraciones, ~100 `help` de más de 140 caracteres
(el peor: `descriptors/delivery.ts:75`, **480 caracteres**) y 5 bloques numerados de
"cómo funciona". Y no hay una sola doc por extensión: `docs/recipes/` tiene 17 archivos
para 43 extensiones.

**Fuente única — decisión y por qué.** El contenido vive en módulos TypeScript
(`src/admin/help/<extension>.ts`), un script genera `docs/extensions/<extension>.md`, y un
test falla si el markdown quedó viejo. Se descartó leer el `.md` directo con `?raw` de Vite
porque el admin no expone su config de bundler y su modo de falla es que la ayuda
desaparezca en silencio — exactamente lo que `site-scope-bar.tsx:82-97` ya rechaza para la
barra de tienda. El repo además ya resuelve invariantes así: `migration-names.test.ts` y
`admin-site-scope.test.ts`.

**Piezas:**

1. `src/admin/help/types.ts` — `ExtensionHelp = { title, summary, sections: {heading, body, steps?, links?}[] }`.
2. `src/admin/help/<extension>.ts` × 43 — el contenido, migrando el texto que hoy está en
   `description=`, en los `help:` largos y en los bloques numerados.
3. `components/common/help-drawer.tsx` — botón discreto en el header de cada página que
   abre un `Drawer` (`@medusajs/ui`, ya usado en 57 archivos) renderizando el `ExtensionHelp`.
4. `scripts/generate-extension-docs.ts` + test de sincronía → `docs/extensions/<ext>.md`.

**Adelgazamiento de la UI (lo que queda visible):**

- `description` de `ExtensionSettingsCard` → **una** oración. El resto va al drawer.
- `help` de más de 140 caracteres → tooltip. El componente ya existe y está probado:
  `ErpSettingLabel` (`routes/erp/components/shared.tsx:86-112`), usado 15 veces en ERP.
  **Levantarlo a `components/common/setting-label.tsx` y cablearlo en `SettingField`
  (`setting-field.tsx:123-126`)** — con eso las ~100 filas largas se arreglan en un solo lugar.
- Bloques numerados (`brands/components/brand-csv-bulk.tsx:176-250`, ~75 líneas;
  `videos/components/vimeo-connection-card.tsx:93-108`; `whatsapp/inbox/page.tsx:40-58`)
  → al drawer.
- `settings/site-credentials` (~1250 líneas, casi todo explicación: `integration-card.tsx:268-309`
  son 6 párrafos apilados) → al drawer, dejando los `InlineTip` condicionales, que sí son
  contextuales y accionables.

---

### Hallazgo lateral de PR 4: dieciséis claves de traducción que no existen

Migrando la ayuda al drawer apareció que `typesense/components/Synonyms/SynonymFormDrawer.tsx`
llamaba a `t('ROOT_TERM_HELP_TEXT_DETAILED')`, una clave que no está definida en ningún
namespace. **i18next no rompe con eso**: hace fallback al NOMBRE de la clave y lo pinta tal
cual. El operador leía literalmente `ROOT_TERM_HELP_TEXT_DETAILED` abajo del campo, en
mayúsculas y con guiones bajos. Sin excepción, sin warning, sin pantalla en blanco.

Al medir no era una: son **dieciséis**, en ocho archivos — `videos` (seis), `email-templates`,
`banners`, `andreani`, `typesense`. Entre ellas `POSTER_HELP`, `UPLOAD_POSTER`,
`LABEL_SALES_CHANNELS`, `SALES_CHANNELS_HELP`. El compilador no las ve porque `t()` toma un
`string`.

Se arregló la de Typesense (existía `ROOT_TERM_HELP_TEXT`, con el texto correcto, y encima
el `.split('\n')` que la envolvía partía un string de una sola línea: ayuda rota que no
rompía nada). Las otras quince **no** se arreglaron acá: cada una necesita su copy en los
dos idiomas y eso es decisión de producto, no de un PR de layout.

Lo que sí se hizo es cerrar la puerta: `src/admin/translations/ghost-keys.test.ts`, con techo
en 16 y la misma exigencia de igualdad que el ratchet de transporte —arreglar una obliga a
bajar el número—. Probado en negativo: una clave fantasma nueva lo lleva a 17 y falla.

El conteo usa la unión GLOBAL de claves definidas, sin separar por namespace. Es un sesgo
deliberado hacia el falso negativo: subestima, pero **todo lo que marca está roto de verdad**.
Un ratchet con falsos positivos se desactiva a la semana.

### Cobertura final de la ayuda: 29 de 29

Las 29 extensiones con descriptor tienen su módulo en `src/admin/help/` y su markdown
generado. El drawer está montado en las 29 pantallas donde hay dónde montarlo.

Dos no tienen pantalla propia y quedaron resueltas por su lugar real de uso, no por el
directorio: `mercadopago` monta su card dentro de `payment-benefits/settings`, y
`store-importer` se opera desde el detalle de tienda (`routes/sites/[id]/`).

**Por qué `HelpDrawer` recibe el slug explícito y no lo deduce de la ruta**: el slug es el del
DESCRIPTOR, y en cuatro casos no coincide con el directorio —`recommendation-engine` vive en
`routes/recomendaciones/`, `abandoned-cart` en `routes/abandoned-carts/`, `corporate` en
`routes/corporates/`, `loyalty-engine` en `routes/loyalty/`—. Deducirlo funcionaría en 25 de
29 y fallaría **en silencio**, sin drawer y sin error, justo en las cuatro excepciones.

Dos criterios de adelgazamiento que aparecieron al hacerlo y conviene reusar:

- **Lo que hace cumplir un validador no se repite en prosa.** Si un `refine` del descriptor ya
  impide guardar el valor malo, las tres oraciones que lo explican sobran.
- **Lo que sólo se sabe parado frente al campo se queda.** De dónde se copia un valor en un
  panel externo (Settings → Mail Settings → Signed Event Webhook) no se deduce; la consecuencia
  de no cargarlo sí está en el drawer.

Y una entrada del plan que se revirtió con evidencia: el bloque numerado "Cómo conectar" de
`videos/components/vimeo-connection-card.tsx` NO se movió al drawer. Está envuelto en
`{!isConnected && …}`: es un empty state con los pasos accionables. Esconder detrás de un botón
las instrucciones que aparecen sólo cuando la cuenta no está conectada empeora exactamente la
pantalla que este trabajo viene a arreglar.

## PR 5 — Espaciado

El caso que señalaste, medido: de la barra de pestañas al título "Página de contraseña" hay
**48px** = `Tabs.Content px-6 py-6` (`store-config/page.tsx:259`) + `Container p-6`
(`site-gate-card.tsx:74`), más una card con sombra anidada dentro de otra card con sombra.

**Causas y arreglos:**

1. **Card dentro de card.** Las cinco cards de `store-config/components/` son `<Container>`
   propios adentro del `<Container>` de la página. Seguir a `fiscal-docs-card.tsx:254`,
   que ya lo resolvió con `p-0` + su propio header `px-6 py-4`.
2. **`mb-4` a mano dentro de padres con `gap`.** 7 cards lo hacen
   (`branch-settings-card.tsx:44`, `storefront-settings-card.tsx:31`, `ai-config-card.tsx:90`,
   `email-branding-card.tsx:231`, `site-gate-card.tsx:74`, `fiscal-docs-card.tsx:254`,
   `whatsapp/components/floating-button-card.tsx:75`) → `gap-4` + `mb-4` = 32px. Borrar
   el margen: el gap del padre manda.
3. **Cinco wrappers raíz distintos** — `<>` (sin gap), `gap-y-2`, `gap-y-3`, `gap-y-4`,
   `gap-4`. Adoptar `components/layouts/single-column.tsx` (ya existe, 9 líneas, hoy usado
   sólo en 4 archivos de Typesense) como shell único de las páginas de ajustes y unificar
   en un valor.
4. `Tabs.Content` de `store-config/page.tsx` y `comments/page.tsx`: `py-6` → `py-4`.

---

### La escritura por id: 8 medidos, 56 reales

El mismo principio del PR 1 —filtrar el listado y dejar la escritura abierta es peor que no
migrar— aplicado a todo el backend. `assertIdInSite` ya lo tenía escrito
(`lib/multistore/scope.ts:316-319`): *"si una fila se ve, se puede editar; si no, 404"*.

La primera medición dio **8 rutas sin guard**. Estaba baja, por dos motivos independientes que
vale documentar porque son la misma clase de error:

1. **Criterio angosto.** Sólo se miraban rutas cuyo ÚLTIMO segmento es un parámetro. Las de
   acción (`.../[id]/assign`, `.../[id]/auto-assign`) tienen el mismo agujero con otra forma y
   pasaban de largo. `assign` era el peor de todos: con el id de una ejecución ajena se le
   encajaba un repartidor propio a la entrega de otra tienda.
2. **El barril.** `lib/multistore/index.ts` re-exporta `assertRowInSite`, así que cualquier
   ruta que importara del barril —aunque fuera sólo `siteFromRequest`— quedaba a un salto del
   nombre del guard y se contaba como protegida.

Y un tercero, en el propio ratchet mientras se escribía: las rutas donde el guard no aplica lo
explican en un comentario (*"acá no va `assertIdInSite`"*), y el match de texto las absolvía.
**El mismo error que ese test denuncia, cometido por el test.** Ahora exige el paréntesis,
sobre el fuente ya sin comentarios.

Número real: **143 rutas de mutación con parámetro → 113 sobre recursos `scoped` → 56 sin
guard**. Se cerraron 9. Las 56 quedan en el techo de
`src/api/admin-id-mutation-scope.test.ts`, y 55 de ellas tienen un ancestro ya guardado que
nombra el descriptor exacto, así que el propio mensaje de error dicta la línea que falta.

No se cerraron en la misma pasada a propósito: tocar ~20 módulos de forma mecánica es
exactamente donde se cuela un guard sobre el campo equivocado, que es peor que ninguno porque
parece que protege.

### El dashboard de Fidelización dice `scoped` y filtra a medias

Al montarle la barra a las siete sub-páginas de Fidelización apareció que
`admin/loyalty/dashboard` está declarada `{ state: 'scoped' }`
(`scoped-routes.ts:247`) y su handler **no lo cumple**. De sus siete KPIs:

- **3 filtran** — emitidos, canjeados y vencidos, vía
  `siteFilter(…, POINTS_TRANSACTION_SITE_SCOPE)` (`dashboard/route.ts:29-31`).
- **3 NO filtran** — canjes totales, canjes pendientes y el top de recompensas salen de
  `listRewardGrants({}, …)` (`dashboard/route.ts:49`), con el filtro VACÍO, aunque
  `LOYALTY_REWARD_GRANT_SITE_SCOPE` existe y `grants/route.ts:17` sí lo usa. Es un bug,
  no una decisión.
- **1 es de instancia por diseño** — clientes activos y balance promedio salen de
  `points_account` (`:18`), que es una cuenta por cliente en toda la instancia.

La pantalla quedó declarada **`unscoped`** en `lib/site-scope.ts`: con cuatro de siete
números cruzando tiendas, el badge verde sería exactamente la mentira que el registro
existe para evitar. **El bug del backend NO se arregló acá** — cambiar `listRewardGrants`
cambia los números que el dashboard viene mostrando, y eso merece su propio cambio.

**Segundo agujero del ratchet del servidor.** `admin-site-scope.test.ts` exige que toda
ruta `scoped` **invoque** `siteFromRequest`. Esta ruta lo invoca —para tres de sus siete
consultas— y el test pasa igual. Invocar no es filtrar. Sumado al agujero del transporte
del cliente, el registro puede estar entero en verde con la pantalla mostrando datos de
todas las tiendas por dos caminos distintos.

## Cambio de tienda en caliente — Comments, Blog y Loyalty

El default del admin es **recargar** el navegador al cambiar de tienda, y sigue siéndolo:
está argumentado en `lib/active-site.ts` y no se toca. Pero `settings/site-credentials` y
`settings/extension-settings` ya se salían de ahí con `reloadOnChange={false}`, así que la
pregunta era si eso se puede generalizar. Se puede, y **migrar el transporte es el
habilitante, no el paso previo**.

`SetActiveSiteOptions` pide tres condiciones. La 2 —"el header viaja POR LLAMADA"— la
cumple `lib/http.ts` solo, porque llama a `siteHeader()` adentro de `fetchJson`, en cada
request. El `sdk` NO: fija `globalHeaders` una sola vez al construirse
(`lib/client.ts`), así que sin recarga el `x-site-id` queda congelado en la tienda que
estaba activa cuando cargó el bundle.

Consecuencia concreta: **los catorce hooks sin migrar no pueden ir en caliente**, y
`seo-geo` tampoco —es la única pantalla que ya filtraba bien, pero pega por el SDK—.

**Estado por pantalla** (medido, no estimado):

| Pantalla | Key scopeada | Header por llamada | Modo |
|---|---|---|---|
| `comments/settings` | ✅ | ✅ | caliente |
| `blog/settings` | ✅ | ✅ | caliente |
| `loyalty/configuracion` | ✅ | ✅ | caliente |
| `settings/site-credentials` | ✅ | ✅ | caliente (ya estaba) |
| `settings/extension-settings` | ✅ | ✅ | caliente (ya estaba) |
| `seo-geo/configuracion` | ❌ | ❌ | recarga — pega por `sdk` con `globalHeaders` |
| las 14 sin migrar | ❌ | ❌ | recarga — primero hay que migrar el transporte |

**Corrección a una regla que estaba mal escrita.** "Header por llamada" NO quiere decir
"no usar el `sdk`": `site-credentials` y `app-settings` pegan por `sdk.client.fetch` y están
bien, porque pasan `headers: siteHeaders(siteId)` en cada request. Lo que no sirve es
apoyarse en el `globalHeaders` del SDK, que `lib/client.ts` resuelve UNA vez al construirse.
`seo-geo` hace exactamente eso, y por eso —siendo la única pantalla que ya filtraba bien
desde el principio— es la que no puede ir en caliente.

**Lo hecho en las tres:**

- `CardSiteContext` acepta `reloadOnChange` (opt-in, default `true`, misma prop y mismo
  default que `SiteScopeBar`).
- `siteScopedKey()` vive en `lib/active-site.ts`, no copiado en cada hook: a la tercera
  copia a mano ya se habría escrito distinto.
- La franja va en la PÁGINA, **fuera** del `key`, y el cuerpo se remonta con
  `key={activeId ?? INSTANCE_KEY}`. Que la franja se quede quieta y sólo parpadee el
  cuerpo es la mitad de la gracia de no recargar: si se remontara junto, el operador
  perdería el selector que acaba de usar justo mientras espera los datos. El costo es
  subir el `dirty` con un callback, porque el borrador vive abajo.
- Cada una con su esqueleto, espejando la forma real del formulario. Un esqueleto de otra
  forma no ahorra el salto de layout: lo mueve al momento en que llegan los datos.
- En Comments se scopeó también la key del listado, que hoy no lo necesita: dejar media
  docena de claves constantes en el mismo archivo es la trampa armada para el próximo. En
  Loyalty se scopeó SÓLO `programs` —el único hook que consume una pantalla caliente— y
  queda escrito por qué.
- **Blog: el botón Guardar bajó del header al pie.** El borrador tiene que vivir en el
  componente remontable, y un botón que guarda un borrador que no puede ver necesita otro
  callback hacia arriba. Ese cable ya existe para el `dirty`, que es un booleano; armarlo
  también para el submit es acoplamiento a cambio de nada. De paso quedó igual que Comments.

**Dónde muerde más la condición 3.** En Loyalty el guardado es por ID
(`updateProgram({ id: program.id, … })`). Un borrador que sobreviviera al cambio de tienda
no escribiría "mal" en la tienda nueva: escribiría en el PROGRAMA DE LA VIEJA, que ni
siquiera está en pantalla.

**El guard.** De las tres condiciones, dos fallan ruidosamente y la tercera —el
remonte— falla **en silencio**: sin `key={activeId}`, el borrador de la tienda A se guarda
contra la B, sin excepción ni toast. No hay tipo que exprese esa relación entre un
componente y su llamador, así que la hace cumplir `lib/soft-site-change.test.ts`: toda
pantalla con `reloadOnChange={false}` tiene que remontar con `key={activeId}` y no puede
pegar por el SDK. Probado en negativo. Incluye además un test que falla si NO hay ninguna
pantalla en caliente — un escáner que no encuentra nada da un verde que no significa nada.

## Orden y riesgo

PR 1 → 2 → 5 → 3 → 4. Los primeros tres son acotados y verificables; PR 3 toca ~12 archivos
de forma mecánica; **PR 4 es el más grande con diferencia** (43 módulos de contenido) y
conviene mandarlo dividido por tandas de extensiones una vez que el mecanismo esté aprobado
en la primera.

---

# Dónde terminó, y qué queda

El plan arrancó como pulido de UI y terminó en otra parte. La causa está en su propia
premisa —"una UI que dice 'esta tienda' y muestra las tres no confunde: engaña"—: apenas se
empezó a hacer que la UI dijera la verdad, apareció cuánta de esa verdad no existía todavía.

## Las cuatro superficies

Ninguna de las cuatro se veía desde las otras, y cada una necesitó su propio criterio de
entrada porque el eje de tienda llega distinto:

| Superficie | Cómo llega la tienda | Estado |
|---|---|---|
| `src/api/admin` | `siteFromRequest(req)` — header `x-site-id` | 3 ratchets, techos en 0 · 2 `pending` bloqueadas |
| `src/admin` (cliente) | `siteHeader()` por llamada | 0 hooks sin header · 0 claves fantasma |
| `src/jobs` + `src/subscribers` | no hay request: se resuelve del dato | registro + ratchet · 12 `pending` |
| `src/api/store` | publishable key → `sales_channel_ids` | ratchet · 22 `pending` |

## Las cuatro formas del mismo bug

Aparecieron en ese orden y todas comparten que **no fallan nunca**: responden 200, la pantalla
se ve bien, y el síntoma aparece parado en otra tienda o semanas después.

1. **La lectura filtra, la escritura no** — 56 rutas de mutación sin guard.
2. **El transporte no manda el header** — 14 hooks del admin.
3. **La creación nace sin tienda** — `blog-posts`, `catalogador` ×3, `blog-posts/duplicate`.
4. **El guard valida el padre, la mutación va por la hija** — 7 rutas.

Y una quinta, la más cara, que sólo se ve desde el storefront: **la mitad de servidor escrita
y la del cliente no**. `store/store-config` no filtraba `password_gate` —un control de acceso—
mientras el admin ya filtraba con el mismo descriptor.

## Lo que aprendieron los ratchets sobre sí mismos

Los tres primeros fallaron por **criterio angosto**, y cada uno lo lleva documentado:

- mirar sólo el último segmento del path → `auto-assign` "no existía", siendo el peor caso;
- seguir el barril de re-exports → cualquier import contaba como guardado;
- confundir **mención** con **invocación** → las rutas que explican en un comentario por qué
  el guard no aplica quedaban absueltas. *El mismo error que el test denuncia, cometido por
  el test.*

Por eso los últimos llevan un test que **mide su propio criterio**: que la población sea
estrictamente mayor que la de la versión ingenua. Si alguien simplifica el walk, se pone rojo
en vez de bajar el contador en silencio.

**Todos los techos exigen igualdad, no `<=`.** Con `<=` se arreglan N deudas y queda lugar
para N nuevas: el número pasa a ser decoración.

## Lo que queda abierto — todo requiere una decisión, ninguno es "falta escribirlo"

- **Las 22 rutas store** son casi todas la MISMA: `?sales_channel_id=` lo declara el cliente y
  sin el parámetro no se filtra nada. Sellarlo desde la key cambia lo que hoy ve la tienda
  principal. **Se cierran juntas o la incoherencia queda invisible.**
- **`store-locations/resolve`** devuelve el canal con el que el storefront arma el carrito:
  filtrar cambia el `covered` de clientes que hoy compran.
- **MercadoPago** — `getAccount` es síncrono y está en el camino del cobro; dos providers
  comparten credenciales.
- **WhatsApp conversations** — `phone` es UNIQUE por instancia: partirlo divide el historial
  de quien le escribió a dos tiendas.
- **Los jobs de gift cards** — `claimDueDeliveries` reclama las filas antes de saber de qué
  tienda son; los días de aviso no son valores por fila sino los parámetros de la consulta.
- **`customer-created-*`** — no hay de dónde sacar la tienda: no hay columna, ni link, ni
  metadata. Deducirla de las órdenes acierta a veces y es silenciosamente falsa el resto, que
  es peor que no resolver. Se cierran con un cambio aguas arriba: sellar la tienda en el alta.

## La regla que más veces salvó un cambio

**Un guard sobre el campo equivocado es peor que ninguno, porque parece que protege.** Aparece
en el diff, la revisión lo da por cerrado, y el agujero sigue abierto.

De ahí sale todo lo demás: no declarar `scoped` por analogía, no inventar el eje donde no hay
de dónde sacarlo, y preferir una razón escrita a un número más bajo.

## Verificación

> **El runner es `node --test`, no vitest.** Vitest no está en `package.json` ni en
> `node_modules`: `npx vitest` lo bajaría de internet para correr contra una config que no
> existe. La convención del repo es `node:test` + `node:assert/strict` — ver
> `src/modules/migration-names.test.ts`.

- Un archivo — `cd apps/backend && node --experimental-transform-types --import ./test-register.mjs --test src/api/admin-site-scope.test.ts`.
  El ratchet valida que toda ruta `scoped` invoque `siteFromRequest` (cubre PR 1) y que no
  haya entradas huérfanas en el registro. Baseline al abrir la rama: **8/8 pasando**.
- Suite completa — `cd apps/backend && npm test`. Incluye `migration-names.test.ts` y los
  tests de `lib/active-site` y `lib/site-scope`.
- Nuevo test de sincronía drawer↔docs en PR 4.

> **`npm run typecheck` NO alcanza como gate, y lo aprendí de la peor forma.**
> `tsc --noEmit` valida tipos sobre un AST ya parseado: un `{/* … */}` puesto entre los
> ATRIBUTOS de un elemento JSX —donde no es válido— pasó el typecheck en dos archivos, en
> dos commits distintos, y sólo lo atrapó `npx medusa lint`. Correr el lint antes de
> mergear no es opcional.

**Lo que NO se pudo verificar acá y hay que hacer antes de mergear:**

- **Smoke test del SQL del tablero de Fidelización** contra una base real. Los agregados de
  canjes (`api/admin/loyalty/dashboard/route.ts`) se escribieron para sacar el techo de 5000
  y están revisados a mano, pero **no ejecutados**: no hay Postgres en el entorno donde se
  desarrollaron. Es lo único de la rama que la suite no cubre. Comparar los tres números
  contra los que da hoy en una instancia con datos.
- **La pasada manual con dos tiendas** de la lista de abajo. La suite prueba invariantes, no
  comportamiento: que una lista filtre lo verifica un test, que el operador entienda por qué
  ve menos filas, no.
- Manual, con al menos dos tiendas cargadas:
  - Preferencias → elegir una tienda → **Acceso muestra sólo esa fila**; Fiscal muestra los
    datos de esa tienda; Comercio muestra "Configuración de la instancia" + el panel con su
    region/moneda/canal.
  - Sidebar: Catalogador, Typesense, Delivery, Companies… todas con "Configuración" como hijo.
  - Cada extensión: el selector aparece dentro de la card, en la misma posición.
  - Preferencias → Acceso: el salto de la barra de pestañas a la card baja de 48px a ~16px.
