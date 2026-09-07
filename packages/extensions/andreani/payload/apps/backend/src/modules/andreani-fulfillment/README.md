# Andreani — integración de fulfillment

Provider de fulfillment de Medusa para Andreani (Argentina). Single-tenant:
las credenciales vienen por variables de entorno.

## Funcionalidades

- **Provider de fulfillment** (`createFulfillment`): cotización, sucursales/HOP,
  tracking, y creación de etiqueta en el flujo nativo de Medusa.
- **Generación de etiquetas on-demand**: `POST /admin/andreani/orders/:id/tickets`
  crea un envío nuevo y guarda el ticket en `order.metadata.andreani_tickets[]`.
- **Generación masiva**: `POST /admin/andreani/tickets/bulk` → ZIP con los PDFs.
- **Descarga de etiqueta**: `POST /admin/andreani/labels` y
  `GET /admin/andreani/labels/:shipmentId`.
- **Cajas (box packing)**: módulo `andreani-data` + `POST/GET /admin/andreani/boxes`.
  El box-packer arma los bultos con las cajas activas (o defaults si no hay).
- **Auto-fulfillment al pagar** (opcional): subscriber gateado por `ANDREANI_AUTO_FULFILL`.
- **Job de sync de tracking**: transiciona los envíos a shipped/delivered.

## Variables de entorno

> Estas variables NO están en `.env.template` (archivo protegido). Agregalas a mano.

### Credenciales / origen (requeridas para habilitar el provider)

```bash
ANDREANI_USERNAME=          # habilita el provider si está seteada
ANDREANI_PASSWORD=
ANDREANI_CONTRACT=
# ⚠️ El DEFAULT es QA. Una instalación productiva que no la setea despacha contra
# el entorno de prueba y las etiquetas no valen. En el admin es un desplegable de
# dos opciones (Ajustes → Andreani → "Entorno de la API"); acá son estos dos
# valores exactos y nada más.
ANDREANI_HOSTNAME=apisqa.andreani.com   # prod: apis.andreani.com
ANDREANI_CLIENT_CODE=                   # opcional
# Heredada: hoy no cambia nada, porque sólo elegía el host cuando ANDREANI_HOSTNAME
# venía vacío y ese campo siempre tiene default.
ANDREANI_TEST_MODE=true                 # opcional

ANDREANI_SENDER_NAME=
ANDREANI_SENDER_EMAIL=                  # opcional
ANDREANI_SENDER_PHONE=                  # opcional
ANDREANI_SENDER_DOC_TYPE=               # opcional
ANDREANI_SENDER_DOC_NUMBER=             # opcional

ANDREANI_ORIGIN_POSTAL_CODE=
ANDREANI_ORIGIN_STREET=
ANDREANI_ORIGIN_NUMBER=
ANDREANI_ORIGIN_CITY=
ANDREANI_ORIGIN_PROVINCE=
```

### Nuevas (features portadas de Saphirus)

```bash
# Auto-crear el fulfillment (y la etiqueta) cuando la orden se paga.
ANDREANI_AUTO_FULFILL=false

# Cron del job de sync de tracking (default: cada hora).
ANDREANI_TRACKING_SYNC_SCHEDULE=0 * * * *
# Si true, el job solo corre 8–21h ART (UTC-3).
ANDREANI_TRACKING_BUSINESS_HOURS_ONLY=false

# Overrides de contrato por tipo de servicio (opcionales).
ANDREANI_DOMICILIO_CONTRACT_OVERRIDE=
ANDREANI_SUCURSAL_CONTRACT_OVERRIDE=
ANDREANI_PUNTO_DE_TERCERO_CONTRACT_OVERRIDE=

# Fallback de dimensiones (OPT-IN). Por default el box-packer es estricto y
# aborta la etiqueta si un producto (no-kit) no tiene length/width/height.
# Con enabled=true, rellena los faltantes con estos valores y loggea un warning.
# OJO: Andreani cotiza por volumen real — usar medidas truchas puede generar
# costo/dimensionado incorrecto. Preferí cargar las medidas reales en el producto.
ANDREANI_DIMENSION_FALLBACK_ENABLED=false
ANDREANI_DIMENSION_FALLBACK_LENGTH=30   # cm (default 30)
ANDREANI_DIMENSION_FALLBACK_WIDTH=20    # cm (default 20)
ANDREANI_DIMENSION_FALLBACK_HEIGHT=15   # cm (default 15)
ANDREANI_DIMENSION_FALLBACK_WEIGHT=0.5  # kg por unidad (default 0.5)
```

## Flujo de creación de envíos (provider stubbeado)

El provider `createFulfillment` está **stubbeado a propósito**: NO crea el envío
real en Andreani. Solo registra la intención (el fulfillment nativo de Medusa se
crea con un tracking placeholder `PENDING-<id>` y `status: pending_label`).

La creación del envío real (`POST /v2/ordenes-de-envio`) y la etiqueta se
disparan **únicamente on-demand** vía el workflow `andreani-generate-tickets`
(botón "Generar etiqueta" / generación masiva en el admin). Esto garantiza un
único camino de creación y evita el doble envío.

Flujo operativo:
1. Se crea el fulfillment (nativo o vía `ANDREANI_AUTO_FULFILL`) → queda
   `PENDING-<id>`.
2. Desde el admin se aprieta "Generar etiqueta" (o bulk) → se crea el envío real
   y la etiqueta queda en `order.metadata.andreani_tickets[]`.
3. El job de sync transiciona shipped/delivered (ignora los `PENDING-*`).
```
