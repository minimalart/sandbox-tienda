# Webhook: Odoo → Medusa

Endpoints que Odoo llama contra Medusa para propagar cambios en tiempo real,
sin esperar a la próxima corrida del cron (`stock_sync`, `catalog_sync`).

Diseñados para usar los mecanismos **NATIVOS** de Odoo 18/19: `base_automation`
+ server actions de tipo `webhook`. Cero módulos OCA. Cero código Python del
lado Odoo. La configuración es 3 pasos desde el admin, una sola vez.

## Endpoints

| Endpoint | Modelo Odoo | Hace |
| --- | --- | --- |
| `POST /webhooks/erp-odoo/stock` | `stock.quant` | Actualiza `inventory_level.stocked_quantity` en Medusa |

## Configuración del lado Odoo (una vez por instancia)

Requiere el módulo `base_automation` (Apps → buscar "Automation Rules" →
Install). Viene con la mayoría de setups de Odoo 18/19.

### Paso 1 — Server Action (define QUÉ mandar)

**Settings → Technical → Actions → Server Actions → Create**

- **Action Name**: `ERP-Odoo Stock Webhook`
- **Model**: `Quants (stock.quant)`
- **Type**: `Send Webhook Notification`
- **URL**: `https://<tu-medusa>/webhooks/erp-odoo/stock?token=<secret>`
- **Fields**: elegir en orden — `product_id`, `quantity`, `reserved_quantity`,
  `location_id`

El botón "Sample Payload" muestra exactamente lo que va a mandar. Podés usar
"Run" para dispararlo manualmente contra un `stock.quant` seleccionado y verlo
llegar al log de Medusa antes de conectar el trigger.

### Paso 2 — Automation Rule (define CUÁNDO mandar)

**Settings → Technical → Automation → Automation Rules → Create**

- **Rule Name**: `ERP-Odoo Stock Sync Rule`
- **Model**: `Quants (stock.quant)`
- **Trigger**: `On create and edit`
- **Trigger Fields**: `Quantity`
- **Actions To Do → Add**: seleccionar el server action del paso 1

El `Trigger Fields = Quantity` es crítico: sin él, Odoo dispara la regla en
cada write interno (create + varios updates al mismo record dentro de la misma
transacción) y el endpoint recibe 4 hits por un solo ajuste. Con él, dispara
una sola vez cuando `quantity` cambia de verdad.

### Paso 3 — Secreto compartido

Odoo 18/19 no permite headers custom en el server action `webhook`, así que el
token viaja en la query string de la URL (`?token=<secret>`). Elegí un valor
random (32+ caracteres), guardalo en un password manager, y setealo en:

- **Odoo**: dentro del `webhook_url` del paso 1
- **Medusa**: env var `ERP_ODOO_WEBHOOK_TOKEN`

Sin `ERP_ODOO_WEBHOOK_TOKEN` seteado en Medusa el endpoint acepta cualquier
request (modo dev). **Producción SIEMPRE debe setearlo**. Complementar con IP
allowlist a nivel infra si el endpoint está expuesto a internet — si el
operador de Odoo copia la URL a un log público, filtró el token.

## Configuración del lado Medusa

### `settings.stock_sync.deposito_map` (opcional pero recomendado)

Si tu Odoo tiene varios depósitos internos y querés que cada uno escriba en
una `stock_location` distinta de Medusa, cargá el mapa en Admin → ERP →
Ajustes → Stock:

```jsonc
{
  "stock_sync": {
    "deposito_map": [
      { "deposito": "WH/Stock", "stock_location_id": "sloc_...", "enabled": true },
      { "deposito": "My Co/Stock/Shelf A", "stock_location_id": "sloc_...", "enabled": true }
    ]
  }
}
```

El campo `deposito` es el `complete_name` de la `stock.location` en Odoo
(exactamente como aparece en el admin de Odoo). El endpoint hace un lookup
por SKU + location contra Odoo para resolver ambos nombres desde los IDs
numéricos que trae el webhook.

Sin `deposito_map`, cae a `settings.stock_location_id`. Sin eso, a la
stock location más antigua con warning en el log.

## Shape del payload que manda Odoo

Verificado con `webhook_sample_payload` de Odoo 19 Enterprise:

```json
{
  "_action": "ERP-Odoo Stock Webhook(#471)",
  "_id": 1,
  "_model": "stock.quant",
  "id": 1,
  "location_id": 5,
  "product_id": 36,
  "quantity": 16.0,
  "reserved_quantity": 0.0
}
```

Ni el SKU ni el nombre del depósito viajan — `webhook_field_ids` en Odoo no
permite navegar relaciones. El endpoint hace dos hops adicionales contra Odoo
usando el adapter y las credenciales del `erp_config`:

- `product.product.read([product_id], ['default_code'])` → SKU
- `stock.location.read([location_id], ['complete_name'])` → nombre para
  matchear en `deposito_map`

## Comportamiento del endpoint

- Responde **200 al emisor pase lo que pase** (patrón "webhook nunca falla al
  emisor"). Errores quedan en el log; el cron `stock_sync` reconcilia.
- **Idempotente**: si el `stocked_quantity` ya coincide, no-op. Múltiples hits
  por el mismo cambio (ej. reintentos) se absorben sin dobles updates.
- SKU no encontrado en Medusa → log info + skip.
- SKU duplicado en Medusa (dos variantes con el mismo `sku`) → skip con warn
  (mismo criterio defensivo que `plan-stock-updates.ts`).
- Falla al escribir en Medusa → log error + 200 al emisor.

## Debugging

En el log del backend, todos los eventos vienen con prefijo `[erp-odoo webhook]`:

```
[erp-odoo webhook] stock event received: {"_model":"stock.quant",...}
[erp-odoo webhook] SKU PRO-K10208-EB: 0 → 17 en sloc_xxx (Odoo: My Co/Stock)
```

Para replay manual (con curl):

```bash
curl -X POST https://<medusa>/webhooks/erp-odoo/stock \
  -H 'Content-Type: application/json' \
  -H 'X-Erp-Webhook-Token: <secret>' \
  -d '{"sku":"PRO-K10208-EB","available":42}'
```

El shape simple `{sku, available, location_name?}` está soportado para tests
manuales sin pasar por Odoo.
