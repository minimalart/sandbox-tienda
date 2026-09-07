# DESIGN.fashion.md — Mercatto · Template Moda

Sistema de diseño del **template Fashion / Indumentaria** de Mercatto, construido sobre Medusa. Documento escrito para humanos y para agentes de IA (Claude Code, Cursor, Copilot, v0, etc.).

Este template **convive** con los templates Grocery (supermercado) y Technology (electro) **sin reemplazar a ninguno**. Se activa cuando un demo store define `template: "fashion"` y se sirve en rutas como `mercatto.studio/demo/moda`.

> Idea rectora: **build desire, not discounts**.
>
> El objetivo no es vender una oferta: es construir marca, identidad y deseo. La fotografía es la protagonista; la interfaz desaparece. La experiencia debe sentirse editorial, premium y contemporánea — cercana a COS, Zara, Aime Leon Dore y Nike.

Toma como **referencia metodológica** el Apple Design Analysis (profundidad, estructura, consistencia), pero **no copia su estética**: reinterpreta esos principios para una marca de moda con paleta cálida neutra, serif editorial y aristas rectas.

---

## 1. Principios

### Fotografía primero

Las personas entran a inspirarse. La interfaz **nunca** compite con la imagen de campaña. La decoración existe solo si ordena o da aire.

Prioridad de la home:
1. Hero editorial (campaña)
2. Colecciones (deseo)
3. Storytelling de campaña
4. Producto (sin densidad)
5. Lifestyle + Lookbook (inspiración)
6. Temporada (marca)
7. Newsletter (relación)

### Aire y silencio visual

El espacio en blanco (en realidad, **bone-white cálido**) es el pedestal de la imagen. Secciones amplias, pocos elementos, jerarquías claras. Evitar contenedores, sombras, badges y gradientes decorativos.

### Editorial, no catálogo

Cada bloque debe leerse como una página de revista, no como una grilla de marketplace. Menos información por card, más intención por sección.

### Marca por encima de promoción

Sin precios tachados, sin "% OFF", sin banners de oferta, sin urgencia. El precio aparece, discreto, una sola vez por card.

---

## 2. Personalidad

El template Fashion es:

- Editorial
- Premium
- Sereno
- Contemporáneo
- Aspiracional

El template Fashion **no** es:

- Marketplace
- Catálogo técnico
- Supermercado
- Folleto de ofertas
- Tienda de electrodomésticos

---

## 3. Color

Paleta cálida, neutra y monocromática. Un solo tono de tinta como "acción"; el resto es estructura. Inspirada en COS / Aime Leon Dore: bone-white, tinta cálida casi negra y taupe.

### 3.1 Tokens (scope `.fashion-home`)

```css
.fashion-home {
  --f-canvas:  #f4f1ea; /* bone / off-white cálido — fondo dominante */
  --f-paper:   #ffffff; /* blanco puro — alterna con canvas para dar ritmo */
  --f-ink:     #1a1815; /* near-black cálido — texto, CTA, wordmark */
  --f-muted:   #6f685e; /* taupe-gray — texto secundario */
  --f-subtle:  #9b9388; /* labels, captions, legales */
  --f-hairline:#e3ded4; /* bordes y divisores 1px */
  --f-divider: #ece8df; /* placeholder de imagen / fondo de card */
  --f-dark:    #1a1815; /* tile oscuro editorial */
  --f-on-dark: #f4f1ea; /* texto/chrome sobre imagen oscura */
}
```

### 3.2 Uso

- `--f-ink`: titulares, navegación, precio, wordmark, CTA. Es el **único** color de acción.
- `--f-canvas`: fondo base (≥ 70% de la superficie).
- `--f-paper`: se intercala con canvas para separar secciones (el cambio de fondo **es** el divisor, no una línea).
- `--f-muted` / `--f-subtle`: jerarquía de texto secundario (gris cálido, nunca opacidad).
- `--f-hairline`: header, footer y separadores. 1px, jamás sombras.

### 3.3 Reglas cromáticas

- Monocromático cálido: **no** introducir un segundo color de marca.
- Sin rojo promocional, sin amarillo de oferta, sin verde de supermercado, sin azul tech.
- Sin gradientes decorativos. Solo veils sutiles (`black/30`, `white/20`) sobre fotografía para legibilidad.
- No usar fondos oscuros en bloques de lectura larga; el negro se reserva a tiles de campaña con foto.

