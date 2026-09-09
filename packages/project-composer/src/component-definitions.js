/** Canonical ownership map for code that is extracted from the boilerplate core. */
module.exports = {
  'space-designer': [
    'apps/storefront/public/space-designer',
    'apps/storefront/src/modules/space-designer',
    'apps/storefront/src/lib/data/space-designer.ts',
    'apps/storefront/src/lib/space-designer',
    'apps/storefront/src/app/[countryCode]/(main)/espacios',
    'apps/storefront/src/app/api/store/space-designer',
  ],
  blog: [
    'apps/backend/src/modules/blog', 'apps/backend/src/api/admin/blog-posts', 'apps/backend/src/api/admin/blog-categories',
    'apps/backend/src/api/admin/blog-settings', 'apps/backend/src/api/store/blog-posts', 'apps/backend/src/api/store/blog-categories',
    'apps/backend/src/api/store/blog-settings', 'apps/backend/src/admin/routes/blog', 'apps/backend/src/admin/hooks/api/blog.tsx',
    'apps/backend/src/admin/components/blog', 'apps/backend/src/admin/translations/blog',
    'apps/storefront/src/modules/blog', 'apps/storefront/src/lib/data/blog.ts',
    'apps/storefront/src/app/[countryCode]/(main)/blog', 'apps/storefront/src/app/sitemap.ts',
  ],
  'checkout-links': [
    'apps/backend/src/modules/checkout-link', 'apps/backend/src/api/admin/checkout-links', 'apps/backend/src/api/store/checkout-links',
    'apps/backend/src/admin/routes/checkout-links', 'apps/backend/src/admin/hooks/api/checkout-links.tsx',
    'apps/backend/src/workflows/create-checkout-link.ts', 'apps/storefront/src/app/[countryCode]/c',
  ],
  'database-explorer': [
    'apps/backend/src/modules/database-explorer', 'apps/backend/src/api/admin/database-explorer',
    'apps/backend/src/admin/routes/data', 'apps/backend/src/admin/hooks/api/database-explorer.tsx',
  ],
  ga4: [
    'apps/backend/src/modules/ga4', 'apps/backend/src/api/admin/ga4-builtins', 'apps/backend/src/api/admin/ga4-config',
    'apps/backend/src/api/admin/ga4-mappings', 'apps/backend/src/admin/routes/ga4', 'apps/backend/src/admin/hooks/api/ga4-mappings.tsx',
    'apps/backend/src/admin/translations/ga4-events', 'apps/backend/src/subscribers/ga4-dispatcher.ts',
    'apps/backend/src/subscribers/ga4-ecommerce-dispatcher.ts', 'apps/backend/src/workflows/create-ga4-mapping.ts',
    'apps/backend/src/workflows/delete-ga4-mapping.ts', 'apps/backend/src/workflows/update-ga4-mapping.ts',
    'apps/backend/src/workflows/steps/create-ga4-mapping.ts', 'apps/backend/src/workflows/steps/delete-ga4-mapping.ts',
    'apps/backend/src/workflows/steps/update-ga4-mapping.ts', 'apps/storefront/src/lib/analytics/google-analytics.tsx',
  ],
  wishlist: [
    'apps/backend/src/modules/wishlist', 'apps/backend/src/api/store/customers/me/wishlist',
    'apps/storefront/src/app/api/store/wishlist', 'apps/storefront/src/lib/hooks/use-wishlist.ts',
    'apps/storefront/src/lib/stores/wishlist.store.ts', 'apps/storefront/src/lib/util/wishlist.ts',
    'apps/storefront/src/modules/common/components/wishlist-button', 'apps/storefront/src/modules/layout/components/wishlist-drawer',
    'apps/storefront/src/modules/account/components/wishlist-overview',
    'apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/wishlist',
  ],
  'loyalty-points': [
    'apps/backend/src/modules/points', 'apps/backend/src/api/store/points',
    'apps/backend/src/scripts/reverse-b2b-points.ts', 'apps/storefront/src/app/api/store/points',
    'apps/storefront/src/modules/account/components/loyalty-overview',
  ],
  'loyalty-engine': [
    'apps/backend/src/modules/loyalty', 'apps/backend/src/scripts/seed-loyalty.ts',
    'apps/backend/src/subscribers/order-placed-points.ts',
    'apps/backend/src/subscribers/order-canceled-loyalty.ts',
    'apps/backend/src/subscribers/customer-created-loyalty.ts',
    'apps/backend/src/subscribers/comment-approved-loyalty.ts',
    'apps/backend/src/workflows/earn-loyalty-points.ts',
    'apps/backend/src/workflows/reverse-loyalty-points.ts',
    'apps/backend/src/workflows/redeem-reward.ts',
    'apps/backend/src/jobs/expire-loyalty-points.ts',
    'apps/backend/src/api/admin/loyalty',
    'apps/backend/src/api/store/loyalty',
    'apps/backend/src/admin/routes/loyalty',
    'apps/backend/src/admin/hooks/api/loyalty.tsx',
    'apps/backend/src/admin/widgets/customer-loyalty-widget.tsx',
    'apps/storefront/src/app/api/store/loyalty',
    'apps/storefront/src/modules/account/components/loyalty-rewards',
    'apps/storefront/src/modules/checkout/components/loyalty-rewards-checkout',
  ],
  'gift-cards': [
    'apps/backend/src/modules/gift-card-experience',
    'apps/backend/src/api/admin/gift-card-experience',
    'apps/backend/src/api/store/gift-card-experience',
    'apps/backend/src/api/webhooks/sendgrid-gift-cards',
    'apps/backend/src/subscribers/order-canceled-gift-card.ts',
    'apps/backend/src/subscribers/order-placed-gift-card.ts',
    'apps/backend/src/subscribers/payment-captured-gift-card.ts',
    'apps/backend/src/jobs/process-gift-card-deliveries.ts',
    'apps/backend/src/jobs/process-gift-card-lifecycle.ts',
    'apps/backend/src/jobs/reconcile-gift-card-usage.ts',
    'apps/backend/src/workflows/hooks/gift-card-cart-validation.ts',
    'apps/backend/src/scripts/audit-gift-card-duplicates.ts',
    'apps/backend/src/scripts/backfill-gift-card-deliveries.ts',
    'apps/backend/src/admin/routes/gift-card-experience',
    'apps/backend/src/admin/hooks/api/gift-cards.tsx',
    'apps/storefront/src/modules/products/components/gift-card-configurator',
    'apps/storefront/src/app/api/store/gift-card-experience',
    'apps/storefront/src/app/[countryCode]/(main)/gift-card',
    'apps/storefront/public/images/gift-card-default.svg',
  ],
  mercadopago: [
    'apps/backend/src/modules/mercado-pago', 'apps/backend/src/modules/mercado-pago-api',
    'apps/backend/src/api/mercado-pago', 'apps/backend/src/api/mercado-pago-api', 'apps/backend/src/api/store/mercadopago',
    'apps/backend/src/scripts/setup-mercadopago.ts', 'apps/backend/src/scripts/probe-mercadopago-benefits.ts',
    'apps/storefront/src/app/api/store/mercadopago', 'apps/storefront/src/lib/data/mercadopago.ts',
    'apps/storefront/src/modules/checkout/components/payment-mercadopago-brick', 'apps/storefront/src/modules/common/icons/mercadopago.tsx',
  ],
  typesense: [
    'apps/backend/src/modules/typesense', 'apps/backend/src/api/admin/typesense', 'apps/backend/src/api/store/typesense',
    // Explícitos: `discoverBackendIntegrations` sólo adopta un archivo si importa
    // algo ya poseído por la extensión, y estos dos no importaban nada de
    // typesense — por eso faltaban del payload y los proyectos generados
    // quedaban sin el loader del sync (que la ruta admin SÍ importa) ni las
    // traducciones del admin (que `admin/i18n/index.ts` SÍ importa).
    'apps/backend/src/api/store/custom/typesense-sync',
    'apps/backend/src/admin/translations/typesense',
    'apps/backend/src/admin/routes/typesense', 'apps/backend/src/admin/hooks/api/typesense.tsx',
    'apps/storefront/src/lib/typesense',
  ],
  brands: [
    'apps/backend/src/modules/brand', 'apps/backend/src/api/admin/brands', 'apps/backend/src/api/store/brands',
    'apps/backend/src/admin/routes/brands', 'apps/backend/src/admin/hooks/api/brands.tsx', 'apps/backend/src/admin/translations/brands',
    'apps/storefront/src/lib/data/brands.ts', 'apps/storefront/src/modules/home/components/logo-showcase',
  ],
  banners: [
    'apps/backend/src/modules/banner', 'apps/backend/src/api/admin/banners', 'apps/backend/src/api/store/banners',
    'apps/backend/src/admin/routes/banners', 'apps/backend/src/admin/hooks/api/banners.tsx', 'apps/backend/src/admin/translations/banners',
    'apps/storefront/src/lib/banners.ts', 'apps/storefront/src/lib/data/banners.ts', 'apps/storefront/src/lib/context/banners-context.tsx',
    'apps/storefront/src/modules/home/components/hero-banners',
  ],
  'media-library': [
    'apps/backend/src/modules/media-library', 'apps/backend/src/api/admin/media-library',
    'apps/backend/src/admin/routes/media-library', 'apps/backend/src/admin/hooks/api/media-library.tsx',
  ],
  'store-config': [
    'apps/backend/src/modules/store-config', 'apps/backend/src/api/admin/store-config',
    'apps/backend/src/api/store/store-config', 'apps/backend/src/api/store/minimum-purchase', 'apps/backend/src/api/store/barcode-scanner',
    'apps/backend/src/admin/routes/store-config', 'apps/backend/src/admin/hooks/api/store-config.tsx', 'apps/backend/src/admin/hooks/api/email-branding.tsx',
    'apps/backend/src/admin/hooks/api/legal-pages.tsx',
    // El editor de textos legales. Va en su propia carpeta —y no en
    // `admin/components/blog/`— porque un archivo con DOS dueños lo saltea el extract
    // sin ningún error: el payload de una de las dos extensiones saldría incompleto.
    'apps/backend/src/admin/components/store-config',
    'apps/backend/src/admin/translations/store-config',
    'apps/storefront/src/lib/data/store-settings.ts', 'apps/storefront/src/app/api/store/minimum-purchase', 'apps/storefront/src/app/api/store/barcode-scanner',
    // Los textos legales del storefront. Misma nota que el gate más abajo: los paths
    // de apps/storefront NO se auto-descubren, y `apps/platform` instala/actualiza
    // EXACTAMENTE `files[]`. Con sólo el módulo de datos acá, un proyecto que
    // actualice store-config recibiría `legal-pages.ts` y no las páginas que lo
    // importan: build roto. Por eso van las tres cosas juntas —datos, componentes y
    // rutas— igual que el gate lleva su `layout.tsx`.
    'apps/storefront/src/lib/data/legal-pages.ts',
    'apps/storefront/src/modules/legal',
    'apps/storefront/src/app/[countryCode]/(main)/legal',
    // Carga de los textos legales desde un JSON. El script es genérico; el
    // contenido de cada cliente vive en SU repo, no acá.
    'apps/backend/src/scripts/seed-legal-pages.ts',
    // Página de contraseña (site gate). Los paths de apps/storefront NO se
    // auto-descubren, así que sin estas 4 líneas el gate deja de ser parte de la
    // extensión: `apps/platform` instala/actualiza exactamente `files[]`, así que
    // un proyecto que agregue o actualice store-config no recibiría nunca el
    // código del gate (y `verify` dejaría de vigilar su payload).
    //
    // OJO con `[countryCode]/layout.tsx`: es un archivo del core y va acá porque
    // importa `site-gate.ts` y `site-gate-screen.tsx` de forma directa, así que
    // los tres tienen que instalarse juntos. La contra es que un proyecto SIN
    // store-config se queda sin el layout del storefront. Hoy no puede pasar
    // —las 5 plantillas dependen de store-config— pero una plantilla nueva que
    // no dependa de ella necesita antes un slot generado, como
    // `whatsapp-slot.tsx` o `recommendations-slot.tsx`.
    'apps/storefront/src/lib/site-config/site-gate.ts',
    'apps/storefront/src/app/api/site-gate',
    'apps/storefront/src/modules/site-gate',
    'apps/storefront/src/app/[countryCode]/layout.tsx',
  ],
  'store-locations': [
    'apps/backend/src/modules/store-location', 'apps/backend/src/api/admin/store-locations', 'apps/backend/src/api/admin/sales-channels-b2c',
    'apps/backend/src/api/store/store-locations', 'apps/backend/src/admin/routes/store-locations', 'apps/backend/src/admin/hooks/api/store-locations.tsx',
    'apps/backend/src/admin/translations/store-locations',
    'apps/backend/src/scripts/seed-store-locations.ts',
    'apps/storefront/src/modules/store-locations', 'apps/storefront/src/lib/data/store-locations.ts', 'apps/storefront/src/lib/data/branch.ts', 'apps/storefront/src/lib/data/branch-types.ts', 'apps/storefront/src/app/api/store/addresses',
  ],
  contact: [
    'apps/backend/src/modules/contact', 'apps/backend/src/api/admin/contact-submissions', 'apps/backend/src/api/store/contact-submissions',
    'apps/backend/src/admin/routes/contact-submissions', 'apps/backend/src/admin/hooks/api/contact-submissions.tsx',
    'apps/storefront/src/modules/contact', 'apps/storefront/src/app/api/store/contact',
  ],
  // El route del storefront es de la extensión, igual que `contact` posee el suyo:
  // sin ella, ese archivo es el placeholder que devolvía `success: true` sin
  // hablar con nadie. El FORMULARIO (`layout/components/newsletter-form`,
  // `lib/hooks/use-newsletter.ts`) queda en el core a propósito — es UI base que
  // ya existía y que sigue teniendo sentido apuntando a este endpoint.
  newsletter: [
    'apps/backend/src/modules/newsletter',
    'apps/backend/src/api/admin/newsletter-subscriptions',
    'apps/backend/src/api/store/newsletter-subscriptions',
    'apps/backend/src/admin/routes/newsletter-subscriptions',
    'apps/backend/src/admin/hooks/api/newsletter-subscriptions.tsx',
    'apps/storefront/src/app/api/store/newsletter',
  ],
  comments: [
    'apps/backend/src/modules/comments', 'apps/backend/src/api/admin/comments', 'apps/backend/src/api/store/comments',
    'apps/backend/src/admin/routes/comments', 'apps/backend/src/admin/hooks/api/comments.tsx',
    'apps/storefront/src/lib/data/comments.ts', 'apps/storefront/src/lib/data/comments-actions.ts',
  ],
  'shop-by-looks': [
    'apps/backend/src/modules/shop-by-look', 'apps/backend/src/api/admin/shop-by-looks', 'apps/backend/src/api/store/shop-by-look',
    'apps/backend/src/admin/routes/shop-by-looks', 'apps/backend/src/admin/hooks/api/shop-by-looks.tsx', 'apps/backend/src/admin/translations/shop-by-looks',
    'apps/storefront/src/lib/data/shop-by-look.ts', 'apps/storefront/src/modules/home/components/shop-by-look',
  ],
  videos: [
    'apps/backend/src/modules/vimeo-video', 'apps/backend/src/api/admin/videos', 'apps/backend/src/api/admin/vimeo', 'apps/backend/src/api/store/videos',
    'apps/backend/src/admin/routes/videos', 'apps/backend/src/admin/hooks/api/videos.tsx', 'apps/backend/src/admin/translations/videos',
    'apps/storefront/src/lib/data/videos.ts', 'apps/storefront/src/modules/home/components/shoppable-videos',
  ],
  'pdf-catalog': [
    'apps/backend/src/modules/pdf-catalog', 'apps/backend/src/api/admin/pdf-catalogs', 'apps/backend/src/api/store/pdf-catalog',
    'apps/backend/src/admin/routes/pdf-catalogs', 'apps/backend/src/admin/hooks/api/pdf-catalogs.tsx',
    'apps/storefront/src/lib/data/pdf-catalog.ts', 'apps/storefront/src/modules/pdf-catalog',
    'apps/storefront/src/app/api/pdf-catalog',
  ],
  'landing-pages': [
    'apps/backend/src/modules/landing-page', 'apps/backend/src/api/admin/landing-pages', 'apps/backend/src/api/store/landing-pages',
    'apps/backend/src/admin/routes/landing-pages', 'apps/backend/src/admin/hooks/api/landing-pages.tsx', 'apps/backend/src/admin/translations/landing-pages',
    'apps/storefront/src/modules/landing-page', 'apps/storefront/src/lib/data/landing-pages.ts',
  ],
  'email-templates': [
    'apps/backend/src/modules/email', 'apps/backend/src/modules/email-template', 'apps/backend/src/api/admin/email-templates',
    'apps/backend/src/admin/routes/email-templates', 'apps/backend/src/admin/hooks/api/email-templates.tsx', 'apps/backend/src/admin/translations/email-templates',
    'apps/backend/src/scripts/seed-email-templates.ts',
    // EXPLICITO a proposito. Los subscribers se auto-descubren por analisis de
    // imports desde estas raices, y por eso `order-placed-email.ts` no esta listado:
    // importa `modules/email/admin-recipient`, que SI cuelga de una raiz. Este no
    // importa nada de `modules/email` —solo arma la `data` y llama al servicio de
    // notificaciones—, asi que el extract lo dejaba afuera y el mail de cancelacion
    // no habria llegado a ningun proyecto de cliente. Hacerlo importar algo del
    // modulo para "ganarse" la atribucion seria un import de mentira.
    'apps/backend/src/subscribers/order-cancelled-email.ts',
  ],
  'payment-benefits': [
    'apps/backend/src/modules/payment-benefits', 'apps/backend/src/api/admin/payment-benefits', 'apps/backend/src/api/store/payment-benefits',
    'apps/backend/src/admin/routes/payment-benefits', 'apps/backend/src/admin/hooks/api/payment-benefits.tsx',
    'apps/storefront/src/lib/data/payment-benefits.ts',
  ],
  'recurring-orders': [
    'apps/backend/src/modules/recurring-order', 'apps/backend/src/api/admin/recurring-orders', 'apps/backend/src/api/store/recurring-orders', 'apps/backend/src/api/store/recurring-eligibility', 'apps/backend/src/api/store/subscription-plans', 'apps/backend/src/api/store/subscription-cancellation-reasons', 'apps/backend/src/api/webhooks/mercadopago-subscriptions',
    'apps/backend/src/admin/routes/recurring-orders', 'apps/backend/src/admin/hooks/api/recurring-orders.tsx',
    'apps/storefront/src/lib/data/recurring-orders.ts', 'apps/storefront/src/app/api/store/recurring-orders',
    'apps/storefront/src/modules/products/components/subscribe-action', 'apps/storefront/src/modules/products/templates/product-actions-wrapper/index.tsx',
    'apps/storefront/src/modules/cart/components/make-recurring', 'apps/storefront/src/modules/cart/templates/index.tsx', 'apps/storefront/src/app/[countryCode]/(main)/cart/page.tsx',
    'apps/storefront/src/modules/account/components/subscriptions', 'apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/subscriptions', 'apps/storefront/src/app/[countryCode]/(main)/subscriptions/renew',
    'apps/storefront/src/modules/store/templates/typesense-product-grid.tsx', 'apps/storefront/src/modules/store/templates/typesense-product-card.tsx',
  ],
  'abandoned-cart': [
    'apps/backend/src/modules/abandoned-cart', 'apps/backend/src/api/admin/abandoned-carts',
    'apps/backend/src/admin/routes/abandoned-carts', 'apps/backend/src/admin/hooks/api/abandoned-carts.tsx',
    'apps/backend/src/jobs/scan-abandoned-carts.ts', 'apps/backend/src/workflows/notify-abandoned-cart.ts',
    'apps/backend/src/subscribers/abandoned-cart-recovered.ts',
  ],
  'commerce-dashboard': [
    'apps/backend/src/modules/commerce-dashboard', 'apps/backend/src/api/admin/commerce-dashboard',
    'apps/backend/src/admin/routes/commerce-dashboard', 'apps/backend/src/admin/hooks/api/commerce-dashboard.tsx',
  ],
  'dynamic-groups': [
    'apps/backend/src/modules/dynamic-groups', 'apps/backend/src/api/admin/dynamic-groups',
    'apps/backend/src/admin/routes/dynamic-groups', 'apps/backend/src/admin/hooks/api/dynamic-groups.tsx',
    'apps/backend/src/workflows/recalculate-dynamic-group.ts',
  ],
  b2b: [
    'apps/backend/src/modules/company', 'apps/backend/src/modules/company-credit', 'apps/backend/src/modules/company-credit-payment', 'apps/backend/src/modules/billing-profile',
    'apps/backend/src/api/admin/companies', 'apps/backend/src/api/store/b2b', 'apps/backend/src/api/store/companies', 'apps/backend/src/api/store/billing-profiles',
    'apps/backend/src/admin/routes/companies', 'apps/backend/src/admin/hooks/api/companies.tsx', 'apps/backend/src/admin/hooks/api/company-credit.tsx', 'apps/backend/src/admin/hooks/api/billing-profiles.tsx',
    'apps/storefront/src/modules/b2b', 'apps/storefront/src/app/api/b2b', 'apps/storefront/src/app/[countryCode]/(b2b)',
    'apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/company', 'apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/credit',
    'apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/billing',
    'apps/storefront/src/lib/data/b2b-cart.ts', 'apps/storefront/src/lib/data/company.ts',
    // EXPLÍCITO, y por la misma razón que la línea de `delivery` de más abajo:
    // el descubrimiento ya le daba esta ruta a b2b (importa `./validators`, que
    // es de b2b). Al declarar `modules/arca` en `fiscal-documentation`, los
    // imports de `modules/arca/{lookup,config,types}` pasaron a pesar más y
    // `resolveOwnership()` se la REGALABA a fiscal-documentation, dejando el
    // `route.ts` de un lado y su `validators.ts` + `middlewares.ts` del otro.
    // Consecuencia verificada: un proyecto con `fiscal-documentation` y SIN
    // `b2b` se lleva el route pero no el validators, y el
    // `import type … from './validators'` rompe el typecheck. Las raíces
    // explícitas se chequean antes del descubrimiento, así que esto lo ata.
    'apps/backend/src/api/store/arca/taxpayer-lookup/route.ts',
  ],
  corporate: [
    'apps/backend/src/modules/corporate', 'apps/backend/src/api/admin/corporates', 'apps/backend/src/api/store/corporates', 'apps/backend/src/api/store/corporate-invitations',
    'apps/backend/src/admin/routes/corporates', 'apps/backend/src/admin/hooks/api/corporates.tsx',
    'apps/storefront/src/app/[countryCode]/(main)/corporate',
    'apps/storefront/src/modules/account/components/corporate',
  ],
  // The fiscal document tabs/cards live inside the companies, corporates and
  // store-config route folders, so they stay owned by those host extensions.
  // This extension owns the module, its ARCA client and its admin API.
  'fiscal-documentation': [
    'apps/backend/src/modules/fiscal-documentation', 'apps/backend/src/api/admin/fiscal-documents',
    // `modules/arca` no lo reclamaba NINGUNA extensión y tampoco lo puede
    // descubrir `resolveOwnership()`: el descubrimiento sólo mira
    // `api|jobs|links|scripts|subscribers|workflows|admin`, nunca `modules/`.
    // O sea que el cliente WSAA de AFIP —con `ARCA_CERTIFICATE_BASE64` y
    // `ARCA_PRIVATE_KEY_BASE64`, un X.509 y su clave privada— viajaba a TODO
    // proyecto generado como si fuera core, sin manifest que declarara sus 7
    // env vars y sin instalador que se las pidiera al cliente.
    //
    // El dueño es esta extensión y no otra: sus propios archivos ya importan
    // `../arca/types` (`fiscal-documentation/{types,snapshot}.ts`) y su API
    // admin llama a `lookupTaxpayer()` (`api/admin/fiscal-documents/route.ts`).
    // Los otros consumidores —`b2b` y `corporate`, vía la ruta store— YA
    // dependen de `fiscal-documentation` en `catalog.json`, así que no hay
    // combinación instalable que se quede con la ruta y sin el cliente.
    //
    // OJO: declarar esta raíz habilita el descubrimiento de
    // `api/store/arca/taxpayer-lookup/route.ts`, que importa `modules/arca`.
    // Es lo buscado. El `storeArcaMiddlewares` de esa carpeta lo sigue
    // cableando `b2b` en `extension-integrations.js`, que es el consumidor
    // real del lookup de CUIT en el checkout.
    'apps/backend/src/modules/arca',
  ],
  delivery: [
    'apps/backend/src/modules/delivery', 'apps/backend/src/api/admin/delivery', 'apps/backend/src/api/store/delivery',
    'apps/backend/src/admin/routes/delivery', 'apps/backend/src/admin/hooks/api/delivery.tsx', 'apps/backend/src/admin/hooks/api/delivery-analytics.tsx', 'apps/backend/src/admin/hooks/api/delivery-routes.tsx',
    'apps/backend/src/workflows/optimize-route.ts', 'apps/backend/src/workflows/transition-delivery-execution.ts',
    // EXPLÍCITO y no por descubrimiento: `create-delivery-execution.ts` importa
    // `isCorreoShippingMethod`/`resolveCorreoDeliveryType` de
    // `./correo-generate-tickets`, que es de correo-argentino. Como
    // correo-argentino depende de delivery y delivery no depende de
    // correo-argentino, el `compatible` de `resolveOwnership` elige
    // correo-argentino y le REGALA este workflow (y en cascada
    // `create-delivery-execution.test.ts`, `subscribers/delivery-execution-create.ts`
    // y `subscribers/own-fleet-order.ts`, que lo importan). Verificado componiendo
    // un proyecto con `delivery` y sin `correo-argentino`: sin esta línea el
    // proyecto queda SIN el workflow ni el subscriber que lo dispara, o sea sin
    // el alta de DeliveryExecution. Las raíces explícitas se chequean antes del
    // descubrimiento, así que declararla acá lo desactiva para este archivo.
    'apps/backend/src/workflows/create-delivery-execution.ts',
    'apps/backend/src/scripts/seed-coverage.ts',
    'apps/storefront/src/modules/driver', 'apps/storefront/src/app/api/driver', 'apps/storefront/src/app/driver',
  ],
  andreani: [
    'apps/backend/src/modules/andreani-data', 'apps/backend/src/modules/andreani-fulfillment', 'apps/backend/src/api/admin/andreani', 'apps/backend/src/api/store/andreani',
    'apps/backend/src/admin/routes/andreani', 'apps/backend/src/admin/hooks/api/andreani.tsx', 'apps/backend/src/admin/translations/andreani',
    'apps/storefront/src/app/api/store/andreani-branches',
  ],
  // Correo Argentino. Depende de `delivery` (extiende su union de
  // `provider_type`, registra un adapter en `providers/registry.ts` y agrega una
  // rama a `classify()` de `create-delivery-execution.ts`).
  //
  // Deliberadamente FUERA de este bloque, porque viven DENTRO de
  // `apps/backend/src/modules/delivery` y por lo tanto ya los posee la extensión
  // `delivery` (mismo criterio que Andreani con `providers/andreani` y
  // `normalizers/andreani.ts`):
  //   - `modules/delivery/providers/correo-argentino/`
  //   - `modules/delivery/normalizers/correo-argentino.ts`
  //   - `modules/delivery/types.ts` (union + transiciones + POD)
  //   - `workflows/create-delivery-execution.ts` (la rama de `classify()`)
  // Declararlos acá NO cambiaría nada: `extract` copia
  // `apps/backend/src/modules/delivery` con `cpSync` recursivo, así que el
  // payload de `delivery` los incluye igual. Sólo agregaría dos dueños para el
  // mismo byte.
  //
  // OJO: los seeds NO se auto-descubren (no importan nada poseído: sólo
  // `@medusajs/*`), y `admin/lib/correo.ts` tampoco (no importa NADA). Sin las
  // líneas explícitas, un proyecto generado CON la extensión se queda sin ellos
  // — y en el caso de `admin/lib/correo.ts` ni compone, porque
  // `assertRelativeImportsResolve` corre sobre `apps/backend/src/admin` y el
  // widget y los hooks lo importan.
  'correo-argentino': [
    'apps/backend/src/modules/correo-argentino-fulfillment',
    'apps/backend/src/api/admin/correo-argentino', 'apps/backend/src/api/store/correo-argentino',
    'apps/backend/src/admin/routes/correo-argentino', 'apps/backend/src/admin/hooks/api/correo-argentino.tsx',
    'apps/backend/src/admin/translations/correo-argentino',
    'apps/backend/src/admin/widgets/order-correo-widget.tsx',
    'apps/backend/src/admin/lib/correo.ts',
    'apps/backend/src/workflows/correo-generate-tickets.ts',
    'apps/backend/src/scripts/seed-correo-domicilio.ts', 'apps/backend/src/scripts/seed-correo-sucursal.ts',
    // El job va EXPLÍCITO aunque el descubrimiento lo adoptaría igual: sin la
    // raíz, `sync-correo-tracking-status.test.ts` se visita antes de que el `.ts`
    // tenga dueño, ve sólo los imports a `modules/delivery/*` y se lo queda
    // DELIVERY — un proyecto con delivery y sin correo se llevaba el test con
    // `import './sync-correo-tracking-status'` roto. Con la raíz declarada el par
    // queda junto.
    'apps/backend/src/jobs/sync-correo-tracking-status.ts',
    'apps/backend/src/subscribers/correo-order.ts',
    'apps/backend/src/subscribers/correo-ticket-tracking-whatsapp.ts',
  ],
  erp: [
    'apps/backend/src/modules/erp', 'apps/backend/src/api/admin/erp', 'apps/backend/src/admin/routes/erp', 'apps/backend/src/admin/hooks/api/erp.tsx',
    'apps/backend/src/admin/translations/erp',
    // El store de tintometría entero, como raíz. `discoverBackendIntegrations`
    // sólo adopta un archivo si importa algo ya poseído por la extensión, y de
    // este directorio eso sólo vale para los 3 `route.ts` (importan modules/erp):
    // `context.ts`, `middlewares.ts`, `rate-limit.ts` y `validators.ts` importan
    // únicamente paquetes externos, así que quedaban afuera. El resultado eran 3
    // rutas que importan `../context` y `../validators` inexistentes, más un
    // `extension-middlewares.ts` que importa `./store/tinting/middlewares`
    // (ver `middlewareDefinitions.erp`): el backend del proyecto no compila.
    'apps/backend/src/api/store/tinting',
    // Rutas store del comprobante. Van listadas a mano por el mismo motivo que
    // tintometría: `discoverBackendIntegrations` sólo adopta un archivo si
    // importa algo ya poseído por la extensión, y `middlewares.ts` de este
    // directorio importa únicamente `@medusajs/framework/http` — quedaría afuera
    // y `extension-middlewares.ts` importaría un módulo inexistente.
    'apps/backend/src/api/store/erp',
  ],
  // OJO: los paths de apps/storefront NO se auto-descubren — hay que listarlos a
  // mano. Deliberadamente FUERA de este bloque, porque tiene que sobrevivir en
  // los proyectos que NO seleccionan la extensión:
  // `apps/storefront/src/lib/whatsapp-slot.tsx`, que lo GENERA el composer
  // (renderWhatsappFloatingSlot) y es lo que importa el layout del storefront.
  whatsapp: [
    'apps/backend/src/modules/kapso-whatsapp', 'apps/backend/src/api/admin/kapso', 'apps/backend/src/api/store/whatsapp', 'apps/backend/src/admin/routes/whatsapp', 'apps/backend/src/admin/hooks/api/kapso.tsx',
    'apps/backend/src/admin/translations/whatsapp',
    // Hooks de la sección WhatsApp → Asesor. Van con esta extensión y no con
    // ai-assistant porque la PÁGINA vive en `admin/routes/whatsapp` (que es de
    // acá): si el hook fuera de otra extensión, un proyecto con whatsapp y sin
    // ai-assistant tendría la página importando un archivo inexistente.
    // Los hooks no importan nada de otra extensión —sólo el `sdk`—, así que no
    // introducen dependencia cruzada; los endpoints se resuelven por HTTP y la
    // página tolera que no existan.
    'apps/backend/src/admin/hooks/api/whatsapp-advisor.tsx',
    'apps/backend/src/admin/hooks/api/whatsapp-conversations.tsx',
    'apps/storefront/src/lib/data/whatsapp.ts', 'apps/storefront/src/modules/whatsapp',
  ],
  // El webhook de Kapso va como DIRECTORIO (igual que `webhooks/sendgrid-gift-cards`
  // en gift-cards) y no por descubrimiento: `route.ts` se auto-adopta porque importa
  // el módulo, pero `middlewares.ts` sólo importa `@medusajs/framework/http`, así que
  // ningún dueño lo reclamaba y quedaba FUERA del payload — el proyecto generado
  // instalaría un `integrations.middlewares` que apunta a un archivo inexistente.
  'ai-assistant': [
    'apps/backend/src/modules/ai-assistant', 'apps/backend/src/api/admin/ai-assistant', 'apps/backend/src/admin/routes/ai-assistant',
    'apps/backend/src/api/webhooks/kapso',
    // Rutas de API del bot. Las superficies de ADMIN (la página del Asesor y sus
    // hooks) NO van acá: viven dentro de la sección WhatsApp del backoffice y las
    // posee la extensión `whatsapp`, que es la dueña de `admin/routes/whatsapp`.
    //
    // `api/admin/whatsapp-advisor` tampoco: lo adopta typesense, porque importa el
    // motor de clasificación y lo que configura es el INDEXADO.
    'apps/backend/src/api/admin/whatsapp-analytics',
    'apps/backend/src/api/admin/whatsapp-conversations',
    'apps/backend/src/scripts/seed-ai-agents.ts', 'apps/backend/src/scripts/seed-redactor.ts', 'apps/backend/src/scripts/seed-content-team.ts', 'apps/backend/src/scripts/seed-campaign-team.ts',
  ],
  catalogador: [
    'apps/backend/src/modules/catalogador', 'apps/backend/src/api/admin/catalogador',
    'apps/backend/src/admin/routes/catalogador', 'apps/backend/src/admin/hooks/api/catalogador.tsx',
    'apps/backend/src/admin/translations/catalogador',
    'apps/backend/src/workflows/catalogador', 'apps/backend/src/jobs/catalogador-process.ts',
  ],
  // Ownership de SEO & GEO. Crece por hito: los siguientes agregan
  // admin/routes/seo-geo, admin/hooks/api/seo-geo.tsx, translations y los
  // componentes de JSON-LD del storefront.
  'seo-geo': [
    'apps/backend/src/modules/seo-geo',
    'apps/backend/src/api/admin/seo-geo',
    // La única ruta pública: el Open Graph que lee el `generateMetadata()` del
    // storefront. El resto de la config no sale del admin.
    'apps/backend/src/api/store/seo-geo',
    'apps/backend/src/jobs/seo-audit-run.ts',
    'apps/backend/src/jobs/seo-embed-catalog.ts',
    'apps/backend/src/jobs/seo-audit-schedule.ts',
    'apps/backend/src/admin/routes/seo-geo',
    'apps/backend/src/admin/hooks/api/seo-geo.tsx',
  ],
  // Motor de recomendaciones (headless). Los archivos de integración del backend
  // (jobs, subscribers, workflows, scripts) los auto-descubre extract-components
  // por análisis de imports; acá sólo van las raíces.
  'recommendation-engine': [
    'apps/backend/src/modules/recommendations',
    'apps/backend/src/api/admin/recommendations',
    'apps/backend/src/api/store/recommendations',
    'apps/backend/src/admin/routes/recomendaciones',
    'apps/backend/src/admin/hooks/api/recommendations.tsx',
  ],
  // Widgets de storefront del motor. OJO: los paths de apps/storefront NO se
  // auto-descubren — hay que listarlos a mano o el proyecto generado se queda sin
  // ellos mientras los validadores siguen en verde.
  //
  // Deliberadamente FUERA de este bloque, porque tiene que sobrevivir en los
  // proyectos que NO seleccionan la extensión:
  // `apps/storefront/src/lib/recommendations-slot.tsx`, que lo GENERA el composer
  // (renderRecommendationSlots) y es lo que importan los archivos core.
  'recommendation-widgets': [
    'apps/storefront/src/modules/recommendations',
    'apps/storefront/src/lib/data/recommendations.ts',
    'apps/storefront/src/lib/stores/recently-viewed.store.ts',
    'apps/storefront/src/app/api/store/recommendations',
  ],
  // This feature belongs only to the boilerplate used for demos. It is always
  // removed from generated customer projects and is intentionally not catalogued.
  /**
   * El registro de tiendas. `required: true` en el catálogo: es la base sobre la
   * que se apoya todo el scoping por tienda, y varias extensiones resuelven
   * `demo_store` por string literal contando con que exista.
   *
   * Antes esto era el componente `demo-creator`, que el composer BORRABA de todo
   * proyecto de cliente. Por eso ninguna extensión podía importarlo y por eso el
   * admin del cliente no tenía multitienda. Ahora se instala.
   */
  multistore: [
    'apps/backend/src/api/admin/catalog-imports',
    'apps/backend/src/admin/routes/catalog-imports',
    'apps/backend/src/admin/widgets/catalog-commercial.tsx',
    'apps/backend/src/jobs/process-catalog-imports.ts',
    'apps/backend/src/scripts/test-catalog-import-fixture.ts',
    'apps/backend/src/modules/store-importer',
    'apps/backend/src/jobs/process-demo-store-imports.ts',
    'apps/backend/src/scripts/backfill-woocommerce-variant-prices.ts',
    'apps/backend/src/api/store/carts/[id]/checkout',
    'apps/backend/src/api/admin/orders/[id]/checkout',
    'apps/backend/src/admin/widgets/order-checkout-recipients.tsx',
    'apps/backend/src/workflows/hooks/site-checkout-validation.ts',
    'apps/backend/src/jobs/cleanup-checkout-recipients.ts',
    // Carga del footer de una tienda desde un JSON. Genérico; el contenido de
    // cada cliente vive en SU repo.
    'apps/backend/src/scripts/seed-site-footer.ts',
    'apps/backend/src/modules/demo-store', 'apps/backend/src/api/admin/sites',
    'apps/backend/src/api/admin/site-templates',
    // `api/store/sites` es la ruta viva; `api/store/demo-stores` sobrevive un
    // release como re-export. Las dos importan de `modules/demo-store`.
    'apps/backend/src/api/store/sites', 'apps/backend/src/api/store/demo-stores',
    'apps/backend/src/admin/routes/sites',
    'apps/backend/src/admin/hooks/api/demo-stores.tsx',
    'apps/backend/src/admin/translations/demo-stores',
    'apps/backend/src/links/demo-store-region.ts',
    'apps/backend/src/links/demo-store-sales-channel.ts',
    'apps/backend/src/links/demo-store-stock-location.ts',
    'apps/storefront/src/app/[countryCode]/(main)/demo',
  ],

};
