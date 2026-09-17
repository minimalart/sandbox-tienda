# Bundled Products + Configurator Wizard — Plan de implementación

> Estado: skeleton compilable en `feat/bundled-products`. Nada de este documento describe código validado en runtime; los servicios no se levantan en este PR.

## 1. Contexto

El PRD "Bundled Products + Configurator Wizard Multitienda" pide una capacidad
**genérica y opcional** para vender conjuntos configurables de Products
existentes de Medusa, con disponibilidad por Store (multitienda), Wizard de
configuración y checkout que resulta en line items nativos de Medusa agrupados
por un `bundle_instance_id`.

La feature vive en Brick (medusa-b2c-boilerplate) y se propaga a derivados
(Educabot, etc.) vía el flujo estándar de sync. Brick sigue las reglas del
`mercatto-boilerplate-guard`: cero acoplamiento a un cliente, capacidad
opcional, defaults conservadores, contrato aditivo.

## 2. Decisiones arquitectónicas

### 2.1. Módulo backend nuevo: `bundle`

- **Ubicación:** `apps/backend/src/modules/bundle/`.
- **Key del módulo:** `bundle` (evitar keys genéricas que colisionen con
  módulos oficiales — la memoria del proyecto tiene precedente `loyalty`).
- **Registro:** `...optionalModule('bundle', 'bundle')` en `medusa-config.ts`.
- **Motivo:** un módulo puro para la composición. Precios, variants, cart y
  order siguen viviendo en Medusa.

### 2.2. Entidad Store = `demo_store`

Brick ya tiene el concepto Store implementado en el módulo `demo-store`
(1:1 con `SalesChannel`, `Region`, `StockLocation`). El PRD (§6) exige
reusar la entidad existente. **Bundle ↔ Store se implementa como
`Bundle ↔ DemoStore`** vía module link many-to-many.

Consecuencia práctica: cuando se resuelve el "contexto comercial" a partir de
la Store activa, se derivan `sales_channel_id` / `region_id` / `stock_location_id`
del `demo_store` linkeado. Esa derivación **ya existe** en el módulo
`demo-store` — Bundle no la reimplementa.

Si un proyecto derivado no tiene el módulo `demo-store` (single-tenant puro),
el link se degrada a una fila global por bundle (ver §5.4 "Ausencia de demo_store").

### 2.3. Modelo de datos mínimo

```
Bundle {
  id, title, handle, description?, thumbnail?, status ('draft'|'published'),
  metadata?, created_at, updated_at
}

BundleItem {
  id, bundle_id (FK), product_id, quantity (>0), position, metadata?
}

Link:  Bundle  ↔ many-to-many ↔  DemoStore     (tabla bundle_demo_store)
Link:  BundleItem ↔ many-to-one ↔ Product      (product_id nativo, resuelto vía Query)
```

**BundleItem NO guarda:**
- variant seleccionada por default;
- precio;
- opciones;
- flags de cliente.

Toda alternativa se resuelve leyendo `Product → Options → Variants` en Medusa.

### 2.4. Line item metadata (contrato de cart/order)

Cada line item creado por la confirmación de un bundle recibe:

```ts
line_item.metadata = {
  bundle_id: string,
  bundle_instance_id: string,   // UUID v4 generado server-side por confirmación
  bundle_title?: string,        // snapshot no autoritativo, sólo para lectura histórica
  bundle_item_id: string        // para poder mapear back al slot dentro del bundle
}
```

El key `bundle_instance_id` agrupa TODOS los line items de una configuración
concreta, permite múltiples instancias del mismo bundle en el mismo carrito
(PRD §24) y habilita "Editar configuración" / "Eliminar bundle" (§52-54).

### 2.5. API pública

**Admin (`/admin/bundles`):**
- `GET /admin/bundles` — lista paginada + filtros (status, store_id, q).
- `POST /admin/bundles` — crea Bundle.
- `GET /admin/bundles/:id` — detalle con items + stores linkeadas.
- `POST /admin/bundles/:id` — update.
- `DELETE /admin/bundles/:id` — soft delete.
- `POST /admin/bundles/:id/items` — add BundleItem.
- `POST /admin/bundles/:id/items/:itemId` — update qty / position.
- `DELETE /admin/bundles/:id/items/:itemId`.
- `POST /admin/bundles/:id/stores` — set stores disponibles (idempotente).
- `POST /admin/bundles/:id/publish` — valida composición y marca `published`.
- `POST /admin/bundles/:id/unpublish`.

**Store (`/store/bundles`):**
- `GET /store/bundles` — lista bundles disponibles en la Store activa.
- `GET /store/bundles/:handle` — detalle con Products expandidos, options,
  variants, prices resueltos en el contexto de la Store.