---

## 4. Tipografía

Dos familias: una **serif editorial** para display y una **sans** aireada para UI y labels. Es la firma del template.

### 4.1 Familias

```css
--f-serif: var(--font-fashion-serif), "Cormorant Garamond", Georgia, serif;
--f-sans:  var(--font-inter), Inter, -apple-system, system-ui, sans-serif;
```

`--font-fashion-serif` se carga con `next/font` (Cormorant Garamond) en el root layout y se expone como variable global; **solo** lo consume `.fashion-home`.

### 4.2 Uso

- **Serif (Cormorant)**: hero, títulos de sección, nombres de colección, frases de campaña, wordmark. Peso 400–500, line-height ajustado (1.04–1.1).
- **Sans (Inter)**: navegación, eyebrows, labels, precio, nombre de producto, body, formularios. Las etiquetas van en **MAYÚSCULAS con tracking amplio** (0.16–0.22em) — el gesto COS/Zara.

### 4.3 Escala

| Token | Familia | Tamaño | Peso | Tracking | Uso |
|---|---|---:|---:|---:|---|
| Hero | serif | clamp(2.75 → 6rem) | 500 | -0.005em | Hero, banner de temporada |
| Display | serif | clamp(2 → 3.25rem) | 500 | 0 | Campaña, títulos grandes |
| Section title | serif | clamp(1.5 → 2.25rem) | 500 | 0 | Encabezados de sección |
| Collection | serif | 1.5–1.875rem | 500 | 0 | Nombre sobre la card |
| Eyebrow | sans | 0.72rem | 500 | 0.22em · UPPER | Kicker editorial |
| Nav / CTA | sans | 0.72–0.78rem | 500 | 0.16em · UPPER | Navegación, CTA, labels |
| Body | sans | 1rem | 300–400 | 0 | Párrafos de campaña |
| Product name | sans | 0.81rem | 400 | 0 | Nombre en card |
| Price | sans | 0.81rem | 500 | 0.01em | Precio en card |
| Brand / caption | sans | 0.625rem | 500 | 0.18em · UPPER | Marca en card, captions |

### 4.4 Reglas

- Display **siempre serif**; UI/labels **siempre sans**. La frontera es inquebrantable.
- Body en peso 300/400 (ligero, editorial). El precio en 500. Nunca 700 en esta home.
- Labels y CTA en mayúsculas con tracking; titulares serif en caja normal.
- Permitido el letter-spacing negativo leve solo en el hero serif.

---

## 5. Espaciado y layout

### 5.1 Escala

Base `4px`: `4, 8, 12, 16, 24, 32, 40, 56, 80, 112`. Las secciones respiran con padding vertical alto.

- Padding vertical de sección: `56px` (mobile) → `80px` (sm) → `112px` (newsletter).
- Gutters de grilla: `12–20px`.
- El hero y los banners de temporada son full-bleed (sin gutter).

### 5.2 Contenedores

- Ancho máximo de contenido: **1600px** (más ancho que Grocery para sostener fotografía grande).
- Hero / season banner: **full-width**, alto por viewport (`78–92vh` hero, `70vh` temporada).
- Campaña: split 50/50 imagen ↔ texto en desktop; apilado en mobile.

### 5.3 Reglas

- El cambio de fondo (`canvas` ↔ `paper`) separa secciones; evitar líneas duras salvo header/footer.
- Romper la grilla con `span` (`wide` / `tall`) en collection-grid y lookbook para dar ritmo editorial.
- En mobile, priorizar fotografía y swipe sobre densidad.

---

## 6. Forma y elevación

### 6.1 Radii

**Aristas rectas.** El template es deliberadamente sin redondeo (gesto Zara/COS).

```text
radius-base: 0px      (cards, imágenes, botones)
radius-pill: 9999px   (solo el contador del carrito)
```

### 6.2 Elevación

- **Sin sombras.** La jerarquía viene del cambio de superficie y de la fotografía.
- El único "movimiento de capa" es el header sticky con `backdrop-blur` sobre `--f-canvas/80`.

### 6.3 Imagen

- Retrato **3:4** para producto y categorías; **4:5** para colecciones; full-bleed para hero/temporada.
- Hover de producto: cross-fade a la segunda imagen (si existe) o `scale 1.03`.
- Transiciones lentas (`duration-700 ease-out`) — sensación premium.

