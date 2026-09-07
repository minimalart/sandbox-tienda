/**
 * Qué jobs y subscribers respetan la tienda, y cuáles todavía no.
 *
 * Es el gemelo de `scoped-routes.ts` para el trabajo que corre SIN request.
 *
 * Existe porque las rutas admin tienen tres ratchets que las vigilan y esto no
 * tenía ninguno. Un job no tiene `siteFromRequest` —no hay request— así que
 * ninguna de las tres poblaciones lo indexaba, y la deuda de acá se encontró
 * leyendo archivo por archivo. Eso no escala y no se puede repetir en cada PR:
 * lo que no está en un registro con un test que lo cruce contra el filesystem,
 * crece solo.
 *
 * Los tres estados son los MISMOS de `scoped-routes.ts`, con el vocabulario
 * traducido a un contexto sin request:
 *
 *   scoped          resuelve la tienda de lo que está por tocar —recorriendo el
 *                   registro (`listSites`), resolviéndola desde la orden/fila
 *                   (`resolveSite`), o propagando `sales_channel_id`/`site_id`
 *                   hacia afuera— y LEE Y ESCRIBE con ese eje puesto.
 *                   Media migración es PEOR que ninguna, igual que en las rutas:
 *                   un subscriber que manda el mail al cliente con la marca de
 *                   su tienda y la copia al admin al buzón de otra no está
 *                   "casi" migrado — está mintiendo en la mitad que no se mira.
 *   not-applicable  no tiene eje de tienda posible. Va con razón escrita, y la
 *                   razón tiene que NOMBRAR qué lo hace único por instalación:
 *                   qué tabla, qué helper, qué invariante. "Es de instancia" no
 *                   es una razón, es una etiqueta.
 *   pending         todavía no aplica el eje. Va con razón escrita que dice QUÉ
 *                   falta. A diferencia de las rutas —donde ya no queda deuda
 *                   "por hacer" y por eso su ratchet exige el prefijo
 *                   `BLOQUEADA POR …`— acá SÍ queda trabajo hacible, y forzar
 *                   ese prefijo obligaría a inventar un bloqueo que no existe.
 *
 * ── DOS FORMAS DE "APLICAR EL EJE", Y POR QUÉ LAS DOS CUENTAN COMO `scoped` ───
 *
 * 1. POR CAPA: el trabajo se hace una vez por tienda. `jobs/seo-audit-schedule`
 *    recorre `listSites()` y encola una auditoría por tienda con su config, su
 *    URL y su canal.
 * 2. POR FILA: el barrido es único, pero cada fila ya trae su tienda y el efecto
 *    viaja con ella. `subscribers/order-placed-whatsapp` manda UN mensaje por
 *    orden con el `sales_channel_id` de ESA orden.
 *
 * La forma correcta depende del trabajo y elegir mal es caro en las dos
 * direcciones. `jobs/seo-embed-catalog` es el ejemplo del error inverso: el
 * fan-out por tienda sería EL bug, porque el vector de un producto es idéntico
 * en toda tienda y se pagarían N embeddings por lo mismo.
 *
 * ── QUÉ SIGNIFICA "LA TIENDA" ACÁ ────────────────────────────────────────────
 *
 * Lo mismo que en `scoped-routes.ts`, con la misma pérdida: el eje que viaja es
 * casi siempre el SALES CHANNEL, porque es lo que las filas guardan y lo único
 * que un `order.placed` trae a mano. `SiteRef.channel_ids` traduce con pérdida en
 * las dos direcciones. Las dos excepciones son las tablas que llevan `site_id`
 * propio (`corporate`, `cataloging_execution`, `dynamic_group`, `loyalty_program`,
 * `gift_card_settings`), y ahí el eje es exacto.
 *
 * Lo vigila `job-scope.test.ts`. Su punto ciego está escrito en la cabecera de ese
 * archivo, y es obligatorio leerlo antes de creerle a un `scoped`.
 */

export type JobScopeState =
  | { state: 'scoped' }
  | { state: 'not-applicable'; reason: string }
  /**
   * `reason` es OBLIGATORIA en el tipo, no sólo en el test. En las rutas es
   * opcional (`reason?`) y el test la exige aparte; acá se endurece de entrada
   * porque el registro nace con 21 pendientes y una nota mental perdida entre 21
   * es una nota mental perdida.
   */
  | { state: 'pending'; reason: string };