- `POST /store/bundles/confirm` — recibe `{ bundle_id, cart_id, selections[] }`,
  valida server-side, genera `bundle_instance_id`, agrega line items
  atómicamente al carrito.

### 2.6. Workflow de confirmación

`confirmBundleWorkflow` en `apps/backend/src/workflows/bundle/`. Steps:

1. `validateBundleAvailabilityStep` — bundle existe, `published`, disponible
   en la Store del carrito.
2. `validateSelectionsStep` — cada `BundleItem` tiene una selección, cada
   variant pertenece al Product correcto, quantities coinciden con
   `BundleItem.quantity` (no se aceptan del cliente).
3. `resolvePricingStep` — recalcula prices vía Medusa Query en el pricing
   context de la Store.
4. `generateInstanceIdStep` — `crypto.randomUUID()`.
5. `addBundleLineItemsStep` — invoca el workflow nativo `addToCartWorkflow` (o
   equivalente en Medusa 2.x) por cada selección, pasando el metadata del
   bundle. Compensación: rollback removiendo los line items ya creados si
   alguno falla → **atomicidad** (PRD §50).

### 2.7. Admin UI

- **Listado:** `apps/backend/src/admin/routes/bundles/page.tsx` con `DataTable`
  (columnas Bundle / Status / Stores / Items / Updated / Actions).
- **Create:** `FocusModal` + `ProgressTabs` con pasos General, Products,
  Availability, Review.
- **Edit:** `[id]/page.tsx` con las mismas tabs.
- Toda copia via i18n (`bundles` namespace) en `admin/translations/bundles.ts`.
- Todo con `@medusajs/ui` (dark/light heredado, sin colores raw).

Si el módulo `demo-store` no está en el proyecto, el paso "Availability"
oculta el multi-select y muestra un aviso "single-tenant".

### 2.8. Storefront wizard

- **Ruta:** `apps/storefront/src/app/[countryCode]/(main)/bundles/[handle]/page.tsx`.
- **Componentes:** `apps/storefront/src/modules/bundles/`.
  - `bundle-entry.tsx` — landing con conteo, precio "desde", CTA "Armar mi kit".
  - `bundle-wizard.tsx` — máquina de estados (loading / start / step / review /
    error).
  - `bundle-step.tsx` — un producto configurable (radio para 1 option, group
    de selects para N options).
  - `bundle-review.tsx` — resumen + "Agregar al carrito".
- **Persistencia temporal:** `sessionStorage`, keyed por `bundle_id + cart_id`.
- **Layout:** desktop dos columnas (contenido + resumen sticky), mobile una
  columna con CTA sticky (PRD §58).
- **Data:** `apps/storefront/src/lib/data/bundles.ts` con `getBundle`,
  `getBundles`, `confirmBundle` sobre el SDK.

### 2.9. Optionalidad

**Backend:**
- `optionalModule('bundle', 'bundle')` — si la carpeta no existe, el módulo no
  se registra.
- Las rutas admin/store bajo `apps/backend/src/api/{admin,store}/bundles/`
  desaparecen físicamente en proyectos generados sin la extensión — la
  registración por descubrimiento de Medusa no las carga.
- `extension-middlewares.ts` importa los middlewares desde
  `./admin/bundles/middlewares` y `./store/bundles/middlewares`; el generador
  de proyectos ya reescribe este archivo según las extensiones seleccionadas
  (mismo patrón que `storeStoreLocationsMiddlewares`).

**Admin UI:**
- Las rutas bajo `src/admin/routes/bundles/` sólo existen si el módulo está
  presente (misma regla del scaffold).
- El sidebar item usa `hidden: !bundlesEnabled` derivado de un
  probe endpoint `/admin/bundles/health` que responde 404 cuando el módulo no
  está.

**Storefront:**
- Feature flag por tenant: `tenant.features.bundles.enabled` (default `false`).
- Cuando está apagado, las rutas `/bundles/*` responden 404 y los componentes
  no se renderizan (`return notFound()` en el server component).

**Default:** apagado en proyectos nuevos (PRD §62). Habilitación explícita
via seleccionar la extensión en el generator o via flag de tenant en storefront.

### 2.10. Migrations

Convención estricta del repo (backend/CLAUDE.md): nombre con módulo en PascalCase.
- `Migration20260915120000Bundle.ts` — tablas `bundle`, `bundle_item`.
- Link table `bundle_demo_store` la genera Medusa a partir de `defineLink`.

### 2.11. i18n

- Namespace `bundles` en `apps/backend/src/admin/translations/bundles/{en,es}.ts`.
- Registro en `apps/backend/src/admin/i18n/index.ts`.
- Storefront: usar el mecanismo i18n existente (`next-intl` u equivalente
  ya presente en el proyecto — pendiente de confirmar en fase 3).