---

## 7. Componentes

Componentes reutilizables (en `src/modules/home-fashion/components/`). Cada uno consume su bloque de `assets.fashion`.

### 7.1 `fashion-header`
Minimalista, baja altura, sticky con blur. Layout en 3 columnas: navegación (desktop) / hamburguesa (mobile) · wordmark centrado · accesos (búsqueda, cuenta, favoritos, carrito). Búsqueda como **overlay** (no ocupa espacio fijo). Ocupa menos alto que el header de Grocery.

### 7.2 `editorial-hero`
La pieza más importante. Fotografía de campaña full-width (`78–92vh`), arte distinto para mobile (`imageMobile`), eyebrow + título serif gigante + subtítulo + **CTA discreto** (link subrayado). Veil sutil para legibilidad. Sin banners ni descuentos.

### 7.3 `collection-grid`
Grid editorial de colecciones (Mujer, Hombre, Calzado, Accesorios, Nueva Colección). Cards full-bleed con nombre serif superpuesto; `span` (`wide`/`tall`) rompe la grilla. Mobile: carrusel con swipe.

### 7.4 `campaign-banner`
Storytelling. Split 50/50: foto a un lado (`imageSide`), texto sobrio al otro (eyebrow + frase serif + body + CTA). Cero precios.

### 7.5 `new-arrivals-carousel` (reutilizable)
Carrusel de producto. Sirve para **New Arrivals** y para **Productos destacados** (carrusel secundario) cambiando `source`. Card mínima (`fashion-product-card`): imagen 3:4, marca, nombre, precio, favorito. Sin badges.

### 7.6 `fashion-product-card`
Imagen protagonista con cross-fade en hover, favorito como única acción, y tres líneas de texto: marca (caption upper), nombre (1 línea), precio. Toda la card enlaza al PDP.

### 7.7 `lifestyle-categories`
Navegación inspiracional: rail de retratos (Workwear, Casual, Outdoor, Running, Essentials) con el nombre en label upper debajo.

### 7.8 `lookbook-grid`
Sección diferencial. Mosaico de fotografías editoriales de tamaños distintos (`span`); cada una enlaza a colección/categoría/producto. Label + flecha aparecen en hover.

### 7.9 `season-banner`
Bloque visual grande full-width (`70vh`) con foto protagonista, título serif de temporada y `f-btn-solid` (rectángulo tinta).

### 7.10 `fashion-newsletter`
Captación elegante y centrada: input con borde inferior 1px y CTA en texto upper. Sin popups.

### 7.11 `fashion-footer`
Inspirado en COS: columnas en labels upper espaciadas, mucho aire, contacto + redes como texto, línea legal sobria. Sin densidad.

### 7.12 CTAs
- `.f-cta`: link subrayado, upper, tracking — CTA por defecto (discreto).
- `.f-btn-solid`: rectángulo tinta → invierte a outline en hover — para CTA sobre fotografía.

---

## 8. Layout y grilla

- Hero / season: 1 columna full-bleed.
- Collection grid: 1 col (mobile, carrusel) → 2 col (sm) → 3 col (lg), con `span` para romper.
- New arrivals / destacados: rail horizontal con snap; cards de `260px` (desktop) / `58%` ancho (mobile).
- Lifestyle: rail → 3 col (sm) → 5 col (lg).
- Lookbook: mosaico 2 col (mobile) → 4 col (lg) con auto-rows por viewport.
- Campaña: split 50/50 (lg), apilado (mobile).

---

## 9. Responsive

Misma profundidad que el Design.md base. Tres modos:

### Desktop (`≥ 1024px`)
- Header completo con navegación inline y wordmark centrado.
- Grillas a máxima densidad editorial (3–5 col). Hero a `92vh`.
- Campaña split 50/50. Lookbook 4 col.

### Tablet (`640–1023px`)
- Navegación principal colapsa a hamburguesa a partir de `<1024px`.
- Collection grid y lifestyle a 2–3 col. Lookbook 4 col con filas más bajas.
- Hero a `88vh`. Campaña aún apilada o split según el bloque.

### Mobile (`< 640px`)
- **Diseñado para moda, no una reducción del desktop.**
- Hero usa `imageMobile` (recorte vertical), `78vh`.
- Colecciones, lifestyle y arrivals se vuelven **carruseles con swipe** (snap), cards anchas para foto grande.
- Lookbook = mosaico 2 columnas.
- Navegación en drawer lateral; búsqueda en overlay full-width.
- Touch targets ≥ 44px en iconos del header.

