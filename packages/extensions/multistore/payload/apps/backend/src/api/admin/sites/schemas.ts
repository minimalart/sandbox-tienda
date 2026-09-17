import {
  storeLocatorRegionsSchema,
  storeLocatorCategoriesSchema,
  storeLocatorTypesSchema,
} from '../../../lib/store-locator-config';
import { z } from 'zod';
import {
  isReservedSlug,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
} from '../../../modules/demo-store/reserved-slugs';
import { DEFAULT_TEMPLATE_CODE } from '../../../modules/demo-store/templates';

/**
 * Schemas de validación de las rutas de Tiendas, en su propio módulo.
 *
 * Vive separado de los handlers por dos razones:
 *  1. Los `route.ts` importan `MedusaRequest`/`MedusaResponse`, que son exports
 *     SÓLO DE TIPO de `@medusajs/framework/http`. Bajo el harness de tests
 *     (`node --test` con ESM) importar un route.ts explota con "does not provide an
 *     export named 'MedusaRequest'". Por eso el repo no tenía ni un test de rutas:
 *     acá los schemas se vuelven testeables (`theme-schema.test.ts`).
 *  2. `[id]/route.ts` importaba de `../route` — una ruta dependiendo de otra ruta.
 */
/**
 * ÚNICA definición del theme. `UpdateDemoStoreSchema` en `[id]/route.ts` importa
 * ESTE objeto: antes tenía una copia inline con las mismas claves, y un campo nuevo
 * agregado sólo acá se guardaba al crear y se perdía al editar, en silencio.
 */
export const ThemeSchema = z
  .object({
    primary_color: z.string().optional(),
    secondary_color: z.string().optional(),
    accent_color: z.string().optional(),
    // Fondo del header/footer. Sin esto el storefront usa el default del template.
    header_background: z.string().optional(),
    footer_background: z.string().optional(),
    // Fondo del boton "Promociones" del header. Sin esto usa el color primario.
    promo_button_color: z.string().optional(),
    // Branding: logo/icono/favicon en variantes positivo y negativo. Todos
    // opcionales. `mobile_logo` se mantiene por compatibilidad (= icono positivo).
    logo: z.string().optional(),
    logo_negative: z.string().optional(),
    icon: z.string().optional(),
    icon_negative: z.string().optional(),
    mobile_logo: z.string().optional(),
    // `mobile_nav_icon` vivió acá: elegía cuál de los dos isotipos usaba el
    // botón de home del nav inferior mobile. Se retiró en DESDEELSUR-29 — el
    // círculo es `bg-white` y el isotipo negativo es blanco, así que la opción
    // 'negative' sólo podía dejar el botón vacío. Sin migración a propósito:
    // `.partial()` strippea la clave, así que las filas viejas se limpian solas
    // en el próximo guardado.
    favicon: z.string().optional(),
    favicon_negative: z.string().optional(),
    typography: z.string().optional(),
  })
  .partial();

