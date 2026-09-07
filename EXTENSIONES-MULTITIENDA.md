# Extensiones multitienda — clasificación y plan

> **Estado: v3 — en ejecución.** La v2 incorporó la vuelta con el equipo
> (Mati / Ale, 6-ago) y la decisión de **eliminar `site-manager`** (decisión 7).
> Desde entonces se implementó: ver **[Estado de la implementación](#estado-de-la-implementación)**
> abajo. Las estimaciones siguen siendo de orden de magnitud, no compromisos.

## Estado de la implementación

Rama `refactor/desmantelar-site-manager`, sin push. **2347 tests en verde**,
typecheck limpio en backend y storefront, 42 payloads verificados.

### Cerrado

| Bloque | Estado |
|---|---|
| **Fundaciones P0–P7** | 8/8. El seam vive en `apps/backend/src/lib/multistore/` y sobrevive al composer. |
| **Providers con credenciales por tienda** | 5/5: Andreani, Correo Argentino, Kapso, MercadoPago (×2), email/SendGrid. |
| **Rutas admin filtrando** | **145 `scoped` + 81 `not-applicable`** (con razón escrita) de 227 — **queda UNA**. |
| **Extensiones migradas** | 30, declaradas en `catalog.json` con su capacidad real. |
| **Formas físicas del filtro** | 6. Las 4 originales + `site_column` (eje propio) + `via_parent` (lo hereda del padre, recursivo y con FK de array). |
| **Deuda documentada** | La única pendiente declara **qué la bloquea**, y un test lo exige. |

### Las tres decisiones que más cuestan si se revierten

1. **Credenciales ilegibles CORTAN, nunca caen al entorno.** Si una tienda declaró
   sus credenciales y no se pueden descifrar (típicamente porque rotó `JWT_SECRET`),
   despachar, cobrar o mandar WhatsApp desde la cuenta de otra tienda es peor que
   fallar — y ninguna de las tres se puede deshacer. Fijado por
   `lib/multistore/provider-credentials.test.ts` en los tres carriers.
2. **`NULL` en config significa GLOBAL, no "todas".** Listar une; resolver un valor
   efectivo tiene PRECEDENCIA. Por eso `siteFilter` y `pickBySitePrecedence` son dos
   funciones con nombres distintos y no un flag: confundirlas es el fail-open que
   este documento venía advirtiendo.
3. **Todo cache que dependa de la tienda va indexado por tienda.** El del branding de
   email estaba en un slot único: el primer mail de la tienda A dejaba su logo
   cacheado un minuto y todos los de la B en esa ventana salían con la marca de A.
   El mail ya salió — no se deshace.
4. **La config por tienda se ESCRIBE con `upsert…ForSite`, nunca actualizando por id
   la fila que devolvió el GET.** Si la tienda no tiene fila propia, el GET devuelve la
   GLOBAL — y guardar por ese id cambia la configuración de la instancia entera
   creyendo editar una sola tienda. Apareció tres veces (gift cards, recurrentes,
   comments/blog) y las tres se veían idénticas a código correcto.
5. **Leer config es `readSetting(key, siteId)`, nunca `listStoreSettings({ key })`.**
   Desde que `store_setting` tiene `site_id`, el listado puede devolver dos filas y
   `rows[0]` depende del plan de ejecución. Un test camina `modules/` y `lib/` y falla
   si alguien vuelve a la forma ambigua.
6. **El detalle se guarda igual que el listado, con el mismo subselect.** Filtrar la
   lista y dejar el `POST /:id` abierto esconde la fila de la otra tienda pero deja
   editarla con sólo saber el id. `assertIdInSite` reusa el subselect del listado
   justamente para que detalle y listado no puedan discrepar. Devuelve 404 y no 403:
   un 403 confirmaría que el id existe en otra tienda.

### Lo que queda: UNA ruta

| Bloqueo | Ruta | Qué hay que decidir |
|---|---|---|
| **Producto** | `whatsapp-conversations` | `whatsapp_conversation` tiene `phone` **UNIQUE en toda la instancia** — una conversación por cliente. Partirla por tienda dividiría el historial de alguien que le escribió a dos, y eso es una decisión de producto con consecuencias sobre datos vivos. Los **eventos** sí filtran (`whatsapp-analytics`), que es donde está el embudo. |

Las que antes estaban bloqueadas se resolvieron sin forzar ninguna decisión de costo:

- **`typesense` (12)** — un mapa en env resuelve la colección de cada tienda
  (`TYPESENSE_SITE_COLLECTIONS`), mismo patrón que `MERCADOPAGO_ACCOUNTS`. Con el mapa
  vacío —el default— todo se comporta como antes; el día que el equipo cree las
  colecciones, agrega el mapa y no hay que tocar una ruta. De paso apareció que
  **stopwords y presets son del clúster**, no de la colección: esas cuatro no se pueden
  separar ni con colecciones distintas.
- **`catalogador` (2)** — la corrida es de quien la lanzó, aunque el producto que
  enriquece sea compartido. El modelo y el listado lo dicen para que nadie lea
  aislamiento donde no lo hay.
- **`whatsapp-analytics`** — la tienda llega por `?site=` en la URL del webhook, que es
  el patrón que el repo ya usa para el `notification_url` de MercadoPago.


---

## Contexto

El monorepo ya es multitienda **a nivel de sitio**: `feat/tiendas-multisitio` (PR #773)
trajo la tabla `demo_store`, un `sales_channel` + `region` + `stock_location` nativos
por tienda, y resolución por path (`/tienda/<slug>`) y por subdominio (mergeada,
apagada tras `NEXT_PUBLIC_SITE_HOST_SUFFIX`).

Lo que **no** es multitienda son las 41 extensiones. Hoy, como mucho, filtran su
*data* por `sales_channel_id` — y sólo 10 lo hacen. Su **configuración y sus
credenciales son una sola por instancia**.

El pedido que origina este documento: *"si agarro la extensión de Andreani, quiero
poder gestionar para distintas tiendas las credenciales y el sistema de la
extensión. Así me gustaría que ocurra para todas las extensiones"*. Es decir:
**config y credenciales por tienda**, no data por tienda.

**Resultado del análisis:** 41 extensiones revisadas — **`site-manager` se elimina**
(decisión 7), quedan **40 a migrar**. ~200-310 días-persona totales, de los cuales
**23 extensiones (las olas 0-2, ~80 d-p) ya dan multitienda demostrable**. El 55%
del esfuerzo está concentrado en 8 extensiones.

---

## Decisiones tomadas

| # | Decisión | Detalle |
|---|---|---|
| 1 | **Eje: `site_id`, resuelto vía canal** | Config por `site_id`. Resolución: header `x-site-slug` → `sales_channel_id` → global. |
| 2 | **Credenciales: híbrido por integración** | **DB cifrada** (AES-256-GCM, patrón `erp/crypto.ts`, KEK de `JWT_SECRET`): andreani, correo-argentino, mercadopago, kapso, sendgrid. **ENV plano sin scoping**: typesense, S3, OpenRouter, embeddings. |
| 3 | **Fail-closed en lectura, copy-at-creation** | `is_main` → `site ?? global ?? env`. No-main → `site ?? OFF`. Sin site (mono-tienda) → `global ?? env`. Al **crear** una tienda se copia la fila global de cada namespace: nace usable y diverge al editarse, con auditoría en `site_setting_revision`. |
| 4 | **Alcance máximo** | Funciona también en proyectos de cliente. `demo-store` deja de borrarse. |
| 5 | **Paquetes: partir en dos** | `multistore` (modelo, provision, main-store, links, `/admin/sites`, resolución en storefront) = **required**. `store-importer` (importers Shopify/VTEX/Woo, `demo_import_job`, cron) = opcional, `dependencies: ['multistore']`. |
| 6 | **Clientes vivos: migración opt-in** | Código y migraciones listos; se aplican por cliente y a demanda. |
| 7 | **Se elimina `site-manager`** (equipo, 2ª vuelta) | No se "vuela": se **reparte** en cuatro destinos. Ver abajo. |
| 8 | **El host de config nace nuevo dentro de `multistore`** | `site_setting(site_id, namespace)` + `site_setting_revision`, con `site_id` desde el día 1 y locking atómico. Reemplaza a P2'. |

### Decisión 7: el reparto de `site-manager`

El planteo del equipo fue: el template y los datos ya vienen de Tiendas, las
extensiones no se manejan desde el backoffice, y Configuración cae dentro de
Tiendas. **Correcto** — y la evidencia lo respalda más de lo que se planteó:

- Los namespaces `branding`/`content` están **superados** por `demo_store.theme` y
  `content_config` (13 campos vs 4), y **sus UIs ya fueron eliminadas**
  (`admin/routes/site-manager/settings/page.tsx:8-17` lo documenta).
- **`GET /store/site-config` tiene CERO llamadores.** El propio código lo llama
  *"write-only dead end"*.
- **`packages/site-manager/` tiene CERO importadores** y se copia igual a todos
  los proyectos generados (`pruneComponentPackages` no lo poda).
- Nadie la declara como `dependencies`: el grafo del catálogo queda limpio.

Pero adentro hay **cuatro responsabilidades**, y sólo dos son borrables:

| Qué | Destino | Por qué |
|---|---|---|
| UI "Sitio", namespaces `branding`/`content`/`project`, `GET /store/site-config`, `packages/site-manager/` | **Se borran** | Muertos o duplicados (ver arriba). |
| Tabla de settings + revisiones | **A `multistore`**, como `site_setting` | Es el host de config del plan. Nace con `site_id` y unique `(site_id, namespace)`. |
| Catálogo espejo, `project-metadata.ts`, change-requests contra la plataforma, `seed-operational.ts` | **A core**: `apps/backend/src/lib/platform/` + `src/scripts/` | **No son "Sitio": son infraestructura de plataforma.** Estaban ahí por historia. En core nadie las puede desinstalar y `sync-backend-mirror.js` sigue apuntando a una ruta viva. |
| `POST /commerce/apply` (moneda del Store + regiones) | **A Configuración** (`store-config`) | Es config de **instancia**: corre `updateStoresWorkflow` sobre el Store global de Medusa. Es la única UI de site-manager que sigue viva. |

**Ejecución en dos fases:**
- **Fase A (P7-A), ya**: borrar lo muerto y mudar la infra a core. Bajo riesgo,
  independiente de todo lo demás, da la señal.
- **Fase B (P7-B), después de P1**: mover la tabla a `multistore` y apagar el módulo.

### El orden no es negociable

> **`demo_store` NO existe en los proyectos de cliente. `site-manager` SÍ.**

El composer borra `modules/demo-store` de todo proyecto generado
(`component-definitions.js:392-393`, verificado por test en `index.test.js:69-70`).
"El template y los datos vienen de Tiendas" es cierto **en el boilerplate**; en el
repo de un cliente existe Sitio y **no existe Tiendas** — conviven sólo acá, con
dos ítems de sidebar peleando el mismo `rank: 5`.

Volar site-manager antes de P1 deja a todo proyecto de cliente **sin ningún
sistema de configuración**, y rompe el `db:seed` del bootstrap
(`seed-operational.ts` es un `managed_file` de site-manager).

### La decisión 2 borró el tier más caro

Con credenciales cifradas en DB, un provider de fulfillment lee las suyas **por
llamada** (tiene `order.sales_channel_id` en `createFulfillment`, y `pgConnection`
como ya hace `modules/email/service.ts:120-140`). Consecuencia:

- **No hacen falta N instancias de provider** registradas en `medusa-config.ts`.
- **No hay que migrar los `provider_id`** de las shipping options en producción.
- **Dar de alta una tienda con cuenta propia no requiere redeploy.**

Andreani y Correo Argentino bajan de ~15-30 d-p cada una a ~8-18.

---

## Correcciones al mapa inicial

Hallazgos de la investigación que contradicen supuestos habituales sobre el repo:

| Afirmación | Realidad verificada |
|---|---|
| `mercadopago` es de las más difíciles | **Falso, es de las fáciles.** `modules/mercado-pago/utils/accounts.ts:57-72` ya resuelve la cuenta **en runtime** desde el `data` de la sesión, por branch code → `salesChannelId` → global. Nunca estuvo atado al boot. |
| `store_setting` lo usan 12 extensiones | **~50 archivos** de `apps/backend/src` fuera de `modules/store-config`. Blast radius 4×. |
| `x-site-slug` ya existe como seam | **No llega al backend.** Lo emite `storefront/src/proxy.ts:23` y lo consume `lib/site-config/active-tenant.ts:35`, **dentro de Next**. Cero lectores en `apps/backend`. Es trabajo nuevo. |
| `media-library` es 100% env | **0 `process.env` propias.** Las 5 `S3_*` las consume el módulo File de `medusa-config.ts:491`. |
| `whatsapp` es 100% env | Parcial: `WHATSAPP_SALES_CHANNEL_ID`, bindings y botón flotante **ya migraron** a `store_setting`. |
| — | **Fuga de catálogo VIVA**: `storefront/src/lib/repositories/products.repository.ts:26-34` recibe `publishableKey` y **lo ignora en la key** (`cache[backendUrl]`, en `globalThis`). Y `lib/data/categories.ts:22` usa el `sdk` global con `force-cache`: todas las tiendas ven el mismo árbol. |
| — | **Los 41 manifiestos ya declaran `settings_namespace: "extension:<id>"`** y `modules/site-manager/service.ts:5-12` **ya valida ese namespace**. Es un slot reservado y sin usar. |
| — | `andreani/env-options.ts:50` dice literal *"Mirrors the contract-selection logic from the multi-tenant version, minus the DB credential lookup"*. **Existió un Andreani multi-tenant con lookup en DB** — buscarlo en el historial antes de reinventarlo. |
| — | **Semánticas opuestas de `NULL` conviviendo**: `sales_channel_ids` jsonb plural (`NULL` = *todos*) en banner/brand/blog_post/store_location/vimeo_video/shop_by_look/payment_benefit, vs `sales_channel_id` text singular (`NULL` = *global/fallback*) en `recurring_setting`. Mezclarlas produce **fail-open donde se quería fail-closed**. |
| — | **Bug vivo**: una tienda con `b2b_enabled` tiene DOS canales (`sales_channel_id` y `b2b_sales_channel_id`). `recurring-order/runtime-config.ts` filtra sólo por el primero → **el canal mayorista no matchea su propia config y cae al global en silencio.** |
| *(v1)* El optimistic locking de site-manager es una razón para elegirlo como host | **Falso, está roto.** `modules/site-manager/service.ts:27-36` hace el check de `expectedRevision` y la escritura **sin transacción y sin `WHERE revision = ?`**. Dos writers con el mismo `expectedRevision` pasan ambos; el perdedor choca contra el unique `(namespace, revision)` **después de haber pisado el valor**. Se reimplementa bien en el host nuevo. |
| *(v1)* `site_manager_setting` "ya está listo para multitienda" | **Falso.** Su unique es sólo `(namespace)` (`models/site-manager-setting.ts:9`); no tiene `site_id`. Había que migrarlo igual. |
| — | ~~**Bug vivo**: `api/admin/fiscal-documents/_helpers.ts:85` hace `req.scope.resolve('site-manager')` en kebab, pero el módulo se registra como `'siteManager'` (`medusa-config.ts:564`). Es el **único** `resolve` en kebab de todo `apps/backend/src`. Resultado: **la config fiscal está rota hoy** — la lectura siempre cae a defaults y el guardado siempre tira *"El módulo site-manager no está disponible"*.~~ **CERRADO por el merge de multitienda.** El `resolve` ya no es a `site-manager`: `_helpers.ts` resuelve `'demo_store'`, que es exactamente lo que vale `DEMO_STORE_MODULE` (`modules/demo-store/index.ts:4`), y la config fiscal se mudó a `site_setting` conservando el namespace `extension:fiscal-documentation`. No queda ningún `'site-manager'` en `apps/backend/src` fuera del docblock de `modules/module-keys.test.ts`, que lo cita como precedente. Ese mismo test es lo que ahora custodia el literal: tiene a `fiscal-documents/_helpers.ts` en los `seams` de `demo-store`, así que un renombre de la clave del módulo lo pone en rojo en vez de volver a degradar en silencio. |
| — | **Los IDs de template son dos espacios distintos sin mapeo**: el catálogo usa `grocery`, `demo_store.template_code` usa `supermercado` (default). Nadie los cruza. |
| — | El **toggle de extensiones** (namespace `extensions`) **no tiene equivalente** en `demo_store`: no hay columna, tabla ni endpoint que registre extensiones activas por tienda. |

---

## Fundaciones (P0-P7) — nada de esto es una extensión

### Dónde vive el seam

`apps/backend/src/lib/multistore/`. **No** puede ser un paquete de workspace:
`apps/backend/src/lib/shared/index.ts:1-9` documenta que el deploy de DigitalOcean
construye sólo `apps/backend` con buildpack de npm, que no entiende `workspace:*`
(`EUNSUPPORTEDPROTOCOL`) — por eso `packages/shared` está vendorizado ahí.

`src/lib/` **sobrevive al composer**: `resolve-ownership.js:70` sólo auto-descubre
`api|jobs|links|scripts|subscribers|workflows|admin`. Precedente vivo: payloads de
extensión ya importan `../../lib/shared` (`gift-cards/.../types.ts:1`) y
`../../lib/whatsapp/...` (`typesense/.../advisor.test.ts:9`).

```
apps/backend/src/lib/multistore/
  module-key.ts         # EL literal 'demo_store', único en el repo
  types.ts              # SiteRef, SiteHint, SiteResolution, SiteConfigResult
  resolve-site.ts       # vía container
  resolve-site-sql.ts   # vía knex — OBLIGATORIO, no opcional (ver abajo)
  request.ts            # middleware de hints + siteFromRequest(req) memoizado
  config.ts / config-sql.ts
  credentials.ts        # AES-256-GCM, patrón erp/crypto.ts
  seed.ts               # copy-at-creation + seed env→DB
```

**El gemelo SQL es obligatorio.** Los providers (fulfillment, payment, notification)
reciben un container **aislado** y no pueden `container.resolve('demo_store')`. Por
eso `kapso-whatsapp/service.ts:60-65` y `email/service.ts:120-126` ya leen por SQL
crudo con `ContainerRegistrationKeys.PG_CONNECTION`. Riesgo: el SQL puentea los
filtros de MikroORM (soft delete). Mitigación con el precedente que ya existe —
un test tipo `modules/demo-store/ddl-mirrors.test.ts`.

### Los prerequisitos

| Id | Trabajo | Esf. |
|---|---|---|
| **P0** | `resolveSite(container, hint)` + middleware de hints en `api/multistore-middlewares.ts`, registrado en `api/middlewares.ts` (CORE) — **no** en `extension-middlewares.ts`, que `apps/platform/src/github.js:112` mergea. El middleware **no hace I/O**: cuelga pistas de `req`; el lookup es perezoso y memoizado por request. Resolución: `siteId` → `slug` → `salesChannelId` (matcheando **ambas** columnas de canal, lo que arregla el bug B2B) → `orderId`/`cartId` → `is_main` sólo con `allowMainFallback`. Devuelve `registryAbsent` y `singleSite`, que es lo que hace que un proyecto mono-tienda no se rompa. | **M** (3-5 d) |
| **P1** | **Promover `demo-store` a extensión instalable**, partida en `multistore` (required) + `store-importer` (opcional). Borrar `'demo-creator'` de `component-definitions.js:394-406` **y la línea `index.js:174`** que lo re-borra dentro de `removeEmbeddedExtensionSources`. `medusa-config.ts` **no se toca**: `optionalModule()` chequea existencia de carpeta. Entrada en `catalog.json` + el espejo `lib/site-manager/catalog.json` + `admin/lib/extension-versions.ts`. **El ítem más subestimado del proyecto.** | **L/XL** (10-20 d) |
| **P2''** | **Host de config nuevo dentro del paquete `multistore`** — reemplaza al P2' de la v1, que modificaba `site_manager_setting`. Modelos `site_setting(site_id, namespace, value)` y `site_setting_revision`, agregados a `modules/demo-store/service.ts` (hoy es un `MedusaService({DemoStore, ImportJob})` de 9 líneas sin métodos custom). **Sale mejor que modificar la tabla vieja**: nace con `site_id` desde el día 1 sin migrar datos vivos, hereda `required: true` de `multistore`, y permite implementar el locking **atómico** que el original no tiene. El servicio de site-manager (103 líneas) es trasplantable por copy-paste; sólo cambian el prefijo de id, la regex de `validateNamespace` y el filtro por `site_id`. Dos índices únicos parciales (ver gotcha). `store_setting` **no se toca**: se lee como paso 3 de la cadena (`legacyStoreSettingKey`), así que los ~50 archivos siguen andando hasta que cada extensión migre en su propio bump. | **M/L** (5-8 d) |
| **P3** | Credenciales cifradas por site: tabla `site_credential` (o campo en `site_manager_setting`), AES-256-GCM calcado de `modules/erp/crypto.ts` con KEK derivada de `JWT_SECRET` vía scrypt. `readSiteCredentials(integration, siteId)` en las dos variantes (container y SQL). | **M** (4-6 d) |
| **P4** | El storefront propaga el site: `lib/config.ts` inyecta `x-site-slug` en el SDK del tenant. **Y arregla las dos fugas vivas**: `products.repository.ts:26` (key sin `publishableKey`) y `categories.ts:22` (sdk global). Respetar `cache-directives.test.ts`. | **S/M** (3 d) |
| **P5** | `getSiteConfig` con retorno de **unión discriminada** (`{status:'configured'} \| {status:'not_configured'}`), no un objeto con un booleano. Es lo que obliga a cada call site a manejar "no configurada" en vez de llamar a la API con el contrato en `''`. Modos de herencia por extensión: `fail-closed` \| `inherit-global` \| `inherit-global-for-main`. | **S** (2 d) |
| **P6** | Ritual de bump por extensión: `catalog.json` + `extension-versions.ts` + espejo + re-correr `extract-components.js` + `verify-components.js`. **Overhead fijo × 38.** | **XS** (0.25 d c/u) |
| **P7-A** | **Desmantelar `site-manager`, fase A** — independiente de todo lo demás, se puede arrancar hoy. Borrar la UI `admin/routes/site-manager/`, los namespaces `branding`/`content`/`project`, `api/store/site-config/` y `packages/site-manager/`. Mudar a core: `lib/site-manager/{catalog.json,project-metadata.ts}` → `lib/platform/`, los change-requests → `lib/platform/change-requests.ts`, y `seed-operational.ts` sale del `files[]` del manifiesto para quedar como script core. Actualizar `sync-backend-mirror.js:11`, `validate.js:15` y `.github/workflows/validate-catalog.yml:8,59` a la ruta nueva. Mover `commerce/plan|apply` + `CommerceEditor` a `store-config`. **Arreglar de paso el bug kebab/camelCase de fiscal-documents.** | **M** (4-6 d) |
| **P7-B** | **Fase B, después de P1**: migrar los datos de `site_manager_setting` (sólo `extension:fiscal-documentation` tiene contenido real) a `site_setting`, borrar el módulo, sacar la entrada del catálogo y del espejo, y actualizar los 4 tests que la asumen (`project-catalog/src/index.test.js:14`; `project-composer/src/index.test.js:59,65,67` — este último tiene el **conteo exacto de 24 paquetes** hardcodeado). | **S** (2-3 d) |

### Guardarraíl del literal

`module-key.ts` exporta el **único** `SITE_REGISTRY_MODULE = 'demo_store'` del repo.
`modules/module-keys.test.ts` se **reescribe, no se borra** (su premisa actual —
"el composer borra demo-store" — cae con P1), y queda más fuerte: además de cruzar
el literal contra la constante real y `medusa-config.ts`, **prohíbe que el literal
`'demo_store'` aparezca en cualquier archivo bajo `packages/extensions/*/payload/`**.

Los 3 seams actuales (`recurring-order/toggle.ts:23`, `api/store/b2b/pricing-region.ts:16`,
`store-config/site-gate.ts:88`) se reescriben para consumir el seam.

---

## Ranking — 40 extensiones, de más fácil a más difícil

**Criterio.** Siete ejes, pero uno domina: **el punto de acople** (dónde se puede
resolver el site). `0` = request con canal presente · `1` = request sin canal ·
`2` = job/subscriber (sin request) · `3` = provider aislado. El tier lo fija ese
eje; el orden dentro del tier lo fija config + superficie + storefront.

Por eso `delivery` (27k LOC, 12 modelos) es más fácil que `email-templates`
(1 tabla): cuando se manda un mail no hay request.

### Tier −1 · Referencia (1)

| Ext | Por qué | Qué cambiar | Esf. |
|---|---|---|---|
| **recurring-orders** | Es el patrón: `recurring_setting` nullable + merge canal→global→env en `runtime-config.ts:48`. | Re-key `sales_channel_id` → `site_id`. **Arregla el bug B2B de paso.** | **S** (1-2 d) |

### Tier 0 · No deberían ser multitienda de config (3)

| Ext | Argumento | Qué SÍ hacer | Esf. |
|---|---|---|---|
| **database-explorer** | Navega la DB entera, que es compartida por diseño. Una "vista por tienda" sería mentira: las tablas core de Medusa no tienen `site_id`. | Guard de RBAC + banner "esto ve todas las tiendas". | **XS** |
| **commerce-dashboard** | Sin config, sin env. Lo que se quiere no es config por tienda: son números filtrados. | Selector de tienda + `site_id` en 5 queries. | **S** (2 d) |
| **media-library** | El bucket es uno y vive en el módulo File de la plataforma, no en la extensión. Credenciales S3 por tienda = N File providers al boot, para cero beneficio. | Prefijo de carpeta por site + `site_id` en `media_asset`. **No** tocar credenciales. | **S/M** (3 d) |

### Tier 1 · Trivial — salen gratis con P2'' (6)

| Ext | Qué cambiar | Dep | Esf. |
|---|---|---|---|
| **pdf-catalog** | Sólo la lectura de `pdf_catalog_enabled` en `api/store/pdf-catalog/active/route.ts`. Cero migraciones. | P2'' | **XS** |
| **shop-by-looks** | Idem, `shop_by_look_enabled`. Ya scopea data. | P2'' | **XS** |
| **fiscal-documentation** | Su config **ya vive en `site_manager_setting`**. Sólo `site_id` en `fiscal_document`. | P2'' | **XS** |
| **recommendation-widgets** | 0 modelos, 0 env. Propagar el site a `/store/recommendations`. | P4 | **XS** |
| **wishlist** | **Decisión de producto primero**: ¿un cliente en 2 tiendas ve 1 wishlist o 2? Si son 2: `site_id` + filtro + backfill. | P0 | **S** |
| **loyalty-points** | Misma decisión (¿puntos compartidos?). La política la fija loyalty-engine. | P0 | **S** |

### Tier 2 · Fácil (8)

| Ext | Qué cambiar | Dep | Esf. |
|---|---|---|---|
| **brands** | Ya scopea por `sales_channel_ids`. Sólo consumir P0 en vez del query param. | P0 | **XS/S** |
| **comments** | `comment_settings`: `site_id` + índice parcial + merge. Selector en el admin. | P0 | **S** |
| **blog** | `blog_post.sales_channel_ids` **ya existe**; falta sólo la config (`blog_settings`). 5 admin pages. | P0 | **S/M** |
| **contact** | `site_id` en `contact_submission`. El destinatario, config por site. | #email | **S** |
| **checkout-links** | `site_id` + **resolver la base URL desde el site** (slug → host/`canonical_form`). Si no, el link manda a la tienda equivocada. | P0, P1 | **S** |
| **dynamic-groups** | El job de recálculo itera sites. Sin esto, una regla de la tienda A mete clientes de la B en su grupo. | P0 | **S/M** |
| **payment-benefits** | Token de MP por site (comparte resolver con mercadopago). Config no-secreta a DB. | P3 | **S/M** |
| **videos** | Ya scopea data. La cuenta de Vimeo es global: token OAuth por site. Si se acepta cuenta única, baja a XS. | P0, P3 | **S/M** |

### Tier 3 · Media (14)

| Ext | Qué cambiar | Dep | Esf. |
|---|---|---|---|
| **store-config** | **Es P2'' mismo**, no un ítem aparte. Además unificar el password gate: el de la principal vive en `store_setting`, el de las demos en columnas de `demo_store`. | P0 | **M/L** |
| **banners** | Ya estricto por canal. Sólo `ai_config` por site en `api/admin/banners/ai-*`. | P2'' | **S** |
| **store-locations** | Las 2 keys de cobertura a por-site; Maps key global. **Bloquea delivery.** | P2'', P3 | **M** |
| **ga4** | `site_id` + merge. **Trampa**: `NEXT_PUBLIC_GA_MEASUREMENT_ID`/`GTM_ID` son **build-time en Next** — tienen que salir por tenant config. | P0, P4 | **M** |
| **landing-pages** | `ai_config` por site + `site_id` en `landing_page` (hoy no scopea). | P2'', P3 | **M** |
| **catalogador** | Split: modelos/prompts/template → DB por site. API keys → env global (decisión 2). El job itera sites. | P2'' | **M** |
| **mercadopago** | **Ya resuelve en runtime.** Agregar site a las keys; lo no-secreto a DB. **Trampa**: son **dos** providers (`mercado-pago` y `mercado-pago-api`) que comparten credenciales — tocar los dos o media checkout queda en la cuenta equivocada. | P3 | **M** |
| **recommendation-engine** | Config por site; los 4 jobs iteran sites o las relaciones se cruzan entre tiendas. | P2'' | **M/L** |
| **abandoned-cart** | El job resuelve site por `cart.sales_channel_id`. La URL de recuperación desde el site. | P0, P1, #email | **M** |
| **loyalty-engine** | `site_id` en `loyalty_program` **y cambiar el `{take:1}`**. Reglas/niveles/campañas heredan el scope. 9 admin pages. | P0 | **M/L** |
| **b2b** | Ya bastante multitienda (`demo_store` tiene `b2b_*`, y `pricing-region.ts` ya es seam). Config B2B a DB por site. | P0, P1 | **M/L** |
| **corporate** | Las 6 env → config por site. Template de invitación por site. | #b2b, #email | **M** |
| **gift-cards** | `(singleton_key, site_id)` unique. **Trampa**: el índice es parcial (`where deleted_at is null`); con filas soft-deleted la migración puede fallar en prod y no en dev. | P0, #email | **M** |
| **erp** | `unique(provider, site_id)` — el comentario del modelo dice que el unique *"deja lugar a multi-config futura sin migrar"*. **Excepción a documentar**: `credentials_enc` ya está cifrado en DB; no lo muevas a env o alguien lo "corrige". La data tintométrica es **de la instancia**, no del site. | P0 | **L** |

### Tier 4 · Difícil (8)

| Ext | Por qué sigue siendo difícil | Esf. |
|---|---|---|
| **andreani** | Ya no necesita N providers (decisión 2). Sí necesita: tabla de config por site (origen, remitente, contrato, dimensiones), credenciales cifradas, y que `get-client.ts` / `label-download.ts` / el workflow de tickets / el job de tracking reconstruyan el cliente por site. **Buscar primero la versión multi-tenant que existió** (`env-options.ts:50`). | **L** (8-12 d) |
| **correo-argentino** | Todo lo de andreani **más**: 34 env distintas, **0 migraciones — hay que crear el módulo de datos desde cero**, y `SEED_SHIPPING_OPTIONS` siembra opciones desde env, que es justo el mecanismo a multiplicar. | **L/XL** (12-18 d) |
| **email-templates** | **La credencial en DB no lo arregla.** El problema es que **no hay request cuando se manda un mail**: el `site_id` tiene que **viajar en el `data` de la notificación desde decenas de emisores** (order, gift-cards, b2b, corporate, abandoned-cart, recurring). Además el branding se cachea en memoria del proceso (`BRANDING_TTL_MS`) — hay que keyear por site. Y `EMAIL_FROM` por tienda exige **un sender verificado en SendGrid por tienda**: trabajo fuera del código. | **L** (10-15 d) |
| **whatsapp** | Reescribir el constructor para que no capture `api_key` y resuelva por llamada. **Trampa mayor**: el modelo actual es **1 número → N canales**, con el primero como principal (`bot-channels.ts:11-17`). Hacerlo 1 número por tienda es **invertir** la feature, no extenderla. Y sin credenciales el provider cae a "modo log" en vez de fallar, sin `validateOptions` **a propósito** — choca de frente con fail-closed. | **L** (10-15 d) |
| **typesense** | **Bifurcación a decidir primero.** (a) una colección por site → reindex por site, 7 subscribers reenrutados = **XL**. (b) una colección con filtro obligatorio → **el schema ya tiene `sales_channels.id` facetado e indexado** (`schema.ts:154`), así que es agregar el filtro en search y en el cliente = **L**. **Recomendación: (b)**, 3× más barato y no rompe el reindex. Las 6 `NEXT_PUBLIC_TYPESENSE_*` son build-time. | **L** (12-16 d) |
| **delivery** | **La más grande del catálogo**: 12 modelos, 14 migraciones, 10 admin pages, 14 workflows, 27k LOC. Casi no tiene config — es volumen puro de scoping. Backfill de 12 tablas. | **L/XL** (15-25 d) |
| **seo-geo** | El SEO es **inherentemente por dominio**: el host sale de la fila del site, no de `NEXT_PUBLIC_BASE_URL`. `site_id` en las 8 tablas o las auditorías de una tienda contaminan a otra. 3 jobs iteran sites. | **L** (12-18 d) |
| **ai-assistant** | 19 modelos, 18 migraciones, 25.5k LOC. **Lo caro es semántico**: la memoria del agente y las skills son *conocimiento de la tienda* — un agente que recuerda cosas de la tienda A y responde en la B es una fuga de datos. El MCP OAuth por site es decisión aparte. | **L/XL** (15-25 d) |
| ~~**site-manager**~~ | **Ya no se migra: SE ELIMINA** (decisión 7). Sale del ranking — su trabajo pasó a P7-A y P7-B. Quedan **40** extensiones a clasificar. *(Nota que sigue valiendo para el reparto: `MERCATTO_PROJECT_SECRET`/`PROJECT_ID` son de la **instancia**, no del site — por eso los change-requests van a core y no a `multistore`.)* | — |

---

## Camino crítico y olas

```
P1 sites instalable (L/XL) ──┐
P4 storefront manda header ──┼──► P0 resolveSite ──┬──► P2'' config por site ──► 12 extensiones
                             │                     ├──► P3 credenciales cifradas ──► carriers, pagos
                             │                     └──► P5 fail-closed
                             │
   #store-locations ──► #delivery
   #email-templates ──► contact, abandoned-cart, corporate, gift-cards, b2b
```

**Crítico:** `P1 → P0 → P3 → delivery → correo-argentino` ≈ **55-66 d-p en serie**.
Paralelizando delivery y correo en equipos distintos, ≈ **46 d-p**.

| Ola | Contenido | d-p |
|---|---|---|
| **A** | **P7-A: desmantelar site-manager (fase A).** No depende de nada — se puede arrancar hoy, en paralelo con la ola 0. Incluye el fix del bug kebab/camelCase de fiscal-documents. | ~4-6 |
| **0** | Fundaciones: P1, P0, P4, P2'', P3, P5, P6 → y **P7-B** al cerrar P1 | ~38-53 |
| **1** | Los 6 de Tier 1 + brands, comments, blog. **Da la demo de "multitienda funciona" con esfuerzo mínimo.** | ~10 |
| **2** | store-locations, ga4, landing-pages, catalogador, mercadopago, payment-benefits, videos, checkout-links, dynamic-groups, banners | ~35 |
| **3** | email-templates → contact, abandoned-cart, corporate, gift-cards. En paralelo: recommendation-engine, loyalty-engine, b2b, erp | ~55 |
| **4** | delivery, typesense, seo-geo, ai-assistant, whatsapp, andreani, correo-argentino | ~75-110 |

**Olas 0+1+2 (~80 d-p) cubren 23 de 40** y dejan afuera exactamente las que dependen
de providers aislados.

---

## Trampas que un implementador no vería

| Dónde | Trampa |
|---|---|
| `recurring-order/toggle.ts:32` | El guard `!demo.is_main`. La fila principal **tiene** el canal por defecto del store, y el default de la columna es `false`. Sin el guard, la sola existencia de la fila principal **apaga la feature del sitio principal sin un error en logs**. Todo el que copie el patrón hereda la trampa. |
| `module-keys.test.ts:49-54` | El catch de `site-gate.ts` **devuelve `null`**: un literal desalineado **apaga el password gate de todas las tiendas, en silencio**. |
| comparar `banner.ts` vs `recurring-setting.ts` | `sales_channel_ids` jsonb plural: `NULL` = **todos**. `sales_channel_id` text singular: `NULL` = **global**. Semánticas **opuestas**. Mezclarlas produce **fail-open** donde se quería fail-closed. |
| `ga4/service.ts:54-65` | `getSettings()` **siembra desde env en el primer acceso**. Con `site_id`, el primer site que consulte se lleva la config global y los demás quedan vacíos. Sembrar explícito por site o desactivar la siembra. |
| `loyalty/service.ts` | `loyalty_program` es singleton **por convención** (`{take:1}`) — gana el último creado. Agregar `site_id` sin tocar el `take:1` hace que el programa de una tienda cualquiera aplique a todas. |
| `main-store.ts:25-40` | El `slug` es la clave del host y de la cookie. Si algo se keyea por slug, **renombrar rompe en silencio** — usar `site_id` (`demo_...`), que es inmutable. `MAIN_STORE_ID = 'demo_main'` es fijo y su theme está copiado literal de `storefront/.../default.ts` con un test que lo hace cumplir: toda config nueva tiene que sembrar la principal. |
| `verify-components.js:31-40` | Valida sha256 con normalización de EOL, **el orden de `managed_files`** (agregar una entrada a mano al final del grupo lo rompe) y que toda migración del payload esté en `migrations[]`. |
| `project-composer/src/index.js:174` | Borrar `'demo-creator'` de `component-definitions.js` **no alcanza**: esta línea lo re-borra dentro de `removeEmbeddedExtensionSources`. Si queda, el payload se instala y se borra un instante después, en el mismo run. |
| `resolve-ownership.js:55` | Los paths de `apps/storefront` **nunca se auto-descubren**, y `assertRelativeImportsResolve` sólo valida `apps/backend/src/admin`. Un path de storefront faltante en `files[]` da un proyecto que compila el backend y **falla recién en `next build`**. |
| jobs fan-out | Un job con fail-closed se vuelve **silenciosamente inerte** para las tiendas sin configurar. Loguear una línea por tienda salteada con el motivo, o el síntoma es "las renovaciones de la tienda Norte dejaron de correr" sin un solo error. |
| orden de fases | **No se puede prender fail-closed para una extensión antes de que exista la UI para configurarla por tienda.** Requisito de orden, no sugerencia. |
| `provision.ts:340-346` | Linkea cada canal nuevo a **TODAS** las publishable keys. Con multitienda real, la key de la tienda Norte puede leer el catálogo de la Sur. Fuera de alcance, pero el agujero se agranda al volverlo producto. |
| `seed-operational.ts` | Es un `managed_file` de `site-manager` **y** el `db:seed` de los proyectos generados, invocado por `setup-medusa.js` durante el bootstrap. Borrar la extensión sin reubicarlo **rompe la creación de proyectos nuevos**. Además tiene hardcodeado `extensions: ['site-manager']` como fallback (`:31`). |
| `lib/site-manager/catalog.json` | El espejo del catálogo vive **dentro del payload de site-manager**, y es la única forma que tiene un backend en producción de saber qué tiene instalado (`packages/project-catalog` no existe en prod). `sync-backend-mirror.js:11` y `validate.js:15` apuntan ahí, y CI lo valida en un check **bloqueante** (`validate-catalog.yml:59`). Mover el archivo sin actualizar los tres rompe el merge de cualquier PR. |
| `project-catalog/src/index.js:65-67` | Las `required` se siembran **directo en el Set**, sin pasar por `add()` — así que **sus dependencias transitivas NO se resuelven**. Hoy no molesta porque site-manager tiene `dependencies: []`. Si `multistore` nace required **y con dependencias**, se rompe en silencio. |
| tests de composición | `project-composer/src/index.test.js:65` tiene el **conteo exacto** de paquetes de extensión (24) hardcodeado, y `:59,67` asertan que `site-manager` esté presente. `project-catalog/src/index.test.js:14` también. Los cuatro rompen en P7-B. |

---

## Verificación

**Fundaciones (P0-P5)**
- Unit: `resolveSite` con las 6 rutas de resolución, incluyendo **el caso B2B** (canal mayorista → su propia tienda, no el global) y `registryAbsent`/`singleSite`.
- Unit: `getSiteConfig` en los 3 modos de herencia — que `fail-closed` en tienda no-principal devuelva `not_configured` y que `is_main` caiga al global.
- Paridad: el mismo caso resuelto por container y por SQL da idéntico resultado.
- Drift: test tipo `ddl-mirrors.test.ts` cruzando las columnas del SQL crudo contra `models/demo-store.ts`.
- `module-keys.test.ts` reescrito: cero ocurrencias del literal bajo `packages/extensions/*/payload/`.

**Aislamiento end-to-end** (el que realmente importa)
1. Levantar con `pnpm dev` (docker + backend + storefront).
2. Crear dos tiendas desde `/app/sites`. Verificar que **cada una nace con sus filas copiadas** de la global (decisión 3).
3. Cambiar la config de una extensión en la tienda A. **Confirmar que la B no cambió** y que la edición quedó en `site_setting_revision`.
4. Cargar credenciales distintas de un carrier en cada tienda y verificar que cada checkout cotiza con la suya.
5. **Prueba de fuga**: pedir el mismo producto desde las dos tiendas y confirmar que no se sirve el catálogo cruzado — esto valida el fix de `products.repository.ts` (fuga viva hoy).
6. Borrar la config de una extensión en la tienda B y confirmar que **no opera** ahí y **sí sigue operando** en la principal.

**Desmantelamiento de site-manager (P7)**
- Tras P7-A: `pnpm site:catalog:validate` en verde con el espejo en su ruta nueva
  (`sync-backend-mirror.js`, `validate.js` y el workflow de CI actualizados a la vez).
- Tras P7-A: componer un proyecto con `pnpm site:create` y correr su `db:seed` —
  es lo único que atrapa que `seed-operational.ts` quedó bien reubicado.
- Tras P7-A: guardar y leer la config fiscal desde el admin (hoy está rota).
- Tras P7-B: los 4 tests que asumen `site-manager` actualizados, incluido el
  conteo exacto de paquetes de `project-composer/src/index.test.js:65`.

**Regresión**
- `pnpm typecheck` y `pnpm test` (~2018 tests) en verde.
- `pnpm site:catalog:validate` + `pnpm site:components:verify` + `backend:lock:verify`.
- `cache-directives.test.ts` en verde tras P4.
- Componer un proyecto de cliente con `pnpm site:create` y correr `next build`: es lo único que atrapa un path de storefront faltante en `files[]`.

---

## Fuera de alcance (decisión 6)

Los proyectos de cliente ya desplegados no se migran automáticamente. El código y
las migraciones quedan listos; `apps/platform` puede abrir el PR por cliente y a
demanda. Ojo: verifica sha256 de `managed_files` y **aborta si el cliente customizó
el archivo**.

---

## Preguntas abiertas para el equipo

0. **El toggle de extensiones por tienda.** Al eliminar site-manager desaparece el
   namespace `extensions`, y `demo_store` **no tiene equivalente**: no hay forma de
   decir "esta extensión está activa en la tienda A y no en la B". Hoy eso no se usa
   (el toggle actual es un write-only dead end), pero conviene decidirlo explícito:
   ¿las extensiones se activan por proyecto y punto, o alguna vez van a activarse
   por tienda? La respuesta cambia el diseño de `site_setting`.
1. **`wishlist` y `loyalty-points`**: ¿un cliente que compra en dos tiendas ve una
   wishlist o dos? ¿Sus puntos son compartidos o separados? Es decisión de
   producto y bloquea a ambas.
2. **`typesense`**: colección por tienda vs. colección única con filtro obligatorio.
   La recomendación es la segunda (3× más barata, el schema ya lo soporta), pero
   si cada tienda necesita sinónimos y curaciones propias, la primera se justifica.
3. **`videos`**: ¿se acepta una cuenta única de Vimeo para todas las tiendas? Si sí,
   la extensión baja de S/M a XS.
4. **`email-templates`**: `EMAIL_FROM` por tienda exige un sender verificado en
   SendGrid **por tienda**. ¿Quién lo opera y cuánto tarda?
5. **Orden de las olas 3 y 4**: están dimensionadas pero no priorizadas entre sí.
   ¿Qué duele más hoy en la operación?
