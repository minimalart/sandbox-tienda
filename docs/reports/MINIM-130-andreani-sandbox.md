# Reporte — Andreani sandbox / puntos HOP (MINIM-130)

**Fecha:** 2026-06-12
**Ticket:** MINIM-130 — Configurar Andreani sandbox para cotización o envío de prueba
**Módulo base:** `apps/backend/src/modules/andreani-fulfillment` (fulfillment provider ya existente)

## Resumen ejecutivo

La integración de Andreani **ya existía completa** en el boilerplate (provider de fulfillment, cliente HTTP, endpoints de cotización, sucursales, puntos HOP y tracking, hooks de storefront y widgets de admin). El problema reportado —**"no se ven los puntos HOP en el envío"**— no era un bug del código de HOP, sino que **faltaba sembrar una shipping option de retiro Andreani**: el checkout solo dispara la búsqueda de puntos HOP cuando hay una opción de *pickup* cuyo provider es Andreani, y el seed solo creaba opciones `manual_manual` (Estándar/Express).

Este cambio agrega al seed una **fulfillment set de tipo `pickup` + shipping option Andreani**, gateada por `ANDREANI_USERNAME`. Cuando hay credenciales sandbox cargadas, el checkout expone *"Retiro en punto Andreani HOP"* y al seleccionarla busca los puntos HOP (PuntoDeTercero) para el código postal del carrito.

## ¿Existe sandbox de Andreani? Sí — verificado

Andreani expone un entorno **QA / sandbox** en `apisqa.andreani.com` (producción es `apis.andreani.com`). El provider lo selecciona solo:

- `ANDREANI_TEST_MODE=true` → usa `apisqa.andreani.com` automáticamente.
- `ANDREANI_HOSTNAME` → override explícito si Andreani te asigna otro host.

Ver `normalizeOptions()` en `apps/backend/src/modules/andreani-fulfillment/service.ts` (selección de hostname por `testMode`).

### Verificación contra QA (2026-06-12)

Probado en vivo contra `apisqa.andreani.com` con las credenciales QA del cliente:

| Flujo | Request | Resultado |
|-------|---------|-----------|
| Login | `GET /login` (Basic auth) | **HTTP 200**, token recibido (válido ~24h). |
| Puntos HOP | `GET /v2/puntos-de-tercero?contrato=400018602&atencionPorCodigoPostal=1425` | **HTTP 200**, **4 puntos HOP** con dirección, coordenadas y horarios. |
| Cotización | `GET /v1/tarifas?cpDestino=1425&contrato=400018596&bultos[0][...]` | **HTTP 200**, tarifa con IVA ≈ $8037.13 (2 kg). |

> Las credenciales (usuario/password) **no se versionan**: viven en `apps/backend/.env` (gitignored). Acá solo se documenta el resultado de la prueba.

### Contratos por tipo de servicio

Andreani asigna un número de contrato por tipo de servicio. El boilerplate usa **un solo** `ANDREANI_CONTRACT`, así que se elige según el flujo que se quiera demostrar:

| Servicio | Contrato QA |
|----------|-------------|
| A domicilio | `400018596` |
| Retiro por sucursal / Punto de Tercero (HOP) | `400018602` |

Para el flujo HOP del seed, usar `ANDREANI_CONTRACT=400018602`.

## Configuración segura de credenciales

Todas las credenciales viajan por **variables de entorno** (nunca hardcodeadas ni en el seed). El provider **solo se registra si `ANDREANI_USERNAME` está seteada** (`medusa-config.ts`, módulo FULFILLMENT). Sin credenciales, la app funciona igual y la opción de retiro Andreani no se siembra.

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `ANDREANI_USERNAME` | sí | Usuario API. Gatea el registro del provider **y** el seed de la opción HOP. |
| `ANDREANI_PASSWORD` | sí | Contraseña API (Basic auth → token). |
| `ANDREANI_CONTRACT` | sí | Número de contrato. |
| `ANDREANI_TEST_MODE` | recomendada | `true` para apuntar al sandbox QA. |
| `ANDREANI_HOSTNAME` | opcional | Override del host (si QA usa otro dominio). |
| `ANDREANI_CLIENT_CODE` | opcional | Código de cliente. |
| `ANDREANI_SENDER_NAME` / `_EMAIL` / `_PHONE` / `_DOC_TYPE` / `_DOC_NUMBER` | recomendadas | Datos del remitente para la orden de envío. |
| `ANDREANI_ORIGIN_POSTAL_CODE` / `_STREET` / `_NUMBER` / `_CITY` / `_PROVINCE` | recomendadas | Origen del envío (depósito). |

Si faltan `username`/`password`/`contract`, el provider lanza error explícito al iniciar.

## Qué cambió en este PR

### Backend — `apps/backend/src/scripts/seed.ts`

Bloque **4b** nuevo, idempotente y gateado por `ANDREANI_USERNAME`:

1. Crea una fulfillment set `Retiro Andreani` de **`type: 'pickup'`** con service zone Argentina.
2. La linkea al stock location.
3. Crea la shipping option **"Retiro en punto Andreani HOP"**:
   - `provider_id: 'andreani_andreani'` → matchea `isAndreani()` en el storefront.
   - El nombre contiene *"Retiro"* (→ `isPickupOption`) y *"Andreani"* (→ `isAndreani`), por lo que `isAndreaniPickupOption()` da `true` y gatilla el lookup de HOP.
   - `data: { id: 'andreani-punto-tercero', service_type: 'PuntoDeTercero' }` → al fulfillar, `resolveServiceType()` crea el envío como **PuntoDeTercero (HOP)**.
   - `price_type: 'flat'`, gratuita: la opción queda **siempre seleccionable**, que es lo que dispara la visibilidad de los HOP. La cotización en vivo se valida aparte (ver abajo).

### Documentación

- Este reporte (`docs/reports/MINIM-130-andreani-sandbox.md`).

## Cómo valida el checkout cotización / envío

| Flujo | Endpoint / mecanismo | Resultado |
|-------|----------------------|-----------|
| **Puntos HOP** | Storefront → `GET /store/andreani/hop-points?postal_code=XXXX` (vía `useAndreaniBranches` con `PuntoDeTercero`) | Lista de puntos HOP cercanos al CP del carrito. |
| **Cotización** | `POST /store/andreani/rates` (provider `calculatePrice` → API de tarifas QA) | Precio por CP destino + peso + valor declarado. |
| **Envío** | `createFulfillment()` → `POST /v2/ordenes-de-envio` | Nº de tracking + etiqueta. Service type según `data` (HOP). |
| **Tracking** | `GET /store/andreani/tracking/:nro` → `/v2/envios/{id}/trazas` | Estado y eventos. |

> **Decisión de diseño:** la opción de retiro se sembró `flat`/gratuita en vez de `calculated`. Con `calculated`, el radio del checkout queda **deshabilitado hasta que la API de tarifas responde**; si el sandbox falla o tarda, los HOP **nunca aparecen** — el problema original. Con `flat` la opción es siempre seleccionable y los HOP se ven de forma confiable. La cotización en vivo se prueba por `/store/andreani/rates`.

## Cómo replicar en un proyecto nuevo

1. Pedir credenciales sandbox a Andreani (usuario, password, contrato) y datos de remitente/origen.
2. Cargar las env vars de la tabla de arriba, con `ANDREANI_TEST_MODE=true` y `ANDREANI_CONTRACT=400018602` (HOP).
3. Levantar el backend → el provider `andreani` se registra automáticamente.
4. Crear la opción de retiro Andreani:
   - **Base nueva (primera corrida):** `pnpm db:seed` — el bloque 4b crea la opción *"Retiro en punto Andreani HOP"*.
   - **Base existente (el seed ya corrió):** `dotenv -e .env -- medusa exec ./src/scripts/seed-andreani-pickup.ts`. El seed completo no es re-ejecutable (su paso de regiones falla si `ar` ya está asignado), así que este script standalone e idempotente crea solo la opción Andreani reusando región/stock/profile.
5. En el storefront, en el checkout cargar una dirección con CP argentino válido y elegir el retiro Andreani → se listan los puntos HOP.

> **Gotchas encontrados al correrlo de verdad (ya corregidos):**
> - El nombre de service zone es **único globalmente** en Medusa → la zona del pickup no puede llamarse `Argentina` (la usa la set principal). Se nombró `Argentina (Andreani HOP)`.
> - El provider `andreani_andreani` debe **linkearse al stock location** antes de crear la shipping option, o falla con *"not enabled for the service location"*.

## Fallback si no hay sandbox

Si Andreani no provee credenciales sandbox para un proyecto, el comportamiento es **degradado controlado**, no roto:

- Sin `ANDREANI_USERNAME`: el provider no se registra y el seed **no crea** la opción de retiro Andreani. El checkout sigue funcionando con los envíos `manual_manual` (Estándar/Express). No se rompe nada.
- Para un demo sin credenciales reales que igual muestre los HOP, queda como mejora futura un *fallback* con datos HOP mockeados (fuera del alcance de este PR; ver opción descartada en el ticket).

## Archivos tocados

| Archivo | Qué cambió |
|---------|------------|
| `apps/backend/src/scripts/seed.ts` | Bloque 4b: fulfillment set `pickup` + shipping option Andreani HOP, gateado por `ANDREANI_USERNAME`. Incluye el link del provider al stock location y zona con nombre único. |
| `apps/backend/src/scripts/seed-andreani-pickup.ts` | Script standalone e idempotente para crear la opción HOP sobre una base existente. |
| `docs/reports/MINIM-130-andreani-sandbox.md` | Este reporte. |
