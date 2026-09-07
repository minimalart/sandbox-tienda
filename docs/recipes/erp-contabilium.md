# ERP → Contabilium (Argentina)

Cómo activar la extensión ERP con **Contabilium** (rest.contabilium.com),
implementada contra la [documentación oficial](https://documenter.getpostman.com/view/17702437/2s93shz9yz).
Los dos flujos del MVP quedan operativos: stock Contabilium → Medusa por SKU y
registro de cada venta cobrada (trigger: pago capturado) como **orden de
venta** o **factura electrónica cobrada**.

## Requisitos

- Credenciales de la API: `client_id` = **email principal de la cuenta**
  (en empresas hijas, el email del usuario administrador) y `client_secret` =
  **API Key** (Contabilium → Mi Cuenta → Datos de mi empresa → API). El
  adapter obtiene el token OAuth (client_credentials, ~24 h) y lo renueva solo.
- Los SKUs de Medusa deben existir como **conceptos** en Contabilium con el
  mismo código (`/api/conceptos/getByCodigo`). El matching es
  case-insensitive (Contabilium normaliza los códigos a mayúsculas).

## Encontrar los IDs de la cuenta

```bash
TOKEN=$(curl -s -X POST https://rest.contabilium.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=EMAIL&client_secret=APIKEY" | jq -r .access_token)

# Depósitos (deposito_id)
curl -H "Authorization: Bearer $TOKEN" "https://rest.contabilium.com/api/inventarios/getDepositos"

# Puntos de venta (punto_venta_id, solo para factura_cobrada)
curl -H "Authorization: Bearer $TOKEN" "https://rest.contabilium.com/api/puntosdeventa/search"

# Condiciones de venta (texto para condicion_venta)
curl -H "Authorization: Bearer $TOKEN" "https://rest.contabilium.com/api/usuarios/condicionesVenta"

# Cliente consumidor final (default_client_id): buscarlo o crearlo
curl -H "Authorization: Bearer $TOKEN" "https://rest.contabilium.com/api/clientes/search?pageSize=0"
```

## Configuración en el admin

En **ERP → Configuración**:

1. Provider: `Contabilium (Argentina)` · País: `Argentina`.
2. Credenciales → claves `client_id` y `client_secret` (write-only).
3. Sección Contabilium:
   - `ID de depósito`: **requerido para notificar ventas** (es el
     `IDInventario` de la venta); sin él, el stock suma todos los depósitos
     activos.
   - `Qué crea cada venta`:
     - **Orden de venta (sin factura)** — default y arranque recomendado:
       registra la venta en Contabilium (estado "Pendiente") sin emitir
       comprobante fiscal.
     - **Factura electrónica (cobrada)** — emite y cobra la FE en un paso
       (`emitirFECobrada`). Requiere FE habilitada en la cuenta, `ID de punto
       de venta`, tipo de comprobante (default `FCB`) y condición de venta.
   - `ID de cliente por defecto`: cliente genérico ("Consumidor Final") para
     órdenes sin documento — las ventas de Contabilium siempre exigen cliente.
   - `SKU del concepto de envío`: las **órdenes de venta no aceptan ítems
     libres**; creá un concepto "ENVIO" y cargá su SKU para facturar el envío
     como línea (sin esto, el costo de envío queda como observación en la
     orden; en facturas sí va como ítem libre).
   - `Los precios de Medusa incluyen IVA`: activado (default) divide por 1.21
     para mandar netos (`tax_rate` configurable por API si la alícuota
     dominante no es 21%).
4. "Validar conexión" (token + `obtenerinfo`; verifica el depósito si está
   configurado) → activar la integración y los flujos.

## Semántica

- **Stock**: Contabilium es fuente de verdad. Se usa `StockConReservas`
  (disponible = actual − reservado) por SKU: del depósito configurado o el
  total de la cuenta. Con catálogo grande el adapter barre
  `getStockByDeposito` paginado (50 fijo por página, paceado por el rate
  limit de 30 req/10 s); con pocos SKUs consulta `getStockBySKU` directo.
- **Cliente**: se busca por documento (`GetClientByDoc` con CUIT/CUIL/DNI del
  `billing_snapshot` de la orden) y si no existe se **crea** (`CondicionIva:
  CF`, `Personeria` según el tipo de doc). Sin documento → `default_client_id`.
- **Errores**: red/5xx reintentan con backoff; los rechazos de validación
  (SKU sin concepto, falta depósito/punto de venta, factura rechazada con
  `errores`) van a `dead_letter` directo — corregir y reintentar a mano desde
  ERP → Ventas.
- **Idempotencia**: una notificación por orden (clave por order_id). En modo
  factura, `RefExterna` viaja con el `order_id` de Medusa para conciliar. Si
  Contabilium acepta la operación pero la respuesta se pierde (timeout justo
  ahí), el retry puede duplicarla — revisar ERP → Ventas ante timeouts
  repetidos.
- **IVA**: el neto se calcula con una alícuota global (`tax_rate`, default
  21%). En órdenes de venta el IVA real lo pone Contabilium según cada
  concepto; en facturas el campo `Iva` de cada línea usa esta alícuota — si la
  cuenta mezcla alícuotas (10.5%, exento), validar con contabilidad antes de
  usar `factura_cobrada`.

## Checklist E2E (con cuenta real o ModoQA)

1. Validar conexión → OK con razón social y CUIT de la cuenta.
2. Sync de stock manual → log con `updated` para SKUs que existan como
   conceptos y `not_found` para los que no.
3. Checkout + captura de pago → ERP → Ventas: evento `sent` con el ID de la
   orden de venta (verla en Contabilium → Ventas → Órdenes) o el número de FE.
4. Orden sin CUIT/DNI → usa el cliente por defecto; con CUIT nuevo → crea el
   cliente (verificar en Contabilium → Clientes).
