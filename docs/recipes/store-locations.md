# Mis tiendas (Store Locations / Sucursales)

Capacidad reutilizable para administrar las sucursales físicas del merchant
("Mis tiendas"), basada en el comportamiento de Saphirus pero implementada 100%
sobre Medusa 2.x — **sin Supabase**.

## Alcance V1 vs Saphirus

Incluido en V1:

- Módulo Medusa `store-location` con CRUD admin completo.
- Endpoint público store (solo sucursales visibles, shape limpio).
- Selección de tienda preferida por customer (persistida en metadata del
  customer, sin migrar el modelo customer).
- Admin UI (DataTable + Drawer, i18n es/en) con buscador de direcciones Google
  Places + mapa con marcador arrastrable (opcional, ver "Google Maps en el
  admin") y editor visual de horarios por día/franja.
- Página pública `/sucursales` en el storefront (cards responsive con tipo,
  dirección, contacto, horarios y "Cómo llegar") + link en el footer.
- Seed demo idempotente: `pnpm --filter @repo/backend seed:store-locations`
  (`src/scripts/seed-store-locations.ts`, 4 sucursales de ejemplo).

Quedó fuera (vs Saphirus), planificado para versiones siguientes:

- **Upload de imágenes a storage**: en V1 `images` es un array de hasta 3 URLs
  cargadas a mano. V2 debería integrar el File Module de Medusa.
- **PIN de entrega único garantizado por constraint de DB**: en V1 el PIN se
  genera random (100000–999999) server-side/client-side sin unicidad
  garantizada. Si se necesita unicidad dura, agregar `UNIQUE` parcial en la
  migración + retry en el create.
- **UI para `is24Hours`**: el editor de horarios no expone el flag 24 hs (se
  preserva el valor existente, default `false`).
- **Multi-organización**: en el boilerplate las tiendas pertenecen al merchant
  (single-tenant). En un B2B multi-org se agregaría `organization_id` al modelo
  + filtro por organización en todos los endpoints.

## Modelo de datos

Tabla `store_location` (módulo `apps/backend/src/modules/store-location/`):

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | text PK | prefijo `sloc` |
| `code` | text nullable | código interno |
| `store_type` | text | `'distribution_center' \| 'wholesale' \| 'point_of_sale'` (default `point_of_sale`) |
| `name` | text | requerido |
| `province` / `city` / `street` | text | requeridos |
| `phone` / `whatsapp` / `email` / `website` | text nullable | contacto |
| `instagram` / `facebook` / `tiktok` / `linkedin` | text nullable | redes |
| `business_hours` | jsonb nullable | `Record<dia, { closed, is24Hours, slots: [{ open, close }] }>` |
| `images` | jsonb nullable | `string[]` de URLs, máx. 3 (validado en zod) |
| `is_visible` | boolean | default `false` — controla exposición pública |
| `sales_channel_ids` | jsonb nullable | `string[]` — canales donde se muestra. `null`/`[]` = todos (ver más abajo) |
| `delivers_kits` | boolean | default `false` |
| `delivery_pin` | integer nullable | 100000–999999 |
| `lat` / `lng` | text nullable | coordenadas |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | soft delete estándar de Medusa |

Índices: `(is_visible, deleted_at)` y `(deleted_at)`.

## Endpoints

### Admin (`/admin/store-locations`)

- `GET /admin/store-locations?limit=&offset=&q=` — lista paginada. `q` busca
  por nombre/ciudad/provincia (case-insensitive vía `$ilike`, soportado por los
  filtros de MikroORM que MedusaService pasa through). Devuelve
  `{ store_locations, count, limit, offset }`.
- `POST /admin/store-locations` — crea. Requeridos: `name`, `store_type`,
  `province`, `city`, `street`. Validación zod en
  `src/api/admin/store-locations/validators.ts` (email válido, `images` máx. 3
  URLs, `delivery_pin` 100000–999999).
- `GET /admin/store-locations/:id` — detalle.
- `POST /admin/store-locations/:id` — update parcial.
- `DELETE /admin/store-locations/:id` — soft delete (vía
  `softDeleteStoreLocations` del service).

### Store (público)

- `GET /store/store-locations?sales_channel_id=&strict=1` — solo
  `is_visible = true` y no eliminadas, scopeadas por canal (ver
  "Visibilidad por sales channel"). Shape limpio por sucursal
  (`sales_channel_ids` NO se expone):

```json
{
  "id": "sloc_...",
  "name": "...",
  "street": "...",
  "city": "...",
  "province": "...",
  "lat": "...",
  "lng": "...",
  "store_type": "point_of_sale",
  "phone": "...",
  "whatsapp": "...",
  "email": "...",
  "business_hours": { "monday": { "closed": false, "is24Hours": false, "slots": [{ "open": "09:00", "close": "18:00" }] } },
  "images": ["https://..."],
  "social": { "instagram": "...", "facebook": "...", "website": "...", "tiktok": "...", "linkedin": "..." }
}
```

### Tienda preferida del customer (autenticado)

Cubre la "relación con usuario/cliente" de V1 sin migrar el modelo customer:
la selección se persiste en `customer.metadata.preferred_store_location_id`
usando el módulo Customer de Medusa (`Modules.CUSTOMER` + `updateCustomers`).

- `GET /store/store-locations/preferred` — devuelve
  `{ store_location: <shape público> | null }`. Si la preferencia apunta a una
  sucursal eliminada/oculta, devuelve `null`.
- `POST /store/store-locations/preferred` — body
  `{ "store_location_id": "sloc_..." }`. Valida que la sucursal exista y sea
  visible (404 si no).

Ambas rutas requieren auth de customer (session/bearer), registrada en
`src/api/store/store-locations/middlewares.ts` y agregada a
`src/api/middlewares.ts`.

## Visibilidad por sales channel

`sales_channel_ids` (jsonb `string[]`) scopea **la exposición pública** de la
sucursal, con la misma semántica que el blog / brands / videos:

- `null` o `[]` → global: se ve en todos los canales, incluido el store principal.
- array no vacío → se ve **solo** en esos canales.
- `strict=1` además oculta las globales, así una demo lista solo lo suyo.

El filtro corre en JS (`isLocationInSalesChannel` en
`src/api/store/store-locations/helpers.ts`) porque la columna es jsonb; el helper
está duplicado a propósito del de blog para no acoplar extensiones (el extractor
de componentes asigna archivos siguiendo imports relativos).

En el storefront lo aplica `getStoreLocations()`
(`apps/storefront/src/lib/data/store-locations.ts`): resuelve el canal con
`getActiveSalesChannelId()` + `getActiveDemoSalesChannelId()` y manda `strict=1`
cuando estamos en una demo.

En el admin se setea con el multiselect **"Visibilidad por canal"** de la pestaña
General del formulario de sucursal, y el listado muestra una columna "Canales"
(`Todos los canales` vs. los canales asignados).

**No confundir con la pestaña Comercial** (`branch-config`): esa maneja el link
`store_location_sales_channel`, que es la propiedad *operativa* canal→sucursal
(inventario, cobros, resolución de sucursal desde el carrito) y es un canal → una
sucursal. Son dos cosas distintas y no se sincronizan entre sí.

**El pickup del checkout no está scopeado** a propósito
(`apps/storefront/src/lib/hooks/use-store-pickup-locations.ts` sigue pidiendo el
listado completo): un punto de retiro puede ser un depósito que no es sucursal, y
las dos listas responden a necesidades distintas.

## Migración

La migración se escribió a mano siguiendo el formato de las del módulo banner
(no se puede correr `npx medusa db:generate StoreLocation` sin una DB
disponible):
`apps/backend/src/modules/store-location/migrations/Migration20260612000000.ts`.

Para aplicarla:

```bash
pnpm --filter @repo/backend exec medusa db:migrate
```

Si preferís regenerarla desde el modelo (con DB corriendo):

```bash
cd apps/backend
npx medusa db:generate StoreLocation
```

## Configuración (`medusa-config.ts`)

```ts
import { STORE_LOCATION_MODULE } from './src/modules/store-location';

// dentro de modules:
[STORE_LOCATION_MODULE]: {
  resolve: './src/modules/store-location',
},
```

`STORE_LOCATION_MODULE = 'storeLocation'` (mismo criterio camelCase que
`vimeoVideo`).

## Admin UI

- Ruta: `src/admin/routes/store-locations/page.tsx` — sidebar "Sucursales"
  (icono `BuildingStorefront`, rank 130). DataTable paginado server-side
  (patrón brands): columnas Nombre, Tipo (badge traducido), Ciudad, Provincia,
  Visible (StatusBadge) y menú de acciones (editar / eliminar con confirm).
  Click en fila = editar.
- Form: `src/admin/routes/store-locations/components/store-location-form.tsx`
  — Drawer único para crear/editar con secciones planas: Básico, Ubicación
  (buscador Google Places + mapa + inputs manuales siempre editables),
  Horarios de atención (editor visual), Contacto, Redes, Imágenes (3 inputs
  URL) y Opciones (`delivers_kits`, `delivery_pin` con botón "Generar" random
  100000–999999).
- Editor de horarios:
  `src/admin/routes/store-locations/components/business-hours-editor.tsx` —
  una fila por día (Lun..Dom), franja apertura/cierre con inputs `time`, botón
  "+" para una segunda franja (con tachito para borrarla) y toggle
  Abierto/Cerrado. Escribe el shape existente
  `Record<'lunes'..'domingo', { closed, is24Hours, slots }>`; `is24Hours`
  queda en `false` (sin UI en V1). Default: Lun–Vie 09:00–18:00, Sáb/Dom
  cerrado.
- Hooks: `src/admin/hooks/api/store-locations.tsx` (`useStoreLocations`,
  `useStoreLocation`, `useCreateStoreLocation`, `useUpdateStoreLocation`,
  `useDeleteStoreLocation`) con `queryKeysFactory('store-location')`.
- i18n: `src/admin/translations/store-locations/index.ts` — namespace
  `storeLocations`, bundles completos es + en, registrado vía
  `registerStoreLocationsTranslations(i18n)` en cada componente (mismo patrón
  que brands; pasar siempre la instancia de `useTranslation()`).

## Google Maps en el admin

El form de Ubicación incluye un buscador de direcciones (Places
AutocompleteSuggestion) y un mapa con marcador arrastrable
(`src/admin/routes/store-locations/components/location-picker.tsx`). Al elegir
una dirección se autocompletan `street` (route + street_number), `city`
(locality), `province` (administrative_area_level_1) y `lat`/`lng`; arrastrar
el marcador o hacer clic en el mapa actualiza las coordenadas y re-geocodifica.
Los campos siguen siendo editables a mano.

Configuración:

1. Crear una API key en Google Cloud con **Maps JavaScript API** y **Places
   API** habilitadas.
2. Agregar al `.env` del backend:

```bash
VITE_GOOGLE_MAPS_API_KEY=tu-api-key
```

El prefijo `VITE_` es necesario porque el admin de Medusa corre sobre Vite y
lee la key vía `import.meta.env`. **Sin la key el form degrada limpio**: se
muestran los inputs manuales de siempre con un hint para configurarla, y no se
inyecta ningún script de Google (mismo criterio que
`apps/storefront/src/modules/common/components/address-form-with-map/`). El
script de Maps se carga por script tag dinámico — no agrega dependencias.

## Storefront — página /sucursales

- Ruta: `apps/storefront/src/app/[countryCode]/(main)/sucursales/page.tsx`.
- Data: `apps/storefront/src/lib/data/store-locations.ts` — fetch server-side a
  `GET {NEXT_PUBLIC_MEDUSA_BACKEND_URL}/store/store-locations` con header
  `x-publishable-api-key` (revalidate 60s; ante error devuelve `[]`).
- Template: `apps/storefront/src/modules/store-locations/templates/index.tsx` —
  cards responsive con nombre, badge de tipo (Punto de venta / Mayorista /
  Centro de distribución), dirección, teléfono / WhatsApp / email como links
  (`tel:` / `wa.me` / `mailto:`), resumen legible de horarios (ej. "Lun a Vie
  09:00–18:00") y link "Cómo llegar" a Google Maps si hay coordenadas. Incluye
  empty state.
- Footer: link "Sucursales" → `/sucursales` en
  `apps/storefront/src/lib/data/navigation-links.ts` (`COMPANY_LINKS`).

## Seed de ejemplo

```bash
pnpm --filter @repo/backend seed:store-locations
```

Crea 4 sucursales demo (Casa Central — Buenos Aires, Sucursal Córdoba, Centro
de Distribución Pacheco —no visible—, Mayorista Rosario) con contacto y
horarios válidos. Es idempotente: busca por `name` antes de crear.

## Cómo reutilizar en otro proyecto

Opción A — copiar y pegar (más simple):

1. Copiar `apps/backend/src/modules/store-location/` (modelo, service,
   migración).
2. Copiar `apps/backend/src/api/admin/store-locations/` y
   `apps/backend/src/api/store/store-locations/`, y registrar
   `storeStoreLocationsMiddlewares` en `src/api/middlewares.ts`.
3. Copiar `apps/backend/src/admin/routes/store-locations/`,
   `src/admin/hooks/api/store-locations.tsx` y
   `src/admin/translations/store-locations/` (requiere los helpers
   `lib/client` y `lib/query-key-factory` ya presentes en este boilerplate).
4. Registrar el módulo en `medusa-config.ts` y correr `medusa db:migrate`.

Opción B — extraer a plugin npm (Medusa 2.x soporta plugins con módulos, API
routes y extensiones de admin): mover módulo + api + admin a un paquete
`medusa-plugin-store-locations` con `medusa plugin:build`, y consumirlo desde
cualquier proyecto vía `plugins` en `medusa-config.ts`. Recomendado si se va a
usar en 3+ proyectos.