### Breakpoints clave
`640px` (sm — grilla aparece), `1024px` (lg — nav inline + densidad máxima), `1600px` (lock de contenido).

---

## 10. Imágenes

- Fotografía **editorial**: campañas, lifestyle, retrato de modelo. Luz natural, encuadres amplios, mood sereno.
- Producto sobre fondo neutro (`--f-divider`), retrato 3:4, sin sombras.
- Hero y temporada full-bleed con veil sutil.
- Evitar: stock genérico, packshots fríos, collages, fondos saturados.
- Lazy-load por defecto; el hero carga `priority`. Imágenes remotas → `unoptimized` (catálogos demo de dominios arbitrarios).

---

## 11. Movimiento

```css
--f-duration-slow: 700ms; /* cross-fade y scale de imágenes */
--f-duration-base: 200ms; /* hover de chrome / opacidad */
```

- Transiciones lentas y suaves: la imagen "respira", no salta.
- Hover de producto: cross-fade a 2ª imagen. Hover de CTA: `opacity 0.6`.
- Respetar `prefers-reduced-motion`.
- Nada parpadea, nada cuenta regresiva.

---

## 12. Accesibilidad

- Contraste AA: tinta cálida sobre bone-white cumple; sobre fotografía se usa veil + peso.
- Área táctil ≥ 44px en iconos del header.
- Iconos con `aria-label`; imágenes con `alt` descriptivo.
- Foco visible; navegación por teclado en drawer, overlay de búsqueda y carruseles.
- No comunicar información solo por color (la paleta es monocromática por diseño).

---

## 13. Voz y microcopy

Sobria, breve, aspiracional. Mezcla español/inglés editorial.

Preferir:
- `Descubrir`, `Ver todo`, `Ver la campaña`, `Ver temporada`
- `New Collection`, `New Arrivals`, `Lookbook`, `Summer Essentials`

Evitar:
- `% OFF`, `Oferta`, `Comprá ya`, `Últimas unidades`
- Urgencia, exclamaciones, tono de folleto.

---

## 14. Contenido dinámico

Todas las secciones consumen `assets.fashion` y son compatibles con `demo_store_id`, `vertical_code`, `template_id` y `sales_channel_id` (resueltos vía Demo Stores → `getActiveTenant()`).

Claves de contenido:

| Sección | Clave de config | Fuente de catálogo |
|---|---|---|
| Hero | `fashion.hero` | — |
| Colecciones | `fashion.featuredCollections` | — |
| Campaña | `fashion.campaign` | — |
| New Arrivals | `fashion.newArrivals.filter` | Typesense |
| Lifestyle | `fashion.lifestyleCategories` | — |
| Lookbook | `fashion.lookbook` | — |
| Destacados | `fashion.featuredProducts.filter` | Typesense |
| Temporada | `fashion.seasonBanner` | — |
| Newsletter | `fashion.newsletter` | — |
| Footer | `fashion.footer` | — |

Equivalencias con el brief: `featured_collections` → `featuredCollections`, `new_arrivals` → `newArrivals`, `lookbook_items` → `lookbook.items`, `campaign_banners` → `campaign`, `seasonal_content` → `seasonBanner`, `featured_products` → `featuredProducts`.

El contenido por defecto vive en `lib/site-config/fashion.ts` y un demo lo sobreescribe key por key (merge en `active-tenant.ts`).

---

## 15. Do's & Don'ts

### Do
- Dejar que la **fotografía** mande; la UI se calla.
- Serif para display, sans upper-tracked para labels.
- Bone-white de base, tinta cálida como única acción.
- Aristas rectas, sin sombras; el cambio de fondo es el divisor.
- Transiciones lentas (700ms) en imagen.
- Mobile con swipe y arte vertical propio.

### Don't
- Sin descuentos, badges, precios tachados ni urgencia.
- Sin segundo color de marca, sin gradientes decorativos.
- Sin redondeos (salvo el contador del carrito).
- No replicar el desktop en mobile.
- No usar estética de marketplace, supermercado ni electro.

---

## 16. Regla final

Ante la duda, elegir la opción más **silenciosa, fotográfica y editorial**. El template Fashion existe para construir deseo y marca, no para empujar una oferta.
