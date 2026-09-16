/**
 * Si una PANTALLA del backoffice respeta la tienda activa.
 *
 * Es un registro distinto del de capacidades por extensión
 * (`lib/extension-multistore.ts`) y del de rutas del backend
 * (`lib/multistore/scoped-routes.ts`), y los tres hacen falta:
 *
 *   extension-multistore  qué promete la EXTENSIÓN     → alimenta el badge de versión
 *   scoped-routes         qué filtra la RUTA del backend → alimenta el ratchet de deuda
 *   este archivo          qué ve el usuario en la PANTALLA que tiene delante
 *
 * No alcanza con los otros dos porque la migración no es atómica por extensión:
 * `blog-posts` filtra y `blog-settings` todavía no. Si la barra leyera el registro
 * por extensión, prometería que la pantalla de settings respeta la tienda cuando no.
 *
 * `instance` NO es un `unscoped` que algún día se arregla: es "esto es único para
 * todo el backoffice, por diseño". Separarlos evita el ticket recurrente "¿cuándo
 * arreglan el filtro de X?" sobre cosas que nunca van a filtrar.
 */
export type SiteScopeState = 'scoped' | 'unscoped' | 'instance';

/**
 * Una pantalla es `scoped` sólo si TODAS sus lecturas Y TODAS sus escrituras llevan
 * la tienda. Media migración —la lista filtra, el alta crea global— es peor que
 * ninguna: el usuario ve su tienda y crea algo que aparece en todas.
 */
