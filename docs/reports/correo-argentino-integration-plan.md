# Correo Argentino — Plan de integración

> Estado: **planificación**. Credenciales comprometidas para esta semana; el plan está diseñado para
> construir todo lo posible contra el contrato documentado y dejar solo la QA en vivo bloqueada.
>
> Fuente primaria: `apiPaqAr-v2.pdf` (Abril 2023, 37 pág.) + `apiMiCorreo.pdf` (2025-01-14).
> Referencia de implementación: `src/modules/andreani-fulfillment/` — Correo es el **segundo** carrier
> del proyecto y el primero que se agrega después de que aterrizó la abstracción `delivery`.

---

## 1. Hallazgo que gobierna la arquitectura: son DOS APIs

Correo Argentino expone dos plataformas distintas, con auth distinta, y **hay que usar las dos**.

| | **paqar/v1** | **micorreo/v1** |
|---|---|---|
| Host test | `https://apitest.correoargentino.com.ar/paqar/v1` | `https://apitest.correoargentino.com.ar/micorreo/v1` |
| Host prod | `https://api.correoargentino.com.ar/paqar/v1` | `https://api.correoargentino.com.ar/micorreo/v1` |
| Auth | `authorization: Apikey <key>` + `agreement: <id>` en **cada** request. Sin token. | `POST /token` con HTTP Basic → JWT. Luego `Authorization: Bearer <jwt>` |
| Identidad | `agreement` (acuerdo comercial) | `customerId` |
| Rol | **Operar**: órdenes, rótulos, tracking, sucursales | **Cotizar**: `POST /rates` |
| Cotización | ❌ no existe | ✅ único cotizador real |

**Prueba de que hay que combinar ambas:** el plugin oficial de Correo Argentino para WooCommerce
(v3.0.7) tiene `PaqArService::getRates()` como un stub hardcodeado que devuelve `price => 0` **sin
hacer ninguna llamada HTTP**, mientras que `MiCorreoService::getCalculatedRates()` sí pega contra
`POST /rates`. Los que integran solo paqar cotizan $0 y reconcilian el costo offline.

### Endpoints paqar/v1

| Método | Path | Uso |
|---|---|---|
| `GET` | `/auth` | 204 = credenciales válidas. Health check / `testConnection()` |
| `POST` | `/orders` | Alta de orden. Devuelve `trackingNumber` |
| `PATCH` | `/orders/{trackingNumber}/cancel` | Solo mientras **no fue impuesto** |
| `POST` | `/labels` | **Bulk nativo**: array `{sellerId, trackingNumber}` → `fileBase64` por ítem |
| `GET` | `/tracking` | Historial. Array de TNs. `extClient` opcional (3 chars numéricos) |
| `GET` | `/agencies` | Sucursales. Filtros `stateId`, `pickup_availability`, `package_reception` |

### Endpoint micorreo/v1 que nos importa

```http
POST /micorreo/v1/rates
Authorization: Bearer <jwt>

{ "customerId": "0000550137",
  "postalCodeOrigin": "1757",
  "postalCodeDestination": "1704",
  "deliveredType": "D",              // "D" domicilio | "S" sucursal | omitir → devuelve ambos
  "dimensions": { "weight": 2500, "height": 10, "width": 20, "length": 30 } }
```

→ `{ customerId, validTo, rates: [{ deliveredType, productType, productName, price, deliveryTimeMin, deliveryTimeMax }] }`

---

## 2. Decisiones tomadas

| # | Decisión | Razón |
|---|---|---|
| D1 | **Paridad total con Andreani**: provider de fulfillment + adapter de `delivery` + admin UI + job de tracking + subscriber de auto-fulfill + selector de sucursales en checkout | Alcance definido por el negocio |
| D2 | **Cotizar con MiCorreo `/rates`**, operar con paqar | Es el único cotizador real que existe |
| D3 | **El refactor de generalización del storefront va en un PR APARTE y ANTES de Correo** | Si se mezcla, una regresión en el checkout de Andreani (que hoy factura) queda indistinguible de un bug nuevo de Correo. Separado, Andreani es el test de regresión vivo |
| D4 | **Fallback de tarifa cuando `/rates` falla: `amount = 0` → "Gratuito"**, igual que Andreani hoy | Consistencia con el comportamiento actual. Decisión explícita del negocio |
| D4b | El fallback se loguea con severidad **`error`** (no `warn`) y llega a Sentry | Un fallback silencioso que regala flete tiene que ser visible desde el día uno. No cambia la UX |
| D5 | Registro del provider **gateado por env var** (`CORREO_ARGENTINO_API_KEY`), igual que `ANDREANI_USERNAME` | La app arranca sin credenciales sin romper nada |
| D6 | **NO construir flujo de `locker`** | Los SmartLockers figuran como *currently unavailable* en el FAQ oficial y `/v1/agencies` no tiene campo discriminador para identificarlos |

---

## 3. Constraints duros del contrato

Estos no son detalles de implementación, son restricciones que cambian el diseño.

### 3.1 `parcels[]` solo toma el PRIMER elemento

> *"IMPORTANTE: Solo tomará un producto, en caso de cargar más de uno en este array solo se toma y
> transforma el primero recibido en el array y se ignoran los siguientes."* — pág. 15

