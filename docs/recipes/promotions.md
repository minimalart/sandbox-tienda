# Promociones visibles en el storefront — Receta + demo

> **Ticket:** MINIM-129 — Implementar promociones visibles para demo supermercado
> **Medusa:** 2.15.5 (`@medusajs/framework` / `@medusajs/medusa`)
> **Estado:** Implementado. El seed deja **Promotions reales de Medusa** (varios tipos) + un price list `sale`, todo visible en cards, navbar y el sidebar del PLP.

## 1. Objetivo

Mostrar promociones en el storefront para la demo del supermercado: badge en las tarjetas de producto, un botón **Promociones** en el navbar que lleva al PLP filtrado, y una sección de **promociones activas** en el sidebar del PLP. La capa visual ya existía; este ticket **siembra los datos** y **cabletea el pipeline** que faltaba para que las Promotions de Medusa lleguen a la vitrina.

## 2. Dos mecanismos de descuento (y cuándo usar cada uno)

| Mecanismo | Qué es | ¿Se ve en cards/PLP? | ¿Afecta el precio real? | Asociable a |
|---|---|---|---|---|
| **Price list `sale`** | Precio de oferta sobre la variante | ✅ Sí (precio tachado) | ✅ Sí — es el precio de venta real, también en carrito/checkout | Variantes (productos) |
| **Medusa Promotion** | Motor de descuentos por reglas / cupón | ✅ Sí (badge + filtro), **si la promo es `is_automatic`** | ✅ Sí, al aplicarse en el carrito | Productos, colecciones, sales channel |

Las dos conviven en el seed, apuntando a **productos distintos** para no apilar dos descuentos sobre el mismo producto.

> 🔑 **Automatic vs. código.** Una Promotion `is_automatic: true` se aplica sola → el storefront la muestra como badge y baja el precio en la card. Una promo **por código** (`is_automatic: false`) aparece en el filtro/sidebar pero **no baja el precio en la card**: requiere ingresar el código en el checkout. Las promos de tipo **order** (target_type `order`) tampoco se muestran en cards porque no apuntan a un producto — son de carrito.

## 3. Qué siembra el seed

`apps/backend/src/scripts/seed.ts`, bloque **`[8/8] Demo promotions`**, sembrado **FUERA de la guarda de catálogo** a propósito: la guarda salta la creación de productos cuando la tienda ya tiene catálogo (p. ej. un import real), así que las promociones tienen que correr igual.

Toma un **~15% aleatorio del catálogo publicado** (Fisher-Yates) y a cada producto seleccionado le asigna **1 o 2** promociones al azar de una pila de tipos — así ~40% de los seleccionados quedan con **dos promos que stackean** en el carrito. Cada tipo es UNA promoción con `target_rules` `items.product.id` operador `'in'` y la lista de IDs que le tocaron.

| Code | Tipo | Auto | Campaña (sidebar) |
|---|---|---|---|
| `DEMO-PCT-20` | percentage -20% (items) | ✅ | Hot Sale -20% |
| `DEMO-PCT-15` | percentage -15% (items) | ✅ | Oferta -15% |
| `DEMO-PCT-10` | percentage -10% (items) | ✅ | Descuento -10% |
| `DEMO-FIJO-500` | **fixed** -$500 (items) | ✅ | Rebaja $500 |
| `DEMO-2X1` | **buyget** (comprá 2, 1 gratis) | ✅ | Combo 2x1 |
| `DEMO-CARRITO10` | percentage -10% (**order**) | ❌ código | — |

Cubre todos los tipos del motor (percentage / fixed / buyget / order), automáticas y por código.

**Re-ejecutable:** antes de crear, borra las promociones `DEMO-*` y campañas `demo-*` existentes, así re-correr el seed re-randomiza la selección sin duplicar ni chocar el `campaign_identifier`.

**Stacking en la card:** si un producto tiene 2 promos, la tarjeta muestra **el descuento más grande** (uno solo); el stacking real de las dos ocurre en el **carrito**. Computar el precio combinado en la vitrina dependería de cómo Medusa combina los descuentos, así que la card es conservadora.

> El price list `Ofertas demo` (`type: 'sale'`) sigue existiendo pero está **dentro** de la guarda y apunta a los productos demo del boilerplate; en un catálogo ya importado queda salteado. Las Promotions de Medusa son el mecanismo que aplica a cualquier catálogo.

Atributos de regla (canónicos en Medusa 2.15.5): targeting por producto con `items.product.id`, por colección con `items.product.collection_id`, y regla de canal con `sales_channel_id` (la exige el filtro estricto del storefront, ver `promotion-channel-filter.ts`).

## 4. El pipeline de visibilidad (lo que se cableó)