export const SCREEN_SITE_SCOPE: Record<string, SiteScopeState> = {
  marketplaces: 'scoped',
  // Migradas: sus rutas admin filtran y sus mutaciones guardan con la tienda.
  brands: 'scoped',
  'shop-by-looks': 'scoped',
  'payment-benefits': 'scoped',
  banners: 'scoped',
  'blog.articles': 'scoped',
  'store-locations': 'scoped',
  // Migradas a plugins pero conservan el estado scoped porque el plugin
  // renderiza el slot `SiteScopeBar` del runtime contract, que resuelve el
  // scope contra este mismo map.
  'abandoned-carts': 'scoped',
  comments: 'scoped',
  'dynamic-groups': 'scoped',
  'media-library': 'scoped',
  'pdf-catalogs': 'scoped',
  videos: 'scoped',
  'recurring-orders': 'scoped',
  // Lee y escribe SIEMPRE contra la tienda activa: sin tienda la ruta ni siquiera
  // deja guardar (400), así que no hay media migración posible acá.
  'site-credentials': 'scoped',
  // Misma invariante, con una vuelta más: acá "sin tienda" NO es falta de filtro
  // sino la capa de la instancia, que es editable y es de la que heredan las
  // tiendas sin valor propio. Sigue siendo `scoped` porque lo que el badge
  // pregunta es si la pantalla aísla por tienda, y aísla: se escribe exactamente
  // en la capa que se está mirando (la invariante de `precedence.ts`).

  // De la instancia por diseño, no pendientes.
  // database-explorer: moved to @minimalart/mercatto-plugin-database-explorer
  sites: 'instance',
  // media-library, dynamic-groups, abandoned-carts: siguen 'scoped' arriba.

  /**
   * Preferencias se declara POR PESTAÑA, no por pantalla.
   *
   * Tenía una sola entrada `store-config: 'scoped'` para las siete, y era mentira en
   * tres: Acceso listaba todas las tiendas, Documentación Fiscal pegaba sin el header
   * de tienda y Comercio escribe el Store global de Medusa. El badge decía "Filtra por
   * tienda" encima de una lista con las tres.
   *
   * La granularidad correcta es la pestaña porque es la unidad que el operador ve: cada
   * `Tabs.Content` tiene su propia ruta de backend y su propio estado de migración. Es
   * el mismo argumento que ya justifica que este registro sea por PANTALLA y no por
   * extensión (`blog-posts` filtra y `blog-settings` no) — una escala más abajo.
   */
  'store-config.commerce': 'instance',
  'store-config.branches': 'scoped',
  'store-config.storefront': 'scoped',
  'store-config.ai': 'scoped',
  'store-config.fiscal': 'scoped',
  'store-config.min-purchase': 'scoped',
  'store-config.access': 'scoped',
  'store-config.legal': 'scoped',

  /**
   * Fidelización se declara POR SUB-PÁGINA, por el mismo motivo que Preferencias se
   * declara por pestaña: cada una tiene su propia ruta de backend y su propio estado
   * de migración. Seis filtran y una no, así que una sola entrada `loyalty` habría
   * mentido en el tablero — que es la pantalla que el operador mira primero.
   *
   * Las seis `scoped` comparten la forma: la ruta mete el filtro en el WHERE con
   * `siteFilter` y las que escriben heredan la tienda por `program_id`, que sale de
   * `useLoyaltyPrograms()` — el único hook de `hooks/api/loyalty.tsx` con `siteId` en
   * la query key. No hay `siteDefaults` en los POST y está bien: los descriptores son
   * `via_parent`, donde inventar un default escribiría un eje que contradiría al
   * padre (ver `lib/multistore/scope.ts`).
   */
  'loyalty.reglas': 'scoped',
  'loyalty.recompensas': 'scoped',
  'loyalty.canjes': 'scoped',
  'loyalty.movimientos': 'scoped',
  // Las dos únicas cuyo `[id]` no corre `assertIdInSite`: el listado y el alta sí
  // llevan la tienda, y desde la pantalla no hay forma de nombrar un id ajeno, pero
  // la ruta de detalle queda abierta. Es deuda del backend, anotada acá para que no
  // se pierda: si algún día el admin permite editar por id escrito a mano, estas dos
  // bajan a `unscoped` hasta que el guard exista.
  'loyalty.niveles': 'scoped',
  'loyalty.campanas': 'scoped',

  /**
   * Las seis listas sueltas que migraron con el mismo molde: el GET mete el filtro
   * en el WHERE con `siteFilter` y el POST hereda la tienda con `siteDefaults`, así
   * que lo que se ve y lo que se crea son la misma capa. Cada una cita su prueba en
   * el comentario que acompaña a su `<SiteScopeBar>`.
   *
   * `checkout-links` y `landing-pages` estaban acá abajo, entre las pendientes, y no
   * era mentira sino desfase: sus rutas ya filtraban, pero el hook mandaba sólo
   * `Content-Type` y `siteFromRequest` resolvía `allSites`. Con el hook migrado a
   * `fetchJson` el header viaja y el filtro deja de ser no-op.
   */
  'checkout-links': 'scoped',
  'landing-pages': 'scoped',
  corporates: 'scoped',
  // dynamic-groups: sigue 'scoped' arriba.
  'email-templates': 'scoped',
  /**
   * Igual que las otras cinco en la lectura, y cerrada también del lado de la
   * mutación: `contact-submissions/[id]` corre `assertIdInSite` en POST y en DELETE,
   * así que marcar leído o archivar por id escrito a mano ya no cruza de tienda.
   *
   * No hay POST de alta y por eso no falta `siteDefaults`: los mensajes nacen en el
   * storefront, donde la publishable key ya identifica la tienda. Es la primera tabla
   * del repo con `site_id` propio en vez de canal, justamente por eso.
   */
  'contact-submissions': 'scoped',

  /**
   * Newsletter nace scopeada de las dos puntas, y es la primera que además scopea
   * una CREDENCIAL de terceros por ese mismo eje.
   *
   * Lectura: el GET mete `siteFilter` en el WHERE, y su descriptor es el primero
   * con `empty: 'unassigned'` en vez de `'all'` — la tabla nace con la columna, así
   * que una fila sin tienda es una anomalía, no historia previa.
   *
   * Escritura: el reintento corre `assertRowInSite` para decidir si el operador
   * puede tocar la fila, y resuelve la cuenta de Brevo con el `site_id` DE LA FILA,
   * no con la tienda de la pantalla. Es la diferencia entre filtrar la vista y
   * aislar de verdad: parado en "Todas", reintentar con la resolución del request
   * mandaría el contacto a la cuenta de otro cliente.
   */
  'newsletter-subscriptions': 'scoped',

  /**
   * Delivery se declara POR PANTALLA, no una entrada para la extensión entera.
   *
   * Son diez listas con diez rutas distintas, y agruparlas repetiría el error que se
   * acaba de corregir en Preferencias: una entrada tapando siete pestañas, mintiendo
   * en tres. Acá las diez filtran hoy, pero el día que una regrese —o que se sume una
   * pantalla nueva sin migrar— la entrada única las volvería a cubrir a todas.
   *
   * Las diez comparten la mecánica: `delivery` no tiene columna de tienda propia,
   * todo cuelga de `store_location` por FK (`modules/delivery/site-scope.ts`), así
   * que el filtro es `via_parent` sobre las sucursales de la tienda activa. Por eso
   * ninguno de sus POST lleva `siteDefaults` y está BIEN: la tienda la fija la
   * sucursal que se elige en el formulario, e inventar un default escribiría un eje
   * que contradiría al padre — el mismo argumento que ya vale en Fidelización.
   */
  'delivery.executions': 'scoped',
  'delivery.analytics': 'scoped',
  'delivery.zones': 'scoped',
  'delivery.zone-conflicts': 'scoped',
  'delivery.rules': 'scoped',
  'delivery.drivers': 'scoped',
  'delivery.vehicles': 'scoped',
  'delivery.routes': 'scoped',
  'delivery.coverages': 'scoped',
  'delivery.coverages-map': 'scoped',

  /**
   * SEO & GEO se declara POR PANTALLA, y de sus diez sólo CINCO entran acá.
   *
   * Es el mismo argumento que ya justifica Preferencias por pestaña y Fidelización por
   * sub-página, pero acá la granularidad no es opcional: las diez pantallas cuelgan de
   * ocho rutas distintas y tres de ellas no resuelven el eje. Una entrada `seo-geo`
   * habría puesto "Filtra por tienda" encima de Keywords, que lista las categorías de
   * TODA la instancia.
   *
   * Las cinco de acá comparten la forma: la ruta mete el filtro de canal en la consulta
   * que la pantalla lee, y las dos que además escriben —tablero y listado, las dos por
   * `POST admin/seo-geo/audits`— estampan `siteDefaults(…, SEO_AUDIT_SITE_SCOPE)` y el
   * `base_url` de la tienda. Y el transporte, que este registro no cubre:
   * `hooks/api/seo-geo.tsx` va entero por `sdk.client.fetch`, que lleva `x-site-id` en
   * `globalHeaders` (`lib/client.ts`), así que el header viaja y el filtro no es no-op.
   *
   * `seo-geo/configuracion` NO está acá y no es un olvido: monta `CardSiteContext`, que
   * no lee este registro porque su scope se declara por prop. Y `auditorias/[id]` no
   * monta franja de ningún tipo — ver la nota de su `page.tsx`.
   */
  'seo-geo.dashboard': 'scoped',
  'seo-geo.auditorias': 'scoped',
  'seo-geo.hallazgos': 'scoped',
  'seo-geo.ai-visibility': 'scoped',
  'seo-geo.simulador': 'scoped',

  /**
   * Pantallas SECUNDARIAS de extensiones cuya raíz ya tenía barra.
   *
   * Es el mismo desfase que Preferencias, visto desde el otro lado: allá una entrada
   * cubría siete pestañas; acá la entrada existía para la raíz y las secundarias
   * quedaban sin ninguna, cayendo al fallback `unscoped` — que en pantallas que SÍ
   * filtran es el error barato, pero igual es un cartel naranja mintiendo.
   *
   * `banners.placement` consume el mismo `admin/banners` que la raíz. Se declara
   * igual: son dos pantallas, a la del placement se llega también por URL directa, y
   * el día que una de las dos cambie de ruta la entrada compartida no lo avisaría.
   */
  'banners.placement': 'scoped',
  'recurring-orders.analytics': 'scoped',
  'recurring-orders.renewals': 'scoped',
  'recurring-orders.plans': 'scoped',
  'recurring-orders.forecast': 'scoped',
  'recurring-orders.incidents': 'scoped',

  // Todavía no filtran. Se van moviendo a `scoped` junto con su ruta.
  'blog.categories': 'unscoped',
  // commerce-dashboard: moved to @minimalart/mercatto-plugin-commerce-dashboard
  /**
   * CORRECCIONES quedó afuera porque la ruta IMPORTA el helper de tienda pero el
   * filtro no llega a la consulta que la pantalla LEE. Es el desfase que
   * `lib/multistore/scoped-routes.ts` no puede ver: la ruta está declarada
   * `{ state: 'scoped' }` ahí y eso sigue siendo cierto de lo que GUARDA, no de lo
   * que muestra.
   *
   * No monta franja: un selector que no cambia lo que se ve miente aun con el badge
   * naranja al lado, porque el operador lee la lista antes que el badge. Queda
   * declarada igual, como lista de trabajo — el test de entradas muertas sólo le
   * exige barra a las `scoped`.
   *
   * Las dos rutas propias SÍ cierran: `corrections` y
   * `corrections/apply` corren `assertProductInSite` (404, no 403). Pero la pantalla no
   * se alimenta de ellas para LEER: el buscador de producto pega a `/admin/products`,
   * que es del core de Medusa y no tiene eje de tienda —`multistore-middlewares.ts`
   * sólo le engancha `attachSiteHint`, que adjunta la pista y no filtra nada—. El
   * resultado es la media migración que este archivo llama peor que ninguna: el
   * operador de Norte encuentra en el buscador un producto de Sur, lo elige, y recién
   * al generar recibe un "No encontrado" que no explica nada. Sube a `scoped` cuando el
   * buscador use una ruta con `siteProductFilter`.
   */
  /**
   * KEYWORDS subió a `scoped` cuando las categorías pasaron a recortarse por
   * `productIdsForSite` (`keywords/route.ts`). Antes filtraba sólo la columna
   * "Cobertura" —que sale de la última auditoría— mientras Término, Pregunta y
   * Productos venían de un `query.graph` sobre `product_category` sin filtro: la
   * misma lista de preguntas en las tres tiendas, con `product_count` contando
   * productos que esa tienda no vende. Ahora las categorías sin productos EN LA
   * TIENDA no se publican.
   */
  'seo-geo.keywords': 'scoped',
  'seo-geo.correcciones': 'unscoped',
  // pdf-catalogs, comments, videos: siguen 'scoped' arriba (con la nota).
  /**
   * B2B filtra a MEDIAS, que para este registro es no filtrar. Segundo caso con la
   * misma forma que el tablero de Fidelización, y por eso vale la pena nombrarlo:
   * `admin/companies` está declarada `scoped` en `scoped-routes.ts` y su GET filtra
   * de verdad (`companies/route.ts:36`), pero el ALTA no.
   *
   * `POST /admin/companies` estampa `getB2bSalesChannelId()`, que es el canal
   * mayorista de la INSTANCIA: `modules/company/settings.ts` documenta que el camino
   * sincrónico sólo ve la fila global, así que todas las tiendas escriben el mismo
   * canal. El operador crea una empresa parado en Norte y la empresa cae en el canal
   * de quien sea que lo tenga — con el listado ya filtrando, no vuelve a encontrarla
   * donde la creó. Es exactamente la media migración que este archivo llama peor que
   * ninguna.
   *
   * La LECTURA por id ya cerró (`companies/[id]` corre `assertRowInSite` en GET, POST
   * y DELETE), y por eso lo único que queda entre esta pantalla y el `scoped` es el
   * alta. No es un detalle menor de implementación: es la mitad que falta.
   *
   * Sube a `scoped` el día que la ruta propague la `SiteResolution` al camino async
   * de `app-settings` — el descriptor ya está declarado `scope: 'site'` justamente
   * para eso.
   */
  companies: 'unscoped',
  /**
   * Beneficios de Pago → Configuración: tercer caso de la misma forma. Las métricas y
   * el catálogo filtran (`dashboard/route.ts:13`, `catalog/route.ts:19`), pero
   * "Última sincronización" sale de `listPaymentSyncLogs({}, …)` sin filtro —
   * `payment_sync_log` no tiene columna de tienda ni de canal, así que hoy no hay eje
   * por el que filtrarla— y el botón de sincronizar corre con las credenciales de
   * ENTORNO y escribe el catálogo global.
   *
   * Sube a `scoped` cuando el sync tome la cuenta por tienda (`site_credential` ya
   * existe para eso) y el log gane su eje.
   */
  'payment-benefits.settings': 'unscoped',
  /**
   * El tablero de Fidelización SÍ filtra, y hasta hace poco no.
   *
   * Estuvo `unscoped` mientras tres de sus siete KPIs cruzaban tiendas: los canjes
   * salían de `listRewardGrants({}, …)` con el filtro vacío, aunque el descriptor
   * existía y su listado hermano lo usaba. Se cerró en `dashboard/route.ts`.
   *
   * Queda UNA cosa fuera del eje, y es deliberada: el saldo promedio y los clientes
   * activos salen de `points_account`, que es una cuenta por cliente en toda la
   * instancia. Partirla por tienda dividiría el saldo de alguien que compró en las
   * dos, o sea que el número sería más falso filtrado que sin filtrar.
   *
   * Por eso `scoped` y no `unscoped`: lo que el operador lee como "sus canjes" ahora
   * son sus canjes. Lo que es de la instancia lo dice el propio KPI.
   */
  'loyalty.dashboard': 'scoped',
};

/**
 * FAIL-CLOSED: una pantalla sin entrada se asume NO filtrada.
 *
 * Es la misma ética que ya está escrita en `lib/extension-multistore.ts`: un tag
 * optimista hace que alguien asuma un aislamiento que no existe. Preferimos decir
 * "esta pantalla todavía no filtra" de más que de menos.
 */
export const resolveScreenScope = (screen: string): SiteScopeState =>
  SCREEN_SITE_SCOPE[screen] ?? 'unscoped';
