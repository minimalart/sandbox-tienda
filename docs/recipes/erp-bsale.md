# ERP → Bsale (Chile)

Cómo activar la extensión ERP con **Bsale** (api.bsale.io). Los dos flujos del
MVP quedan operativos: stock Bsale → Medusa por SKU y emisión de un documento
en Bsale por cada venta cobrada (trigger: pago capturado).

## Requisitos

- Token de la API de Bsale (`access_token`): en Bsale, **Configuración →
  Integraciones / API** (lo entrega Bsale por cuenta). Todas las llamadas van
  con el header `access-token`.
- Los SKUs de Medusa deben coincidir con el `code` de las variantes en Bsale
  (matching exacto; la extensión sanitiza espacios/saltos de línea).

## Encontrar los IDs de la cuenta

Los settings numéricos salen de la cuenta Bsale. Se consultan una vez por API:

```bash
# Sucursales (office_id)
curl -H "access-token: $TOKEN" "https://api.bsale.io/v1/offices.json"

# Tipos de documento (document_type_id) — buscar "Nota de Venta" o "Boleta Electrónica"
curl -H "access-token: $TOKEN" "https://api.bsale.io/v1/document_types.json"

# Formas de pago (payment_type_id)
curl -H "access-token: $TOKEN" "https://api.bsale.io/v1/payment_types.json"

# Impuestos (tax_ids) — el IVA 19% suele ser id 1
curl -H "access-token: $TOKEN" "https://api.bsale.io/v1/taxes.json"

# Listas de precio (price_list_id, opcional)
curl -H "access-token: $TOKEN" "https://api.bsale.io/v1/price_lists.json"
```

## Configuración en el admin

En **ERP → Configuración**:

1. Provider: `Bsale (Chile)` · País: `Chile`.
2. Credenciales → agregar la clave `access_token` con el token (write-only:
   nunca se vuelve a mostrar).
3. Sección Bsale:
   - `Office ID`: sucursal para stock y documentos. Vacío = el stock suma
     todas las sucursales.
   - `Document type ID`: **requerido para notificar ventas**. Recomendado para
     arrancar: el ID de **Nota de Venta** (no declara al SII); pasar a Boleta
     Electrónica + "Declarar al SII" recién cuando el flujo esté validado.
   - `Payment type ID`: opcional; sin esto el documento se emite sin pagos.
   - `Tax IDs`: default `1` (IVA 19% en cuentas estándar).
   - `Los precios de Medusa incluyen IVA`: activado (default) divide por 1.19
     para mandar netos; el envío va como línea extra "Costo de envío".
   - `Descontar stock en Bsale al emitir`: activarlo solo si Bsale no recibe
     la venta por otro canal (evita doble descuento).
4. "Validar conexión" (verifica token y, si está seteada, que la office exista)
   → activar la integración y los flujos.

## Semántica

- **Stock**: Bsale es fuente de verdad. `quantityAvailable` por SKU (sumado
  entre sucursales si no hay office); se escribe como `stocked_quantity` en la
  location configurada. Con catálogo grande el adapter hace un barrido paginado
  de `/v1/stocks.json` (50 por página) en vez de una request por SKU.
- **Venta**: al capturarse el pago se emite el documento configurado, con
  cliente por **RUT** si la orden lo trae (desde `billing_snapshot` tipo RUT,
  `metadata.rut` o `metadata.billing_address.rut`, validado con módulo 11);
  sin RUT sale a consumidor final. La respuesta guarda `id`, `number`,
  `urlPdf` y `urlPublicView` en el evento del outbox (visible en ERP → Ventas).
- **Errores**: red/5xx reintentan con backoff; config/payload inválidos
  (falta `document_type_id`, SKU inexistente en Bsale, ítem sin SKU) van a
  `dead_letter` directo — corregir y reintentar a mano desde ERP → Ventas.
- **Idempotencia**: una notificación por orden (clave por order_id). Ojo: si
  Bsale acepta el documento pero la respuesta se pierde (timeout justo ahí),
  el retry puede duplicar el documento — Bsale no tiene clave idempotente.
  Es el mismo riesgo del flujo original de aec-chile-backend; revisar ERP →
  Ventas ante timeouts repetidos.

## Storefront (para que las órdenes traigan RUT)

El checkout de este boilerplate captura CUIT/DNI (AR). Para Chile, el sitio
debe guardar el RUT del comprador en la metadata de la orden en alguna de las
fuentes que lee la capa país: `metadata.billing_snapshot`
(`document_type: 'RUT'`, `document_number`), `metadata.rut` o
`metadata.billing_address.rut`. Sin eso, todos los documentos salen a
consumidor final (válido para boleta/nota de venta).