**El `box-packer.ts` de Andreani NO aplica.** Ese módulo parte el pedido en N cajas; acá la N-ésima
se descarta en silencio y el envío viaja sub-declarado. Hay que **consolidar en un solo bulto**.

> El plugin oficial de WooCommerce manda el array completo — es un bug que sub-declara peso en
> pedidos multi-ítem. **No copiarlo.**

Diseño: `transformers/consolidate-parcel.ts`
- `productWeight` = suma de pesos de los ítems, **en gramos**
- `dimensions` = heurística de apilado: suma del lado menor de cada ítem, máximo de los otros dos
- `declaredValue` = subtotal del pedido (obligatorio, numérico)
- Validación contra límites **antes** de llamar a la API

### 3.2 `serviceType`: solo `CP` y `EP`

| Código | Producto | SLA | Intentos a domicilio |
|---|---|---|---|
| `CP` | Correo Argentino Clásico | 2–5 días hábiles | 1, luego 5 días hábiles en custodia en sucursal |
| `EP` | Correo Argentino Expreso | 1–3 días hábiles | 2, luego 5 días hábiles en custodia |

⚠️ **`EP` sobre `/v1/orders` está SIN VERIFICAR.** El plugin oficial manda siempre `CP`, incluso
cuando el comprador eligió Expreso — ninguna integración pública ejercita `EP`. **Probar en
`apitest` antes de ofrecerlo.**

No mandar `HC` ni `EE`: `HC` aparece solo como identificador interno SAP en respuestas de tracking;
`EE` pertenece a la API legacy de tracking retail, otro namespace.

Existe un tercer producto comercial (**Paq.ar Hoy**, mismo día, CABA/AMBA) sin código conocido en
ninguna documentación pública. Pedirlo al ejecutivo de cuenta si el negocio lo quiere.

### 3.3 `deliveryType` y su mapeo

| Valor API | Equivalente SOAP | Soportado en v1 |
|---|---|---|
| `homeDelivery` | `D` | ✅ |
| `agency` | `S` | ✅ |
| `locker` | `B` | ❌ (ver D6) |

`agencyId` es **obligatorio** salvo cuando `deliveryType = homeDelivery`, y se valida que la sucursal
esté habilitada para ese `agreement` al momento del alta.

### 3.4 Códigos de provincia: DOS convenciones distintas

El payload de `POST /orders` usa `state` = **código de una letra**. Pero `GET /agencies` filtra por
`stateId` = **ISO 3166-2**. No son lo mismo y hay que mapear en las dos direcciones.

| | | | | | | |
|---|---|---|---|---|---|---|
| `A` Salta | `B` Buenos Aires | `C` CABA | `D` San Luis | `E` Entre Ríos | `F` La Rioja | `G` Sgo. del Estero |
| `H` Chaco | `J` San Juan | `K` Catamarca | `L` La Pampa | `M` Mendoza | `N` Misiones | `P` Formosa |
| `Q` Neuquén | `R` Río Negro | `S` Santa Fe | `T` Tucumán | `U` Chubut | `V` Tierra del Fuego | `W` Corrientes |
| `X` Córdoba | `Y` Jujuy | `Z` Santa Cruz | | | | |

`zipCode` se valida contra el código de provincia — un CP que no corresponde a la provincia es un 400.
Reutilizar el `normalizePostalCode()` que ya existe (CPA `C1121AAF` → `1121`).

### 3.5 Límites de peso y dimensiones: las fuentes oficiales se contradicen

| Fuente | Peso máx | Dimensiones |
|---|---|---|
| `/rates` (validación dura de la API) | **1 – 25 000 g** | cada lado ≤ 150 cm |
| Errores de `/shipping/import` | — | alto/ancho/largo entre 0 y 255 |
| `apiPaqAr-v2.pdf` | 5 dígitos (99 999 g); *"para cliente 18018 el máximo es 25000"* | 3 chars; *"algunos clientes solo aceptan < 255 cm"* |
| Página Paquetería eCommerce | 25 kg | suma 250 cm, ninguno > 150 |
| FAQ MiCorreo 2026 / Paq.ar Pymes | 50 kg | suma 300 cm, ninguno > 200 |
| Plugin oficial, rama paqar | 30 000 g | largo 150, volumétrico 250 |
| Plugin oficial, rama MiCorreo | 50 000 g | largo 200, volumétrico 300 |

**Postura de producción: validar 25 000 g para cotizar**, porque `/rates` rechaza por encima de eso
sea cual sea el techo comercial. Configurable por env var.

**Peso volumétrico:** divisor `/4000` (cm³ → kg), billed weight = `max(real, volumétrico)`.
⚠️ El `/4000` es un valor de comunidad. Correo lo llama *"coeficiente de aforo"* y **no lo publica**.
Hacerlo configurable (`CORREO_ARGENTINO_AFORO_DIVISOR`, default `4000`) y pedirlo por escrito.

### 3.6 Tracking: la tabla de `statusId` NO está publicada

