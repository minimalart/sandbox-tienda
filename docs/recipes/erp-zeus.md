# ERP — Zeus ERP (Argentina)

Integración de la extensión ERP con **Zeus ERP** vía su API Ecommerce
(`https://api.zeuserp.tech/api-ecommerce`, Swagger:
`https://api.zeuserp.tech/api-ecommerce/swagger-ui.html`). Tres flujos:

- **Stock Zeus → Medusa**: pull por SKU (cron horario o manual desde el admin).
- **Catálogo Zeus → Medusa**: productos y listas de precios por delta
  incremental (cron cada 15 min, `ERP_CATALOG_SYNC_CRON`). **Zeus no tiene
  webhooks** — no hay ningún endpoint de callback/suscripción en toda su API —
  así que el único mecanismo posible es polling con `fechasincro`.
- **Venta Medusa → Zeus**: se inserta un **pedido de venta** (`POST /pedidos`)
  vía outbox idempotente. El trigger es configurable: **pago capturado**
  (default) o **fulfillment creado desde el admin** (ver "Facturar al
  despachar").
- **Comprobante Zeus → Medusa**: Zeus factura internamente y a su ritmo, así que
  el comprobante se recupera por **polling** (`GET /pedidos/pedidoFacturado`) y
  el PDF con `GET /imprimirComprobante`.

## Requisitos

- **Credencial `jwt_token`**: el JWT que Zeus entrega por cuenta para la API
  Ecommerce (no hay endpoint de login; lo provee Zeus/soporte al habilitar la
  integración). Se carga write-only en ERP → Configuración.
- **SKUs alineados**: el SKU de cada variante en Medusa debe ser el `codigo`
  del artículo en Zeus (matching exacto, sin normalización de mayúsculas).
- Los pedidos exigen código de artículo por línea: un ítem sin SKU manda el
  evento a `dead_letter` con mensaje claro.

## Encontrar los códigos de la cuenta

Con el JWT, los catálogos salen de la propia API:

```bash
BASE=https://api.zeuserp.tech/api-ecommerce
AUTH="Authorization: Bearer $ZEUS_JWT"

# OJO: /health-check/api-zeus devuelve 400 "URI is not absolute" aunque el JWT
# sea válido (bug del server). Para probar la conexión usar /empresas.
curl -s "$BASE/empresas" -H "$AUTH"                   # empresas del JWT (probe de conexión)
curl -s "$BASE/sucursales" -H "$AUTH"                 # codigo_de_sucursal
curl -s "$BASE/depositos" -H "$AUTH"                  # codigo_de_deposito
curl -s "$BASE/condiciones-ventas" -H "$AUTH"         # codigo_condicion_de_venta
curl -s "$BASE/categorias-iva" -H "$AUTH"             # codigo_iva (clientes nuevos)
curl -s "$BASE/tarjetas" -H "$AUTH"                   # codigo de tarjeta
curl -s "$BASE/vendedores" -H "$AUTH"                 # codigo_de_vendedor
curl -s "$BASE/clientes/search?email=x@y.com" -H "$AUTH"  # código del cliente genérico

# Comprobante de un pedido ya insertado (idtransac de la respuesta de /pedidos):
curl -s "$BASE/pedidos/pedidoFacturado?id_Transaccion=<idtransac>&Sucursal=<suc>" -H "$AUTH"
# PDF del comprobante (binario):
curl -s "$BASE/imprimirComprobante?idtransac=<idtransac>&sucursal=<suc>&tipoComprobante=<tipo>" \
  -H "$AUTH" -o comprobante.pdf
```

## Configuración en el admin (ERP → Configuración)

1. Provider **Zeus ERP (Argentina)**, país **AR**.
2. Credencial `jwt_token` = el JWT de Zeus. **Validar conexión** (pega a
   `/empresas` e informa a qué empresas da acceso el token).
3. Settings de Zeus:
   - `Identificador del ecommerce`: valor del parámetro `ecommerce` que Zeus
     asigna a la integración (viaja en `/pedidos` y `/clientes`).
   - `Sucursal`, `Depósito`, `Punto de venta`, `Lista de precios`,
     `Condición de venta`, `Tipo de comprobante`, `Código de vendedor`: según
     la cuenta (curls de arriba). El depósito además acota el stock sync.
   - `Código de cliente por defecto`: cliente genérico "Consumidor Final"
     creado en Zeus, usado cuando la orden no trae documento fiscal.
   - `Categoría de IVA para clientes nuevos`: default 5 (Consumidor Final);
     confirmar contra `/categorias-iva`.
   - `Código de artículo de envío`: artículo "ENVIO" en Zeus para facturar el
     envío como línea; vacío → el costo va en observaciones.
   - `Tipo de pago` (+ `Código de tarjeta` si aplica): con esto el pedido se
     inserta con `medios_pago`; vacío → sin pagos.
   - Switches: crear clientes faltantes (default sí), solo artículos eshop
     (default no), stock disponible = stock − comprometido (default sí),
     precios con IVA (default sí). La alícuota real se toma **por artículo**
     desde `variant.metadata.zeus_por_iva` (que deja el catalog sync) y solo se
     cae al `tax_rate` global si ese dato falta.
4. Sección **Catálogo y precios** (ver "Puesta en marcha del catalog sync").
5. Encender la integración y las llaves de stock/catálogo/ventas.

## Comportamiento real de la API (medido, no documentado en el Swagger)

Verificado contra una cuenta productiva. Varios de estos puntos contradicen lo
que uno asumiría leyendo el spec, así que conviene tenerlos presentes antes de
tocar el adapter:

| Qué | Cómo es en realidad |
|---|---|
| Paginación | `page` es **1-based** y el tamaño de página es fijo en **1000**. **`page=0` devuelve el catálogo completo** en una sola respuesta (~3400 artículos, ~8 MB, 5 s). |
| Delta | `fechasincro` **funciona** y filtra por `fechahoramodife`. Acepta `AAAA-MM-DD hh:mm:ss`. |
| Zona horaria | Los timestamps vienen en **hora local del server (UTC-3) sin offset**. No hay que reinterpretarlos con `new Date()`: correría el watermark varias horas. |
| `eshop=true` | **Se ignora.** La respuesta es byte-idéntica con y sin el parámetro. El filtro de publicables se hace en código sobre `activo` + `publica_en_ecommerce`. |
| Flags de publicación | Llegan como **string** (`"1"`/`"0"`), no como boolean. `activo` llega como número. |
| **Precios** | `/articulos` y `/articulos/precios` devuelven el **precio FINAL**: con IVA incluido y ya convertido a la moneda de la empresa. Contrastado contra `/articulos/search`, que devuelve el neto en la moneda del artículo — el ratio es exactamente `1 + por_iva/100`. |
| Alícuota de IVA | **No es uniforme.** Es por artículo (`por_iva`): en la cuenta medida, 3428 artículos al 21% y 10 al 10.5%. |
| Moneda | Algunos artículos tienen el costo en USD (`codMon`), pero `/articulos` ya aplica el tipo de cambio. No hay que convertir nada. |
| `ival0..9` | **Constante 0 en todo el catálogo.** No sirve para deducir si un precio lleva IVA. |
| `/health-check/api-zeus` | Responde **400 `"URI is not absolute"`** incluso con un JWT válido (bug del server). Por eso la validación de credenciales usa `GET /empresas`. |
| JWT | HS512 con claims `{userId, projectId}` y **sin `exp`**: no expira. |
| **Facturación** | **Asincrónica.** `POST /pedidos` devuelve `idtransac` al instante, pero el comprobante puede no existir hasta horas después (Zeus factura por lote). Recuperarlo es polling, no una llamada sincrónica. |
| `pedidoFacturado` | `GET /pedidos/pedidoFacturado?id_Transaccion=&Sucursal=` → `CpediVtaComprobantePrincipalDTO[]` con `isFacturado`, `numeroComp`, `tipoComp`, `sucursal`, `puntoDeVenta`, `letra`, `fecha`, `total` y `comprobanteResultado[]` (documentos derivados del pedido). `isFacturado` llega como **string**, igual que los flags de publicación: se interpreta con `isTruthyFlag`, no con `Boolean()` (`Boolean("0")` es `true`). |
| `imprimirComprobante` | `GET /imprimirComprobante?idtransac=&sucursal=&tipoComprobante=` → **binario** `application/pdf`. Igual que las imágenes, el `Content-Type` NO es confiable (cuando el comprobante no está, contesta 200 con cuerpo vacío o JSON): se decide por **magic bytes** (`%PDF`). |
| No hay búsqueda por número | No existe endpoint para buscar comprobantes por número de comprobante ni por `id_ecommerce`. La única llave es `idtransac` + `sucursal`, así que **hay que guardar el `idtransac` de la venta** o el comprobante no se puede recuperar nunca más por API. |
| Comprobante: el atajo que NO se toma | `imprimirComprobante` también acepta `?key=<jwt>`. **No se usa**, por lo mismo que las imágenes: ese token lee el catálogo, crea clientes y crea pedidos. La descarga va por proxy autenticado del backend, y en la tienda sólo la puede pedir el dueño de la orden. |
| Categorías | **`GET /articulos/categorias` existe aunque no esté en el Swagger** y devuelve el árbol COMPLETO con nombres (`{id, nombre, foto, categorias_hijas[]}`). `id` es jerárquico por prefijo de 2 caracteres (`01` → `0101` → `010101`) y hex-ish (después de `09` va `0A`). El catálogo mezcla mayúsculas y minúsculas para el mismo código (`0A` y `0a`), así que hay que normalizar. `/categorias`, `/familias` y `/rubros` dan 404. |
| Familia vs categoría | `articulo.familia` es texto libre y **ortogonal** al árbol: una familia cruza varias categorías y viceversa (en la cuenta medida, "PINTURA HOGAR Y OBRA" toca 13 categorías). No sirve como jerarquía. |
| Imágenes | `GET /articulos/imagen?codigo=<codigo>&prioridad=` devuelve el **binario** y **exige el Bearer** (sin auth da 500) → no es hotlinkeable desde el storefront. `prioridad` vacío = imagen principal. Cuando el artículo no tiene foto contesta 200 con cuerpo vacío o un JSON, así que el `Content-Type` no sirve: hay que decidir por **magic bytes**. Cobertura medida: 1669 imágenes / 213,8 MB / 65,7% del catálogo (878 artículos no tienen ninguna). |
| Imágenes: el atajo que NO se toma | `?key=<jwt>` también autentica, o sea que se podrían linkear directo y ahorrar la transferencia. **No se hace**: ese token lee el catálogo, crea clientes y crea pedidos, y una URL de storefront es pública. El camino sano sería pedirle a Zeus una API key restringida a imágenes. |

## Semántica

- **Stock**: pocos SKUs van por `GET /articulos/getbyID?codigos_articulos=`;
  el catálogo completo por barrido paginado. Con `eshop_only` el barrido usa
  `GET /articulos` (que sí trae los flags de publicación) en lugar de
  `GET /articulos/stock`, y filtra en código. Disponible =
  `stock − comprometido` (configurable); con depósito configurado se usa el
  desglose `stock_por_deposito` de ese depósito. La normalización final
  (negativos → 0, fraccionales → piso) la hace el sync, con log por SKU.
- **Catálogo (productos + listas de precios)**: una sola llamada a
  `GET /articulos?fechasincro=&page=0` trae producto, `precio0..9`, stock y
  `fechahoramodife`. No se usa `/articulos/precios`: `/articulos` ya lo incluye
  y además trae el timestamp que sirve de watermark.
  - El **watermark** es el máximo `fechahoramodife` de la corrida (valor del
    servidor), menos `overlap_minutes` de margen. Se guarda en
    `settings.catalog_sync.last_synced_at`.
  - Zeus **no informa bajas**, así que hay un **barrido completo diario**
    (`full_sweep_hour`, default 4 AM) sin `fechasincro`. Es **uno** por día: la
    marca `last_full_sweep_at` lo garantiza. Antes la condición era solo "la hora
    coincide", y con el cron cada 15 minutos eso daba cuatro barridos completos
    por noche. Borrar esa marca a mano fuerza un barrido en el próximo tick.
  - **Qué hace el barrido** se configura con `full_sweep`: `images` (default
    `false`) y `price_lists` (default `true`) — ver `sync/full-sweep-scope.ts`.
    Apagar `price_lists` abarata mucho la corrida cuando hay varias listas
    mapeadas (leer todos los precios de cada price list y escribir los que
    difieren es la parte pesada), pero OJO: el barrido es la **red de seguridad**
    de los precios. Si el watermark se corrió o Zeus no informó un cambio, el
    delta lo pierde para siempre y el barrido es lo único que lo arrastra. El
    precio **base** se escribe siempre, con el flag prendido o apagado, y el
    `summary` deja `full_sweep_scope` para poder auditar con qué configuración
    salió cada informe.
  - El barrido es la **entrada**, no la acción. Quien actúa sobre una baja es
    `status_sync` (apagado por default): espeja el estado de publicación del ERP
    sobre productos que ya existen, en las dos direcciones — publicable →
    `published`, no publicable → `draft` (y fuera del índice de búsqueda). Con
    `status_sync` **apagado**, `only_published` sigue siendo un filtro de entrada
    y un artículo dado de baja en Zeus **se sigue vendiendo** en la tienda.
    - Nunca toca productos `archived` / `rejected` / `proposed`, ni productos que
      no creó el sync (la variante tiene que tener `source_product_id`).
    - Si varios artículos caen en el mismo producto, **uno publicable alcanza**
      para que el producto se quede publicado.
    - Los artículos **borrados** de Zeus no llegan ni con los flags apagados: para
      esos está `status_sync_unpublish_missing`, que solo actúa en el barrido
      completo (en un delta, "no vino" significa "no cambió").
    - **Guard propio**: si se iba a despublicar más de `max_unpublish_pct`
      (default 10%) del lote, no se despublica **ninguno** y queda un warning.
      Publicar de más se revierte desde el admin; despublicar de más es venta
      perdida sin que nadie se entere.
  - Los precios se guardan **tal cual vienen** (ya son finales). La alícuota
    `por_iva` se guarda en `variant.metadata.zeus_por_iva` para que
    `notifySale` calcule el neto correcto por línea.
  - **Guard de sanidad**: si el delta pretende tocar más de `max_change_pct`
    del catálogo (default 40%), la corrida aborta **sin escribir nada**.
  - `create_products` viene **apagado** por default. Prendido, el estado del
    alta lo decide `created_product_status` (`draft` por default; `published`
    cuando el ERP ya manda títulos usables y se importan las imágenes — Medusa
    no tiene publicación masiva desde el admin, así que dejar miles de
    borradores termina en una query a la base).
  - **`published` no alcanza solo: hace falta `sales_channel_ids`.** `/store/*`
    scopea por los canales de la publishable key, así que un producto sin ningún
    canal linkeado **no aparece en la tienda** aunque esté publicado. El sync no
    elige un canal por su cuenta a propósito (mismo criterio que el shipping
    profile: adivinar en una plataforma multi-tienda publica el catálogo de un
    cliente en la tienda de otro); la config avisa cuando el alta va a quedar
    invisible.
  - Un alta **no la publica `status_sync`** en la misma corrida: los códigos
    creados quedan excluidos de esa fase, o elegir `draft` para revisarlos a mano
    no serviría de nada.
  - **Ningún alta sale sin shipping profile.** Si no hay uno configurado ni
    resoluble, el sync **cancela las altas** y deja el motivo en cada log item.
    No es una precaución teórica: un producto colgado de un profile sin
    opciones de envío se navega y se paga bien, y recién falla en
    `validate-shipping` — después de que la pasarela cobró. Precedente: los
    2.661 productos importados para `desde-el-sur`.
- **Imágenes** (`images.enabled`, apagado por default): fase propia del catalog
  sync, después de las altas y antes de los precios.
  - Se **baja** de `GET /articulos/imagen` con el Bearer y se **sube** al File
    module (S3/Spaces en prod). No se hotlinkea — ver la tabla de arriba.
  - Solo toca productos **sin `thumbnail` NI `images`**: una foto cargada a
    mano nunca se pisa, y de ahí sale la idempotencia (una corrida cortada
    retoma sola).
  - Concurrencia 4, 3 intentos por artículo con backoff. La primera corrida
    real murió a las 327 imágenes por un `ECONNRESET`; con reintentos y
    aislamiento por producto terminó en 1669 imágenes / 0 fallos.
  - Es la fase larga, así que **toca el log de sync cada 50 artículos**: sin
    eso el sweep anti-huérfanos la marca `failed` mientras todavía corre.
  - **Alcance** (`sync/full-sweep-scope.ts`): con backfill pendiente recorre el
    catálogo COMPLETO; sin backfill mira SOLO el delta; y en un barrido completo
    **depende de `full_sweep.images`** (default `false` = no revisa nada). Ese último caso es deliberado: lo que sobrevive al planner en
    un barrido completo son justamente los artículos sin foto, y 878 de ellos no
    la tienen en Zeus tampoco — volver a preguntar por esos en cada barrido es
    transferencia al vacío. Si en Zeus le cargan la foto a un artículo viejo, se
    le mueve `fechahoramodife` y entra por el delta. Prender `full_sweep.images`
    tiene sentido con un ERP que cargue imágenes SIN tocar el artículo: ahí el
    delta no las ve nunca. El `summary` informa el alcance en `images.scope`
    (`backfill` / `delta` / `full_sweep` / `skipped`).
  - Prenderla agenda un **backfill** (mismo mecanismo que `categories_sync`):
    la corrida siguiente le busca foto a todo el catálogo, no solo al delta.
    OJO: `mergeErpSettings` reemplaza el objeto `images` entero, así que la UI
    tiene que **arrastrar** `backfill_pending` en cada guardado — sin eso,
    guardar la config entre que se prende la opción y que corre el sync borraba
    el flag y el backfill no ocurría nunca.
  - **Verificá que el File module apunte a S3 antes de prenderla.** Con el
    provider de disco local, las imágenes se borran en cada deploy.
- **Categorías, familia y marca** (`categories_sync`, apagado por default):
  - El árbol de `GET /articulos/categorias` se espeja en `product_category`.
    La identidad es `external_id = zeus:<código>`, así que el espejo es
    idempotente y un rename en el ERP no duplica nada.
  - Es **ADITIVO**: el ERP administra solo las categorías con ese `external_id`.
    Una categoría puesta a mano en un producto **no se toca nunca**, y una
    categoría del ERP que desaparece del árbol se **reporta** en el summary
    (`categories.orphans`) pero jamás se borra: el delete cascadea a los hijos.
  - Nunca se actualiza el `handle` de una categoría existente (rompería URLs y
    SEO) ni su `is_active`/`is_internal` (alguien pudo ocultarla a propósito).
    El `rank` solo se fuerza en el alta, salvo que se prenda
    `categories_sync_rank`: en un update, Medusa re-rankea a **todos** los
    hermanos, incluidas las categorías manuales de la raíz.
  - Un artículo **sin categoría** en el ERP es un no-op: no se le saca la que
    tenga (Zeus no distingue "sin clasificar" de "descategorizado").
  - `familia` y `marca` van a `product.metadata.family` / `.brand`, que es lo
    que indexa la búsqueda — la metadata de VARIANTE no se indexa. Con
    `brands_sync` además se crean las entidades de la extensión Marcas (sin
    logo) y se linkean al producto.
  - Prender `categories_sync` agenda un **backfill**: la corrida siguiente pide
    el catálogo completo para atribuir categoría/familia/marca a TODOS los
    artículos y no solo al delta. Se puede forzar con
    `POST /admin/erp/catalog-sync/run?categories_backfill=true`.
  - Un fallo del árbol o de las marcas **no marca la corrida como fallida**:
    queda como `warnings` en el summary. Los precios valen más que el árbol.
  - Después de la primera corrida hay que **resincronizar Typesense**: el campo
    `family` no existe en la colección hasta que se recrea.

### Mapeo de listas de precios

Zeus expone 10 listas por artículo (`precio0..precio9`), pero en la cuenta
medida **solo 2 son distintas**:

- `precio1` = precio al público (3410 de 3438 artículos lo tienen)
- `precio4` = mayorista, y es exactamente `precio1 × 0.70` en el 99.9% del catálogo
- `precio2` y `precio3` son **idénticos a `precio1` o cero, nunca distintos**
- `precio0` y `precio5..9` están vacíos salvo en ~23 artículos (0.6%)
- Las **escalas por cantidad** (`escala1..4`) no las usa **ningún** artículo

Por eso el default es `base_list_index: 1` (NO 0) y un solo mapeo
`precio4 → "Mayorista"`. El mapeo se configura en el admin: cada lista del ERP
apunta a una price list de Medusa (que se crea si no existe) y a un customer
group. **Sin customer group la price list se crea en `draft`**: activarla sin
regla la aplicaría a todos los clientes.
- **Venta**: se resuelve el cliente (`/clientes/search` por CUIT/DNI, fallback
  email; se crea con `POST /clientes` si falta) y se inserta el pedido con
  `id_ecommerce = order_id` de Medusa. La respuesta trae `idtransac`
  (referencia externa visible en el outbox).
- **Idempotencia real**: si el pedido ya existe, Zeus responde **409** y el
  evento queda `duplicate` (a diferencia de Bsale/Contabilium, acá el
  reintento tras timeout NO duplica).
- **Errores**: timeouts/5xx reintentan con backoff; 401/403 (JWT inválido o
  vencido) también reintentan y terminan en `dead_letter` visibles en el
  panel; 400/422 (datos inválidos) van a `dead_letter` directo.

## Puesta en marcha del catalog sync

El orden importa: la primera corrida sobre un catálogo grande puede crear miles
de borradores o mover miles de precios.

1. En **ERP → Configuración → Catálogo y precios**: dejar
   `base_list_index = 1`, agregar el mapeo `4 → Mayorista` con su customer
   group, y **dejar `create_products` apagado**.
2. Encender "Activar sync de catálogo" y guardar, pero **no** levantar todavía
   el cron (`ERP_CATALOG_SYNC_CRON`).
3. **Simular (dry-run)** desde el panel. Revisar en ERP → Logs el detalle por
   artículo: los montos propuestos tienen que coincidir con lo que el cliente ve
   en Zeus. Contra-chequeo concreto de la cuenta medida: para `010/50` el precio
   base debe ser **2526.12** y el mayorista **1768.28**; para `I39` (IVA 10.5%),
   **630141.31** y **441098.91**. Ojo: el mayorista se toma del `precio4` que
   manda Zeus, **no** se calcula como `base × 0.7` — el redondeo de Zeus no
   siempre coincide con esa cuenta (en `I39` da `.91`, no `.92`).
4. Corrida real manual. Verificar que (a) el precio base cambió, (b) el de la
   price list mayorista cambió, y (c) **precios de otras monedas o con reglas de
   región sobrevivieron** — esto último confirma que `addPrices` no es destructivo.
5. Correr **dos veces seguidas**: la segunda tiene que dar todo
   `price_unchanged`, cero escrituras.
6. Recién entonces levantar el cron y mirar CPU y duración un par de ciclos.
   Arranca en `*/15` a propósito, no en `*/1`.
7. Para dar de alta el catálogo completo, decidir con el cliente antes de
   prender `create_products`: hay ~2559 artículos publicables y cada uno entra
   como borrador a revisar a mano.

## Facturar al despachar (trigger por fulfillment)

Es para la operativa donde el stock vive repartido entre depósitos (A y B) y la
transferencia B → A se hace **a mano en Zeus**. Facturar al cobrar emitiría el
comprobante desde un depósito que todavía no tiene el pedido completo.

Flujo:

1. Se cobra la compra. **No se notifica nada** al ERP todavía.
2. El equipo hace la transferencia B → A en Zeus.
3. El operador crea el fulfillment desde el admin, **desde la ubicación del
   depósito facturador**. Eso deja `order.metadata.erp_billing` (qué depósito,
   cuándo, quién).
4. Se encola la venta con ese depósito → `POST /pedidos` con `deposito` = el
   confirmado (gana sobre `zeus.deposito_id`).
5. Se encola el poll del comprobante y se refresca el stock de los SKUs.
6. Cuando Zeus factura, llega `numeroComp` + PDF: se guardan, se avisa por email
   y queda descargable desde el admin y desde Mi cuenta.

Configuración: en **ERP → Configuración → Llaves**, debajo de "Notificación de
ventas", elegir *"Notificar cuando el fulfillment esté hecho"* y el **depósito
facturador** (sale del mapeo de depósitos, así que hay que cargarlo antes).

Dos rechazos deliberados al crear el fulfillment, ambos con mensaje en el admin:

- **Ubicación distinta al depósito facturador** → 400 nombrando la ubicación
  esperada.
- **Fulfillment parcial** → 400. Zeus emite un comprobante por pedido; un
  parcial lo partiría en dos o facturaría de menos.

### Lo que NO factura (y hay que decírselo al cliente)

El **auto-fulfillment de carrier** (Andreani, Correo, flota propia) crea el
fulfillment solo sobre `order.placed`/`payment.captured`, **sin `location_id`**.
Esos fulfillments **no facturan**: no llevan la marca `erp_billing`, así que no
son confirmación humana de nada. Queda un `logger.info` explicando por qué.

Si una tienda usa auto-fulfillment de carrier, este trigger **no le sirve**. La
pantalla de configuración lo avisa, pero no bloquea el guardado.

### Pendiente de medir contra cuenta real

Un solo punto, y conviene cerrarlo antes de la primera venta real:
`pedidoFacturado` devuelve el pedido y sus documentos derivados en
`comprobanteResultado[]`. El adapter recorre **el objeto raíz y los derivados** y
se queda con el primero que declare `isFacturado` **y** traiga `numeroComp`. Si
en la cuenta del cliente la factura aparece sólo en un lugar (o `isFacturado`
toma un valor distinto de `"1"`/`"true"`), hay que ajustar el mapeo en
`adapters/zeus.ts::fetchInvoiceStatus` con el dato medido, no con el Swagger.

## Checklist E2E (con cuenta real)

1. Cargar `jwt_token` y **Validar conexión** → OK informando las empresas del
   token (usa `/empresas`, no el health check, que está roto del lado de Zeus).
2. Stock sync manual desde el panel → revisar el log por SKU (updated /
   not_found) y que las cantidades respeten depósito y comprometido.
3. Checkout con pago capturado → el evento aparece en ERP → Ventas y pasa a
   `sent` con `idtransac`; verificar el pedido en Zeus (buscarlo por
   `id_ecommerce` = order_id).
4. Reintentar el mismo evento desde el admin → debe quedar `duplicate` (409).
5. Orden con CUIT en el checkout → el cliente se crea/asocia por CUIT; orden
   sin documento → usa el cliente por defecto.

### Checklist del trigger por fulfillment

Va sobre el anterior, con la config puesta en "notificar al fulfillment" y el
depósito facturador = A:

6. Compra cobrada → en ERP → Ventas **no** hay evento. El widget de la orden
   muestra desde qué ubicación hay que despachar.
7. Fulfillment desde la ubicación de **B** → 400 nombrando la ubicación de A.
8. Fulfillment **parcial** desde A → 400.
9. Transferir B → A en Zeus a mano; fulfillment completo desde A → el evento
   `sale_created` pasa a `sent` con `idtransac`. Verificar en Zeus que el pedido
   quedó con `deposito` = A (buscarlo por `id_ecommerce` = order_id).
10. Reintentar ese evento a mano → `duplicate` (409).
11. Facturar el pedido en Zeus → el evento `invoice_fetch` pasa a `sent`, el
    widget muestra tipo/letra/número, y el PDF baja desde el admin y desde Mi
    cuenta. Llega el mail con el link.
12. Verificar el refresco: los niveles de A y B en Medusa reflejan lo que quedó
    en Zeus después de la transferencia + la factura.
13. Con auto-fulfillment de carrier **prendido**: la orden se despacha sola y
    **no** se factura; queda el log diciendo por qué.

Antes de que Zeus facture, el evento `invoice_fetch` se queda en `pending` con
`next_retry_at` moviéndose. Eso es lo esperado: **no** tiene que aparecer como
`failed`.
