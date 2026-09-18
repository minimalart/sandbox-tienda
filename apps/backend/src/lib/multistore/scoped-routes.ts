/**
 * Qué rutas de `/admin/*` respetan la tienda activa, y cuáles todavía no.
 *
 * Existe para que la deuda deje de ser invisible. Sin este registro, "el admin es
 * multitienda" es una afirmación que nadie puede verificar y que el badge del
 * backoffice ya estaba haciendo sin respaldo.
 *
 * Los tres estados no son grados de lo mismo:
 *
 *   scoped          sus GET filtran por tienda Y sus mutaciones guardan con ella.
 *                   Media migración —el listado filtra, el POST crea global— es PEOR
 *                   que ninguna: el operador ve una lista de su tienda y crea un
 *                   registro que aparece en todas.
 *   not-applicable  no tiene eje de tienda posible, y nunca lo va a tener. Va con
 *                   razón escrita. Si estas fueran `pending`, el contador de deuda
 *                   no bajaría nunca y el ratchet perdería sentido.
 *   pending         todavía no filtra. Devuelve datos de todas las tiendas.
 *
 * Lo vigila `src/api/admin-site-scope.test.ts`: una ruta admin nueva sin entrada acá
 * deja el build en rojo, y una marcada `scoped` que no invoque `siteFromRequest`
 * también. El contador `MAX_PENDING` de ese test se baja a mano en cada PR de
 * migración; no puede subir.
 *
 * IMPORTANTE sobre qué significa "filtrado por tienda": el eje real que se filtra es
 * el SALES CHANNEL, porque es lo que los modelos guardan. `SiteRef.channel_ids` es
 * una traducción con pérdida en las dos direcciones — un canal creado a mano no
 * pertenece a ninguna tienda, y una tienda con `source_type: 'sales_channel'` ADOPTA
 * un canal preexistente que puede estar compartido. Hasta que los modelos tengan una
 * columna de tienda propia, `scoped` significa "filtrado por los canales que esa
 * tienda posee", que no es exactamente lo mismo que aislamiento.
 */

export type RouteScopeState =
  | { state: 'scoped' }
  | { state: 'not-applicable'; reason: string }
  | { state: 'pending'; reason?: string };