Verificados solo 3 códigos: `PRE` (preImposición), `CAU` (caduco), `CAN` (en proceso de cancelación).
Revisé también el manual v1 de la API — tampoco la trae. Ninguna integración open source la encodea:
**todas hacen match por substring sobre el TEXTO del evento.**

Diseño: matcher por texto con bucket de fallthrough, y **loguear todo par `statusId` + `status`
desconocido** para armar la tabla real desde tráfico de producción.

```
preimposicion|imposicion|admis   → admitted
transit|despach|planta|clasificac → in_transit
distribuci|reparto|en camino      → out_for_delivery
entregado|delivered               → delivered
devolu|returned                   → returned
cancelad                          → cancelled
caduca|fallid|rechaz              → failed
<sin match>                       → unknown + log.error
```

### 3.7 Otros detalles del contrato

- `saleDate` formato exacto `YYYY-MM-DDTHH:mm:ss-03:00`
- `trackingNumber` opcional, máx 30 chars, único, **lo puede generar el cliente** (ver §5.3)
- `shipmentClientId` documentado como **no funcional** en la versión inicial
- `extClient` en `/tracking`: exactamente 3 chars numéricos; si se omite se appendea `000` al
  `agreement` (`18018` → `18018000`)
- `/labels`: `labelFormat` solo acepta `"10x15"` y `"label"`; cualquier otro valor se ignora en
  silencio y cae al `consRotulo` legacy. Fallas parciales devuelven **200** con `result: "ERROR: ..."`
  por ítem — parsear defensivamente (la doc de Correo es internamente inconsistente: muestra
  `status` y `result`, `fileName` y `filename`)
- URL de tracking público: `https://www.correoargentino.com.ar/formularios/e-commerce?id=<TN>`
- El gateway de paqar devuelve **403 para cualquier path**, incluso inexistentes → no se puede
  enumerar endpoints por probing
- **`/rates` de MiCorreo devuelve `202` con `rates: []` hasta que Correo activa la cuenta
  comercialmente.** No es un bug de código. Verificar activación antes de debuggear nada

---

## 4. Fase 0 — Refactor: generalizar la abstracción de carrier en el storefront

**PR aparte, antes de Correo.** Andreani es el test de regresión.

### 4.1 El bug latente que hay que arreglar primero

`apps/storefront/src/modules/checkout/components/shipping/index.tsx:351-354`

```ts
const isStorePickupOption = (sm) => isPickupOption(sm) && !isAndreaniPickupOption(sm) && !isCdeShippingOption(sm);
```

"Retiro en tienda propia" está definido **en negativo**: cualquier pickup que no sea Andreani ni CDE.
El día que aparezca una opción *"Retiro en sucursal Correo"*, el checkout la clasifica como retiro en
tienda propia → dispara `useStorePickupLocations` → le muestra al comprador **la lista de sucursales
equivocada** → persiste `shipping_method: "retiro_store"` + `pickup_kind: "store"`.

Sin error, sin warning. Falla plausible y silenciosa.

Secundarios: `pickupComplete` (`:904-911`) es un ternario Andreani → store → `true`, así que un
carrier de pickup no reconocido pasa la validación **sin sucursal seleccionada**.

### 4.2 Los 12 puntos donde la identidad del carrier se infiere de strings

| Archivo:línea | Predicado | Inferencia |
|---|---|---|
| `constants.tsx:91` | `isAndreani(name)` | `name.toLowerCase().includes("andreani")` |
| `shipping/index.tsx:289` | `CDE_SHIPPING_OPTION_ID` | **ID de base de datos literal** `"so_01KN55..."` en un componente React |
| `:291-294` | `isCdeShippingOption` | ese ID **o** name incluye `"centro de distribución"` |
| `:298-304` | `isPickupOption` | `fulfillment_set.type === "pickup"` **o** name incluye `"retiro"` |
| `:306` | `isDropzone` | name incluye `"dropzone"` |
| `:309` | `isAndreaniPickupOption` | pickup && (`isAndreani(name)` \|\| `isAndreani(provider_id)`) |
| `:351` | `isStorePickupOption` | definición negativa — ver §4.1 |
| `:71`, `:96` | `SHIPPING_PROVIDER_TAG_REGEX` | `/@(?:andreani\|hop)\b/gi` sobre el nombre de la opción |
| `:173-181` | `savedDeliveryMode` | substrings del nombre otra vez |
| `:1035` | `isAndreaniOption` | name \|\| provider_id |
| `andreani-branches/route.ts:194` | `isHOP` | endpoint origen **o** `description.includes("hop")` |
| `:127-149` | `ShippingProviderBadge` | `brand === "hop" ? ... : andreani` — **Andreani es la rama `else`**, cualquier marca desconocida renderiza su logo |

### 4.3 Trabajo de la Fase 0

1. **Registry de carriers** en `src/lib/constants.tsx` reemplazando `isAndreani` + el
   `getShippingIcon` muerto: `{ id, label, logoSrc, badgeWidth, trackingUrlTemplate, matcher }`.
   `ShippingProviderBadge` y el `<CarrierLogo>` consumen la misma fuente.
