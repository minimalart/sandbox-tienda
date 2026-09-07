# Correo Argentino — integración de fulfillment

Provider de fulfillment de Medusa para Correo Argentino. Single-tenant: las
credenciales vienen por variables de entorno.

> **Estado: Fases 2 y 3 completas.** Clientes HTTP, transformers,
> normalizadores, provider + registro, workflow de tickets, rutas admin y store,
> subscribers, job de sync y adapter del módulo `delivery`. Los seeds están
> escritos pero **deliberadamente apagados** (ver *Seeds*). Falta la Fase 4
> (admin UI) y la Fase 5 (Correo en el checkout del storefront). Plan completo:
> `docs/reports/correo-argentino-integration-plan.md`.
>
> **Cuidado al sumar un carrier: tres lugares clasificaban por el NOMBRE de la
> opción de envío, y "Retiro en sucursal de Correo Argentino" contiene la
> palabra "sucursal".** Los tres se arreglaron leyendo `data.carrier`, que el
> provider estampa explícitamente:
> `classify()` (`workflows/create-delivery-execution.ts`),
> `isAndreaniFulfillment()` y el subscriber `andreani-order.ts`. Ninguno de los
> tres fallaba con error: clasificaban mal en silencio.
>
> ⚠️ **Correo NO aparece en el checkout todavía**, y es a propósito: sin
> credenciales de MiCorreo no hay cotización, y con la decisión D4 vigente cada
> envío mostraría "Gratuito". Ver *Estado de las credenciales*.

## Estado de las credenciales

| | Estado |
|---|---|
| `paqar/v1` — API Key + agreement | ⏳ **sin ejercitar**: no se hizo ni un request real |
| `micorreo/v1` — user / pass / customerId | ❌ **faltan** |

⚠️ **NINGÚN endpoint de Correo se llamó todavía.** Todo lo que este módulo
"sabe" del contrato viene del manual o de inferencias nuestras; los tests son
unitarios y no salen a la red. La primera corrida contra `apitest` es la que
valida (o refuta) las decisiones de la sección *Manual vs. lo que manda el
código*.

Sin las de MiCorreo el provider arranca y opera (crear órdenes, rótulos,
tracking), pero `calculatePrice()` degrada a `$0` en el 100% de los casos. El
constructor loguea un `error` al arrancar avisando exactamente eso.

### Pendiente de pedirle al ejecutivo de cuenta

1. Credenciales de MiCorreo y **confirmación de que la cuenta está activada
   comercialmente** (si no lo está, `/rates` devuelve `202` con `rates: []`).
2. La tabla completa `statusId` → significado.
3. Si `serviceType: "EP"` está habilitado en el agreement.
4. El techo real de peso y el **coeficiente de aforo**.
5. Si el agreement acepta `trackingNumber` generado por nosotros, y con qué
   formato.

## Manual vs. lo que manda el código (INFERENCIAS sin verificar)

Hay **dos puntos donde el código contradice al manual a propósito**. Las dos son
inferencias nuestras, **ninguna se probó contra la API** — el manual es
internamente inconsistente y elegimos la lectura que nos parece más probable.
Los tests de `clients/paqar-client.test.ts` pinean la decisión (para que no se
cambie sin querer), no un comportamiento observado.

| | El manual dice | El código manda | Cómo darlo vuelta |
|---|---|---|---|
| `GET /agencies?stateId` | ISO 3166-2 (`AR-C`) | Código de **una letra** (`C`), el mismo de `POST /orders` | `buildAgencyParams()` en `clients/paqar-client.ts` — un solo lugar |
| `GET /tracking` | Array en el **body de un GET** | Query param `trackingNumbers` repetido | `buildTrackingParams()` + el `request({ method: 'GET' })` de `getTracking()` |

Por qué cada una:

- **`stateId`**: sería raro que la misma API use dos convenciones para el mismo
  dato, y en `POST /orders` el campo de provincia es de 1 char, así que asumimos
  que el ISO sería rechazado. **Si `/agencies` falla en QA, esto es lo PRIMERO a
  mirar.** El mensaje de error exacto (si hay) está por verificar.
