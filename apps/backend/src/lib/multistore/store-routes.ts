import type { RouteScopeState } from './scoped-routes';

/**
 * Qué rutas de `/store/*` respetan la tienda del visitante, y cuáles todavía no.
 *
 * Es el gemelo de `ADMIN_ROUTE_SCOPE`, y existe por la misma razón: sin registro, "el
 * storefront es multitienda" es una afirmación que nadie puede verificar. Pero el
 * RIESGO de los dos lados no es el mismo, y por eso este archivo se escribió después.
 *
 * Una fuga en el admin la ve un OPERADOR: conoce el sistema, sabe que hay más de una
 * tienda y puede reportarla. Una fuga acá la ve un CLIENTE, que no sabe que existen
 * otras tiendas y no tiene con qué comparar. En el mejor caso ve el banner de otra
 * marca y se va. En el peor no ve nada raro y compra igual.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL EJE ACÁ NO ES `x-site-id`
 *
 * `attachSiteHint` está registrado SÓLO para `/admin/*` (`api/multistore-middlewares.ts`),
 * y a propósito: un header de tienda en el store sería una vía de spoofing sin ningún
 * consumidor. El eje del storefront es la PUBLISHABLE KEY, que Medusa traduce a
 * `publishable_key_context.sales_channel_ids` antes de que el handler corra.
 *
 * Lo que hace `siteFromPublishableKey` (`publishable-key.ts`), que es a este registro
 * lo que `siteFromRequest` es al del admin.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL PATRÓN QUE DOMINA LO PENDIENTE: `?sales_channel_id=`
 *
 * Nueve rutas de contenido (blog, banners, marcas, videos, looks, sucursales, catálogo
 * PDF, beneficios de pago, recomendaciones) toman su canal de `req.query` o del body.
 * O sea: **el cliente declara en qué tienda está**.
 *
 * Eso tiene dos modos de falla, y son distintos:
 *
 *  1. Con el canal de OTRA tienda, se ve el contenido de esa tienda. Es la fuga
 *     obvia, y sola no alcanzaría para dejarlas todas en `pending`.
 *  2. SIN el parámetro —el caso por default de cualquier caller que no lo implemente—
 *     el predicado es `if (!salesChannelId) return true`: **no filtra nada**. No es
 *     que se vea de más: se ve TODO, de todas las tiendas, en silencio.
 *
 * No se cierran en esta pasada y el motivo es honesto: sellar el canal desde la key
 * cambia lo que hoy ve la tienda PRINCIPAL, que sin parámetro ve el contenido de todas
 * las demos y hoy se apoya en eso. Ese es un cambio de producto —hay que decidir si la
 * principal ve las demos o no— y forzarlo desde acá sería tomar por el equipo una
 * decisión que ni siquiera es técnica. Quedan declaradas, con el modo de falla escrito.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA REGLA QUE NO SE ROMPE: NO SE INVENTA EL EJE
 *
 * Si una ruta no puede saber su tienda, se dice y queda `pending`. Ya pasó dos veces
 * en esta rama que deducirlo de datos adyacentes —las órdenes del cliente, el canal de
 * un producto— acierta a veces y es SILENCIOSAMENTE falso el resto, que es peor que no
 * resolver: un `pending` se lee en este archivo, un eje inventado no se lee en ningún
 * lado.
 *
 * Lo vigila `src/api/store-site-scope.test.ts`.
 */