2. **`DeliveryMode` deja de conflacionar dos ejes.** Hoy es `"shipping" | "pickup" | "cde"`, que mezcla
   *modalidad de entrega* con *destino de fulfillment*. Pasa a `{ mode: "home" | "branch" | "cde", carrier: string }`.
3. **`data.carrier` explícito en el shipping method.** Hoy `data` solo lleva `{ amount }` y/o
   `{ pickup_kind: "store" }`, y **el id de sucursal viaja por metadata del carrito, no por `data`**
   (`:763-803`). Con un solo campo `pickup_branch_id` el backend no puede saber si es un número de
   sucursal Andreani o un código de sucursal Correo. Agregar `{ carrier, branch_id, branch_code }`
   en `data` y dejar de inferir en el backend (`classify()` de `create-delivery-execution.ts:130-194`).
4. **`isStorePickupOption` en positivo**, sobre `data.pickup_kind === "store"`.
5. **`use-andreani-branches.ts` → `use-carrier-branches.ts`**: `isHOP: boolean` (`:18`) pasa a
   `network: string`; `AndreaniServiceType` pasa a un mapa de service types por carrier; agregar param
   `carrier`.
6. **`/api/store/andreani-branches` → `/api/store/carrier-branches?carrier=…`**: adapters upstream por
   carrier. Preservar `normalizePostalCode()`, `formatOperatingHours()`, el merge con
   `Promise.allSettled` tolerante a fallas parciales (`route.ts:369-402`) y el patrón de sanitización
   de errores (`:121-138`) — todo eso está bien hecho y es reutilizable.
7. **Extraer `getTracking(order) → { number, url, carrier }`.** Hoy la URL de Andreani está hardcodeada
   en **dos** lugares: `order-details-template.tsx:355` y `b2b-order-detail.tsx:111`. Generalizar la
   clave de metadata `andreani_tickets`.
8. **Agregar `selectedBranch` a las deps del re-quote** (`:650`). Hoy es
   `[availableShippingMethods, cart.id, cart.shipping_address?.postal_code]`, así que si el precio
   depende de la sucursal elegida nunca se recotiza.
9. **Testids en las filas de sucursal** (`:1153`) y de tienda (`:1268`) — hoy no tienen, y sin eso no
   se puede escribir el test de regresión multi-carrier.
10. **Limpieza**: el `CDE_SHIPPING_OPTION_ID` literal (`:289`); el `setShippingMethod` paralelo de
    `src/lib/data/cart.ts:351-363` que descarta `data` (verificar que está muerto y borrarlo).

**Fuera de alcance de Fase 0:** B2B. `b2b-checkout-flow.tsx:463-490` usa un
`ShippingOption = { id, name, amount }` plano, sin pickup, sin sucursales, sin `data`. Ahí el pickup
multi-carrier es greenfield, no un refactor. Se trata como fase propia si el negocio lo pide.

**Criterio de aceptación:** el checkout de Andreani (domicilio, sucursal, HOP), el retiro en tienda y
el CDE se comportan **idénticamente** antes y después. Nada de Correo entra en este PR.

---

## 5. Fase 1 — Módulo backend `correo-argentino-fulfillment`

Espeja `src/modules/andreani-fulfillment/`.

```
apps/backend/src/modules/correo-argentino-fulfillment/
├── index.ts                          ModuleProvider(Modules.FULFILLMENT)
├── service.ts                        provider class
├── clients/
│   ├── paqar-client.ts               Apikey + agreement, sin token
│   └── micorreo-client.ts            Basic → JWT, cache de token
├── env-options.ts                    loadCorreoOptionsFromEnv()
├── get-client.ts                     para rutas custom (NO resolver del req.scope)
├── types.ts
├── transformers/
│   ├── order-payload.ts              order → POST /v1/orders
│   ├── consolidate-parcel.ts         N ítems → UN bulto (§3.1)
│   ├── agencies.ts                   /v1/agencies → shape del storefront
│   └── province-codes.ts             letra ↔ ISO 3166-2 ↔ nombre (§3.4)
├── normalizers/
│   └── tracking-status.ts            matcher por texto + fallthrough (§3.6)
├── label-download.ts                 /v1/labels bulk → base64
├── utils/errors.ts
└── README.md                         env vars + flujo operativo
```

### 5.1 Los dos clientes HTTP

**`paqar-client.ts`** — más simple que el de Andreani: **no hay intercambio de token**, la API-Key va
en cada request. Se cae toda la maquinaria de `authenticate()` / `tokenExpiry` / `isAuthenticating` /
interceptor de 401 de `andreani-fulfillment/client.ts:44-125`.

**`micorreo-client.ts`** — sí necesita cache de token: `POST /token` con Basic → JWT.
⚠️ El campo `expires` de la respuesta es un string **sin timezone** (`"2022-04-26 21:16:20"`) y la
timezone es desconocida. **Sub-expirar el cache defensivamente.**
⚠️ Las credenciales Basic de MiCorreo son **por integrador, no por comerciante** (el plugin oficial las
trae hardcodeadas en plaintext). La identidad del comerciante va toda en `customerId`.