- **`/tracking`**: un array como cuerpo de un GET es raro y muchos gateways lo
  descartan, así que asumimos que los TNs tienen que ir en la query.
  **Es lo PRIMERO a verificar contra `apitest`**, porque si está mal el sync de
  tracking no anda y el síntoma es silencioso: los envíos se crean bien y nunca
  actualizan estado.

Si la primera resulta cierta, hay una consecuencia buena: las dos APIs comparten
la convención de provincia y `normalizeProvinceToCode()` alcanza para las dos.
Si resulta falsa, hay que volver a agregar el helper que resuelve al ISO (ver el
comentario en `transformers/province-codes.ts`).

Otras cosas que el módulo asume, **SEGÚN EL MANUAL (sin verificar)**:

- En el único ejemplo de respuesta de `GET /agencies`, `open_hours`,
  `maximum_package_dimensions`, `volumetric_capacity`, `status` y
  `deactivation_date` vienen `null`. Por eso el transformer trata los horarios
  vacíos como "Correo no informa" y empuja al string `schedule`
  (`"LUN A VIE 10.00 A 17.00"`). Cuánto se repite eso en el padrón real, sin
  medir.
- `agency_id` es un código opaco de 3 chars.
- Un TN inexistente en `/tracking` no sería error: `200` con
  `{ id: null, quantity: 0, event: [] }`. Se distingue por `event.length === 0`.
- `GET /auth` devuelve `204` con credenciales válidas y `401` con una key o un
  agreement que no corresponden. Que discrimine de verdad los dos casos está
  **pendiente de verificar en QA**.

  El health check NO usa `testConnection()` (que devuelve un booleano y se come
  el error, perdiendo el status): usa `probeAuth()`, que propaga un
  `CorreoAPIError` con el status HTTP preservado. Eso es lo que permite
  distinguir *credenciales inválidas* (401/403) de *gateway inalcanzable* (sin
  status). El de MiCorreo son DOS pasos —`POST /token` y una sonda a
  `POST /rates`— porque una cuenta que autentica bien puede seguir devolviendo
  `202` con `rates: []` hasta que Correo la activa comercialmente, y ese caso
  (`cuenta_no_activada`) es el que hace que el checkout cotice $0.
  Todo esto se ejercita desde `GET /admin/correo-argentino/health?probe=true`.

## Son DOS APIs, no una

Correo expone dos plataformas distintas, con auth distinta, y **hay que usar las
dos**:

| | **paqar/v1** | **micorreo/v1** |
|---|---|---|
| Rol | **Operar**: órdenes, rótulos, tracking, sucursales | **Cotizar**: `POST /rates` |
| Auth | `authorization: Apikey <key>` + `agreement: <id>` en **cada** request. Sin token | `POST /token` con HTTP Basic → JWT, luego `Authorization: Bearer` |
| Identidad | `agreement` / `sellerId` | `customerId` |
| Cotización | ❌ no existe | ✅ único cotizador real |

Por **default** comparten host — `apitest.correoargentino.com.ar` (test) /
`api.correoargentino.com.ar` (prod) — y difieren solo en el path base
(`/paqar/v1` vs `/micorreo/v1`). Pero ni el host compartido ni los paths son
invariantes: las dos cosas se pueden mover por env var, sin deploy.

