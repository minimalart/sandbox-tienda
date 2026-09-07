# ERP — Odoo (setup local para desarrollo del adapter)

Guía para levantar una instancia local de **Odoo 19 Community** con Inventory
instalado, generar una API key, y verificar que el protocolo `execute_kw` sobre
JSON-RPC responde antes de tocar código del adapter.

Referencia oficial:
`https://www.odoo.com/documentation/19.0/developer/reference.html`.

## Por qué esta doc existe

Odoo **no tiene REST API nativa** (aunque medio internet lo diga). Los dos
endpoints programáticos oficiales son:

| Endpoint | Formato | Notas |
|---|---|---|
| `POST /xmlrpc/2/object` | XML-RPC | Histórico. Payload XML. Anda en todas las versiones. |
| `POST /jsonrpc` | JSON-RPC 2.0 | Mismo protocolo, payload JSON. **Es el que usamos.** |

Ambos llaman al mismo método interno (`execute_kw`) contra los modelos del ORM.
Auth: `db + uid + password_o_api_key`. Desde Odoo 14 la API key reemplaza a la
password para calls programáticos.

Sin una instancia real corriendo, cualquier scaffold del adapter es adivinar
nombres de campos y semántica de estados. Odoo tiene detalles feos (`product.template`
vs `product.product`, `qty_available` vs `virtual_available`, estados de
`sale.order` que cambian por versión) que se resuelven en minutos con datos
reales y en horas sin ellos.

## Cómo funcionan los módulos en Odoo (concepto)

Odoo es un **grafo de módulos con dependencias declaradas**. Cada módulo tiene
un `__manifest__.py` con un array `depends`. Al instalar uno, Odoo resuelve
el grafo transitivo y auto-instala lo que falte.

Para nuestro caso: instalar **Inventory** trae Product automáticamente. No hay
que instalarlo aparte.

```
stock (Inventory)
  ├── depends: product      ← product.template, product.product, product.category
  ├── depends: barcodes
  ├── depends: uom          ← unidades de medida
  └── depends: mail
```

Detalle que confunde a todos al arrancar:

- **`product.template`** = el producto conceptual ("Remera Negra").
- **`product.product`** = la variante concreta ("Remera Negra Talle M"). Es lo
  que tiene SKU (campo `default_code`) y stock.

Nuestro `getStockBySku` va contra `product.product`, no template.

## Levantar Odoo 19 local con Docker

`docker-compose.yml` mínimo — Odoo + Postgres:

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: postgres
      POSTGRES_PASSWORD: odoo
      POSTGRES_USER: odoo
    volumes:
      - odoo-db:/var/lib/postgresql/data

  odoo:
    image: odoo:19
    depends_on: [db]
    ports: ["8069:8069"]
    environment:
      HOST: db
      USER: odoo
      PASSWORD: odoo
    volumes:
      - odoo-data:/var/lib/odoo

volumes:
  odoo-db:
  odoo-data:
```

```bash
docker compose up -d
docker compose logs -f odoo   # esperar "HTTP service (werkzeug) running on 0.0.0.0:8069"
```

Si `odoo:19` no aparece en Docker Hub el día que se corre esto, usar
`odoo:latest` y verificar en `Settings → About` que efectivamente es v19.

## Wizard de setup

1. Abrir `http://localhost:8069`. Aparece el formulario "Create Database".
2. Completar:
   - **Master password**: la que quieras, anotarla (sirve para admin ops sobre la instancia).
   - **Database name**: `mercatto-dev`.
   - **Email**: `admin@example.com` (será el login del admin).
   - **Password**: la que quieras.
   - **Language / Country**: cualquiera, no cambia el ORM.
   - **Load demonstration data**: **TILDAR**. Crea productos, categorías,
     stock, órdenes de ejemplo. Sin esto la instancia arranca vacía y no se
     puede probar el adapter contra nada.
3. Click "Create Database". Tarda ~30 s. Redirige al admin logueado.

## Instalar Inventory

Odoo esconde por default la mayoría de las apps. Hay que sacar un filtro
oculto o no vas a ver Inventory listado.

1. Menú lateral → **Apps**.
2. En el buscador superior hay un chip/pill que dice `Apps`. **Click en la X
   del chip para removerlo.** Ahora se listan todas las apps y módulos.
3. Filtrar por `Inventory` → click **Install** en la tarjeta "Inventory". Tarda
   20-40 s. Al terminar te redirige al módulo Inventory con productos de demo
   ya visibles.
4. Verificar que `Product Management` también aparece como instalado (llegó
   como dependencia).

## Activar Developer Mode

Sin dev mode no se ven los nombres técnicos de los campos, y sin nombres
técnicos no se puede llamar a `execute_kw`.

1. Menú lateral → **Settings**.
2. Scroll hasta abajo → sección "Developer Tools" → **Activate the developer mode**.
3. La URL cambia (aparece `?debug=1`) y ahora, al hacer hover sobre cualquier
   campo, aparece un tooltip con el nombre técnico (`default_code`,
   `qty_available`, etc.).

## Generar API key

1. Click en el avatar arriba a la derecha → **My Profile** (o Preferences).
2. Tab **Account Security** → botón **New API Key**.
3. Nombre: `mercatto-adapter`.
4. La key se muestra **una sola vez**. Copiarla y guardarla — no se puede
   recuperar después.