Ambos reutilizan de Andreani: `LOOKUP_TIMEOUT_MS = 12000` para lookups en checkout (vs 30s general),
`isTransientError()` (reintentar solo rate-limit / 5xx / sin status), `extractErrorMessage()` (recupera
`.message` de errores rehidratados por el workflow engine de Redis, donde `instanceof Error` es `false`),
y `formatApiErrorBody()`. El formato de error de Correo es consistente en las dos APIs:
`{ timestamp, status, error, message, path }`.

### 5.2 Métodos del provider

| Método | Implementación |
|---|---|
| `getFulfillmentOptions()` | `correo-domicilio` (`homeDelivery`), `correo-sucursal` (`agency`). Cada uno con `service_type` (`CP`/`EP`) en `data` |
| `validateOption(data)` | `data.id` en el mapa de opciones |
| `canCalculate()` | `true` |
| `validateFulfillmentData()` | Persiste en `shipping_method.data`: `provider: 'correo_argentino'`, `delivery_type`, `service_type`, `agency_id?`. Este es el punto donde la data del checkout se guarda |
| `calculatePrice()` | **MiCorreo `POST /rates`**. CP origen de config, CP destino del contexto, `deliveredType` D/S, `dimensions` del bulto consolidado. Match por `productType === serviceType`. Fallback ver §5.4 |
| `createFulfillment()` | **Stub deliberado**, igual que Andreani (`service.ts:201`): no llama al carrier. La creación real vive en el workflow (§7.1) |
| `cancelFulfillment()` | `PATCH /v1/orders/{tn}/cancel`. ⚠️ Solo funciona mientras no fue impuesto — mapear el fallo a un error claro, no tragarlo |
| `createReturnFulfillment()` | Stub, `return_requested: true` |
| `get*Documents()` | `[]` — los rótulos se sirven on-demand por ruta admin |
| `static normalizeOptions()` | Throw si falta `apiKey` / `agreement`; computa hostnames según `testMode`; anida `sender`, `origin`, `limits` |

### 5.3 Decisión abierta: ¿quién genera el `trackingNumber`?

`trackingNumber` es opcional en `POST /orders`; si no se manda, Correo lo genera y lo devuelve.
Pero **lo podemos generar nosotros** (máx 30 chars, único por agreement).

**Recomiendo generarlo nosotros, y es una mejora real sobre Andreani.** Razón: **idempotencia**. Si
`POST /orders` timeoutea pero el alta sí ocurrió del lado de Correo, con un TN propio determinístico
el reintento falla con "duplicado" y sabés que ya está creado. Con un TN generado por Correo no tenés
forma de saberlo y terminás con órdenes duplicadas y flete doble.

Beneficio secundario: mata los placeholders `PENDING-<display_id>` que hoy usa Andreani
(`service.ts:219-229`) y que el storefront tiene que filtrar a mano
(`order-details-template.tsx:193-198`).

Contra: el formato tiene que ser único **para siempre** dentro del agreement, así que la colisión es
irrecuperable. Mitigación: prefijo de tenant + `display_id` + sufijo corto determinístico.