/** Clave: la ruta relativa a `src/api`, sin `route.ts`. Ej: `admin/banners/[id]`. */
export const ADMIN_ROUTE_SCOPE: Record<string, RouteScopeState> = {
  'admin/sites/slug-availability': { state: 'not-applicable', reason: 'disponibilidad global del subdominio en el registro; no devuelve datos de tiendas' },
  'admin/marketing-privacy/clarity': { state: 'scoped' },
  'admin/marketing-privacy/merchant': { state: 'scoped' },
  'admin/catalog-imports': { state: 'scoped' },
  'admin/sites/[id]/checkout': { state: 'scoped' },
  'admin/sites/checkout-context': {
    state: 'not-applicable',
    reason:
      'server-only cart context binding; resolves requested site and validates its channel before an immutable binding',
  },
  'admin/orders/[id]/checkout': { state: 'scoped' },

  // ── multistore ──────────────────────────────────────────────────
  'admin/multistore/manifest': {
    state: 'not-applicable',
    reason: 'publica el estado del propio scoping; es de la instancia',
  },

  // abandoned-carts — routes moved to @minimalart/mercatto-plugin-abandoned-cart.
  // GET y POST resuelven la tienda con `siteFromRequest` y la propagan al
  // resolver: se lee y se escribe la MISMA capa (`siteScopeIdOf` es la
  // contraparte de `siteKindOf`). Los descriptores `scope: 'instance'` siguen
  // yendo a la fila global a propósito — no todo ajuste tiene eje de tienda, y
  // eso lo declara el descriptor, no la ruta.
  'admin/app-settings': { state: 'scoped' },

  // ── ai-assistant ────────────────────────────────────────────────
  'admin/ai-assistant/agents': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/draft-agent': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda — devuelve un borrador de agente y no persiste nada',
  },
  'admin/ai-assistant/memory/search': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda — la memoria vive bajo un tenant unico (`default`)',
  },
  'admin/ai-assistant/proposals/generate': {
    state: 'not-applicable',
    reason:
      'registro de ejecucion del asistente sobre la instancia; su eje es la corrida, no la tienda',
  },
  'admin/ai-assistant/agents/[id]': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/agents/[id]/documents': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/keys': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/mcp-servers': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/mcp-servers/[id]': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/memory': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/memory/[id]': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/proposals': {
    state: 'not-applicable',
    reason:
      'registro de ejecucion del asistente sobre la instancia; su eje es la corrida, no la tienda',
  },
  'admin/ai-assistant/proposals/[id]': {
    state: 'not-applicable',
    reason:
      'registro de ejecucion del asistente sobre la instancia; su eje es la corrida, no la tienda',
  },
  'admin/ai-assistant/runs': {
    state: 'not-applicable',
    reason:
      'registro de ejecucion del asistente sobre la instancia; su eje es la corrida, no la tienda',
  },
  'admin/ai-assistant/runs/[id]': {
    state: 'not-applicable',
    reason:
      'registro de ejecucion del asistente sobre la instancia; su eje es la corrida, no la tienda',
  },
  'admin/ai-assistant/skills': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/skills/[id]': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/threads': {
    state: 'not-applicable',
    reason:
      'herramienta interna del operador: el hilo ya esta acotado por created_by, que es el eje correcto para algo personal — la tienda no aplica',
  },
  'admin/ai-assistant/threads/[id]': {
    state: 'not-applicable',
    reason:
      'herramienta interna del operador: el hilo ya esta acotado por created_by, que es el eje correcto para algo personal — la tienda no aplica',
  },
  'admin/ai-assistant/threads/[id]/campaign': {
    state: 'not-applicable',
    reason:
      'herramienta interna del operador: el hilo ya esta acotado por created_by, que es el eje correcto para algo personal — la tienda no aplica',
  },
  'admin/ai-assistant/tools': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/workflows': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/workflows/[id]': {
    state: 'not-applicable',
    reason:
      'configuracion del propio asistente (agentes, skills, tools, MCP): opera sobre la instancia entera, no sobre una tienda',
  },
  'admin/ai-assistant/workflows/runs': {
    state: 'not-applicable',
    reason:
      'registro de ejecucion del asistente sobre la instancia; su eje es la corrida, no la tienda',
  },
  'admin/ai-assistant/workflows/runs/[runId]': {
    state: 'not-applicable',
    reason:
      'registro de ejecucion del asistente sobre la instancia; su eje es la corrida, no la tienda',
  },

  // ── andreani ────────────────────────────────────────────────────
  'admin/andreani/boxes': {
    state: 'not-applicable',
    reason: 'catalogo de bultos del contrato con el carrier: es del contrato, no de una tienda',
  },
  'admin/andreani/fulfillments': { state: 'scoped' },
  'admin/andreani/labels': {
    state: 'not-applicable',
    reason:
      'proxy al rotulo que emite Andreani por label_url/shipment_id/tracking; el dato es del carrier — mismo alcance que labels/[id]',
  },
  // Los DOS bulks pasaron de invisibles a `scoped` en el repaso del punto ciego:
  // tienen verbo de mutacion, no tienen GET y no tienen ningun `[param]`, asi que
  // ninguno de los tres ratchets los miraba. `labels/bulk` prometia en su cabecera
  // "misma logica que el listado" y no pasaba `site_channel_ids`: el ZIP salia con
  // los envios de TODAS las tiendas. `tickets/bulk` es peor porque escribe afuera:
  // crea envios REALES y facturables con los `order_ids` del body.
  'admin/andreani/labels/bulk': { state: 'scoped' },
  'admin/andreani/labels/[id]': {
    state: 'not-applicable',
    reason: 'proxy al rotulo que emite Andreani por shipment_id; el dato es del carrier',
  },
  'admin/andreani/tickets/bulk': { state: 'scoped' },
  'admin/andreani/tracking/[tracking_number]': {
    state: 'not-applicable',
    reason: 'proxy al tracking de Andreani; el dato es del carrier, no nuestro',
  },

  // ── banners ─────────────────────────────────────────────────────
  // Las tres de IA generan para un banner que ES de la tienda activa, asi que
  // tienen que generar con la config de IA de ESA tienda: `getAiConfig()` sin
  // tienda devuelve la fila GLOBAL y el modelo elegido en la pantalla propia no se
  // aplicaba nunca. Es la clase de error que no se ve: sale un texto igual.
  'admin/banners/ai-compose': { state: 'scoped' },
  'admin/banners/ai-generate': { state: 'scoped' },
  'admin/banners/ai-image': { state: 'scoped' },
  'admin/banners': { state: 'scoped' },
  'admin/banners/[id]': { state: 'scoped' },

  // ── blog-categories ─────────────────────────────────────────────
  'admin/blog-categories': { state: 'scoped' },
  'admin/blog-categories/[id]': { state: 'scoped' },

  // ── blog-posts ──────────────────────────────────────────────────
  'admin/blog-posts': { state: 'scoped' },
  'admin/blog-posts/[id]': { state: 'scoped' },
  'admin/blog-posts/[id]/products': { state: 'scoped' },

  // ── blog-settings ───────────────────────────────────────────────
  'admin/blog-settings': { state: 'scoped' },

  // ── brands ──────────────────────────────────────────────────────
  'admin/brands': { state: 'scoped' },
  'admin/brands/[brand_id]': { state: 'scoped' },
  'admin/brands/[brand_id]/images': { state: 'scoped' },
  'admin/brands/[brand_id]/products': { state: 'scoped' },
  // Las DOS puntas de la fila que escribe tenian eje y ninguna guard: `brand_handle`
  // y `product_handle` son claves adivinables (salen del storefront), asi que una
  // planilla pegada en la tienda B reasignaba la marca de un producto de la A —y
  // antes le borraba los links previos—.
  'admin/brands/bulk': { state: 'scoped' },
  'admin/brands/export': { state: 'scoped' },

  // ── catalogador ─────────────────────────────────────────────────
  'admin/catalogador/config': { state: 'scoped' },
  'admin/catalogador/executions': { state: 'scoped' },
  'admin/catalogador/executions/[id]': { state: 'scoped' },
  // El paso 1 elige sobre que productos corre todo lo demas: su conteo es la
  // promesa de la corrida. Contaba el catalogo de la instalacion entera mientras
  // `executions` filtraba.
  'admin/catalogador/selection/preview': { state: 'scoped' },

  // ── checkout-links ──────────────────────────────────────────────
  'admin/checkout-links': { state: 'scoped' },
  'admin/checkout-links/[id]': { state: 'scoped' },

  // ── bundles ─────────────────────────────────────────────────────
  // Un Bundle puede estar linkeado a VARIAS Stores a la vez (many-to-many con
  // demo_store, ver src/links/bundle-demo-store.ts). Por eso el listado no
  // filtra por site: el operador ve todos los bundles y usa el filtro opcional
  // ?store_id= para acotar. La disponibilidad efectiva por Store se enforcea
  // en las rutas /store/bundles y en el confirmBundleWorkflow.
  'admin/bundles': {
    state: 'not-applicable',
    reason:
      'un bundle puede estar linkeado a muchas demo_store a la vez (m2m); el listado ' +
      'no filtra por site — el scoping vive en /store/bundles y en el workflow de confirm',
  },
  'admin/bundles/[id]': {
    state: 'not-applicable',
    reason:
      'detalle/update de un bundle; sus stores linkeadas se expanden en la respuesta ' +
      'para el editor, y las mutaciones de composición se validan al publicar',
  },

  // comments — routes moved to @minimalart/mercatto-plugin-comments.

  // ── commerce-dashboard ──────────────────────────────────────────
  // Moved to @minimalart/mercatto-plugin-commerce-dashboard. The plugin registers
  // /admin/commerce-dashboard, /aggregate and /seed-orders under its own scope
  // rules (all `unscoped` today; the plugin does its own site inference from the
  // active demo store when demo_store is present).

  // ── companies ───────────────────────────────────────────────────
  'admin/companies': { state: 'scoped' },
  'admin/companies/[id]': { state: 'scoped' },
  'admin/companies/[id]/credit': { state: 'scoped' },
  'admin/companies/[id]/credit/transactions': { state: 'scoped' },
  'admin/companies/[id]/members': { state: 'scoped' },

  // ── contact-submissions ─────────────────────────────────────────
  'admin/contact-submissions': { state: 'scoped' },

  // ── corporates ──────────────────────────────────────────────────
  'admin/corporates': { state: 'scoped' },
  'admin/corporates/[id]': { state: 'scoped' },
  'admin/corporates/[id]/activity': { state: 'scoped' },
  'admin/corporates/[id]/members': { state: 'scoped' },
  'admin/corporates/[id]/rules': { state: 'scoped' },

  // ── correo-argentino ────────────────────────────────────────────
  'admin/correo-argentino/fulfillments': { state: 'scoped' },
  // Dejo de ser `not-applicable` con la migracion a `app-settings`: la cuenta y el
  // acuerdo de Correo son POR TIENDA (`site_setting` + `site_credential`), asi que
  // "esta configurado" tiene una respuesta distinta por tienda. El reporte se arma
  // con `getStates` para la tienda de la request y la sonda construye sus clientes
  // con `getCorreoClientsForSite` para esa misma tienda: si una mitad mirara la
  // instancia, el health check se contradiria solo.
  'admin/correo-argentino/health': { state: 'scoped' },
  'admin/correo-argentino/labels': {
    state: 'not-applicable',
    reason:
      'proxy al rotulo que emite Correo Argentino por tracking number; el dato es del carrier — mismo alcance que labels/[id]',
  },
  // Los dos bulks, igual que en Andreani: `labels/bulk` seleccionaba fulfillments de
  // todas las tiendas aunque la tabla que el operador miro estuviera filtrada, y
  // `tickets/bulk` creaba envios facturables con `order_ids` del body sin chequear
  // de quien son. Los dos entraron por el punto ciego: mutan, no tienen GET y no
  // tienen `[param]`.
  'admin/correo-argentino/labels/bulk': { state: 'scoped' },
  'admin/correo-argentino/labels/[id]': {
    state: 'not-applicable',
    reason: 'proxy al rotulo que emite Correo Argentino; el dato es del carrier',
  },
  'admin/correo-argentino/tickets/bulk': { state: 'scoped' },
  'admin/correo-argentino/tracking/[tracking_number]': {
    state: 'not-applicable',
    reason: 'proxy al tracking de Correo Argentino; el dato es del carrier',
  },

  // ── customers ───────────────────────────────────────────────────
  'admin/customers/[id]/billing-profiles': {
    state: 'not-applicable',
    reason: 'los customers de Medusa no tienen ningún eje de canal ni de región',
  },

  // ── database-explorer ───────────────────────────────────────────
  // Moved to @minimalart/mercatto-plugin-database-explorer. The plugin owns
  // all /admin/database-explorer/* routes; all remain not-applicable by design.

  // ── debug ───────────────────────────────────────────────────────
  'admin/debug/heap-snapshot': {
    state: 'not-applicable',
    reason:
      'volca el heap del PROCESO de Node y lo sube a Spaces; su eje es el contenedor, no la tienda — ademas esta apagada salvo que exista DEBUG_HEAP_TOKEN',
  },

  // ── delivery ────────────────────────────────────────────────────
  'admin/delivery/analytics': { state: 'scoped' },
  'admin/delivery/coverages-overview': { state: 'scoped' },
  'admin/delivery/drivers': { state: 'scoped' },
  'admin/delivery/drivers/[id]': { state: 'scoped' },
  'admin/delivery/drivers/[id]/shifts': { state: 'scoped' },
  'admin/delivery/executions': { state: 'scoped' },
  'admin/delivery/executions/[id]': { state: 'scoped' },
  'admin/delivery/executions/[id]/eligible-resources': { state: 'scoped' },
  'admin/delivery/executions/[id]/events': { state: 'scoped' },
  'admin/delivery/executions/[id]/proofs': { state: 'scoped' },
  'admin/delivery/routes': { state: 'scoped' },
  // La gemela de `executions/[id]/auto-assign` —la que se escapo del primer
  // ratchet— con el id en el BODY en vez del path: crea rutas, cuelga paradas y le
  // setea `route_id` a las ejecuciones de la sucursal que le digan. Por venir en el
  // body no la miraba ninguno de los tres.
  'admin/delivery/routes/auto-build': { state: 'scoped' },
  'admin/delivery/routes/[id]': { state: 'scoped' },
  'admin/delivery/rules': { state: 'scoped' },
  'admin/delivery/rules/[id]': { state: 'scoped' },
  'admin/delivery/vehicles': { state: 'scoped' },
  'admin/delivery/vehicles/[id]': { state: 'scoped' },
  'admin/delivery/zones': { state: 'scoped' },
  'admin/delivery/zones/[id]': { state: 'scoped' },
  'admin/delivery/zones/[id]/resources': { state: 'scoped' },
  'admin/delivery/zones/conflicts': { state: 'scoped' },

  // ── dynamic-groups ──────────────────────────────────────────────
  // Dynamic groups — routes moved to @minimalart/mercatto-plugin-dynamic-groups.

  // ── email-templates ─────────────────────────────────────────────
  // El eje NO se toma del request: sale de la ORDEN. El GET lee su sucursal
  // elegida y el POST manda el `sales_channel_id` de esa orden en la
  // notificación, así que un admin de otra tienda que forzara el id igual
  // dispararía el mail con el branding de la tienda DUEÑA del pedido, no de la
  // suya. Por eso `scoped` y no `not-applicable`.
  'admin/orders/[id]/ready-for-pickup': { state: 'scoped' },
  'admin/email-templates': { state: 'scoped' },
  'admin/email-templates/[id]': { state: 'scoped' },
  // Los envíos REALES de la plantilla. Doble eje, porque hacen falta los dos:
  // `assertIdInSite` sobre la fila (lo mismo que `preview` y `test-send`) y, además,
  // atribución por tienda de cada `notification` — la tabla no tiene columna de
  // tienda y el descriptor de la plantilla es `empty: 'all'`, así que la GLOBAL se ve
  // desde todas y sin el segundo filtro entregaría los mails de los clientes de otra.
  'admin/email-templates/[id]/sends': { state: 'scoped' },

  // ── price-lists ─────────────────────────────────────────────────
  'admin/price-lists/[id]/sales-channel-rule': {
    state: 'not-applicable',
    reason:
      'price lists are global to the Medusa instance and not scoped to a site; the rule assigns one or more sales channels to a price list for channel-scoped pricing — the eje is the price list, not the active site',
  },

  // ── erp ─────────────────────────────────────────────────────────
  'admin/erp/catalog-sync/run': {
    state: 'not-applicable',
    reason: 'corridas de sincronizacion contra el ERP unico de la instancia',
  },
  'admin/erp/config/lookups': {
    state: 'not-applicable',
    reason:
      'Consulta los códigos de la cuenta ERP única de la instalación mediante getConfig; no consulta recursos de una tienda.',
  },
  'admin/erp/config': {
    state: 'not-applicable',
    reason: 'conexion al ERP de la empresa: es un sistema por instalacion, no por tienda',
  },
  'admin/erp/config/reset-image-failures': {
    state: 'not-applicable',
    reason:
      'Limpia el mapa de fallas de bajada de imagenes del ERP unico de la instalacion; no toca datos de una tienda.',
  },
  'admin/erp/invoices/[id]/download': {
    state: 'not-applicable',
    reason:
      'comprobante emitido por el ERP unico de la instancia; el eje es la orden, no la tienda',
  },
  'admin/erp/orders/[id]': {
    state: 'not-applicable',
    reason:
      'estado de facturacion de UNA orden en el ERP unico de la instancia; el eje es la orden',
  },
  'admin/erp/outbox-events': {
    state: 'not-applicable',
    reason: 'cola de salida hacia el ERP unico de la instancia',
  },
  'admin/erp/outbox-events/[id]/preview': {
    state: 'not-applicable',
    reason:
      'documento de UNA venta de esa misma cola hacia el ERP unico de la instancia; solo lectura, el eje es el evento',
  },
  'admin/erp/outbox-events/resync': {
    state: 'not-applicable',
    reason:
      'reenvia ventas de esa misma cola al ERP unico de la instancia; opera sobre erp_outbox_event y la configuracion que resuelve getConfig(), que son por instalacion y no por tienda',
  },
  'admin/erp/unregistered-orders': {
    state: 'not-applicable',
    reason:
      'ordenes que faltan en esa misma cola del ERP unico de la instancia; el cruce es contra erp_outbox_event y el trigger de getConfig(), que son por instalacion',
  },
  'admin/erp/price-lists': {
    state: 'not-applicable',
    reason: 'listas de precios que vienen del ERP unico de la instancia',
  },
  'admin/erp/sync-logs': {
    state: 'not-applicable',
    reason: 'corridas de sincronizacion contra el ERP unico de la instancia',
  },
  'admin/erp/sync-logs/[id]': { state: 'not-applicable', reason: 'idem sync-logs' },
  'admin/erp/stock-sync/run': {
    state: 'not-applicable',
    reason: 'corridas de sincronizacion contra el ERP unico de la instancia',
  },
  'admin/erp/sync-logs/[id]/items': { state: 'not-applicable', reason: 'idem sync-logs' },
  'admin/erp/tinting': {
    state: 'not-applicable',
    reason: 'configuracion de tintometria del ERP unico de la instancia',
  },
  'admin/erp/tinting/bases/confirm': {
    state: 'not-applicable',
    reason:
      'configuracion de tintometria del ERP unico de la instancia: la data maestra (bases, cartas, formulas) viene del fabricante y es la misma para toda la instalacion',
  },
  'admin/erp/tinting/bases/detect': {
    state: 'not-applicable',
    reason:
      'configuracion de tintometria del ERP unico de la instancia: la data maestra (bases, cartas, formulas) viene del fabricante y es la misma para toda la instalacion',
  },
  // La UNICA del subarbol de tintometria con eje de tienda de verdad, y por eso no
  // hereda el `not-applicable` de sus hermanas: da de alta PRODUCTOS y elige en que
  // canales se publican con un `sales_channel_ids` que llega del body. Se valida,
  // NO se sobrescribe: un `siteDefaults` acá convertiria en silencio un alta
  // multi-canal deliberada en una de un solo canal.
  'admin/erp/tinting/bases/sync-products': { state: 'scoped' },
  'admin/erp/tinting/colors': {
    state: 'not-applicable',
    reason:
      'configuracion de tintometria del ERP unico de la instancia: la data maestra (bases, cartas, formulas) viene del fabricante y es la misma para toda la instalacion',
  },
  'admin/erp/tinting/formulas': {
    state: 'not-applicable',
    reason:
      'configuracion de tintometria del ERP unico de la instancia: la data maestra (bases, cartas, formulas) viene del fabricante y es la misma para toda la instalacion',
  },
  'admin/erp/tinting/import': {
    state: 'not-applicable',
    reason:
      'configuracion de tintometria del ERP unico de la instancia: la data maestra (bases, cartas, formulas) viene del fabricante y es la misma para toda la instalacion',
  },
  'admin/erp/tinting/price-probe': {
    state: 'not-applicable',
    reason:
      'sonda de precio contra el ERP unico de la instancia: pregunta cuanto sale entonar un articulo, no escribe nada propio',
  },
  'admin/erp/validate-connection': {
    state: 'not-applicable',
    reason:
      'prueba las credenciales del ERP unico de la instancia y anota el resultado en su config; no hay credencial de ERP por tienda',
  },

  // ── fiscal-documents ────────────────────────────────────────────
  'admin/fiscal-documents': { state: 'scoped' },
  'admin/fiscal-documents/[id]': { state: 'scoped' },
  'admin/fiscal-documents/[id]/diff': { state: 'scoped' },
  'admin/fiscal-documents/[id]/download': { state: 'scoped' },
  'admin/fiscal-documents/config': { state: 'scoped' },

  // ga4 — routes moved to @minimalart/mercatto-plugin-ga4.

  // ── gift-card-experience ────────────────────────────────────────
  'admin/gift-card-experience/analytics': { state: 'scoped' },
  'admin/gift-card-experience/deliveries': { state: 'scoped' },
  'admin/gift-card-experience/deliveries/[id]': { state: 'scoped' },
  'admin/gift-card-experience/designs': { state: 'scoped' },
  'admin/gift-card-experience/permissions': {
    state: 'not-applicable',
    reason:
      'devuelve los permisos del USUARIO admin autenticado (actor_id): su eje es el actor, no la tienda — el mismo criterio por el que los hilos del asistente van por created_by',
  },
  'admin/gift-card-experience/settings': { state: 'scoped' },

  // ── kapso ───────────────────────────────────────────────────────
  'admin/kapso/bindings': { state: 'scoped' },
  'admin/kapso/bot-channels': { state: 'scoped' },
  'admin/kapso/floating-button': { state: 'scoped' },
  'admin/kapso/inbox-embed': {
    state: 'not-applicable',
    reason:
      'la config del bot y las credenciales YA son por tienda; templates lista las plantillas aprobadas en la WABA del proveedor (dato de Kapso, no nuestro) e inbox-embed es el iframe de su bandeja',
  },
  'admin/kapso/templates': {
    state: 'not-applicable',
    reason:
      'la config del bot y las credenciales YA son por tienda; templates lista las plantillas aprobadas en la WABA del proveedor (dato de Kapso, no nuestro) e inbox-embed es el iframe de su bandeja',
  },

  // ── landing-pages ───────────────────────────────────────────────
  'admin/landing-pages': { state: 'scoped' },
  'admin/landing-pages/[id]': { state: 'scoped' },

  // ── loyalty ─────────────────────────────────────────────────────
  'admin/loyalty/campaigns': { state: 'scoped' },
  'admin/loyalty/customers/[id]': {
    state: 'not-applicable',
    reason:
      'points_account tiene UNA cuenta por cliente en toda la instancia, y es deliberado: partir el saldo por tienda dividiria en dos el de un cliente que ya compro en las dos, y esa plata es del cliente. Lo que si tiene tienda son los MOVIMIENTOS, que ya filtran',
  },
  'admin/loyalty/dashboard': { state: 'scoped' },
  'admin/loyalty/grants': { state: 'scoped' },
  'admin/loyalty/movements': { state: 'scoped' },
  'admin/loyalty/programs': { state: 'scoped' },
  'admin/loyalty/programs/[id]': { state: 'scoped' },
  'admin/loyalty/rewards': { state: 'scoped' },
  'admin/loyalty/rewards/[id]': { state: 'scoped' },
  'admin/loyalty/rules': { state: 'scoped' },
  'admin/loyalty/rules/[id]': { state: 'scoped' },
  'admin/loyalty/tiers': { state: 'scoped' },

  // ── maintenance ─────────────────────────────────────────────────
  'admin/maintenance/carrefour-backfill': {
    state: 'not-applicable',
    reason: 'operación de la instancia',
  },

  // ── media-library ───────────────────────────────────────────────
  // media-library — routes moved to @minimalart/mercatto-plugin-media-library.

  // ── newsletter-subscriptions ────────────────────────────────────
  // GET con `siteFilter` en el WHERE; el reintento corre `assertRowInSite` y
  // resuelve la cuenta de Brevo con el `site_id` DE LA FILA, no con la tienda
  // activa de la pantalla.
  'admin/newsletter-subscriptions': { state: 'scoped' },

  // ── payment-benefits ────────────────────────────────────────────
  'admin/payment-benefits': { state: 'scoped' },
  'admin/payment-benefits/[id]': { state: 'scoped' },
  'admin/payment-benefits/catalog': { state: 'scoped' },
  'admin/payment-benefits/dashboard': { state: 'scoped' },

  // pdf-catalogs — routes moved to @minimalart/mercatto-plugin-pdf-catalog.

  // ── product-sales-modes ─────────────────────────────────────────
  // El modo de venta de un producto es POR TIENDA: la ruta resuelve la tienda
  // con `siteFromRequest` y acepta un `site_id` explícito (el widget del
  // producto recorre todas). Sin tienda resuelta no devuelve nada: 400.
  // Ver PRD Bundles V2 §5-§11.
  'admin/product-sales-modes': { state: 'scoped' },

  // ── platform ────────────────────────────────────────────────────
  'admin/platform/catalog': {
    state: 'not-applicable',
    reason:
      'registro del proyecto contra la plataforma Mercatto: es de la instancia, no de una tienda',
  },
  'admin/platform/change-requests': {
    state: 'not-applicable',
    reason:
      'registro del proyecto contra la plataforma Mercatto: es de la instancia, no de una tienda',
  },
  'admin/platform/extensions': {
    state: 'not-applicable',
    reason:
      'registro del proyecto contra la plataforma Mercatto: es de la instancia, no de una tienda',
  },

  // ── recommendations ─────────────────────────────────────────────
  // Las tres corridas del motor agregan/recomputan POR canal para toda la
  // instalacion y son idempotentes; las lecturas hermanas (`performance`,
  // `versions`) ya filtran. `seed` crea las estrategias y placements por defecto
  // SIN canal a proposito: `NULL` = global, que es lo que el descriptor declara.
  'admin/recommendations/aggregate': {
    state: 'not-applicable',
    reason:
      'recomputo de metricas agregadas POR canal para toda la instalacion; idempotente y la lectura (performance) ya filtra',
  },
  'admin/recommendations/config': { state: 'scoped' },
  'admin/recommendations/performance': { state: 'scoped' },
  'admin/recommendations/placements': { state: 'scoped' },
  'admin/recommendations/placements/[id]': { state: 'scoped' },
  // Resolvia la cadena GLOBAL (`sales_channel_id: null`) mientras el archivo
  // promete "lo que se ve aca es el comportamiento real y no una simulacion": el
  // merchant ajustaba su placement contra un resultado que su comprador no ve.
  'admin/recommendations/preview': { state: 'scoped' },
  'admin/recommendations/products': { state: 'scoped' },
  'admin/recommendations/rebuild': {
    state: 'not-applicable',
    reason:
      'encola corridas del motor de recomputo, que trabaja sobre el catalogo de la instalacion; el drenador es unico y la corrida no tiene eje de tienda',
  },
  'admin/recommendations/relations': { state: 'scoped' },
  'admin/recommendations/relations/bulk': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: crear la relacion SIN canal —global, visible en todas las tiendas— es una decision deliberada y ESCRITA, no un olvido: esta en la cabecera de `RECOMMENDATION_RELATION_SITE_SCOPE` ("el POST hermano, que NO fuerza canal: una relacion creada sin canal nace global a proposito") y la comparte el POST singular de `admin/recommendations/relations`, que tampoco aplica `siteDefaults`. Ponerle el eje SOLO al bulk seria peor que dejarlo: la MISMA accion crearia global desde el form y de la tienda desde la carga masiva, y el operador no tendria como saber cual hizo cual. Se cierra decidiendo para las dos a la vez —y entonces tambien hay que decidir que pasa con las relaciones globales que ya existen—, que es una decision de producto y no de codigo',
  },
  'admin/recommendations/seed': {
    state: 'not-applicable',
    reason:
      'siembra las estrategias y placements por defecto SIN canal (NULL = todas las tiendas, que es lo que el descriptor declara con empty: all); es idempotente y no pisa lo que el merchant ya configuro',
  },
  'admin/recommendations/strategies': { state: 'scoped' },
  'admin/recommendations/strategies/[id]': { state: 'scoped' },
  'admin/recommendations/versions': { state: 'scoped' },

  // ── recurring-orders ────────────────────────────────────────────
  'admin/recurring-orders': { state: 'scoped' },
  'admin/recurring-orders/[id]': { state: 'scoped' },
  'admin/recurring-orders/alerts': { state: 'scoped' },
  'admin/recurring-orders/analytics': { state: 'scoped' },
  'admin/recurring-orders/analytics/rebuild': {
    state: 'not-applicable',
    reason:
      'recomputa los snapshots por (fecha, canal) para TODOS los canales de una vez, mas la fila agregada global; es idempotente y la lectura hermana ya filtra por la tienda',
  },
  'admin/recurring-orders/cancellation-reasons': { state: 'scoped' },
  'admin/recurring-orders/cycles': { state: 'scoped' },
  'admin/recurring-orders/export': { state: 'scoped' },
  'admin/recurring-orders/forecast': { state: 'scoped' },
  'admin/recurring-orders/offers': { state: 'scoped' },
  'admin/recurring-orders/plans': { state: 'scoped' },
  'admin/recurring-orders/plans/[plan_id]': { state: 'scoped' },
  'admin/recurring-orders/settings': { state: 'scoped' },

  // ── branch-types ────────────────────────────────────────────────
  'admin/branch-types': {
    state: 'not-applicable',
    reason:
      'devuelve los tipos de sucursal de las tiendas de los canales que le pasan; el scope es esa lista de canales, no la tienda activa, porque una sucursal puede estar publicada en varias',
  },

  // ── sales-channels-b2c ──────────────────────────────────────────
  'admin/sales-channels-b2c': {
    state: 'not-applicable',
    reason: 'lista los canales; es la fuente que alimenta al propio selector',
  },

  // ── seo-geo ─────────────────────────────────────────────────────
  'admin/seo-geo/ai-visibility': { state: 'scoped' },
  'admin/seo-geo/audits': { state: 'scoped' },
  'admin/seo-geo/audits/[id]': { state: 'scoped' },
  'admin/seo-geo/config': { state: 'scoped' },
  // Las dos de correcciones reciben `product_id` por BODY: `corrections` genera la
  // propuesta y `corrections/apply` PISA titulo, subtitulo y descripcion del
  // producto. La puerta es la misma que la de un `[id]` —alcanza con saber el id—
  // solo que entra por otro lado, y por eso ningun ratchet las miraba.
  'admin/seo-geo/corrections': { state: 'scoped' },
  'admin/seo-geo/corrections/apply': { state: 'scoped' },
  'admin/seo-geo/dashboard': { state: 'scoped' },
  'admin/seo-geo/findings': { state: 'scoped' },
  'admin/seo-geo/keywords': { state: 'scoped' },
  // Las TRES mitades tenian eje y ninguna lo aplicaba: la config (umbral, top_k),
  // el embed del catalogo y —la cara— la recuperacion, que rankeaba sobre los
  // embeddings de toda la instalacion y contestaba con productos que la tienda no
  // vende, con id y todo.
  'admin/seo-geo/simulator': { state: 'scoped' },

  // ── shop-by-looks ───────────────────────────────────────────────
  'admin/shop-by-looks': { state: 'scoped' },
  'admin/shop-by-looks/[look_id]': { state: 'scoped' },

  // ── site-credentials ────────────────────────────────────────────
  // Scoped en el sentido fuerte: el GET lista lo de la tienda activa Y el POST/DELETE
  // escriben contra ella. Sin tienda resuelta NO cae a la global: corta con 400.
  'admin/site-credentials': { state: 'scoped' },

  // ── site-templates ──────────────────────────────────────────────
  'admin/site-templates': {
    state: 'not-applicable',
    reason: 'catálogo de plantillas de la instancia',
  },

  // ── sites ───────────────────────────────────────────────────────
  'admin/sites': {
    state: 'not-applicable',
    reason: 'ES el registro de tiendas; scoparlo lo volvería inutilizable',
  },
  'admin/sites/[id]': {
    state: 'not-applicable',
    reason: 'ES el registro de tiendas; scoparlo lo volvería inutilizable',
  },
  'admin/sites/[id]/import-job': {
    state: 'not-applicable',
    reason: 'ES el registro de tiendas; scoparlo lo volvería inutilizable',
  },

  // ── store-config ────────────────────────────────────────────────
  'admin/store-config/ai-config': { state: 'scoped' },
  // `apply` y `plan` NO son config por tienda y el propio archivo lo dice: tocan la
  // moneda soportada del Store de Medusa y la region del pais, que son de la
  // instalacion. La config por tienda es `context`, que si es `scoped`. Ponerles el
  // eje partiria en N el Store unico que Medusa tiene.
  'admin/store-config/commerce/apply': {
    state: 'not-applicable',
    reason:
      'configuracion de comercio de la INSTANCIA: moneda soportada del Store unico de Medusa y region del pais. La region POR tienda la crea provision.ts aparte',
  },
  'admin/store-config/commerce/context': { state: 'scoped' },
  'admin/store-config/commerce/plan': {
    state: 'not-applicable',
    reason: 'el dry-run de commerce/apply: mismo alcance de instancia, y ademas no escribe nada',
  },
  'admin/store-config/email-branding': { state: 'scoped' },
  // GET y POST resuelven la tienda con `siteFromRequest` y el upsert escribe con ella:
  // se lee y se escribe la MISMA capa (la propia, o la global si la tienda no tiene).
  'admin/store-config/legal-pages': { state: 'scoped' },
  'admin/store-config/minimum-purchase': { state: 'scoped' },
  'admin/store-config/settings': { state: 'scoped' },
  'admin/store-config/site-gate': { state: 'scoped' },
  'admin/store-config/storefront-url': { state: 'scoped' },

  // ── store-locations ─────────────────────────────────────────────
  'admin/store-locations': { state: 'scoped' },
  'admin/store-locations/[id]': { state: 'scoped' },
  'admin/store-locations/[id]/branch-config': { state: 'scoped' },
  'admin/store-locations/[id]/coverage': { state: 'scoped' },
  'admin/store-locations/[id]/delivery': { state: 'scoped' },

  // ── typesense ───────────────────────────────────────────────────
  'admin/typesense/analytics': { state: 'scoped' },
  // El eje es la COLECCION de analitica, que `TYPESENSE_SITE_ANALYTICS_COLLECTIONS`
  // separa por tienda — el mismo eje que el GET hermano ya resolvia. `reset` era el
  // peor par posible: desde una secundaria borraba la coleccion GLOBAL (los
  // contadores de la principal) y dejaba la propia intacta.
  'admin/typesense/analytics/init': { state: 'scoped' },
  'admin/typesense/analytics/reset': { state: 'scoped' },
  'admin/typesense/collections': {
    state: 'not-applicable',
    reason:
      'lista TODAS las colecciones del cluster para administrarlas; el eje por tienda lo resuelve collections/default, que ya devuelve la de la tienda activa',
  },
  'admin/typesense/collections/[id]': { state: 'scoped' },
  'admin/typesense/collections/default': { state: 'scoped' },
  'admin/typesense/config': {
    state: 'not-applicable',
    reason:
      'el cluster de Typesense es UNO por instancia: conexion, sonda y job de indexado no tienen eje de tienda ni aunque las colecciones se separen',
  },
  'admin/typesense/curations': { state: 'scoped' },
  'admin/typesense/curations/[id]': { state: 'scoped' },
  'admin/typesense/last-sync': {
    state: 'not-applicable',
    reason:
      'el cluster de Typesense es UNO por instancia: conexion, sonda y job de indexado no tienen eje de tienda ni aunque las colecciones se separen',
  },
  'admin/typesense/presets': {
    state: 'not-applicable',
    reason:
      'en Typesense los stopwords y los presets son del CLUSTER, no de la coleccion: no se pueden separar por tienda ni aunque haya colecciones distintas',
  },
  // Mismo eje que curaciones y sinonimos —la COLECCION, no una fila—: pegaba
  // siempre contra la global, asi que el buscador del backoffice mostraba productos
  // que el storefront de esa tienda no indexa. El `collectionName` explicito del
  // body sigue ganando: esta ruta tambien sirve para inspeccionar una cualquiera
  // del cluster desde la pantalla de colecciones.
  'admin/typesense/search': { state: 'scoped' },
  'admin/typesense/presets/[id]': {
    state: 'not-applicable',
    reason:
      'en Typesense los stopwords y los presets son del CLUSTER, no de la coleccion: no se pueden separar por tienda ni aunque haya colecciones distintas',
  },
  'admin/typesense/stopwords': {
    state: 'not-applicable',
    reason:
      'en Typesense los stopwords y los presets son del CLUSTER, no de la coleccion: no se pueden separar por tienda ni aunque haya colecciones distintas',
  },
  'admin/typesense/stopwords/[id]': {
    state: 'not-applicable',
    reason:
      'en Typesense los stopwords y los presets son del CLUSTER, no de la coleccion: no se pueden separar por tienda ni aunque haya colecciones distintas',
  },
  'admin/typesense/sync': {
    state: 'not-applicable',
    reason:
      'el cluster de Typesense es UNO por instancia: conexion, sonda y job de indexado no tienen eje de tienda ni aunque las colecciones se separen',
  },
  'admin/typesense/sync-logs': {
    state: 'not-applicable',
    reason:
      'el cluster de Typesense es UNO por instancia: conexion, sonda y job de indexado no tienen eje de tienda ni aunque las colecciones se separen',
  },
  'admin/typesense/sync-logs/[id]': {
    state: 'not-applicable',
    reason:
      'el cluster de Typesense es UNO por instancia: conexion, sonda y job de indexado no tienen eje de tienda ni aunque las colecciones se separen',
  },
  'admin/typesense/sync-logs/[id]/items': {
    state: 'not-applicable',
    reason:
      'el cluster de Typesense es UNO por instancia: conexion, sonda y job de indexado no tienen eje de tienda ni aunque las colecciones se separen',
  },
  'admin/typesense/synonyms': { state: 'scoped' },
  'admin/typesense/synonyms/[id]': { state: 'scoped' },
  'admin/typesense/test': {
    state: 'not-applicable',
    reason:
      'el cluster de Typesense es UNO por instancia: conexion, sonda y job de indexado no tienen eje de tienda ni aunque las colecciones se separen',
  },

  // ── videos / vimeo ──────────────────────────────────────────────
  // Routes moved to @minimalart/mercatto-plugin-videos.

  // ── whatsapp-advisor ────────────────────────────────────────────
  'admin/whatsapp-advisor/audit': { state: 'scoped' },
  'admin/whatsapp-advisor/config': { state: 'scoped' },

  // ── whatsapp-analytics ──────────────────────────────────────────
  'admin/whatsapp-analytics': { state: 'scoped' },
  'admin/whatsapp-flows': { state: 'scoped' },
  'admin/whatsapp-flows/publish': { state: 'scoped' },
  'admin/whatsapp-flows/seed': { state: 'scoped' },
  'admin/whatsapp-flows/analytics': { state: 'scoped' },
  'admin/whatsapp-flows/preview-action': { state: 'scoped' },
  'admin/whatsapp-flows/versions/[id]': { state: 'scoped' },
  'admin/whatsapp-sessions': { state: 'scoped' },

  // ── whatsapp-conversations ──────────────────────────────────────
  'admin/whatsapp-conversations': {
    state: 'pending',
    reason:
      'BLOQUEADA POR PRODUCTO: whatsapp_conversation tiene phone UNIQUE en toda la instancia — una conversacion por cliente. Partirla por tienda dividiria el historial de alguien que le escribio a dos, y decidir eso es de producto. Los EVENTOS si filtran (whatsapp-analytics), que es donde esta el embudo',
  },
};