export const ContentConfigSchema = z
  .object({
    sections: z
      .object({
        blog: z.boolean().optional(),
        contact: z.boolean().optional(),
        shoppingList: z.boolean().optional(),
        sucursales: z.boolean().optional(),
        corporate: z.boolean().optional(),
        // Menú "Categorías" del nav de escritorio (antes de "Tienda").
        categories: z.boolean().optional(),
        // Etiquetas de formato/color en las cards del catálogo.
        variantLabels: z.boolean().optional(),
        // Bundled Products: habilita el módulo `bundle` para esta tienda.
        // Cuando está en false (default) el bloque Puck `BundlesGrid` del home
        // no renderiza nada, y las rutas storefront pueden asumir que la
        // capacidad no está activa. La creación de bundles en el admin es
        // independiente de este flag — el operador puede tener bundles
        // guardados sin exponerlos todavía en el storefront.
        bundles: z.boolean().optional(),
      })
      .partial()
      .optional(),
    // Descripción de la tienda → metadata.description (meta description + social
    // card). Si falta acá, Zod la strippea al guardar y se pierde en silencio.
    description: z.string().optional(),
    blogSectionName: z.string().optional(),
    // Variante visual del menú de categorías (hamburguesa | botón).
    categoriesMenuLayout: z.enum(['hamburger', 'button']).optional(),
    /**
     * Orden del lugar flexible de la barra inferior mobile (el cuarto ítem,
     * entre el carrito y el menú). El storefront toma el primer id disponible.
     *
     * `z.enum` y no `z.string()`: un id que el storefront no conoce se ignora
     * en silencio, así que dejarlo pasar acá sería guardar config muerta.
     */
    mobileNav: z
      .array(z.enum(['promos', 'colores', 'sucursales', 'blog', 'contacto']))
      .optional(),
    /**
     * Ícono o texto por entrada de la barra. Parcial a propósito: sólo viajan
     * las que el operador cambió a 'text' y el storefront completa el resto con
     * 'icon'.
     *
     * `object().partial()` y no `z.record`: en zod 4 un record con clave
     * enumerada EXIGE las 5 claves, y acá el payload es justamente parcial.
     * Enumerarlas igual mantiene el guard de la clave — una entrada que el
     * storefront no conoce sería config muerta.
     */
    mobileNavDisplay: z
      .object({
        promos: z.enum(['icon', 'text']),
        colores: z.enum(['icon', 'text']),
        sucursales: z.enum(['icon', 'text']),
        blog: z.enum(['icon', 'text']),
        contacto: z.enum(['icon', 'text']),
      })
      .partial()
      .optional(),
    contact: z
      .object({
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        // Horario de atención. Va con el contacto y no con el footer: es el mismo
        // dato que el teléfono y el mail, que la columna "Atención al cliente"
        // muestra juntos.
        hours: z.string().optional(),
      })
      .partial()
      .optional(),
    /**
     * Copy de la sección "Atención al cliente" de `/contact`. Hermana de
     * `contact` a propósito: la pantalla del footer reconstruye `contact` entero
     * desde sus campos, así que un `contact.title` moría en el primer guardado
     * del footer. Ver el tipo del módulo para el detalle.
     *
     * Y vale la regla de este schema: lo que falte acá Zod lo STRIPPEA al
     * guardar, sin error — el campo se pierde en silencio.
     */
    contactPage: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        note: z.string().optional(),
      })
      .partial()
      .optional(),
    /**
     * El footer completo. NO confundir `footer.description` con `description`
     * (esa es la de SEO). Y OJO con la regla de este schema: lo que falte acá Zod
     * lo STRIPPEA al guardar, así que el campo se pierde en silencio — cada
     * agregado al tipo de `content_config.footer` tiene que aparecer también acá.
     *
     * El formulario del backoffice manda el objeto COMPLETO, no un parcial, y eso
     * es lo que desactiva la trampa del merge: `assets.footer` se mergea shallow
     * POR CLAVE, así que un `footer` parcial le borraba al sitio el resto de sus
     * claves y el componente caía en sus fallbacks hardcodeados.
     */
    footer: z
      .object({
        description: z.string().optional(),
        social: z
          .array(
            z.object({
              name: z.string(),
              href: z.string(),
              icon: z.string().optional(),
            }),
          )
          .max(12)
          .optional(),
        legal: z
          .array(z.object({ name: z.string(), href: z.string() }))
          .max(20)
          .optional(),
        newsletter: z
          .object({
            title: z.string().optional(),
            placeholder: z.string().optional(),
            buttonText: z.string().optional(),
          })
          .partial()
          .optional(),
        copyright: z.string().optional(),
      })
      .partial()
      .optional(),
    sucursales: z
      .object({
        // Se persiste incluso vacío: '' = subtítulo oculto (≠ ausente = default).
        subtitle: z.string().optional(),
        regions: storeLocatorRegionsSchema.optional(),
        // Tipos de sucursal de la tienda. Lista vacía = la tienda no clasifica
        // sus sucursales; ausente = todavía no se configuró y caen los tres de
        // siempre. `categories` es la clave vieja: se sigue leyendo para no
        // rechazar un content_config que nunca se guardó con la pantalla nueva.
        types: storeLocatorTypesSchema.optional(),
        categories: storeLocatorCategoriesSchema.optional(),
        showLocationFilters: z.boolean().optional(),
        showCategoryFilters: z.boolean().optional(),
        layout: z.enum(['full', 'compact']).optional(),
      })
      .partial()
      .optional(),
    shoppingList: z
      .object({
        title: z.string().optional(),
        subtitle: z.string().optional(),
        quickTerms: z.array(z.string()).optional(),
      })
      .partial()
      .optional(),
    searchSuggestions: z
      .array(z.object({ label: z.string(), query: z.string() }))
      .optional(),
    searchHints: z.array(z.string()).optional(),
    // Diseño de la sección de marcas del home (carousel | marquee | dots).
    brandsLayout: z.enum(['carousel', 'marquee', 'dots']).optional(),
    // Qué checkout de MercadoPago muestra el demo (api | express | both).
    // Sin esto, validateAndTransformBody (Zod) descartaba la clave al guardar.
    mercadopagoCheckoutMode: z.enum(['api', 'express', 'both']).optional(),
    /**
     * Content SITE-LEVEL del template Campaña (landing institucional).
     *
     * Sólo lleva lo que aparece en TODAS las pantallas del sitio y no solo en
     * la home: announcement bar (barra fina arriba), chrome del header (subtitle
     * institucional + pill "Powered by") y footer institucional. El resto del
     * home (hero + grid de kits) es CUERPO de la home y se edita desde el
     * editor Puck (`assets.homeLayout` con bloques `CampaignHero` y
     * `ProductosDestacados`), no acá.
     *
     * SOLO se lee cuando `template_code === 'campaign'`. Como todo lo demás en
     * este schema: lo que falte acá Zod lo STRIPPEA al guardar, sin error — el
     * campo se pierde en silencio. Cada agregado al tipo hay que replicarlo acá.
     */
    campaign: z
      .object({
        announcement: z
          .object({
            text: z.string().optional(),
            href: z.string().optional(),
          })
          .partial()
          .optional(),
        chrome: z
          .object({
            subtitle: z.string().optional(),
            poweredByLabel: z.string().optional(),
            poweredByHref: z.string().optional(),
            backgroundColor: z.string().optional(),
          })
          .partial()
          .optional(),
        footer: z
          .object({
            poweredBy: z
              .object({ label: z.string(), href: z.string() })
              .optional(),
            backgroundColor: z.string().optional(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
  })
  .partial();

export const CreateDemoStoreSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  /**
   * El slug es la identidad pública de la tienda: `/tienda/<slug>` y, bajo
   * subdominios, `<slug>.<sufijo>`. Por eso el contrato es más estricto que "no
   * vacío":
   *  - largo 3-40. Rechazar 2 caracteres: chocan con el prefijo legacy de país
   *    (`/ar/...`) y con el strip de 2 letras del storefront.
   *  - sin puntos (ya lo garantiza el patrón): un punto crearía un label extra de
   *    subdominio que el certificado wildcard NO cubre.
   *  - fuera de la lista reservada, que cubre los segmentos ruteables del
   *    storefront Y los subdominios de infra.
   *
   * `UpdateDemoStoreSchema` NO acepta `slug`: renombrarlo es breaking (URLs
   * indexadas, links compartidos) y bajo subdominios es peor que un 404, porque el
   * host viejo pasa a desconocido y sirve 200 con el contenido del sitio principal.
   */
  slug: z
    .string()
    .min(SLUG_MIN_LENGTH, `El slug necesita al menos ${SLUG_MIN_LENGTH} caracteres`)
    .max(SLUG_MAX_LENGTH, `El slug no puede pasar de ${SLUG_MAX_LENGTH} caracteres`)
    .regex(SLUG_PATTERN, 'El slug va en minúsculas, separado con guiones')
    .refine((s) => !isReservedSlug(s), {
      message:
        'Ese slug está reservado: choca con una página del storefront o con un subdominio ' +
        'de la infraestructura.',
    }),
  template_code: z.string().optional().default(DEFAULT_TEMPLATE_CODE),
  country_code: z.string().min(2),
  currency_code: z.string().min(3),
  locale: z.string().optional().default('es'),
  // `native` NO se acepta acá a propósito: es el source de la fila principal, que
  // se siembra desde `ensureMainStore()`, no por API. Crear nunca produce una fila
  // principal.
  source_type: z.enum(['woocommerce', 'vtex', 'shopify', 'sales_channel']),
  /**
   * Para las plataformas externas, la URL de la tienda. Para `sales_channel`, el
   * ID del canal origen (`sc_...`): el catálogo ya vive en esta instancia y no
   * hay nada que ir a buscar por HTTP.
   */
  source_url: z.string().min(1, 'Source URL is required'),
  source_config: z.record(z.string(), z.unknown()).nullish(),
  /**
   * Forma canónica para SEO. NO cambia qué URLs resuelven — las dos resuelven
   * siempre — sólo cuál lleva el `<link rel="canonical">` y cuál queda `noindex`.
   *
   * A diferencia del `slug`, esto SÍ es editable: cambiarlo no rompe ninguna URL, sólo
   * mueve la señal de indexación. Un rename de slug, en cambio, dejaría el host viejo
   * devolviendo 200 con el contenido del sitio principal.
   */
  canonical_form: z.enum(['host', 'path']).optional(),
  theme: ThemeSchema.optional(),
  content_config: ContentConfigSchema.nullish(),
  target_count: z.number().int().positive().optional(),
  // When true, provisioning also creates a dedicated wholesale (B2B) setup.
  b2b_enabled: z.boolean().optional().default(false),
  // When true, the demo exposes the recurring purchases (suscripciones) feature.
  recurring_enabled: z.boolean().optional().default(false),
  // When true, the demo exposes the color-first tinting page ("Buscá tu color").
  tinting_enabled: z.boolean().optional().default(false),
  // Secciones de "Mi cuenta". Default TRUE, al revés que los de arriba: hoy están
  // hardcodeadas como siempre visibles en el storefront, así que una tienda nueva
  // tiene que nacer igual que las que ya existen.
  loyalty_enabled: z.boolean().optional().default(true),
  gift_cards_enabled: z.boolean().optional().default(true),
  /**
   * Reusar un stock location existente en vez de crear uno nuevo. Presente =
   * validar que exista y linkearlo al SC de la demo. Ausente/null = comportamiento
   * default: `provisionDemoStore` crea `Depósito Demo <nombre>`.
   *
   * Motivo: hasta hoy toda demo creaba SIEMPRE un stock location propio, aunque
   * el operador quisiera compartir el depósito real de la instancia (por ej. una
   * escuela cuya "tienda" es un demo pero el stock físico es el mismo). Sin esta
   * opción cada demo terminaba con un depósito huérfano.
   *
   * Si viene: el schema NO valida su existencia acá (se hace en el workflow con
   * un lookup real al StockLocation service, para devolver un error tipado).
   */
  reuse_stock_location_id: z.string().min(1).optional(),
});

export type CreateDemoStoreInput = z.infer<typeof CreateDemoStoreSchema>;

/**
 * Editar una tienda existente.
 *
 * NO acepta `slug`: renombrarlo es breaking (URLs indexadas, links compartidos) y
 * bajo subdominios es PEOR que un 404 — el host viejo pasa a "desconocido" y sirve
 * 200 con el contenido del sitio principal.
 *
 * Y NO acepta `is_main`: la fila principal la siembra `ensureMainStore()`, no la
 * API. Si fuera editable, un PATCH podría crear una segunda principal (o dejar
 * cero), y el índice único devolvería un 500 en vez de un error claro.
 */
export const UpdateDemoStoreSchema = z.object({
  name: z.string().min(1).optional(),
  template_code: z.string().optional(),
  /**
   * Forma canónica para SEO. NO cambia qué URLs resuelven — las dos resuelven
   * siempre — sólo cuál lleva el `<link rel="canonical">` y cuál queda `noindex`.
   *
   * A diferencia del `slug`, esto SÍ es editable: cambiarlo no rompe ninguna URL, sólo
   * mueve la señal de indexación. Un rename de slug, en cambio, dejaría el host viejo
   * devolviendo 200 con el contenido del sitio principal.
   */
  canonical_form: z.enum(['host', 'path']).optional(),

  // EL MISMO objeto que el de creación, a propósito. Antes había una copia inline
  // en `[id]/route.ts` con las mismas 13 claves: un campo nuevo de theme agregado
  // sólo en una de las dos se guardaba al crear y se perdía al editar, sin error.
  // Una sola definición hace que esa clase de bug no exista. Lo defiende
  // `theme-schema.test.ts`.
  theme: ThemeSchema.optional(),
  content_config: ContentConfigSchema.nullish(),
  // Puck document for the demo home ({ content, root }). Admin-authored and
  // trusted; stored as-is and surfaced to the storefront via buildTenantConfig.
  home_puck_data: z.record(z.string(), z.any()).nullish(),
  // Enable B2B on an existing demo (provisioned inline on the transition to true).
  b2b_enabled: z.boolean().optional(),
  b2b_sales_channel_id: z.string().min(1).nullable().optional(),
  b2b_price_list_id: z.string().min(1).nullable().optional(),
  // Toggle recurring purchases (no provisioning needed: it's a pure feature flag).
  recurring_enabled: z.boolean().optional(),
  // Toggle la página de tintometría (color → bases). También es feature flag pura:
  // la data maestra es de la instancia y ya existe.
  tinting_enabled: z.boolean().optional(),
  // Toggles de "Mi cuenta" (Mis puntos / Gift Cards). Feature flags puras: los
  // módulos son de la instancia y conservan sus switches en app-settings.
  // Sin `.default()`: en el update, ausente = no se toca.
  loyalty_enabled: z.boolean().optional(),
  gift_cards_enabled: z.boolean().optional(),
  /**
   * Cambiar el stock location asignado a la demo (main o hija). Dispara el
   * workflow `updateDemoStoreStockLocationWorkflow`: desliga el SC del stock
   * location viejo (si había uno) y lo linka al nuevo. `null` explícito =
   * desasignar (útil para la principal, que puede volver a "usar el default de
   * la instancia" sin un stock location propio).
   *
   * Ausente = no se toca. Presente con string = el ID nuevo (debe existir).
   *
   * NO acepta simplemente un string vacío para desasignar: ambiguo con "no vino".
   * El null explícito es el switch de detach.
   */
  stock_location_id: z.string().min(1).nullable().optional(),
  /**
   * Cambiar la region asignada a la demo. Dispara el mismo workflow que stock
   * location (comparten la lógica de re-linkeo del SC). Precaución: en Medusa
   * un país puede pertenecer a UNA sola region — cambiar la region de una demo
   * NO altera esa constraint, el link nuevo puede rechazarse si el SC/país
   * choca con otro. `null` = desasignar (misma semántica que stock_location).
   *
   * Ausente = no se toca. Presente con string = el ID nuevo.
   */
  region_id: z.string().min(1).nullable().optional(),
  /**
   * Reasignar el sales channel de la demo (incluida la principal). Es el cambio
   * de MAYOR impacto de todos: el SC es la identidad de catálogo (los productos
   * que la storefront lee salen de ahí). Al cambiar:
   *
   *  - Los productos linked al SC viejo dejan de aparecer (a menos que también
   *    estén en el SC nuevo).
   *  - Los publishable_api_keys que la storefront usa se re-linkean: pierden el
   *    SC viejo, ganan el SC nuevo. Sin esto la storefront quedaría leyendo un
   *    canal huérfano.
   *  - Si la demo tenía SL asignado, se re-linkea (SL↔SC viejo → SL↔SC nuevo)
   *    para que las shipping options sigan funcionando.
   *
   * NO se valida "canal ya adoptado por otra demo" ni "canal default de la
   * principal" acá — el workflow decide. Motivo: la principal SIEMPRE tiene el
   * SC default de Medusa Store al crearse, y el operador puede querer moverla
   * a un canal dedicado (caso reportado por Educabot en prod).
   *
   * Ausente = no se toca. `null` = desasignar (raro; deja la demo sin SC y sin
   * catálogo). String = el ID nuevo (debe existir).
   */
  sales_channel_id: z.string().min(1).nullable().optional(),
});

export type UpdateDemoStoreInput = z.infer<typeof UpdateDemoStoreSchema>;