/** Clave: la ruta relativa a `src/`, sin extensión. Ej: `jobs/seo-audit-schedule`. */
export const JOB_SCOPE: Record<string, JobScopeState> = {

  // ══ JOBS ══════════════════════════════════════════════════════════════════

  // ── ai-assistant ────────────────────────────────────────────────────────────
  'jobs/embed-pending-memories': { state: 'not-applicable', reason: 'embebe las memorias del asistente, que viven bajo un tenant unico (`default`) — el mismo motivo por el que `admin/ai-assistant/memory/search` es not-applicable; el interruptor que lo gatea es `ai_config.memory_enabled`, que es del Store unico de Medusa' },
  'jobs/generate-proposals': { state: 'not-applicable', reason: 'corre el motor de propuestas sobre la instancia y deja filas en `proposal`, cuyo eje es la CORRIDA y no la tienda (igual que `admin/ai-assistant/proposals`); ademas se auto-saltea si ya hay una pendiente, o sea que su unidad de trabajo es global por diseño' },

  // Abandoned cart — job moved to @minimalart/mercatto-plugin-abandoned-cart.

  // ── catalogador ─────────────────────────────────────────────────────────────
  'jobs/catalogador-process': { state: 'scoped' },

  // ── demo-store / importador ─────────────────────────────────────────────────
  'jobs/process-demo-store-imports': { state: 'scoped' },

  // ── dynamic-groups ──────────────────────────────────────────────────────────
  // Dynamic groups — job moved to @minimalart/mercatto-plugin-dynamic-groups.

  // ── erp ─────────────────────────────────────────────────────────────────────
  'jobs/erp-catalog-sync': { state: 'not-applicable', reason: 'pull de catalogo contra el ERP unico de la instalacion: la conexion sale de `erp_config` (una fila activa, sin columna de tienda) y `admin/erp/config` ya es not-applicable por lo mismo' },
  'jobs/erp-outbox-processor': { state: 'not-applicable', reason: 'drena `erp_outbox_event` hacia el ERP unico de la instalacion; la cola no tiene columna de tienda y su destinatario es uno solo' },
  'jobs/erp-stock-sync': { state: 'not-applicable', reason: 'pull de stock contra el ERP unico de la instalacion, gateado por `erp_config.stock_sync_enabled` — una unica fila de config por instalacion' },

  // ── event bus (infraestructura) ─────────────────────────────────────────────
  'jobs/event-bus-monitor': { state: 'not-applicable', reason: 'mide la cola BullMQ `RedisEventBusService:events-queue`, que es UNA por instalacion: la crea el loader de `@medusajs/event-bus-redis` con la `REDIS_URL` de `projectConfig` (no la de ninguna tienda), no tiene columna ni prefijo por tienda, y por ella pasan mezclados los eventos de todas. Un fan-out por tienda seria el error inverso —el de `seo-embed-catalog`—: N pasadas midiendo la MISMA cola. El aviso tampoco tiene eje y por eso llama a `getAdminNotificationEmail(container)` SIN pista, a diferencia de `subscribers/order-placed-email`, que si la manda: un bus muerto lo esta para las N tiendas a la vez, asi que el destinatario es el `admin_notification_email` GLOBAL y mandar la pista de una elegiria un buzon arbitrario dejando a las demas sin enterarse' },

  // ── gift-card-experience ────────────────────────────────────────────────────
  // `getSettings(siteId)` ahora EXIGE la tienda —`string | null` sin default, el molde
  // es `ga4/service.ts upsertBuiltinSetting`—, asi que las tres pasan `null` ESCRITO y
  // con la razon al lado del argumento. Lo que las mantiene pendientes ya NO es un
  // parametro omitido: eso se cerro donde importaba, en los dos subscribers que SELLAN
  // la entrega. Lo que queda es la forma del barrido — las tres reclaman o recorren
  // filas de todas las tiendas antes de saber de quien es cada una— y en dos de los
  // tres, una decision de producto sobre cuantos mails salen.
  'jobs/process-gift-card-deliveries': {
    state: 'pending',
    reason:
      'BLOQUEADA POR EL RECLAMO: `claimDueDeliveries(limit)` marca las filas ANTES de que se sepa de que tienda es cada una, asi que mover `settings.enabled` a por-entrega dejaria las entregas de una tienda apagada RECLAMADAS y sin procesar para siempre — peor que el bug que arregla. Se cierra cuando el reclamo filtre por tienda (la entrega llega a la suya por `order_id` → `order.sales_channel_id`, o sea un JOIN adentro del UPDATE ... RETURNING) o cuando el barrido sea por tienda. Lo que ya NO falta: la config que se SELLA en la entrega la resuelve `createGiftCardIntentsForOrder` con la tienda de la orden, y la marca del mail viaja por `channelOfOrder`. Sigue faltando `landingUrl()`, que arma el link con `process.env.STOREFRONT_URL` — el storefront de la instalacion, no el de la tienda que vendio, y eso pide que el registro de tiendas lleve su origen',
  },
  'jobs/process-gift-card-lifecycle': {
    state: 'pending',
    reason:
      'BLOQUEADA POR LA CONSULTA Y POR UNA DECISION DE PRODUCTO: `expiring_notice_days` y `balance_reminder_days` no son valores que se apliquen fila por fila, son los PARAMETROS con que `listExpiringNotificationCandidates`/`listBalanceReminderCandidates` arman los candidatos. Una cadencia por tienda pide un barrido por tienda, y ahi hay que decidir si un cliente con tarjetas de dos tiendas recibe DOS recordatorios de saldo o uno — o sea, si esto multiplica mails, que es el unico criterio por el que este registro no cierra algo. Sigue faltando ademas `settings.merchandising_url` y `storefrontPath()`, los dos de la instancia. El `sales_channel_id` de la marca ya viaja (lifecycle.ts)',
  },
  'jobs/reconcile-gift-card-usage': {
    state: 'pending',
    reason:
      'El kill switch que obedece es la fila GLOBAL (`getSettings(null)`, hoy escrito) para una reconciliacion que sella `first_used_at`/`exhausted_at` sobre las entregas de TODAS las tiendas: la tienda B que apaga la experiencia sigue viendo mover sus hitos, y si la apaga la principal se frena la de todas. El bloqueo esta en `reconcileUsageMilestones()`, que cuenta sobre `gift_card_delivery` entera sin ningun filtro: mientras el barrido no acepte tienda, pasarle otra cosa a `getSettings` solo cambiaria QUE gate se mira, no sobre que filas',
  },

  // ── loyalty ─────────────────────────────────────────────────────────────────
  'jobs/expire-loyalty-points': { state: 'not-applicable', reason: 'realiza lotes cuyo `expires_at` ya venció, y esa fecha la sella el programa AL GANARSE el punto: `expireDueLots` filtra sólo por `type=earn, status=available, expires_at < now` y no elige programa. El saldo que resincroniza (`points_account`) es uno por cliente en toda la instalacion a proposito — partirlo dividiria la plata de un cliente que compro en dos tiendas (misma decision que `admin/loyalty/customers/[id]`)' },

  // ── recommendations ─────────────────────────────────────────────────────────
  // Las cuatro son la contraparte de fondo de `admin/recommendations/aggregate` y
  // `rebuild`, que ya son `not-applicable` por escrito: agregan/recomputan POR canal
  // sobre el catalogo de la instalacion, son idempotentes y las lecturas hermanas ya
  // filtran.
  'jobs/recommendations-aggregate-events': { state: 'not-applicable', reason: 'agrega `recommendation_event` a metricas horarias y diarias POR canal en una ventana rodante; el canal es una COLUMNA del agregado, no un filtro del barrido — partirlo por tienda daria las mismas filas en N pasadas' },
  'jobs/recommendations-build-run': { state: 'not-applicable', reason: 'drena UNA corrida de `recommendation_version` por tick; la corrida ya sabe su estrategia y su canal, y el drenador es unico por instalacion — el mismo criterio de `admin/recommendations/rebuild`' },
  'jobs/recommendations-build-schedule': { state: 'not-applicable', reason: 'decide que estrategias tocan y encola a lo sumo una fila por estrategia; la cola es unica por instalacion y quien ejecuta es el drenador, que es lo que garantiza que no corran dos builds de la misma estrategia a la vez' },
  'jobs/recommendations-purge': { state: 'not-applicable', reason: 'retencion de `recommendation_event` y metricas por FECHA de corte, en lotes acotados; el criterio es la antiguedad y no la pertenencia — borrar por tienda dejaria la tabla de mayor volumen creciendo por las tiendas que nadie purgue' },

  // ── recurring-orders ────────────────────────────────────────────────────────
  'jobs/compute-recurring-metrics': { state: 'scoped' },
  'jobs/forecast-recurring-stock': { state: 'scoped' },
  'jobs/preflight-recurring-renewals': { state: 'scoped' },
  'jobs/process-subscription-notifications': {
    state: 'not-applicable',
    reason: 'drena una outbox ya sellada con destinatario, canal, template y datos; procesarla una vez por instalacion evita duplicar mensajes',
  },
  // Las TRES fases propagan el canal. La 3 era la que faltaba y era la peor: el
  // cliente veia el recordatorio con la marca de su tienda y despues el aviso de
  // "se cayo tu suscripcion" con la de otra.
  'jobs/process-recurring-renewals': { state: 'scoped' },

  // ── seo-geo ─────────────────────────────────────────────────────────────────
  'jobs/seo-audit-run': { state: 'not-applicable', reason: 'drena las auditorias en `queued` de a una: el eje viene EN LA FILA —`base_url`, el snapshot `config` y `sales_channel_id`, que `seo-audit-schedule` (scoped) sella al encolar— y `run-audit.ts:33-34,126` los usa en vez de re-resolverlos. Serializar por tienda ademas rompería el guard de "una corrida a la vez", que es lo que evita crawls concurrentes' },
  'jobs/seo-audit-schedule': { state: 'scoped' },
  'jobs/seo-embed-catalog': {
    state: 'pending',
    reason:
      'Lo que falta es SÓLO el gate, y el fan-out por tienda seria EL error: llama a `embedCatalog` con `salesChannelId: null` a proposito porque el vector de un producto es identico en toda tienda —embeberlo N veces es pagar N veces lo mismo— pero se gatea con `getSeoGeoConfig(container)` sin tienda, o sea la fila global de una pantalla que es `scoped` (`admin/seo-geo/config`). Hoy la tienda B con el Simulador prendido no embebe nada si la principal lo tiene apagado, y al reves embebe igual. Falta que el gate sea "alguna tienda lo tiene prendido", no "la global lo tiene prendido"',
  },

  // ── tracking de carriers ────────────────────────────────────────────────────
  // La limitacion ya estaba escrita en la cabecera de Andreani antes de este
  // registro; lo que faltaba era que alguien la contara.
  'jobs/sync-andreani-tracking-status': {
    state: 'pending',
    reason:
      'BLOQUEADA POR EL MODELO: el gate `hasAndreaniCredentials(getAndreaniSettings().options)` mira las credenciales de la INSTANCIA, asi que una instalacion donde solo las tiendas tienen `site_credential` propias queda con el sync apagado; y `AndreaniDeliveryProvider.pollStatus` consulta con `getAndreaniClient()` —la cuenta de la instancia— envios dados de alta con la cuenta de la tienda. Arreglarlo pide que `delivery_execution` sepa de que tienda es, y esa columna vive en el modulo `delivery`. Esta escrito en la cabecera del propio job',
  },
  'jobs/sync-correo-tracking-status': {
    state: 'pending',
    reason:
      'Gemelo del de Andreani y con el mismo bloqueo: corta con `getCorreoSettings().apiKey`, que es la key de la instancia (el propio comentario lo llama "el scope de instancia a proposito"), y despues consulta el tracking en lote con esa misma cuenta sobre envios que pudo haber dado de alta la cuenta de una tienda. Se cierra cuando `delivery_execution` lleve la tienda',
  },

  // ── typesense ───────────────────────────────────────────────────────────────
  // `admin/typesense/sync` y `sync-logs` ya son `not-applicable` con la razon
  // escrita, y nombran a este job: "el cluster de Typesense es UNO por instancia:
  // conexion, sonda y job de indexado no tienen eje de tienda ni aunque las
  // colecciones se separen".
  'jobs/typesense-stock-reconcile': { state: 'not-applicable', reason: 'barrido de reconciliacion contra el cluster UNICO de Typesense: existe porque los cambios de stock por nivel de ubicacion no emiten evento en Medusa v2, y pasa por `startTypesenseSync` para heredar su guard de concurrencia — que es global por diseño' },
  'jobs/typesense-sync-log-prune': { state: 'not-applicable', reason: 'retencion de `typesense_sync_log` por fecha de corte; la tabla registra corridas del cluster unico y no tiene columna de tienda' },

  // ══ SUBSCRIBERS ═══════════════════════════════════════════════════════════

  // Abandoned cart — subscriber moved to @minimalart/mercatto-plugin-abandoned-cart.

  // ── carriers ────────────────────────────────────────────────────────────────
  'subscribers/andreani-order': { state: 'scoped' },
  'subscribers/andreani-ticket-tracking-whatsapp': { state: 'scoped' },
  'subscribers/correo-order': { state: 'scoped' },
  'subscribers/correo-ticket-tracking-whatsapp': { state: 'scoped' },

  // ── company / corporate (B2B) ───────────────────────────────────────────────
  'subscribers/company-credit-order-placed': { state: 'not-applicable', reason: 'resuelve la empresa por `getMembershipByCustomer`, que devuelve `rows[0]` — y es inequivoco porque un cliente pertenece a lo sumo a UNA empresa en toda la instalacion: `create-company.ts:58` y `accept-company-invitation.ts:29` rechazan la segunda con NOT_ALLOWED. La cuenta corriente cuelga de esa empresa, que ya lleva su `sales_channel_id`' },
  // Las dos mandan DOS mails y ahora los DOS resuelven la tienda:
  // `getAdminNotificationEmail(container, hint)` acepta una `SiteHint` y se la pasa
  // a `getEmailBranding(siteId)`. El helper es el mismo que usa `order-placed-email`,
  // asi que las tres deudas se cerraron con un solo cambio de firma. La CANTIDAD de
  // mails no se movio —uno al usuario y uno al admin—: cambio la casilla del segundo.
  'subscribers/company-created-email': { state: 'scoped' },
  'subscribers/corporate-activated-email': { state: 'scoped' },
  'subscribers/corporate-created-email': { state: 'scoped' },

  // ── clientes / auth ─────────────────────────────────────────────────────────
  // Las tres comparten raiz y las tres se ABRIERON en la pasada que cerro los mails
  // al admin: no quedaron afuera por ser efecto externo —mandan UN mail por evento
  // antes y despues, la cantidad no se mueve— sino porque NO HAY DE DONDE SACAR LA
  // TIENDA. Se buscaron las tres vias posibles y ninguna existe hoy:
  //
  //   1. Una columna en `customer`. Medusa v2 no la tiene (mismo motivo por el que
  //      `jobs/recalculate-dynamic-groups` es not-applicable).
  //   2. Un link `customer` → `demo_store`. `src/links/` tiene once archivos y
  //      ninguno toca `customer`.
  //   3. `customer.metadata`. Nadie sella nada al registrarse: el alta va por la
  //      ruta del core, sin ruta custom del storefront que pudiera estampar la tienda.
  //
  // Y la cuarta via —deducirla de las ORDENES del cliente— esta descartada a
  // proposito: acierta para el que compro en una sola tienda, no tiene respuesta
  // para el que se acaba de registrar y elige mal para el que compro en dos. Una
  // regla que es cierta a veces y silenciosamente falsa el resto es peor que no
  // resolver nada, porque el mail SALE igual y nadie se entera. Un `site_id`
  // adivinado no es media migracion: es una mentira con formato correcto.
  //
  // Quedan `pending` y no `not-applicable` porque el eje SI existe —la tienda vive
  // en el storefront que origino la accion—: lo que falta es hacerla llegar. El
  // arreglo es UNO solo para las tres y es aguas arriba: sellar la tienda en el alta
  // del cliente. Con eso, las tres se cierran juntas y sin tocar nada mas.
  'subscribers/customer-created-email': {
    state: 'pending',
    reason:
      'El mail de bienvenida sale sin `site_id` ni `sales_channel_id`, las dos unicas formas que `email/service.ts:242 siteIdForNotification` acepta, asi que el cliente que se registro en la tienda B recibe el logo y los colores de la principal. `customer.created` trae `{ id }` y el subscriber hace `retrieveCustomer(id)`: el DTO no tiene canal, no hay link `customer`→`demo_store` en `src/links/` y el alta no estampa nada en `metadata`. Falta sellar la tienda al registrarse (columna, link o metadata); deducirla de las ordenes del cliente esta descartado — no aplica al recien registrado, que es exactamente el caso de este mail',
  },
  // El unico caso de esta tabla que se cerro DESMINTIENDO su propio reason. Decia que
  // `auth.password_reset` trae `{ entity_id, token, actor_type }` y nada mas, asi que
  // no habia de donde sacar la tienda. Es falso: el payload lo arma
  // `generateResetPasswordTokenWorkflow` y su cuarto campo es `metadata`, que la ruta
  // del core copia del body — y el storefront YA mandaba ahi
  // `{ sales_channel_id, country_code, web_url }` en cada pedido. El subscriber lo
  // destructuraba sin `metadata` y lo tiraba. Vale como advertencia general para el
  // resto de los `pending` de aca: antes de darle a un evento del core por vacio, leer
  // su workflow en `node_modules/@medusajs/core-flows`, no su documentacion.
  'subscribers/password-reset-email': { state: 'scoped' },
  // Se cerro con su gemelo por mail y por el mismo hallazgo: la `metadata` del evento.
  // El reason viejo decia que en la entidad `customer` no hay ningun campo de tienda
  // que pedir — cierto, y por eso mismo irrelevante: la tienda no habia que deducirla
  // del cliente, venia en el pedido de reseteo.
  'subscribers/password-reset-whatsapp': { state: 'scoped' },

  // ── delivery ────────────────────────────────────────────────────────────────
  'subscribers/delivery-execution-create': { state: 'not-applicable', reason: 'crea el sidecar del fulfillment que le llega: clasifica por los shipping methods de ESA orden y mapea la sucursal por `stock_location_id`, que es 1:1 con la stock location de Medusa — no hay eleccion entre filas de tiendas distintas' },
  'subscribers/delivery-execution-reconcile': { state: 'not-applicable', reason: 'fuerza al terminal la `delivery_execution` linkeada a UN fulfillment, resuelta por el link `fulfillment.delivery_execution`; es idempotente y no lee ninguna config' },
  // Se puso al dia con sus hermanas de Andreani y Correo: resuelve la tienda de la
  // orden (`resolveSiteViaSql` sobre `order.sales_channel_id`) y recien ahi lee su
  // interruptor, por el camino async que `modules/delivery/settings.ts` ahora expone
  // (`isOwnFleetAutoFulfillEnabledForSite`). El gate bajo hasta despues de
  // `classify()` y del hint de flota propia: la resolucion de tienda solo se paga
  // para las ordenes que de verdad son de flota propia. No sale nada de la
  // instalacion —el fulfillment es del core de Medusa—, asi que no hay efecto
  // externo que multiplicar: lo que cambia es CUALES ordenes lo generan.
  'subscribers/own-fleet-order': { state: 'scoped' },
  'subscribers/own-fleet-delivery-whatsapp': { state: 'scoped' },

  // ── dynamic-groups ──────────────────────────────────────────────────────────
  // Dynamic groups — subscriber moved to @minimalart/mercatto-plugin-dynamic-groups.

  // ── erp ─────────────────────────────────────────────────────────────────────
  'subscribers/erp-catalog-typesense-sync': { state: 'not-applicable', reason: 'encola un reindex de los productos que el catalog sync del ERP unico toco; el destino es el cluster unico de Typesense y el evento llega con los ids ya resueltos' },
  'subscribers/erp-fulfillment-created': { state: 'not-applicable', reason: 'mismo outbox y mismo ERP unico que los otros dos triggers de venta; el eje es la orden y su marca de deposito facturador, no la tienda' },
  'subscribers/erp-invoice-ready-email': { state: 'not-applicable', reason: 'avisa el comprobante al email de la orden; el branding del mail lo resuelve el provider de notificacion por `sales_channel_id`, no este subscriber' },
  'subscribers/erp-order-placed-reconcile': { state: 'not-applicable', reason: 'encola la venta en el outbox del ERP unico con clave idempotente por orden; `erp_config` es una sola fila activa por instalacion y el destinatario es uno solo' },
  'subscribers/erp-payment-captured': { state: 'not-applicable', reason: 'mismo outbox y mismo ERP unico: resuelve payment → payment_collection → order y encola. No hay credencial de ERP por tienda (`admin/erp/config` ya es not-applicable por eso)' },

  // ga4 — subscribers/ga4-dispatcher and subscribers/ga4-ecommerce-dispatcher
  // moved to @minimalart/mercatto-plugin-ga4.

  // ── gift-card-experience ────────────────────────────────────────────────────
  'subscribers/order-canceled-gift-card': { state: 'not-applicable', reason: 'cancela las entregas NO emitidas de UNA orden (`cancelUnissuedDeliveriesForOrder(order_id)`): no lee configuracion ni elige diseño, solo revierte lo que esa orden creo' },
  // Los dos crean las mismas filas por dos caminos (orden y captura) y por eso se
  // cerraron JUNTOS: si quedaba uno sin la tienda, creaba las entregas mal cada vez
  // que la captura le ganaba la carrera al `order.placed`, y una entrega mal sellada
  // no se corrige despues.
  //
  // El camino comun es `createGiftCardIntentsForOrder`, que ahora resuelve la tienda
  // desde `order.sales_channel_id` y lee la config con ella: `expires_at` (de
  // `default_expiry_days`), `timezone`, `scheduled_at` y el diseño por defecto salen
  // de la tienda que VENDIO, que es la que el operador configuro en
  // `admin/gift-card-experience/settings` (scoped, guarda con `upsertSettingsForSite`).
  //
  // `settings.enabled` tambien pasa a ser por tienda ACA, y no deja nada colgado: los
  // intents se crean de cero en cada pasada, asi que una tienda apagada no crea
  // ninguno. Es exactamente lo contrario del gate de los dos JOBS, que corre DESPUES
  // de reclamar filas — por eso ellos siguen pendientes y estos no.
  //
  // Sigue de la instancia el `STOREFRONT_URL` del link, pero eso lo arma el JOB de
  // entrega y esta contado en SU razon: aca no se sella.
  //
  // El checkout valida con la MISMA config (`hooks/gift-card-cart-validation`), y esa
  // simetria no es prolijidad: `resolveScheduledAt` tira si la fecha cae fuera del
  // horizonte, asi que validar con la global y sellar con la de la tienda dejaria una
  // orden cobrada sin ninguna gift card creada.
  'subscribers/order-placed-gift-card': { state: 'scoped' },
  'subscribers/payment-captured-gift-card': { state: 'scoped' },

  // ── loyalty ─────────────────────────────────────────────────────────────────
  // `getActiveProgram(siteId)` ahora EXIGE la tienda —`string | null` sin default, el
  // molde es `ga4/service.ts upsertBuiltinSetting`— y resuelve por PRECEDENCIA: el
  // programa de esa tienda si lo tiene, el global si no. La precedencia sale del
  // descriptor y no de la intuicion: `LOYALTY_PROGRAM_SITE_SCOPE` es `empty: 'all'`,
  // o sea que el programa sin `site_id` es LEGACY y se ve desde todas — un fallback,
  // no un competidor. Ordenar por `created_at` sobre la union haria que un global
  // creado hoy se apropiara en silencio de las tiendas que ya tienen el suyo.
  //
  // Importa donde no se ve: los MOVIMIENTOS cuelgan del `program_id`
  // (`POINTS_TRANSACTION_SITE_SCOPE` va `via_parent`), asi que elegir mal el programa
  // no acredita "un poco distinto" — le manda los puntos al tablero de la otra tienda.
  //
  // El eje se resuelve en el CALL SITE y viaja en `EarnLoyaltyPointsInput.site_id`
  // (obligatorio): el subscriber ya lo necesita para saber si hay programa —y si no,
  // para caer al earn legacy—, y resolverlo otra vez adentro del workflow serian dos
  // consultas que pueden discrepar.
  'subscribers/comment-approved-loyalty': { state: 'scoped' },
  'subscribers/customer-created-loyalty': {
    state: 'pending',
    reason:
      'BLOQUEADA POR EL MODELO, y es lo unico que queda de los tres: pasa `null` ESCRITO —el programa global— porque `customer.created` no trae canal, `customer` no tiene columna de tienda y no hay link `customer`→`demo_store`. Deducirla de las ordenes del cliente acierta a veces y es silenciosamente falsa el resto, que es por lo que `customer-created-email` sigue pendiente en vez de "resuelta". Consecuencia deliberada y fail-closed: en una instalacion donde CADA tienda tiene su programa y no hay global, el alta no acredita nada — mejor que colgarle los movimientos del alta al tablero de una tienda que el cliente todavia no eligio. Se cierra el dia que el registro del cliente sepa su tienda, junto con las otras dos de esa familia',
  },
  // Cerrado: resuelve la tienda de la orden con `siteIdOfChannel(order.sales_channel.id)`
  // y con ella elige el programa Y sella los movimientos.
  //
  // Lo que NO cubre, escrito para que no se descubra dos veces: el fallback LEGACY
  // —el que corre solo cuando ni la tienda ni la instalacion tienen programa activo—
  // usa `resolvePointsEarnRate()`, que lee `POINTS_EARN_RATE` por el camino
  // SINCRONICO y por lo tanto de la fila global, aunque el descriptor sea
  // `defaultScope: 'site'`. No es media migracion —los dos regimenes son
  // excluyentes, nunca se mezcla el programa de una tienda con la tasa de otra— pero
  // una tienda que setee su tasa en la card no la va a ver aplicada. Cerrarlo pide el
  // camino async por `site_setting`, que es el de `andreani-fulfillment/settings.ts`,
  // y contradice la nota de `modules/loyalty/settings.ts` sobre por que es sincronica.
  'subscribers/order-placed-points': { state: 'scoped' },
  'subscribers/order-canceled-loyalty': { state: 'not-applicable', reason: 'revierte por `(customer_id, reference=order, reference_id)` las transacciones de earn que YA existen: no elige programa ni tasa, asi que hereda la tienda que haya quedado en el earn. Si el earn se acredito mal, el que miente es `order-placed-points` y no esto' },

  // ── mail / whatsapp de orden ────────────────────────────────────────────────
  // Hermano por canal del de WhatsApp: manda el `sales_channel_id` de ESA orden en
  // la `data` de la notificacion, o sea eje POR FILA. No es cosmetico — la fila
  // `order-cancelled` de la base lleva `site_id` propio, asi que sin el eje el
  // proveedor no alcanza la plantilla de la tienda y manda la del codigo.
  'subscribers/order-cancelled-email': { state: 'scoped' },
  'subscribers/order-cancelled-whatsapp': { state: 'scoped' },
  // La confirmacion al cliente ya llevaba `sales_channel_id` en `sharedData`; la
  // copia interna ahora resuelve el destinatario con la MISMA tienda. Sigue saliendo
  // un mail al comprador y uno al operador por orden — un fan-out por tienda aca
  // seria el error inverso.
  'subscribers/order-placed-email': { state: 'scoped' },
  'subscribers/order-placed-whatsapp': { state: 'scoped' },
  'subscribers/return-requested-notify': { state: 'scoped' },

  // ── orden: metadata ─────────────────────────────────────────────────────────
  'subscribers/order-billing-snapshot': { state: 'not-applicable', reason: 'copia `invoice_type`/`billing_profile_id`/`billing_snapshot` del carrito a SU MISMA orden; las dos filas son de la misma tienda por construccion y no se lee ninguna config ni catalogo' },
  'subscribers/order-company-tag': { state: 'not-applicable', reason: 'copia el contexto B2B (`company_id` y compañia) del carrito a SU MISMA orden; el `company_id` sale del `cart.metadata` que el checkout ya sello, no de una busqueda entre empresas' },

  // ── recommendations ─────────────────────────────────────────────────────────
  'subscribers/recommendation-order-attribution': { state: 'scoped' },
  'subscribers/recommendation-order-canceled': { state: 'not-applicable', reason: 'sella `voided_at` en los `recommendation_event` de UNA orden con un UPDATE por `order_id`: no elige entre filas de tiendas distintas y la agregacion, que si separa por canal, recalcula sola por su ventana rodante' },

  // ── recurring-orders ────────────────────────────────────────────────────────
  'subscribers/recurring-order-placed': { state: 'scoped' },

  // ── typesense ───────────────────────────────────────────────────────────────
  // Las seis encolan reindex contra el cluster UNICO. Misma razon escrita que
  // `admin/typesense/sync`: la conexion y el indexado no tienen eje de tienda ni
  // aunque las colecciones se separen.
  'subscribers/product-category-typesense-sync': { state: 'not-applicable', reason: 'resuelve el subarbol de la categoria tocada y encola sus productos hacia el cluster unico de Typesense; el subarbol es del catalogo de la instalacion' },
  'subscribers/product-collection-typesense-sync': { state: 'not-applicable', reason: 'encola los productos de la coleccion tocada hacia el cluster unico de Typesense; `product_collection` es del catalogo de la instalacion y no tiene columna de canal' },
  'subscribers/product-created-typesense-sync': { state: 'not-applicable', reason: 'encola el producto recien creado hacia el cluster unico de Typesense; el documento se arma por producto y el eje por tienda, si algun dia existe, seria de la COLECCION y no del encolado' },
  'subscribers/product-deleted-typesense-sync': { state: 'not-applicable', reason: 'borra el documento del producto del cluster unico de Typesense por su id; un producto borrado no esta en ninguna tienda' },
  'subscribers/product-updated-typesense-sync': { state: 'not-applicable', reason: 'encola el producto editado hacia el cluster unico de Typesense; mismo alcance que el de creacion' },
  'subscribers/product-variant-typesense-sync': { state: 'not-applicable', reason: 'resuelve el `product_id` de la variante editada y encola el producto padre hacia el cluster unico de Typesense; existe porque en Medusa v2 el precio base no emite `product.updated`' },

  // ── usuarios del backoffice ─────────────────────────────────────────────────
  'subscribers/invite-email': { state: 'not-applicable', reason: 'invita a un `user` del backoffice, no a un cliente: el link se arma con `BACKEND_URL` (un admin por instalacion) y `invite`/`user` son tablas del core sin columna de tienda — quien despues limita lo que ese usuario ve es el selector de tienda, no la invitacion' },
};