## 3. Fases de entrega

| Fase | Alcance | Estado |
| --- | --- | --- |
| **F0** | Skeleton compilable: modelos, service, migration inicial, link, rutas API stub, workflow stub, admin UI vacía, wizard esqueleto, i18n keys, feature flag, plan. | **Completo** |
| **F1** — Backend real | Handlers admin CRUD reales (create/update/delete/publish + linking store↔bundle vía Link module), list con filtros q/status/store_id + enriquecimiento, detail admin con stores + products expandidos, publish validation (§38), store scoping server-side vía `siteFromPublishableKey`, store detail con Query + pricing context real (calculated_price por región/canal, auto_resolved_variant_id, pricing.from), confirmBundleWorkflow real con addToCartWorkflow + locking Redis + compensation. | **Completo** |
| **F2** — Wizard funcional | Wizard storefront con option chips reales, disable de combinaciones no comprables, cálculo de total sobre precios server-authoritative, POST /confirm real que redirige al cart, agrupación visual del cart por bundle_instance_id con acciones "Editar configuración" / "Eliminar". | **Completo** |
| **F3** — Edición y eliminación | reconfigureBundleWorkflow que preserva bundle_instance_id (add nuevos → delete viejos, atómico en happy path). POST /store/bundles/reconfigure. `removeBundleInstance` server action. Edición desde cart hace redirect al wizard con `?instance=`. | **Completo** |
| **F4** — Pulido | Admin UI funcional (product picker + reorder + qty, store multi-select, save/publish/delete real en detail). Tests unitarios: schemas admin, publish validation, group-cart-items, resolve-variant. Registro en scoped-routes / store-routes con reasons. | **Completo** |
| **F5** — Sync a derivados | Portar via `minimalart-version-checker` a educabot y validar caso "1.º/2.º/3.º/4.º grado" **sin** introducir código específico Educabot. Correr migration en staging. | Pendiente (fuera de este PR) |

F0→F4 entregados en este worktree. F5 (sync a derivados) es un PR separado.

## 4. Riesgos y decisiones abiertas

### 4.1. Storefront single-tenant hoy
El storefront actual de Brick es single-tenant (`getTenant()` devuelve
default). El PRD asume multitienda en storefront. **Decisión de F2:** el wizard
consume la Store implícita por tenant activo (single-tenant hoy = una única
Store visible), sin bloquear la evolución a multitienda del storefront.

### 4.2. Pricing engine para "desde"
Calcular "Desde $XXX" (PRD §40) requiere consultar precios min por Product en
el pricing context de la Store. En F1 se puede aproximar sumando el precio
mínimo de cada variant. Un cálculo exacto que respete promociones aplicables
queda para F2 con eventual cache invalidable por evento.

### 4.3. Agrupación visual en el cart
El PRD §51 pide que el cart agrupe visualmente los line items del mismo
`bundle_instance_id`. Esto es puramente frontend: el storefront debe agrupar
por `metadata.bundle_instance_id` al renderizar. **No** se toca el modelo
de cart ni se crea un line item sintético.

### 4.4. Concurrencia y locks
Confirmar dos veces el mismo bundle sobre el mismo cart en paralelo podría
crear line items duplicados con el mismo `bundle_instance_id`. Se recomienda
un lock por `cart_id` durante el workflow (Brick ya tiene `Modules.LOCKING`
sobre Redis). Se documenta en F1.

### 4.5. Bundle draft vs. published
Sólo `published` es visible en `/store/bundles`. Admin permite guardar `draft`.
Publicación valida composición (§38) — no permitir publicar sin Store, sin
items, con Product borrado, con qty inválida o sin variant comprable en la Store.

### 4.6. Odoo / ERP
Sin dependencias. Bundle referencia Product; el sync ERP → Product del módulo
`erp` existente es la única integración de catálogo. Confirmado en PRD §27.

### 4.7. Cliente-específico (Educabot)
Ninguna referencia a colegio, grado, alumno, Educabot dentro del módulo. El
"kit por grado" es un caso de **configuración**: Educabot crea Bundles
"1.º grado", "2.º grado", etc., y los asocia a la Store "Andresito" desde
admin. La relación `bundle_instance_id → student` se resuelve **fuera** de
Bundles (checkout configurable existente, PRD §65).

## 5. Compatibilidad y protección del boilerplate

### 5.1. Proyectos sin la extensión
- `bundle` no se registra (folder ausente → `optionalModule` skip).
- `extension-middlewares.ts` no importa los middlewares (regenerado).
- Rutas admin/store no existen físicamente.
- Admin UI sidebar no muestra el ítem.
- Storefront responde 404 en `/bundles/*` (flag apagado por default).
- **Build, boot, admin, storefront, product, cart, order** funcionan sin
  configuración adicional (PRD §63, checklist en tests de F1).