Las Promotions de Medusa viven a **nivel carrito**: NO son parte del `calculated_price` del producto. Para que se vean en la vitrina hubo que cerrar el circuito:

| Paso | Archivo | Qué hace |
|---|---|---|
| 1. Resolver promo→productos | `apps/backend/src/scripts/typesense-sync.ts` | Lee las promociones activas, resuelve sus `target_rules` (`items.product.id` directo / `items.product.collection_id` expandido a productos) y **adjunta** `promotions[]` a cada producto + computa `discount`/`subtotal` del mejor promo **automático** item-level |
| 2. Indexar | `apps/backend/src/modules/typesense/product-mapper.ts` | Indexa `promotions` (incl. `application_method.type/value` y `campaign.name`), `has_promotion`, `discount`, `subtotal` |
| 3. Renderizar card | `use-product-promotion.ts` + `typesense-product-card.tsx` | Detecta percentage / **fixed** / buyget → badge + precio tachado |
| 4. Filtrar PLP | `lib/typesense/core/filters.ts` | `?promos=1` → `has_promotion:=true`; `?promotion=<campaña>` → por campaña |
| 5. Sidebar | `store-client-page.tsx` | La sección **Promociones** se auto-renderiza desde la faceta `promotions.campaign.name` |

> ⚠️ **Requiere reindexar.** El PLP y home salen de Typesense, así que después de sembrar hay que correr `pnpm typesense:sync`. El PDP pega contra Medusa directo.

## 5. Navbar y sidebar

- **Navbar:** se agregó **Promociones** en `nav-client.tsx` apuntando a `/store?promos=1`. Ese param se parsea en `store-client-page.tsx` (`onlyPromotions`) y se traduce al filtro Typesense `has_promotion:=true`.
- **Sidebar del PLP:** la sección "Promociones" lista las **campañas activas** (faceta `promotions.campaign.name`) y al clickear una filtra por `?promotion=<campaña>`. Ya estaba contemplada en `FACET_TO_FILTER_MAP`/`FILTER_DISPLAY_NAMES`; aparece sola cuando hay productos con promos indexadas.

## 6. Cómo verla / reemplazarla por proyecto

### Verla en local

```bash
pnpm db:seed          # catálogo + price list + 5 promotions
pnpm typesense:sync   # reindexa: sin esto NO se ven en PLP/home ni en el sidebar
```

(El PDP no necesita el sync; PLP/home/navbar/sidebar sí.)

### Reemplazarla

1. **Editar las promos:** modificá el bloque "Demo promotions" en `seed.ts` (códigos, valores, productos), reseteá la DB y reseed (la guarda de idempotencia salta el catálogo si ya existe). Reindexá.
2. **Desde el admin:** Settings → Promotions / Campaigns. Creá o editá promos; deben tener una regla `sales_channel_id` para ser visibles en la vitrina. Reindexá con `typesense:sync`.
3. **Quitarlas:** borrá/desactivá la promo. El sync deja de adjuntarla y el badge desaparece.

## 7. Visual vs. cálculo real

- **Price list `sale`** → cambia el **precio de venta real** (coherente en vitrina, carrito y checkout).
- **Promotions automáticas** → descuento **real** del motor, que el sync refleja en la vitrina como badge + precio bajado. Se aplica de verdad en el carrito.
- **Promotions por código / order** → descuento real, pero solo en el carrito al ingresar el código; en la vitrina aparecen como filtro/sidebar, sin bajar el precio de la card.

Ninguna es un cartel cosmético: todas afectan el precio real. La diferencia es *dónde* y *cuándo* se aplican.

## 8. Limitaciones conocidas

- **El sync es el que da visibilidad.** Los subscribers de producto (`product-updated-typesense-sync.ts`, etc.) reindexan un producto puntual sin re-resolver promociones; tras editar promos conviene correr el `typesense:sync` completo. Cerrar eso (enriquecer también los subscribers) queda como mejora futura.
- **Un solo descuento por card.** Si un producto tuviera varias promos automáticas, la card muestra el de mayor descuento (buyget tiene precedencia visual). El seed evita el solapamiento a propósito.
- El índice de Typesense es mono-moneda (ARS); el `discount` computado usa el `calculated_amount` en ARS.

## 9. Conclusión

La demo queda con **promociones reales de Medusa de varios tipos** (percentage, fixed, buyget, order; automáticas y por código) **visibles** en las tarjetas, accesibles desde el botón **Promociones** del navbar y listadas en el sidebar del PLP — más un price list `sale` como ejemplo de cambio de precio de catálogo. El pipeline que faltaba (resolver promo→productos en el `typesense-sync` e indexarlo) quedó cableado y documentado.