/** Clave: la ruta relativa a `src/api`, sin `route.ts`. Ej: `store/banners/[id]`. */
export const STORE_ROUTE_SCOPE: Record<string, RouteScopeState> = {
  'store/demo-stores': { state: 'not-applicable', reason: 'alias compatible del indice publico de tiendas' },
  'store/sites': { state: 'not-applicable', reason: 'indice publico de tiendas publicadas; proyeccion limitada a nombre, slug, logo, plantilla y forma canonica' },
  'store/orders/by-cart': { state: 'not-applicable', reason: 'consulta por capability cart_id para retorno de pago invitado; devuelve únicamente order_id y no lista órdenes ni datos personales' },
  'store/b2b/carts/[id]/presentations': { state: 'not-applicable', reason: 'carrito del cliente autenticado; valida customer_id, canal autorizado por publishable key y pertenencia del SKU a ese canal' },
  'store/carts/[id]/checkout': { state: 'not-applicable', reason: 'cart capability plus authenticated customer and publishable channel checked by assertCartAccess; the site is resolved from the authorized cart' },

  // ── health ──────────────────────────────────────────────────────
  'store': { state: 'not-applicable', reason: 'healthcheck: devuelve un timestamp y no toca ninguna tabla' },

  // ── andreani / correo argentino ─────────────────────────────────
  // Proxies en vivo al carrier. El dato es del carrier y su cuenta la resuelve el
  // provider, no la ruta.
  'store/andreani/branches': { state: 'not-applicable', reason: 'proxy en vivo a Andreani: sucursales del carrier, no filas nuestras' },
  'store/andreani/hop-points': { state: 'not-applicable', reason: 'proxy en vivo a Andreani: puntos de retiro del carrier, no filas nuestras' },
  'store/andreani/rates': { state: 'not-applicable', reason: 'proxy en vivo a Andreani: cotizacion del carrier, no filas nuestras' },
  'store/andreani/tracking/[tracking_number]': { state: 'not-applicable', reason: 'proxy en vivo al tracking de Andreani; el eje es el numero de seguimiento' },
  'store/correo-argentino/agencies': { state: 'not-applicable', reason: 'proxy en vivo a Correo Argentino: sucursales del carrier' },
  'store/correo-argentino/rates': { state: 'not-applicable', reason: 'proxy en vivo a Correo Argentino: cotizacion del carrier' },
  'store/correo-argentino/tracking/[tracking_number]': { state: 'not-applicable', reason: 'proxy en vivo al tracking de Correo Argentino; el eje es el numero de seguimiento' },

  // ── arca ────────────────────────────────────────────────────────
  'store/arca/taxpayer-lookup': { state: 'scoped' },

  // ── auth ────────────────────────────────────────────────────────
  'store/auth/google/link': { state: 'not-applicable', reason: 'vincula una auth identity a un customer por match exacto de email verificado; el eje es la identidad, no la tienda' },

  // ── b2b ─────────────────────────────────────────────────────────
  // Las cuatro se apoyan en la empresa del cliente autenticado, que YA lleva su
  // `sales_channel_id` mayorista, y los precios salen del core con el customer group
  // de esa empresa. El eje es la membresia, que es mas estricto que la tienda.
  'store/b2b/import-order': { state: 'not-applicable', reason: 'resuelve lineas SKU+cantidad contra el core con la membresia del cliente; el eje es la empresa' },
  'store/b2b/prices': { state: 'not-applicable', reason: 'precio mayorista por customer_group de la empresa del cliente; el eje es la empresa' },
  'store/b2b/quick-order': { state: 'not-applicable', reason: 'resuelve lineas SKU/variante contra el core con la membresia del cliente; el eje es la empresa' },
  'store/b2b/reorder': { state: 'not-applicable', reason: 'repite una orden previa de la empresa del cliente; el eje es la empresa' },

  // ── banners ─────────────────────────────────────────────────────
  // El canal sale de `req.query.sales_channel_id` (route.ts:47) y sin el
  // `matchRules` devuelve todo. Ver la nota del encabezado.
  'store/banners': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: el canal sale de `req.query.sales_channel_id` y sin el ' +
      '`matchRules` deja pasar todos los banners. Sellarlo desde la publishable key cambia ' +
      'lo que ve hoy la tienda principal, que sin parametro ve tambien los de las demos.',
  },
  // Los dos contadores son la clase de dano que NO se repara: `banner_analytics` cuelga
  // del `banner_id` y no tiene columna propia, asi que una impresion sumada desde otra
  // tienda queda indistinguible para siempre. Y el `id` es publico: viaja en el JSON de
  // `GET /store/banners`.
  'store/banners/[id]/click': {
    state: 'pending',
    reason:
      'BLOQUEADA POR MODELO: `banner_analytics` no tiene eje propio —cuelga de `banner_id`— ' +
      'y el banner puede ser global (`rules.sales_channel_ids` vacio), donde el contador es ' +
      'uno solo para todas las tiendas. Separarlo pide una columna nueva y decidir que se ' +
      'hace con lo ya acumulado, que es indistinguible por tienda.',
  },
  'store/banners/[id]/impression': {
    state: 'pending',
    reason:
      'BLOQUEADA POR MODELO: misma razon que `click` —`banner_analytics` sin eje propio y ' +
      'contadores globales compartidos—.',
  },

  // ── barcode-scanner ─────────────────────────────────────────────
  'store/barcode-scanner/lookup': { state: 'scoped' },

  // ── billing-profiles ────────────────────────────────────────────
  // El eje es el CLIENTE autenticado (o el carrito, que ya trae su canal del core).
  'store/billing-profiles': { state: 'not-applicable', reason: 'perfiles fiscales del cliente autenticado; el eje es el customer_id' },
  'store/customers/me/claimable-orders': { state: 'scoped' },
  'store/billing-profiles/[id]': { state: 'not-applicable', reason: 'perfil fiscal propio del cliente autenticado; el eje es el customer_id' },
  'store/billing-profiles/[id]/default': { state: 'not-applicable', reason: 'marca por defecto un perfil propio del cliente autenticado; el eje es el customer_id' },
  'store/carts/[id]/billing-profile': { state: 'not-applicable', reason: 'escribe en el metadata de un cart del core, que ya trae su sales_channel de la publishable key' },

  // ── blog ────────────────────────────────────────────────────────
  'store/blog-categories': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: el canal sale de `req.query.sales_channel_id`. Ademas ' +
      '`blog_category` tiene `site_id` propio y la ruta no lo mira: hoy deriva la ' +
      'visibilidad de los POSTS del canal, que es otra cosa.',
  },
  'store/blog-posts': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: el canal sale de `req.query.sales_channel_id` y sin el ' +
      '`isPostInSalesChannel` devuelve `true` para todo (helpers.ts:19).',
  },
  'store/blog-posts/[slug]': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: mismo eje autodeclarado que el listado, y ademas `?preview=1` ' +
      'saltea el chequeo de canal a proposito para la vista previa del admin — cerrarlo pide ' +
      'decidir como se autentica esa preview.',
  },
  'store/blog-settings': { state: 'scoped' },

  // ── brands ──────────────────────────────────────────────────────
  'store/brands': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: el canal sale de `req.query.sales_channel_id` (route.ts:9) y ' +
      'sin el `inScope` devuelve `true` para todas las marcas.',
  },
  'store/brands/[brand_id]': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: el detalle NO mira canal en absoluto, ni siquiera el del query ' +
      'que si mira el listado. Cerrarlo solo tiene sentido junto con el listado: si el listado ' +
      'sigue sin eje, el id de una marca ajena esta a un fetch de distancia igual.',
  },
  'store/brands/[brand_id]/images': { state: 'not-applicable', reason: 'imagenes de UNA marca por brand_id; la pertenencia la decide su marca, no la fila' },

  // ── checkout-links ──────────────────────────────────────────────
  'store/checkout-links/[token]': { state: 'not-applicable', reason: 'el eje es el TOKEN: un link prearmado se resuelve por su secreto y ya trae su propio sales_channel_id' },
  'store/checkout-links/[token]/consume': { state: 'not-applicable', reason: 'el eje es el TOKEN: marca consumido el link que ese secreto identifica' },

  // comments — routes moved to @minimalart/mercatto-plugin-comments.

  // ── companies (B2B) ─────────────────────────────────────────────
  // El eje de todas es la EMPRESA del cliente autenticado o el token de invitacion, y
  // los dos son mas estrictos que la tienda.
  'store/companies/invitations/accept': { state: 'not-applicable', reason: 'el eje es el TOKEN de invitacion, que ya identifica la empresa' },
  'store/companies/me': { state: 'not-applicable', reason: 'la empresa del cliente autenticado; el eje es la membresia' },
  'store/companies/me/credit': { state: 'not-applicable', reason: 'cuenta corriente de la empresa del cliente autenticado; el eje es la membresia' },
  'store/companies/me/credit/transactions': { state: 'not-applicable', reason: 'movimientos de la empresa del cliente autenticado; el eje es la membresia' },
  'store/companies/me/invitations': { state: 'not-applicable', reason: 'invitaciones de la empresa del cliente autenticado; el eje es la membresia' },
  'store/companies/me/logo': { state: 'not-applicable', reason: 'logo de la empresa del cliente autenticado; el eje es la membresia' },
  'store/companies/me/members': { state: 'not-applicable', reason: 'miembros de la empresa del cliente autenticado; el eje es la membresia' },
  'store/companies/members/[id]': { state: 'not-applicable', reason: 'miembro de la empresa del cliente autenticado; el eje es la membresia' },
  'store/company-invitations/[token]': { state: 'not-applicable', reason: 'el eje es el TOKEN de invitacion, que ya identifica la empresa' },
  // La UNICA de company que si tiene eje y no lo usa.
  'store/companies/register': {
    state: 'pending',
    reason:
      'BLOQUEADA POR DATO: nace con `getB2bSalesChannelId()` —el canal B2B de ENTORNO— asi que ' +
      'una empresa registrada desde una tienda secundaria aparece en el listado de la principal. ' +
      'El eje correcto seria el `b2b_sales_channel_id` de la tienda de la key, pero `SiteRef` ' +
      'colapsa los dos canales en `channel_ids` y no distingue cual es el mayorista: resolverlo ' +
      'pide exponerlo en el seam y decidir el fallback de una tienda sin canal B2B propio.',
  },

  // ── contact ─────────────────────────────────────────────────────
  'store/contact-submissions': { state: 'scoped' },

  // ── corporates ──────────────────────────────────────────────────
  'store/corporate-invitations/[token]': { state: 'not-applicable', reason: 'el eje es el TOKEN de invitacion, que ya identifica la cuenta corporativa' },
  'store/corporates/invitations': { state: 'not-applicable', reason: 'invitaciones de la cuenta corporativa del cliente autenticado; el eje es la membresia' },
  'store/corporates/invitations/accept': { state: 'not-applicable', reason: 'el eje es el TOKEN de invitacion, que ya identifica la cuenta corporativa' },
  'store/corporates/me': { state: 'not-applicable', reason: 'la cuenta corporativa del cliente autenticado; el eje es la membresia' },
  'store/corporates/me/members': { state: 'not-applicable', reason: 'miembros de la cuenta corporativa del cliente autenticado; el eje es la membresia' },
  'store/corporates/me/validate-cart': { state: 'not-applicable', reason: 'valida el carrito contra las reglas de la cuenta corporativa del cliente; el eje es la membresia' },
  'store/corporates/members/[id]': { state: 'not-applicable', reason: 'miembro de la cuenta corporativa del cliente autenticado; el eje es la membresia' },
  'store/corporates/register': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: `corporate` tiene `site_id` (CORPORATE_SITE_SCOPE) y ' +
      '`createCorporateWorkflow` no lo sella, asi que toda cuenta nace global y la ven todas ' +
      'las tiendas. Sellarlo es una linea, pero cambia quien administra las cuentas ya creadas ' +
      '—hoy cualquier tienda— y eso lo decide quien opera el B2B, no esta auditoria.',
  },

  // ── customers ───────────────────────────────────────────────────
  'store/customers/me/avatar': { state: 'not-applicable', reason: 'avatar del cliente autenticado; el eje es el customer_id' },
  // wishlist — routes moved to @minimalart/mercatto-plugin-wishlist.

  // ── delivery ────────────────────────────────────────────────────
  'store/delivery/driver/executions/[id]/action': { state: 'not-applicable', reason: 'accion del repartidor sobre una ejecucion asignada a el; el eje es el driver autenticado' },
  'store/delivery/driver/me/stops': { state: 'not-applicable', reason: 'paradas del repartidor autenticado; el eje es el driver' },
  'store/delivery/driver/uploads': { state: 'not-applicable', reason: 'evidencia que sube el repartidor autenticado; el eje es el driver' },
  'store/delivery/tracking/[tracking_number]': { state: 'not-applicable', reason: 'timeline de UN envio por su numero de seguimiento; el eje es el tracking' },

  // ── demo-stores / sites (config publica por tienda) ─────────────
  // Estas cuatro son la EXCEPCION que confirma el eje: la tienda no se filtra, se
  // resuelve — es el parametro de la ruta.
  'store/demo-stores/[slug]/config': { state: 'not-applicable', reason: 'la tienda ES el parametro de la ruta: devuelve la config publica de ESE slug' },
  'store/demo-stores/main/config': { state: 'not-applicable', reason: 'devuelve la config publica de la tienda `is_main` por definicion de la ruta' },
  'store/sites/[slug]/config': { state: 'not-applicable', reason: 'la tienda ES el parametro de la ruta: devuelve la config publica de ESE slug' },
  'store/sites/main/config': { state: 'not-applicable', reason: 'devuelve la config publica de la tienda `is_main` por definicion de la ruta' },

  // ── gift-card-experience ────────────────────────────────────────
  'store/gift-card-experience/designs': { state: 'scoped' },
  'store/gift-card-experience/landing/[token]': { state: 'not-applicable', reason: 'el eje es el TOKEN de la gift card, que identifica una entrega concreta' },
  'store/gift-card-experience/landing/[token]/claim': { state: 'not-applicable', reason: 'el eje es el TOKEN de la gift card, que identifica una entrega concreta' },
  'store/gift-card-experience/wallet': { state: 'not-applicable', reason: 'gift cards del cliente autenticado; el eje es el customer_id' },

  // ── landing-pages ───────────────────────────────────────────────
  'store/landing-pages': { state: 'scoped' },
  'store/landing-pages/[slug]': { state: 'scoped' },

  // ── loyalty / points ────────────────────────────────────────────
  'store/loyalty/grants': { state: 'not-applicable', reason: 'beneficios obtenidos por el cliente autenticado; el eje es el customer_id y los grants son suyos vengan de la tienda que vengan' },
  'store/loyalty/rewards': { state: 'scoped' },
  'store/loyalty/tier': { state: 'scoped' },
  'store/loyalty/redeem': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: `sales_channel_id` viaja en el BODY (route.ts:5) y el workflow ' +
      'canjea contra el programa de ese canal, asi que declarando otro se canjea en el programa ' +
      'de otra tienda. Sellarlo desde la key es correcto pero corta canjes en curso de cualquier ' +
      'storefront que hoy mande un canal distinto, y eso es plata del cliente en el medio.',
  },
  'store/points': { state: 'not-applicable', reason: 'el SALDO es uno por cliente en toda la instancia, decidido asi en loyalty/site-scope.ts: partirlo dividiria puntos que ya son del cliente' },
  'store/points/redeem': { state: 'not-applicable', reason: 'debita del saldo unico del cliente autenticado; misma decision que el balance' },

  // ── mercadopago ─────────────────────────────────────────────────
  'store/mercadopago/installments': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: `sales_channel_id` viene por query y con el se resuelve la CUENTA ' +
      'de cobro (`provider.getAccount`), asi que declarando el canal de otra tienda se leen las ' +
      'cuotas y tasas de SU acuerdo con MercadoPago. Cerrarlo pide decidir que pasa con el ' +
      'checkout que hoy manda el canal explicito.',
  },
  'store/mercadopago/payment': { state: 'not-applicable', reason: 'opera sobre un payment del core, que ya trae su cuenta resuelta por el provider' },
  'store/mercadopago/payment-methods': { state: 'not-applicable', reason: 'tarjetas guardadas del account holder del cliente autenticado; el eje es el customer_id' },

  // ── minimum-purchase ────────────────────────────────────────────
  'store/minimum-purchase': { state: 'scoped' },

  // ── newsletter ──────────────────────────────────────────────────
  // `siteFromPublishableKey` con el `allowMainFallback: false` del helper. Acá el
  // eje no decide sólo qué se ve: decide contra qué CUENTA DE BREVO se sincroniza
  // el contacto, así que una key sin tienda cae en `skipped` y no en la lista de
  // la tienda principal.
  'store/newsletter-subscriptions': { state: 'scoped' },

  // ── payment-benefits ────────────────────────────────────────────
  'store/payment-benefits': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: `sales_channel_id` viene por query (route.ts:36) y sin el ' +
      '`listActiveBenefits` devuelve los beneficios de todas las tiendas. Mismo caso que el ' +
      'resto del contenido autodeclarado.',
  },
  'store/payment-methods': { state: 'scoped' },

  // pdf-catalog — routes moved to @minimalart/mercatto-plugin-pdf-catalog.

  // ── recommendations ─────────────────────────────────────────────
  'store/recommendations': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: `sales_channel_id` viaja en el BODY y su docblock todavia dice ' +
      '"en este repo no hay resolucion publishable-key -> canal", que ya no es cierto. Ademas de ' +
      'servir las estrategias de otra tienda, `recordServed` PERSISTE ese canal declarado en ' +
      '`recommendation_served`: la metrica de esa tienda queda contaminada sin forma de separarla.',
  },
  'store/recommendations/events': { state: 'not-applicable', reason: 'los eventos cuelgan del `request_id` de un `recommendation_served`, que ya tiene su canal; el eje lo hereda del request servido' },

  // ── recurring-orders ────────────────────────────────────────────
  // Cliente + publishable key: pertenecer al customer no autoriza a cruzar de
  // marca cuando una misma identidad compra en más de una tienda.
  'store/recurring-orders': { state: 'scoped' },
  'store/recurring-orders/[id]': { state: 'scoped' },
  'store/recurring-orders/[id]/cancel': { state: 'scoped' },
  'store/recurring-orders/[id]/cycles/[cycle_id]/regenerate': { state: 'scoped' },
  'store/recurring-orders/[id]/pause': { state: 'scoped' },
  'store/recurring-orders/[id]/payment-method': { state: 'scoped' },
  'store/recurring-orders/[id]/resume': { state: 'scoped' },
  'store/recurring-orders/[id]/retention': { state: 'scoped' },
  'store/recurring-orders/[id]/skip-next': { state: 'scoped' },
  'store/recurring-eligibility': { state: 'scoped' },
  'store/subscription-plans': { state: 'scoped' },
  'store/subscription-plans/preview': { state: 'scoped' },
  'store/subscription-cancellation-reasons': { state: 'scoped' },

  // ── shop-by-look ────────────────────────────────────────────────
  'store/shop-by-look': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: el toggle ya sale de la tienda, pero `scopeMatches` compara ' +
      'contra el `sales_channel_id` del query (route.ts:70) y sin el deja pasar todos los looks. ' +
      'Mismo cierre que el resto del contenido autodeclarado.',
  },

  // ── seo-geo ─────────────────────────────────────────────────────
  // Resuelve la tienda con `siteIdFromPublishableKey` y lee la fila de esa tienda
  // (o hereda la global si no tiene). Nace `scoped`: es la card social, y servir la
  // de la tienda principal en el link de otra es el modo de falla completo.
  'store/seo-geo/open-graph': { state: 'scoped' },

  // ── store-config ────────────────────────────────────────────────
  'store/store-config': { state: 'scoped' },
  // Los legales se leen con la tienda de la publishable key y caen a la fila global
  // si esa tienda no tiene texto propio. Nace `scoped`: publicar los términos de otra
  // tienda en el sitio de un cliente es un error de contenido CONTRACTUAL.
  'store/store-config/legal-pages': { state: 'scoped' },
  'store/store-config/site-gate': { state: 'not-applicable', reason: 'el `scope` (`site:<slug>`) ES el eje y viaja en el HMAC del token: se usa para RESOLVER la clave, no para filtrar, asi que declarar otro scope no revela nada de esa tienda' },

  // ── store-locations ─────────────────────────────────────────────
  'store/store-locations': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: el canal sale de `req.query.sales_channel_id` y sin el ' +
      '`isLocationInSalesChannel` devuelve `true` para todas las sucursales.',
  },
  'store/store-locations/preferred': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: valida la sucursal elegida solo por `is_visible`, sin canal, asi ' +
      'que un cliente puede fijar como preferida una sucursal de otra tienda y la arrastra a ' +
      'todo el flujo de retiro. Cerrarlo va junto con el listado: hoy los dos usan el mismo eje.',
  },
  'store/store-locations/resolve': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO — y es la de mayor impacto de las pendientes: `resolveByPoint` ' +
      'busca por poligono de cobertura SIN canal y devuelve el `sales_channel_id` de la sucursal ' +
      'que gane. El storefront arma el carrito con ese canal, asi que un cliente parado donde ' +
      'se solapan dos coberturas puede terminar comprando en la otra tienda. Filtrar cambia el ' +
      '`covered` de clientes que hoy compran, y eso se decide con quien opera las sucursales.',
  },

  // ── tinting (ERP) ───────────────────────────────────────────────
  // ── erp: comprobantes ────────────────────────────────────────────
  // El eje de estas dos es el CLIENTE, no la tienda: ambas exigen customer
  // autenticado y verifican que la orden sea suya (un order_id ajeno responde
  // como "no disponible"). Scopear por tienda encima no agregaria nada, y el
  // comprobante lo emite el ERP unico de la instancia.
  'store/erp/invoices/[order_id]': { state: 'not-applicable', reason: 'comprobante de la orden del customer autenticado; el eje es el cliente y la ruta valida que la orden sea suya' },
  'store/erp/invoices/[order_id]/download': { state: 'not-applicable', reason: 'descarga del comprobante de la orden del customer autenticado; el eje es el cliente y la ruta valida que la orden sea suya' },

  'store/tinting/bases': { state: 'not-applicable', reason: 'catalogo del ERP de tintometria; el dato es del ERP y su cuenta la resuelve el modulo' },
  'store/tinting/catalog': { state: 'not-applicable', reason: 'catalogo del ERP de tintometria; el dato es del ERP y su cuenta la resuelve el modulo' },
  'store/tinting/colors': { state: 'not-applicable', reason: 'catalogo del ERP de tintometria; el dato es del ERP y su cuenta la resuelve el modulo' },
  'store/tinting/line-items': { state: 'not-applicable', reason: 'escribe en el metadata de un line item del core, que ya viene del carrito de la key' },
  'store/tinting/quote': { state: 'not-applicable', reason: 'cotizacion en vivo del ERP para una formula concreta; el dato es del ERP' },

  // ── typesense ───────────────────────────────────────────────────
  'store/typesense/analytics': { state: 'scoped' },
  'store/custom/typesense-sync': {
    state: 'pending',
    reason:
      'BLOQUEADA POR INFRA: devuelve el catalogo ENTERO para indexar, sin canal. Con ' +
      '`TYPESENSE_SITE_COLLECTIONS` cada tienda tiene su coleccion, asi que el eje existe — ' +
      'pero quien decide en cual entra cada producto es el indexador, no esta ruta, y cerrarlo ' +
      'acá partiria el feed a la mitad del pipeline.',
  },

  // ── videos ──────────────────────────────────────────────────────
  // Routes moved to @minimalart/mercatto-plugin-videos.

  // ── whatsapp ────────────────────────────────────────────────────
  'store/whatsapp/floating-button': { state: 'scoped' },
};