> **Pendiente de confirmar con Correo:** si el agreement acepta TNs generados por el cliente y si hay
> un formato/longitud pactado previamente (el manual dice *"o envía el cliente seller en un
> formato/longitud específico previamente definido"* — o sea, se pacta).

### 5.4 Fallback de cotización (D4)

Cuando `POST /rates` falla o devuelve `rates: []`:

```ts
// Decisión del negocio (D4): mismo comportamiento que Andreani — amount 0.
// El comprador ve "Gratuito". Consistencia elegida explícitamente.
logger.error('[correo-argentino] rate lookup failed, degrading to 0', { ... });
return { calculated_amount: 0, is_calculated_price_tax_inclusive: true };
```

⚠️ **Riesgo aceptado y documentado:** un timeout del carrier se le presenta al comprador como envío
gratis y el flete lo absorbe el negocio. Se mitiga con visibilidad, no con UX: `logger.error` +
Sentry + un contador para poder medir cuántas veces pasa. Si el número duele, se revisa la decisión
con datos en la mano.

Ojo también: `shipping/index.tsx:1016-1018` mapea `amount === 0` al literal `"Gratuito"` para `flat`
y `calculated` por igual — es el mismo camino por el que hoy pasa Andreani.

---

## 6. Fase 2 — Registro, opciones de envío y seeds

### 6.1 `medusa-config.ts`

Seguir el patrón exacto de Andreani (`:426-447`), gateado por env var:

```ts
...(hasExtensionSource('correo-argentino-fulfillment') && process.env.CORREO_ARGENTINO_API_KEY
  ? [{ resolve: './src/modules/correo-argentino-fulfillment', id: 'correo_argentino',
       options: loadCorreoOptionsFromEnv() }]
  : []),
```

`provider_id` resultante: `correo_argentino_correo_argentino`. Clave de contenedor:
`fp_correo_argentino_correo_argentino`.

> El loader de opciones está **duplicado** inline en `medusa-config.ts:18-42` y en
> `env-options.ts` — el comentario del archivo dice explícitamente que hay que mantenerlos en sync.
> Replicar la convención (y su nota).

### 6.2 Env vars

```
CORREO_ARGENTINO_API_KEY          # gate de registro
CORREO_ARGENTINO_AGREEMENT
CORREO_ARGENTINO_SELLER_ID        # opcional; si falta, se completa con agreement
CORREO_ARGENTINO_TEST_MODE
CORREO_ARGENTINO_MICORREO_USER    # Basic para POST /token
CORREO_ARGENTINO_MICORREO_PASS
CORREO_ARGENTINO_CUSTOMER_ID      # identidad MiCorreo para /rates
CORREO_ARGENTINO_SERVICE_TYPE     # CP | EP (default CP)
CORREO_ARGENTINO_ORIGIN_POSTAL_CODE
CORREO_ARGENTINO_ORIGIN_STREET / _NUMBER / _CITY / _STATE   # _STATE = letra (§3.4)
CORREO_ARGENTINO_SENDER_NAME / _EMAIL / _PHONE
CORREO_ARGENTINO_MAX_WEIGHT_G     # default 25000 (§3.5)
CORREO_ARGENTINO_AFORO_DIVISOR    # default 4000, SIN VERIFICAR (§3.5)
CORREO_ARGENTINO_AUTO_FULFILL
CORREO_ARGENTINO_TRACKING_SYNC_SCHEDULE
```

### 6.3 Seeds

Espejar `seed-andreani-domicilio.ts` y `seed-andreani-pickup.ts` (idempotentes):

- `seed-correo-domicilio.ts` — zona *shipping* `Argentina`, `price_type: 'calculated'` (**sin** array
  de `prices`), `data: { id: 'correo-domicilio', service_type: 'CP', delivery_type: 'homeDelivery' }`
- `seed-correo-sucursal.ts` — fulfillment set `type: 'pickup'`,
  `data: { id: 'correo-sucursal', service_type: 'CP', delivery_type: 'agency' }`

**Dos trampas conocidas de Medusa:**

1. **Los nombres de service zone son globalmente únicos** (`seed.ts:354`). La zona de pickup de Correo
   necesita un nombre distinto del de Andreani.
2. **El provider tiene que estar linkeado al stock location ANTES** de `createShippingOptionsWorkflow`,
   o falla con *"not enabled for the service location"* (`seed.ts:341-347`):

```ts
await link.create({
  [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
  [Modules.FULFILLMENT]: { fulfillment_provider_id: 'correo_argentino_correo_argentino' },
});
```

Reglas de cada opción: `[{ enabled_in_store: 'true' }, { is_return: 'false' }]`.

---

## 7. Fase 3 — Workflows, rutas y subscribers

### 7.1 `correo-generate-tickets` workflow

Espeja `andreani-generate-tickets.ts` (910 líneas) — es el **único** camino que crea un envío real.

Steps: `validate-order` → `create-order-shipment` (`POST /v1/orders`) → `save-ticket-metadata`
(appendea a `order.metadata.correo_tickets[]`) → `link-to-delivery-execution` (best-effort) →
`emit-ticket-generated` (solo en el primer ticket).

Reutilizar `withPickupRetry(fn, logger, label, maxAttempts = 3)` con backoff lineal
(`andreani-generate-tickets.ts:166-190`) y `isTransientError()`.

### 7.2 Rutas API

**Admin** — `src/api/admin/correo-argentino/`
`fulfillments/`, `labels/`, `labels/bulk/`, `orders/[orderId]/tickets/`, `tickets/bulk/`,
`tracking/[trackingNumber]/`

> `/v1/labels` es **bulk nativo**, así que `labels/bulk` es mucho más simple que en Andreani (que
> tiene que hacer N llamadas y armar el ZIP con `archiver`). Acá una sola llamada trae todos los
> base64. Mantener el `MAX_ORDERS = 50` y el ZIP para la descarga, pero el fan-out desaparece.
> Parsear el `result` por ítem: `"OK"` vs `"ERROR: ..."` con HTTP 200 (§3.7).

**Store** — `src/api/store/correo-argentino/`
`rates/`, `agencies/`, `tracking/[trackingNumber]/`

Patrones a copiar tal cual:
- `statusForError(message)` mapeando prefijos de error del workflow a códigos HTTP
  (`admin/andreani/orders/[orderId]/tickets/route.ts:16-33`)
- `sendError(res, status, { code, message })` con timestamp y validación de CP de 4 dígitos
  (`store/andreani/rates/route.ts:41-45`, `:68`)
- **Construir el cliente desde env con `get-client.ts`, NO resolver el provider del `req.scope`** — el
  comentario en `rates/route.ts:85-86` dice que la resolución desde el request scope no es confiable
  en rutas custom
- Cachear `/v1/agencies` 12 h (el plugin oficial lo hace con transients y es sensato)

### 7.3 Subscribers y jobs

- `correo-order.ts` — `order.placed` / `payment.captured`, gateado por
  `CORREO_ARGENTINO_AUTO_FULFILL === 'true'`, idempotente por `order.fulfillments?.length`
- `correo-ticket-tracking-whatsapp.ts` — sobre `correo.ticket_generated`
- `sync-correo-tracking-status.ts` — espeja `sync-andreani-tracking-status.ts:175`. Paginar
  `delivery_execution` con `PAGE_SIZE = 200` y `$nin` sobre estados terminales; replicar la
  compensación de drift de offset (`:107-159`, sutil pero necesaria); gate de horario comercial.
  **Ventaja: `GET /v1/tracking` acepta un array de TNs**, así que se puede batchear en vez de una
  llamada por envío

### 7.4 Módulo `delivery`

`src/modules/delivery/types.ts:15` — extender el union **junto con** `DELIVERY_TRANSITIONS` y
`POD_REQUIRED_PROVIDER_TYPES` (`:165`), van los tres o ninguno:

```ts
type DeliveryProviderType = 'andreani' | 'own_fleet' | 'store_pickup' | 'correo_argentino';
```

Nuevo adapter `providers/correo-argentino/index.ts` extendiendo `AbstractDeliveryProvider`:
`quote()` throw (la cotización vive en el provider de fulfillment, igual que Andreani),
`createShipment()` → delega al workflow, `getLabel()` → `/v1/labels`, `pollStatus()` → `/v1/tracking`
+ normalizer, `listPickupPoints()` → `/v1/agencies`. Registrar en `registry.ts:40-83`.

⚠️ **`classify()` en `create-delivery-execution.ts:130-194` tiene como fallback por defecto
`own_fleet`/`home_delivery`** (`:194`). Un carrier nuevo sin hint explícito se convierte
silenciosamente en flota propia. Con `data.carrier` de la Fase 0 esto deja de ser adivinanza — pero
hay que agregar la rama igual.

---

## 8. Fase 4 — Admin UI

Espejar la estructura de Andreani (`src/admin/routes/andreani/`):

- `routes/correo-argentino/page.tsx` — nav item, `defineRouteConfig({ label, icon: TruckFast, rank })`
  + `<Navigate to="/correo-argentino/envios" replace />`
- `routes/correo-argentino/envios/page.tsx` — listado de envíos
- `routes/correo-argentino/configuracion/page.tsx` — config
- `widgets/order-correo-widget.tsx` — zona `order.details.after`. Hace su propio fetch en vez de
  confiar en `DetailWidgetProps.data` (ver el comentario en `order-andreani-widget.tsx:6-8`), y
  descarga rótulos con `fetch(..., { credentials: 'include' })` + blob porque las URLs de rótulo
  necesitan el token de API
- `hooks/api/correo-argentino.tsx` — query keys + hooks con `@tanstack/react-query`, `staleTime` 30s
  para tracking
- `translations/correo-argentino/index.ts` — patrón `register*Translations(i18n)` por página (ver la
  nota de dedupe en `medusa-config.ts:130-165`)

Todo con `@medusajs/ui`, `@medusajs/icons` y el singleton `sdk` de `src/admin/lib/client.ts`.
Recordar: `src/admin` **está excluido** del `tsc --noEmit`.

---

## 9. Fase 5 — Storefront: Correo en el checkout

Con la Fase 0 hecha, esto es mayormente configuración:

1. Registrar Correo en el registry de carriers + agregar el asset del logo en
   `apps/storefront/public/` (**hoy no existe** ninguno de Correo)
2. Adapter de sucursales en `/api/store/carrier-branches` apuntando a `/store/correo-argentino/agencies`
3. Rama de branding en `<CarrierLogo>` / `ShippingProviderBadge`
4. Template de URL de tracking: `https://www.correoargentino.com.ar/formularios/e-commerce?id=<TN>`
5. Test Playwright de regresión multi-carrier (hoy **no hay ninguna** cobertura del paso de envío;
   los testids que faltan se agregan en Fase 0)

**No requiere cambios** (ya son carrier-agnostic): `lib/data/fulfillment.ts`,
`checkout.repository.ts:51-85`, `api/store/shipping-options/route.ts`, `api/store/cart/route.ts`,
`cart.repository.ts:914-946` (pasa `data` verbatim), `account/components/order-card`,
`use-checkout.ts:115-127` (el split más limpio del codebase: solo `fulfillment_set.type`, sin
name-sniffing — irónicamente el componente de checkout lo reimplementa peor).

Un solo cambio chico en `checkout-form-client.tsx:230-253`, que hardcodea los tres literales
`retiro_*` de metadata.

---

## 10. Fase 6 — Packaging como extensión

Para paridad con Andreani, que es una extensión seleccionable del catálogo:

- `packages/project-catalog/src/catalog.json` — entry `{ id: "correo-argentino", category: "integraciones", dependencies: ["delivery"] }`
- `packages/project-composer/src/component-definitions.js` — lista de archivos/carpetas
- `packages/project-composer/src/component-metadata.js` — manifest de env vars
- `packages/project-composer/src/extension-integrations.js` — hooks de admin (`:75`) y traducciones (`:91`)

⚠️ Los manifests de extensiones tienen sha256 calculados con CRLF — ver el gotcha ya registrado del proyecto.

---

## 11. Testing

El backend usa **`node:test` + `node:assert/strict`**, ~110 archivos, **todos tests unitarios de
funciones puras**. No hay `@medusajs/test-utils`, ni `medusaIntegrationTestRunner`, ni jest, ni vitest.
Comando: `pnpm test` desde `apps/backend`.

Cobertura unitaria a escribir (todo esto es puro y no necesita credenciales):

- `province-codes.test.ts` — las 24 letras, ida y vuelta, ISO 3166-2, inputs inválidos
- `consolidate-parcel.test.ts` — N ítems → un bulto, peso volumétrico, heurística de apilado, techos
- `order-payload.test.ts` — payload completo para los dos `deliveryType`; que `agencyId` sea
  obligatorio en `agency` y ausente en `homeDelivery`; formato de `saleDate`; campos obligatorios
- `tracking-status.test.ts` — los 3 códigos conocidos, el matcher por texto, el bucket `unknown`
- `label-parse.test.ts` — respuesta bulk con fallas parciales, `fileName` vs `filename`,
  `status` vs `result`
- `rates-parse.test.ts` — match por `productType`, `rates: []` (cuenta sin activar), camino de fallback
- `errors.test.ts` — `isTransientError` (retry solo en rate-limit/5xx/sin status), `extractErrorMessage`

⚠️ **`src/modules/migration-names.test.ts` fuerza la convención
`Migration<YYYYMMDDHHmmss><ModuleInPascal>.ts`** — es globalmente única porque `mikro_orm_migrations`
es una sola tabla compartida y umzug indexa por nombre de archivo. Cualquier migración nueva que no
cumpla **rompe `pnpm test`**. Ver `apps/backend/CLAUDE.md` y
`docs/recipes/migraciones-modulos-custom.md`.

---

## 12. Riesgos y unknowns

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **`EP` sin verificar en `/v1/orders`** | Si no está habilitado, Expreso no se puede ofrecer | Probar en `apitest` el día 1. Arrancar solo con `CP` |
| **Tabla de `statusId` desconocida** | Estados de delivery mal mapeados | Matcher por texto + `unknown` + log de todo par desconocido. Harvestear de producción |
| **`/rates` devuelve `[]` si la cuenta no está activada comercialmente** | Todo cotiza $0 y nadie se da cuenta | Verificar activación ANTES de debuggear. Health check en el smoke test |
| **Coeficiente de aforo `/4000` sin verificar** | Peso facturado mal calculado → cotizaciones incorrectas | Env var configurable. Pedirlo por escrito |
| **Techo de peso contradictorio (25/30/50 kg)** | Rechazos en el alta o promesas incumplidas | Validar 25 000 g (el límite duro de `/rates`) hasta tener confirmación |
| **`parcels[]` descarta todo menos el primero** | Envíos sub-declarados, sobrecostos de Correo | Consolidación explícita + test unitario. **No** reusar `box-packer` |
| **Fallback de tarifa a $0 = "Gratuito" (D4)** | Flete regalado en cada falla del carrier | Riesgo aceptado. `logger.error` + Sentry + contador para medirlo |
| **`cancel` solo funciona antes de la imposición** | Cancelaciones que fallan sin explicación clara | Mapear el fallo a un mensaje accionable, no tragarlo |
| **Sandbox de Correo inestable** (reportado por integradores) | QA bloqueada intermitentemente | Fixtures + tests unitarios para no depender del sandbox |
| **Refactor de Fase 0 sobre un componente de 1532 líneas en producción** | Regresión en el checkout de Andreani, que factura | PR separado, Andreani como regresión viva, testids + test Playwright antes de tocar |

---

## 13. Qué hay que pedirle al ejecutivo de cuenta de Correo

Cinco cosas que **no se pueden deducir de ninguna fuente pública** y que cada una puede romper
producción:

1. **La tabla completa `statusId` → significado**, especialmente entregado, intento fallido, devuelto
   al remitente y disponible para retiro en sucursal.
2. **Si `serviceType: "EP"` está habilitado** en nuestro `agreement` para `POST /v1/orders`.
3. **El techo real de peso** del acuerdo (25 / 30 / 50 kg) y el **coeficiente de aforo** para peso
   volumétrico.
4. **Si el agreement acepta `trackingNumber` generado por nosotros** y con qué formato/longitud pactada.
5. **Si `deliveryType: "locker"` está habilitado** y, en ese caso, cómo se identifica un locker en la
   respuesta de `/v1/agencies` (hoy no hay campo discriminador).

Bonus, si el negocio quiere el producto same-day: **el código de `serviceType` de Paq.ar Hoy**, que no
figura en ninguna documentación.

---

## 14. Secuencia de ejecución

```
Fase 0  Refactor storefront (carrier registry)        ← sin credenciales, empieza YA
Fase 1  Módulo backend: clientes + transformers + tests unitarios   ← sin credenciales
Fase 2  Provider + registro + seeds                   ← sin credenciales
Fase 3  Workflows + rutas + subscribers + delivery adapter          ← sin credenciales
─────────────────────── llegan las credenciales ───────────────────────
QA      Smoke test contra apitest: /auth → /agencies → /rates → /orders → /labels → /tracking
Fase 4  Admin UI
Fase 5  Storefront: Correo en el checkout
Fase 6  Packaging de extensión
```

Las fases 0 a 3 no dependen de credenciales: el contrato está documentado y los tests son unitarios
sobre funciones puras. Cuando lleguen, el smoke test valida el contrato real de punta a punta y recién
ahí se ajusta lo que difiera.