Guardar aparte también:
- **Database**: `mercatto-dev`.
- **User ID (uid)**: **2** para el admin creado por el wizard. Odoo reserva
  uid=1 para `OdooBot`, y el primer usuario humano queda en uid=2. Verificable
  desde el admin: Settings → Users & Companies → Users → click el user →
  la URL trae `id=2`.
- **URL base**: `http://localhost:8069`.

## Probar `execute_kw` con curl

Pedir stock de los primeros 10 productos de demo. Reemplazar `TU_API_KEY`:

```bash
curl -X POST http://localhost:8069/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "service": "object",
      "method": "execute_kw",
      "args": [
        "mercatto-dev",
        2,
        "TU_API_KEY",
        "product.product",
        "search_read",
        [[["default_code", "!=", false]]],
        {"fields": ["id", "default_code", "name", "qty_available", "list_price"], "limit": 10}
      ]
    }
  }'
```

Estructura del payload `execute_kw`:

```
args = [
  db,                     # nombre de la base
  uid,                    # user id (int)
  password_or_api_key,    # secreto
  model,                  # ej. "product.product"
  method,                 # ej. "search_read"
  positional_args,        # array — depende del método
  kwargs                  # dict — depende del método
]
```

Los positional/kwargs siguen la firma del método en el ORM. Para
`search_read`: positional `[domain]`, kwargs `{fields, limit, offset, order}`.
El "domain" es la sintaxis de filtros de Odoo — lista de tuplas
`[campo, operador, valor]`, combinables con `'|'` y `'&'`.

**Respuesta esperada** (200 OK):

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": [
    {
      "id": 12,
      "default_code": "E-COM07",
      "name": "Desk Combination",
      "qty_available": 0.0,
      "list_price": 100.0
    },
    ...
  ]
}
```

Si sale `{"error": {...}}` con `"code": 200` y `"data.name": "odoo.exceptions.AccessError"`,
la API key está mal o el uid no es el del user que la generó.

## Mapa de capabilities → llamadas Odoo (para el adapter)

Estas son las llamadas que después usa el `OdooRpcClient` desde el adapter.
Confirmar los nombres de campo contra la instancia real antes de escribir cada
método:

| Capability `ErpAdapter` | Modelo | Método | Notas |
|---|---|---|---|
| `validateCredentials` | `res.users` | `read` | `read([uid], ['login', 'name'])` → si vuelve, la key es válida. |
| `getStockBySku` | `product.product` | `search_read` | Domain `[['default_code', 'in', skus]]`, fields `['default_code', 'qty_available']`. Considerar `virtual_available` si se quiere reservar stock. |
| `getCatalogChanges` | `product.template` | `search_read` | Domain `[['write_date', '>', since_iso]]`. Delta por timestamp del ORM. |
| `fetchCategories` | `product.category` | `search_read` | Fields `['name', 'parent_id', 'complete_name']`. |
| `fetchProductImage` | `product.template` | `read` | Field `image_1920` viene como **base64**, hay que decodificar y subir a S3. |
| `notifySale` | `sale.order` | `create` + `action_confirm` | Requiere `sale_management` instalado (no viene con Inventory). |
| `fetchInvoiceStatus` | `account.move` | `search_read` | Requiere `account` instalado. Filtrar por `invoice_origin = <sale.order.name>`. |
| `fetchInvoicePdf` | `ir.actions.report` | `_render_qweb_pdf` | O bien `GET /report/pdf/account.report_invoice/<id>` con cookie de sesión. |

**Tinting**: no aplica. Odoo core no modela bases entonables + fórmulas. Si
más adelante se requiere, va como módulo Odoo custom + extensión del adapter.

## Multi-empresa: cuidado con `res.company`

Odoo permite N empresas en la misma instancia. Todos los modelos con `company_id`
scopean por la empresa activa del user. Si el cliente tiene multi-empresa,
`allowed_company_ids` en el contexto de cada call decide qué se ve:

```json
{"context": {"allowed_company_ids": [1, 3], "company_id": 1}}
```

Sin eso, el adapter puede ver stock de otra empresa (o no ver el que existe).
La instancia local de esta guía es mono-empresa (default del wizard), así que
no es un problema hasta que se conecte contra un tenant real.

## Próximos pasos

Con esta instancia y el curl respondiendo:

1. Confirmar la estructura real de `product.product` en Odoo 19: qué campos
   trae por default, si `default_code` puede ser `false`, cómo se representan
   variantes que comparten template.
2. Scaffoldear `apps/backend/src/modules/erp/adapters/odoo.ts` +
   `apps/backend/src/modules/erp/adapters/odoo-rpc-client.ts` (cliente fino
   sobre JSON-RPC) siguiendo el patrón de `zeus.ts`.
3. Registrar en `adapters/registry.ts` como cuarto provider.
4. Sumar `ErpOdooSettings` en `modules/erp/types.ts` (base_url, db, uid,
   api_key, allowed_company_ids).
5. Test suite `odoo.test.ts` mockeando respuestas JSON-RPC reales grabadas
   desde esta instancia local.

## Detener y limpiar

```bash
docker compose down          # detener, mantener volúmenes
docker compose down -v       # detener y borrar la base de Odoo (reinicia el wizard)
```