- **Los paths ya cambiaron.** El historial del manual oficial documenta v1.1
  ("Inclusión versión en la URL") y v1.2 ("Inclusión URL PROD y TEST
  exteriorizadas"), y el manual v1 apuntaba a
  `ptest04.correoargentino.com.ar/apipaqar` — host **y** path distintos de los de
  hoy. Si Correo pasa a `/paqar/v2`, se cambia
  `CORREO_ARGENTINO_PAQAR_BASE_PATH` y listo.
- **El host se puede separar por API.** `CORREO_ARGENTINO_MICORREO_HOSTNAME`
  apunta solo a MiCorreo. El caso concreto: hay reportes de integradores de que el
  sandbox de MiCorreo no responde, así que "operar en test y cotizar en prod"
  puede ser la única combinación viable.

La resolución es toda de `normalizeCorreoOptions()`: deja en
`options.api.paqar.baseUrl` y `options.api.micorreo.baseUrl` las URLs ya armadas y
los clientes no concatenan nada. Los valores se normalizan defensivamente (se
agrega el `/` inicial que falta, se saca el final que sobra, se saca el `https://`
pegado en el hostname) porque los carga una persona a mano en un `.env`: sin eso,
`https://api.correoargentino.com.ar` produce `https://https://api…` y
`/paqar/v1/` produce un doble slash que un gateway puede contestar con 404 o 403.
El health check reporta el ambiente **por API** (`targets.paqar` /
`targets.micorreo`) y, como siempre, solo el clasificador `test`/`prod`/`custom`:
el valor del hostname nunca sale de la ruta.

Los clientes viven en `clients/paqar-client.ts` y `clients/micorreo-client.ts`.
Fuera del provider (workflows, jobs, rutas custom) se construyen con
`get-client.ts` — **nunca** resolviendo el provider del `req.scope`.

## Variables de entorno

> Estas variables NO están en `.env.template` (archivo protegido). Agregalas a mano.

Esta sección y el catálogo del health check
(`api/admin/correo-argentino/health/_env-report.ts`) tienen que listar lo MISMO:
`_env-report.test.ts` escanea el módulo, `src/jobs/`, `src/workflows/` y
`src/subscribers/` y falla si el código lee una `CORREO_ARGENTINO_*` que el
catálogo no reporta. Si agregás una variable, va en los tres lugares (acá, en el
catálogo y en `packages/project-composer/src/component-metadata.js`).

### paqar — operar (requeridas para habilitar el provider)

```bash
CORREO_ARGENTINO_API_KEY=         # habilita el provider si está seteada
CORREO_ARGENTINO_AGREEMENT=
CORREO_ARGENTINO_SELLER_ID=       # opcional; si falta, se usa el agreement
CORREO_ARGENTINO_TEST_MODE=true   # true → apitest, false → api
CORREO_ARGENTINO_HOSTNAME=        # opcional, override del host (default de las DOS APIs)
CORREO_ARGENTINO_PAQAR_BASE_PATH= # opcional, default /paqar/v1
CORREO_ARGENTINO_EXT_CLIENT=      # opcional; EXACTAMENTE 3 chars numéricos (GET /tracking)
```

`HOSTNAME` y los `*_BASE_PATH` se normalizan solos: `paqar/v1` → `/paqar/v1`,
`/paqar/v1/` → `/paqar/v1`, `https://api.correo…/` → `api.correo…`, y un valor que
queda vacío cae al default en vez de armar una URL rota.

### micorreo — cotizar

```bash
CORREO_ARGENTINO_MICORREO_USER=   # Basic para POST /token
CORREO_ARGENTINO_MICORREO_PASS=
CORREO_ARGENTINO_CUSTOMER_ID=     # identidad del comerciante en /rates

CORREO_ARGENTINO_MICORREO_HOSTNAME=  # opcional, host SOLO de MiCorreo
CORREO_ARGENTINO_MICORREO_BASE_PATH= # opcional, default /micorreo/v1
```

> Las credenciales Basic de MiCorreo son **por integrador, no por comerciante**
> (el plugin oficial de WooCommerce las trae hardcodeadas en plaintext). La
> identidad del comerciante va toda en `customerId`.

`MICORREO_HOSTNAME` tiene una cadena de fallback de tres niveles:
`CORREO_ARGENTINO_MICORREO_HOSTNAME` → `CORREO_ARGENTINO_HOSTNAME` → el derivado de
`CORREO_ARGENTINO_TEST_MODE`. Sin setearla, el comportamiento es el de siempre (un
solo host para las dos APIs); seteándola se puede, por ejemplo, operar contra
`apitest` y cotizar contra prod.

### Remitente / origen

```bash
CORREO_ARGENTINO_SENDER_NAME=
CORREO_ARGENTINO_SENDER_EMAIL=        # opcional
CORREO_ARGENTINO_SENDER_PHONE=        # opcional
CORREO_ARGENTINO_SENDER_CELLPHONE=    # opcional
CORREO_ARGENTINO_SENDER_OBSERVATION=  # opcional

CORREO_ARGENTINO_ORIGIN_POSTAL_CODE=
CORREO_ARGENTINO_ORIGIN_STREET=
CORREO_ARGENTINO_ORIGIN_NUMBER=
CORREO_ARGENTINO_ORIGIN_CITY=
CORREO_ARGENTINO_ORIGIN_STATE=        # código de UNA letra (ver "Provincias")
CORREO_ARGENTINO_ORIGIN_FLOOR=        # opcional
CORREO_ARGENTINO_ORIGIN_DEPARTMENT=   # opcional
```

### Producto y límites

```bash
CORREO_ARGENTINO_SERVICE_TYPE=CP      # CP (Clásico) | EP (Expreso). Default CP
CORREO_ARGENTINO_PRODUCT_CATEGORY=    # parcels[].productCategory (obligatorio en la API)
CORREO_ARGENTINO_PRODUCT_WEIGHT_UNIT=kg  # unidad de product.weight: kg (default) | g

CORREO_ARGENTINO_MAX_WEIGHT_G=25000   # default 25000 (límite duro de /rates)
CORREO_ARGENTINO_MAX_DIMENSION_CM=150 # default 150 (límite duro de /rates)
CORREO_ARGENTINO_AFORO_DIVISOR=4000   # default 4000 — ⚠️ SIN VERIFICAR
```

### Fallback de dimensiones (OPT-IN)

```bash
# Por default la consolidación es ESTRICTA y aborta antes de pegarle a la API si
# un producto no tiene weight/length/width/height. Con enabled=true rellena los
# faltantes y loguea un warning por ítem.
# OJO: Correo factura por peso facturado real — medidas truchas = costo incorrecto.
CORREO_ARGENTINO_DIMENSION_FALLBACK_ENABLED=false
CORREO_ARGENTINO_DIMENSION_FALLBACK_LENGTH=30   # cm
CORREO_ARGENTINO_DIMENSION_FALLBACK_WIDTH=20    # cm
CORREO_ARGENTINO_DIMENSION_FALLBACK_HEIGHT=15   # cm
CORREO_ARGENTINO_DIMENSION_FALLBACK_WEIGHT=0.5  # en PRODUCT_WEIGHT_UNIT, por unidad
```

### Operación: automatismos y tracking number

⚠️ Estas cinco **NO pasan por `normalizeCorreoOptions()`**: las leen directo el
subscriber, el job y el workflow (de un `env` inyectado, para poder testearlos).
Todas son opt-in con default seguro, así que no setearlas es una decisión válida —
pero explican comportamiento, y por eso el health check las reporta (grupo
`operacion`).

```bash
# Auto-fulfillment al pagar. true → el subscriber crea el fulfillment NATIVO de
# Medusa cuando la orden se coloca o se captura el pago.
# Ausente/≠true = nada automático.
# OJO: esto NO crea el envío en Correo — el alta real la hace el workflow
# `correo-generate-tickets`, on-demand desde el admin.
CORREO_ARGENTINO_AUTO_FULFILL=false

# Cron del job de sync de tracking. Default: cada hora.
CORREO_ARGENTINO_TRACKING_SYNC_SCHEDULE='0 * * * *'

# true → el job solo sincroniza entre las 8 y las 21 ART (offset fijo -3:
# Argentina no tiene DST). Ausente/≠true = corre siempre, a cualquier hora.
CORREO_ARGENTINO_TRACKING_BUSINESS_HOURS_ONLY=false

# Base de la URL de seguimiento que ve el comprador (WhatsApp, detalle de orden).
# Default: https://www.correoargentino.com.ar/formularios/e-commerce
# Es una PÁGINA WEB, no una API: si Correo la mueve, el síntoma es un link roto,
# no un checkout caído. Se le saca el `/` final y se IGNORA si no arranca con
# http(s):// — media URL mal pegada da un link inútil, y es mejor el default.
CORREO_ARGENTINO_TRACKING_BASE_URL=
```

```bash
# ⚠️ DEJAR APAGADA hasta que Correo confirme POR ESCRITO el formato pactado del TN.
#
# `trackingNumber` es OPCIONAL en `POST /orders`: si se omite, lo genera Correo, y
# ese es el default (ausente/≠true). Están implementadas las dos vías.
#
#  - A favor de prenderla: un TN propio determinístico compra IDEMPOTENCIA. Si el
#    POST timeoutea pero el alta ocurrió, el reintento con el MISMO TN falla con
#    "duplicado" y eso es información: el envío ya existe y se adopta. Con el TN de
#    Correo no hay forma de saberlo → dos altas, dos envíos, flete doble.
#  - En contra: el manual dice que el formato/longitud del TN del cliente "se pacta
#    previamente" y todavía NO tenemos esa confirmación del ejecutivo de cuenta. Un
#    formato no pactado puede ser rechazado, o peor: aceptado hoy y rechazado
#    cuando endurezcan la validación. Y una colisión dentro del agreement es
#    IRRECUPERABLE.
CORREO_ARGENTINO_SELF_GENERATED_TN=false

# Prefijo del TN propio. Default MER. Alfanumérico, máx 6 chars (el TN entero
# entra en 30). Solo aplica con SELF_GENERATED_TN=true.
CORREO_ARGENTINO_TN_PREFIX=MER
```

### Seeds

```bash
# Las shipping options de Correo NO se siembran por default. Prendé esto SOLO
# cuando haya credenciales de MiCorreo: sin cotización, cada envío de Correo se
# le muestra al comprador como "Gratuito" (decisión D4).
CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS=false
```

Los dos seeds son idempotentes (find-or-create) y se pueden correr repetidas
veces:

```bash
pnpm --filter backend seed:correo-domicilio   # zona "Argentina" del shipping set, price_type calculated
pnpm --filter backend seed:correo-sucursal    # fulfillment set propio, type: pickup
```

Tres trampas de Medusa que estos seeds respetan y que hay que respetar en
cualquier seed nuevo:

1. Los nombres de **service zone son globalmente únicos**. La zona del pickup de
   Correo es `Argentina (Correo Argentino)` porque `Argentina` y
   `Argentina (Andreani HOP)` ya están tomadas.
2. El provider tiene que estar **linkeado al stock location ANTES** de
   `createShippingOptionsWorkflow`, o falla con *"not enabled for the service
   location"*.
3. `price_type: 'calculated'` va **sin** array de `prices`: un precio flat
   pisaría la cotización en vivo.

`env-options.ts` es la **única** implementación del loader y de la validación.
A diferencia de `andreani-fulfillment` —que duplica su loader en
`medusa-config.ts` con un comentario pidiendo mantener las dos copias en sync—
`medusa-config.ts` reusa `loadCorreoOptionsFromEnv()` con un `require` perezoso
(perezoso porque los proyectos generados traen solo las carpetas de extensión
seleccionadas, y un import estático rompería el arranque de los que no incluyan
este módulo).

> `.env.example` y `.env.template` están protegidos por permisos y no se
> pudieron actualizar automáticamente. Copiá los bloques de arriba a mano.

## Constraints del contrato que cambian el diseño

### `parcels[]` descarta todo menos el primer elemento

Textual del manual (pág. 15): *"Solo tomará un producto, en caso de cargar más de
uno en este array solo se toma y transforma el primero recibido en el array y se
ignoran los siguientes."*

Por eso **el `box-packer.ts` de Andreani NO aplica** y `consolidate-parcel.ts`
consolida N ítems en UN bulto: peso real sumado en gramos, dimensiones por
apilado (suma del lado menor, máximo de los otros dos), `declaredValue` =
subtotal, y peso facturado = `max(real, volumétrico)`.

> El plugin oficial de Correo para WooCommerce manda el array completo: es un bug
> que sub-declara peso y valor en pedidos multi-ítem. No copiarlo.

El coeficiente de aforo (`/4000`) es un valor **de comunidad**: Correo no lo
publica. Es configurable a propósito hasta tenerlo por escrito.

### Provincias: el código asume UNA sola convención (el manual dice otra cosa)

El módulo manda el mismo código de una letra a `POST /orders` (`state`) y a
`GET /agencies` (`stateId`), aunque el manual diga que `/agencies` quiere ISO
3166-2. Es una inferencia **sin verificar** — ver la tabla de *Manual vs. lo que
manda el código*. `transformers/province-codes.ts` normaliza desde la letra, el
ISO o el nombre/variante ("CABA", "Capital Federal", "Bs As"), y
`PaqarClient.getAgencies()` lo aplica en el borde para que una provincia mal
formateada falle acá y no como un error opaco de Correo.

⚠️ `B` (Provincia de Buenos Aires) y `C` (CABA) son provincias **distintas**. El
manual da a entender que Correo valida `zipCode` contra `state`, así que un CP
que no corresponde a la provincia sería rechazado — no se comprobó.

### Tracking: la tabla de `statusId` no está publicada

Verificados solo 3 códigos: `PRE` (preImposición), `CAU` (caduco), `CAN` (en
proceso de cancelación). `normalizers/tracking-status.ts` matchea por código
conocido y después por texto, y **loguea con `logger.error` todo par
`statusId` + `status` sin match**. Ese log es el mecanismo para cosechar la tabla
real desde tráfico de producción — no apagarlo.

### `/labels` es bulk y las fallas parciales son HTTP 200

Una sola llamada trae todos los base64 (sin el fan-out de N llamadas que necesita
Andreani), pero los ítems fallidos vienen con **HTTP 200** y
`result: "ERROR: <motivo>"`. La doc muestra tanto `status` como `result` y tanto
`fileName` como `filename`: `label-download.ts` acepta las dos grafías y devuelve
resultado **por ítem**.

`labelFormat` solo acepta `"10x15"` y `"label"`; cualquier otro valor se ignora en
silencio y cae al `consRotulo` legacy.

### `/rates` con `202` y `rates: []` = cuenta sin activar

Una cuenta que Correo todavía no activó **comercialmente** devuelve HTTP 202 con
`rates: []`. No es un bug de código: hay que pedir la activación.
`parseRatesResponse()` distingue ese caso (`account_not_activated`) de "no hay
tarifas para esta ruta" (`no_rates`), y lo loguea con `logger.error`.

### Token de MiCorreo con timezone desconocida

El `expires` de `POST /token` es un string **sin timezone**
(`"2022-04-26 21:16:20"`). Se interpreta como UTC (el instante más temprano entre
las timezones plausibles), se aplica un 80% de margen y un techo de 1h. Ver
`resolveTokenTtlMs()`.

### Otros

- `saleDate`: formato exacto `YYYY-MM-DDTHH:mm:ss-03:00`.
- `trackingNumber`: máx 30 chars, único por agreement, **lo puede generar el
  cliente** (idempotencia — ver §5.3 del plan).
- `shipmentClientId`: documentado como **no funcional** en la versión inicial.
- `agencyId`: obligatorio salvo en `homeDelivery`, donde va **ausente**.
- `deliveryType: "locker"` NO se implementa: los SmartLockers figuran como
  *currently unavailable* y `/agencies` no tiene campo discriminador.
- El gateway de paqar devuelve **403 para cualquier path**, incluso inexistentes
  → no se pueden enumerar endpoints por probing, y un 403 no implica credencial
  inválida.
- Todos los valores del payload de `/orders` son **strings**, incluso los
  numéricos.

## Tests

```bash
pnpm --filter backend test        # node:test, funciones puras
pnpm --filter backend typecheck
```

Cobertura: `province-codes`, `consolidate-parcel`, `order-payload`,
`tracking-status`, `label-download`, parsing de `/rates` + TTL del token, y
`utils/errors`. Todo puro: no requiere credenciales ni el sandbox de Correo
(que los integradores reportan como inestable).