### 5.2. Proyectos con la extensión pero sin `demo-store`
- Link `bundle_demo_store` no puede resolverse; el módulo detecta ausencia
  y trata todos los bundles como globales.
- Admin oculta la tab "Availability".
- Storefront asume Store implícita única.

### 5.3. Proyectos multitienda existentes (Educabot)
- Bundle se linkea a las `demo_store` seleccionadas.
- Scoping server-side estricto en `/store/bundles`.
- Pricing context derivado de la Store del carrito.

### 5.4. Idioma y ámbito
- Namespace `bundles` en admin (en/es).
- Textos hardcodeados prohibidos en componentes.
- Storefront reutiliza el mecanismo i18n existente (siguiendo lo que ya usa
  `apps/storefront/src/lib/i18n` — a confirmar en F2).

## 6. Checklist F0 (este PR)

- [x] Worktree `feat/bundled-products` creado desde `origin/main`.
- [x] Módulo `bundle` con models, service y migration.
- [x] Link `bundle_demo_store`.
- [x] Rutas admin API (stubs con schemas correctos).
- [x] Rutas store API (stubs con schemas correctos).
- [x] Workflow `confirmBundleWorkflow` (steps stub con TODOs marcados).
- [x] Admin UI: listado + create/edit con FocusModal+ProgressTabs vacíos.
- [x] i18n namespace `bundles` registrado (en/es).
- [x] Storefront wizard skeleton (componentes + hook + data layer).
- [x] `optionalModule('bundle', 'bundle')` en `medusa-config.ts`.
- [x] `pnpm typecheck` verde en el backend. Storefront reporta 4 errores
  pre-existentes en `storefront-shared-providers.tsx`, `gift-card-cart.ts` y
  `gift-card-configurator/index.tsx` — ninguno tocado por este PR. El código
  nuevo en `apps/storefront/src/{lib/data,modules,app}/bundles*` no introduce
  errores nuevos.
- [x] F1: linking real Bundle↔DemoStore, list/detail enriquecidos,
  publish validation completa.
- [x] F1: store scoping server-side vía publishable key, 404 estricto en
  bundle no linkeado (PRD §18).
- [x] F1: store detail con Query + pricing context real, auto-resolve de
  variants únicas, pricing.from correcto.
- [x] F1: confirmBundleWorkflow con addToCartWorkflow, LOCKING redis y
  compensation atómica.
- [x] F2: wizard storefront consume options + variants + prices reales,
  chips deshabilitados para combinaciones no comprables.
- [x] F2: cart agrupa por bundle_instance_id con subtotal, editar y
  eliminar (PRD §51-54).
- [x] F3: reconfigureBundleWorkflow con preservación de bundle_instance_id.
- [x] F4: admin UI funcional (product picker con reorder + qty, store
  multi-select, save/publish/delete real).
- [x] F4: tests unitarios (schemas, publish-validation, group-cart-items,
  resolve-variant) — 22/22 verdes en las suites nuevas.
- [x] F5-checklist: rutas registradas en `scoped-routes.ts` (admin) y
  `store-routes.ts` (store) — el test guard del repo lo enforcea.
- [x] Documento `docs/bundled-products/plan.md` (este archivo).

## 7. Contratos de datos preliminares (referencia F1)

```ts
// GET /store/bundles/:handle
{
  id: string; title: string; handle: string; description?: string;
  thumbnail?: string;
  items: {
    id: string; quantity: number; position: number;
    product: {
      id: string; title: string; handle: string; thumbnail?: string;
      options: { id: string; title: string; values: string[] }[];
      variants: {
        id: string; title: string;
        options: Record<string, string>;
        prices: { amount: number; currency_code: string }[];
        inventory_available: boolean;
      }[];
    };
    auto_resolved_variant_id?: string;   // populado cuando el product tiene 1 variant comprable
  }[];
  pricing: {
    from: { amount: number; currency_code: string } | null;
    all_configurable: boolean;
  };
  store_context: { id: string; sales_channel_id: string; region_id: string; currency_code: string };
}

// POST /store/bundles/confirm
{
  bundle_id: string;
  cart_id: string;
  selections: { bundle_item_id: string; variant_id: string }[];
}
// → 200 { cart, bundle_instance_id, added_line_item_ids: string[] }
// → 409 (catalog changed) { code, invalid_selections: [...] }
// → 404 (bundle not in store)
```

## 8. Referencias del PRD

Este plan mapea directamente al PRD ubicado en
`downloads:PRD — Bundled Products + Configurator Wizard Multitienda.md`.
Toda decisión que se aparte del PRD debe documentarse aquí.
