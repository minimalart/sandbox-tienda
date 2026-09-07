import type { i18n as I18nInstance } from 'i18next';

const CORREO_NAMESPACE = 'correoArgentino';
let registered = false;

export const en = {
  // ── Fulfillment list ──
  TITLE: 'Correo Argentino Shipments',
  SUBTITLE: 'Global list of fulfillments handled by Correo Argentino.',
  REFRESH: 'Refresh',
  SEARCH_PLACEHOLDER: 'Search by order, tracking or agency...',
  FILTER_STATUS: 'Status',
  STATUS_ALL: 'All',
  STATUS_PENDING: 'Pending',
  STATUS_SHIPPED: 'Shipped',
  STATUS_DELIVERED: 'Delivered',
  STATUS_CANCELED: 'Canceled',
  ONLY_TICKETED: 'Only with shipment created',
  PENDING_TICKET_NOTE:
    '{{count}} shipment(s) in this filter have no Correo shipment yet.',
  LOADING_SHIPMENTS: 'Loading shipments...',
  NO_RESULTS: 'No results for "{{search}}"',
  NO_SHIPMENTS: 'No Correo Argentino shipments registered yet.',
  COL_ORDER: 'Order',
  COL_TRACKING: 'Tracking',
  COL_SERVICE: 'Service',
  COL_DELIVERY: 'Delivery',
  COL_STATUS: 'Status',
  COL_DATE: 'Date',
  NO_TRACKING: 'No shipment yet',
  VIEW_TRACKING: 'View tracking',
  LABEL_BUTTON: 'Label',
  SELECTED_COUNT: '{{count}} selected',
  DELIVERY_HOME: 'Home delivery',
  DELIVERY_AGENCY: 'Agency',
  SERVICE_CP: 'CP · Classic',
  SERVICE_EP: 'EP · Express',

  // ── Bulk actions ──
  DOWNLOAD_ALL: 'Download all (filtered)',
  DOWNLOAD_ALL_OK: 'The ZIP with the filtered labels is downloading.',
  DOWNLOAD_ALL_TRUNCATED:
    'The filter matched {{total}} shipments; only the 200 most recent were included.',
  BULK_LABELS: 'Download labels',
  BULK_GENERATE: 'Create shipments',
  BULK_NO_TRACKING:
    'None of the selected rows has a Correo shipment yet. Create the shipments first.',
  BULK_TICKETS_TITLE: 'Bulk shipment creation',
  BULK_TICKETS_TRUNCATED:
    '{{requested}} orders were requested; only the first {{cap}} were processed.',
  BULK_TICKETS_SUMMARY: '{{ok}} created · {{failed}} failed',
  BULK_TICKETS_EXISTING: 'already existed',
  BULK_TICKETS_NEW: 'created',
  BULK_TICKETS_COL_ORDER: 'Order',
  BULK_TICKETS_COL_RESULT: 'Result',
  BULK_TICKETS_DOWNLOAD_LABELS: 'Download the labels that were created',

  // ── Per-item label results ──
  LABELS_TITLE: 'Label download',
  LABELS_SUMMARY_MIXED:
    '{{ok}} of {{total}} labels came back OK. {{failed}} failed.',
  LABELS_SUMMARY_ALL_OK: 'All {{total}} labels came back OK.',
  LABELS_SUMMARY_ALL_FAILED: 'None of the {{total}} labels could be downloaded.',
  LABELS_PARTIAL_NOTE:
    'Correo reports partial failures with HTTP 200, one result per item. The per-item detail is below.',
  LABELS_TRUNCATED:
    '{{requested}} labels were requested; the backend caps the batch at 200.',
  LABELS_COL_TRACKING: 'Tracking',
  LABELS_COL_RESULT: 'Result',
  LABELS_OK: 'OK',
  LABELS_FAILED: 'Failed',
  LABELS_OPEN: 'Open',
  LABELS_DOWNLOAD: 'Download',
  LABELS_DOWNLOAD_OK_ONES: 'Download the {{count}} that came back OK',
  LABEL_ERROR: 'Could not get the label: {{message}}',

  // ── Tracking modal ──
  TRACKING_TITLE: 'Tracking: {{code}}',
  MODAL_ORDER: 'Order',
  MODAL_SERVICE: 'Service',
  MODAL_DELIVERY: 'Delivery type',
  MODAL_AGENCY: 'Agency',
  MODAL_AGREEMENT: 'Agreement',
  MODAL_MEDUSA_STATUS: 'Medusa status',
  LOADING_TRACKING: 'Loading tracking...',
  TRACKING_ERROR: 'Could not get tracking information. Try again.',
  CURRENT_STATUS: 'Current status:',
  NO_HISTORY:
    'The shipment exists but Correo has not registered any movement yet.',
  MOVEMENT_HISTORY: 'Movement history',
  NO_MOVEMENTS: 'No movements registered yet.',
  UNMAPPED_TITLE: 'Codes we could not map ({{count}})',
  UNMAPPED_NOTE:
    'Correo does not publish the full statusId table. These pairs are the ones to add to the normalizer.',
  LAST_UPDATE: 'Last update: {{date}}',
  VIEW_ON_CORREO: 'View on correoargentino.com.ar',
  CLOSE: 'Close',
  BUCKET_PRE_SHIPMENT: 'Pre-shipment',
  BUCKET_ADMITTED: 'Admitted',
  BUCKET_IN_TRANSIT: 'In transit',
  BUCKET_OUT_FOR_DELIVERY: 'Out for delivery',
  BUCKET_DELIVERED: 'Delivered',
  BUCKET_RETURNED: 'Returned',
  BUCKET_CANCELED: 'Canceled',
  BUCKET_FAILED: 'Failed',
  BUCKET_UNKNOWN: 'Unmapped',

  // ── Configuration ──
  CONFIG_TITLE: 'Correo Argentino configuration',
  CONFIG_SUBTITLE:
    'Read-only status of the integration. Values live in environment variables and are not exposed here.',
  // `CONFIG_NO_BOXES_NOTE` y `CONFIG_PROVIDER_HINT` se fueron al drawer de ayuda
  // (`src/admin/help/correo-argentino.ts`): eran texto visible SIEMPRE. Se borran
  // las claves y no sólo el render porque una clave sin consumidor es una promesa
  // de traducción que nadie mantiene — se traduce a dos idiomas y no se ve en
  // ninguno. `CONFIG_PROVIDER_MISSING_HINT` se queda: es la rama de falla.
  CONFIG_PROVIDER_TITLE: 'Provider registration',
  CONFIG_PROVIDER_REGISTERED: 'Registered',
  CONFIG_PROVIDER_MISSING: 'Not registered',
  CONFIG_PROVIDER_MISSING_HINT:
    'The provider does not show up in /admin/fulfillment-providers. Check CORREO_ARGENTINO_API_KEY and that the extension is installed.',
  CONFIG_PROVIDER_ENABLED: 'Enabled',
  CONFIG_PROVIDER_DISABLED: 'Disabled',
  CONFIG_OPTIONS_TITLE: 'Seeded shipping options',
  CONFIG_OPTIONS_EMPTY:
    'No Correo shipping options. Run the seeds (seed-correo-domicilio / seed-correo-sucursal).',
  CONFIG_OPTIONS_COL_NAME: 'Option',
  CONFIG_OPTIONS_COL_ID: 'data.id',
  CONFIG_OPTIONS_COL_SERVICE: 'service_type',
  CONFIG_OPTIONS_COL_DELIVERY: 'delivery_type',
  CONFIG_OPTIONS_COL_PRICE: 'Price',
  CONFIG_OPTIONS_COL_ZONE: 'Zone',
  CONFIG_OPTIONS_MISSING_FIELD: 'missing',
  CONFIG_LOADING: 'Loading status...',

  // ── Configuration state ──
  CONFIG_ENV_TITLE: 'Configuration',
  CONFIG_ENV_NOTE:
    'State only: the backend reports whether each key has an effective value and which layer it comes from, never the value itself.',
  CONFIG_ENV_ERROR: 'Could not read the configuration state: {{message}}',
  CONFIG_ENV_CREDENTIALS_UNREADABLE:
    'This store has its own Correo credentials and they cannot be decrypted (the encryption key was probably rotated). Re-enter them under Settings → Credentials: until then, creating shipments fails.',
  CONFIG_ENV_TARGET: 'Pointing at',
  CONFIG_ENV_TARGET_TEST: 'Test (apitest.correoargentino.com.ar)',
  CONFIG_ENV_TARGET_PROD: 'Production (api.correoargentino.com.ar)',
  CONFIG_ENV_TARGET_CUSTOM: 'Custom host (hostname override)',
  // Solo se muestran cuando paqar y MiCorreo apuntan a ambientes distintos.
  CONFIG_ENV_TARGET_API_PAQAR: 'paqar',
  CONFIG_ENV_TARGET_API_MICORREO: 'MiCorreo',
  CONFIG_ENV_ALL_OK: 'Every key this integration needs has an effective value.',
  CONFIG_ENV_MISSING_REQUIRED:
    'Missing required: {{names}}. Without these paqar cannot authenticate and no shipment can be created.',
  CONFIG_ENV_MISSING_QUOTING:
    'Missing for quoting: {{names}}. Without these MiCorreo cannot quote and every Correo shipment is priced at $0.',
  CONFIG_ENV_MISSING_OPERATING:
    'Missing for operating: {{names}}. The provider starts, but shipment creation goes out with empty or default data.',
  CONFIG_ENV_STATE_OK: 'set',
  CONFIG_ENV_STATE_INVALIDA: 'set but discarded',
  CONFIG_ENV_STATE_AUSENTE: 'not set',
  CONFIG_ENV_INVALID_NOTE:
    'Set but discarded by the module: check the format (the API key must not include the "Apikey " prefix; ext client must be exactly 3 digits).',
  // Which layer the effective value comes from. `off` is not "not set": it is the
  // fail-closed of a secondary store that never declared its own.
  CONFIG_ENV_SOURCE_SITE: 'this store',
  CONFIG_ENV_SOURCE_GLOBAL: 'inherited (instance)',
  CONFIG_ENV_SOURCE_CREDENTIAL: 'store credential',
  CONFIG_ENV_SOURCE_ENV: 'environment file',
  CONFIG_ENV_SOURCE_DEFAULT: 'default',
  CONFIG_ENV_SOURCE_OFF: 'off (not declared for this store)',
  CONFIG_ENV_SOURCE_UNSET: 'nowhere',
  CONFIG_ENV_GROUP_PAQAR: 'paqar — operate',
  CONFIG_ENV_GROUP_MICORREO: 'MiCorreo — quote',
  CONFIG_ENV_GROUP_ORIGEN: 'Origin address',
  CONFIG_ENV_GROUP_REMITENTE: 'Sender',
  CONFIG_ENV_GROUP_PRODUCTO: 'Product and limits',
  CONFIG_ENV_GROUP_FALLBACK: 'Dimension fallback',
  CONFIG_ENV_GROUP_OPERACION: 'Operation',
  CONFIG_ENV_GROUP_SEEDS: 'Seeds',

  // ── Connection test ──
  CONFIG_TEST_TITLE: 'Connection test',
  // `CONFIG_TEST_NOTE` se fue al drawer, misma razón que las dos de arriba.
  CONFIG_TEST_BUTTON: 'Test connection',
  CONFIG_TEST_RUNNING: 'Testing...',
  CONFIG_TEST_NEVER_RUN: 'Not tested yet.',
  CONFIG_TEST_ERROR: 'Could not run the test: {{message}}',
  CONFIG_TEST_AT: 'Last test: {{date}}',
  CONFIG_TEST_PAQAR: 'paqar — orders, labels, tracking',
  CONFIG_TEST_MICORREO: 'MiCorreo — quoting',
  CONFIG_TEST_HTTP: 'HTTP {{status}}',
  CONFIG_TEST_RETRYABLE: 'Retrying may help.',
  CONFIG_TEST_PROBE_DETAIL: 'Probe quote to postal code {{code}}.',
  CONFIG_TEST_ORIGIN_FALLBACK:
    'Quoted from a placeholder origin because CORREO_ARGENTINO_ORIGIN_POSTAL_CODE is not set.',
  CONFIG_TEST_ACCOUNT_NOT_ACTIVATED:
    'MiCorreo authenticates but returns an empty quote: the account is not commercially activated. While it stays this way every Correo shipment is quoted at $0 and the buyer sees "Free" — the shipping cost is paid by the store. Ask Correo to activate the agreement; there is nothing to fix in the code.',

  HEALTH_STATUS_NO_PROBADO: 'Not tested',
  HEALTH_STATUS_SIN_CREDENCIALES: 'No credentials',
  HEALTH_STATUS_OK: 'OK',
  HEALTH_STATUS_CREDENCIALES_INVALIDAS: 'Invalid credentials',
  HEALTH_STATUS_GATEWAY_INALCANZABLE: 'Correo unreachable',
  HEALTH_STATUS_ERROR_DESCONOCIDO: 'Unexpected error',
  HEALTH_STATUS_CUENTA_NO_ACTIVADA: 'Account not activated',
  HEALTH_STATUS_SIN_TARIFAS: 'No rates returned',

  // ── Order widget ──
  WIDGET_HEADING: 'Correo Argentino',
  WIDGET_LOADING: 'Loading shipments…',
  WIDGET_GENERATE: 'Create shipment',
  WIDGET_GENERATE_OK: 'Shipment created — tracking {{tracking}}',
  WIDGET_GENERATE_EXISTING:
    'The order already had a shipment: {{tracking}} (nothing new was created)',
  WIDGET_GENERATE_ERR: 'Could not create the shipment: {{message}}',
  WIDGET_TICKET_BADGE: 'Shipment #{{n}}',
  WIDGET_DOWNLOAD_LABEL: 'Download label',
  WIDGET_SELF_TN: 'Self-generated tracking number',
  WIDGET_RECOVERED: 'Adopted from an existing shipment',
  WIDGET_RECOVERED_HINT:
    'The creation call came back "duplicate tracking number", so the shipment that already existed at Correo was adopted instead of creating a second one.',
  WIDGET_PARCEL: 'Parcel',
  WIDGET_PARCEL_DIMENSIONS: '{{height}} × {{width}} × {{depth}} cm',
  WIDGET_PARCEL_ITEMS: '{{count}} item(s)',
  WIDGET_WEIGHT_REAL: 'Real weight',
  WIDGET_WEIGHT_BILLED: 'Billed weight',
  WIDGET_WEIGHT_VOLUMETRIC: 'Volumetric weight',
  WIDGET_WEIGHT_SURCHARGE: '+{{amount}} over the real weight',
  WIDGET_WEIGHT_VOLUMETRIC_WINS:
    'Volumetric weight beats the real one: Correo bills {{billed}} for a parcel that weighs {{real}}.',
  WIDGET_DECLARED_VALUE: 'Declared value',
  WIDGET_AGENCY: 'Agency',
  WIDGET_GENERATED_AT: 'Created on {{date}}',
};

export const es = {
  // ── Listado de envíos ──
  TITLE: 'Envíos Correo Argentino',
  SUBTITLE: 'Lista global de fulfillments gestionados por Correo Argentino.',
  REFRESH: 'Actualizar',
  SEARCH_PLACEHOLDER: 'Buscar por orden, tracking o sucursal...',
  FILTER_STATUS: 'Estado',
  STATUS_ALL: 'Todos',
  STATUS_PENDING: 'Pendiente',
  STATUS_SHIPPED: 'Enviado',
  STATUS_DELIVERED: 'Entregado',
  STATUS_CANCELED: 'Cancelado',
  ONLY_TICKETED: 'Solo con envío creado',
  PENDING_TICKET_NOTE:
    '{{count}} envío(s) del filtro todavía no tienen envío creado en Correo.',
  LOADING_SHIPMENTS: 'Cargando envíos...',
  NO_RESULTS: 'Sin resultados para "{{search}}"',
  NO_SHIPMENTS: 'No hay envíos de Correo Argentino registrados aún.',
  COL_ORDER: 'Orden',
  COL_TRACKING: 'Tracking',
  COL_SERVICE: 'Servicio',
  COL_DELIVERY: 'Entrega',
  COL_STATUS: 'Estado',
  COL_DATE: 'Fecha',
  NO_TRACKING: 'Sin envío creado',
  VIEW_TRACKING: 'Ver seguimiento',
  LABEL_BUTTON: 'Rótulo',
  SELECTED_COUNT: '{{count}} seleccionados',
  DELIVERY_HOME: 'Domicilio',
  DELIVERY_AGENCY: 'Sucursal',
  SERVICE_CP: 'CP · Clásico',
  SERVICE_EP: 'EP · Expreso',

  // ── Acciones masivas ──
  DOWNLOAD_ALL: 'Descargar todos (filtrados)',
  DOWNLOAD_ALL_OK: 'Se está descargando el ZIP con los rótulos filtrados.',
  DOWNLOAD_ALL_TRUNCATED:
    'El filtro matcheó {{total}} envíos; solo se incluyeron los 200 más recientes.',
  BULK_LABELS: 'Descargar rótulos',
  BULK_GENERATE: 'Crear envíos',
  BULK_NO_TRACKING:
    'Ninguna de las filas seleccionadas tiene envío creado en Correo. Creá los envíos primero.',
  BULK_TICKETS_TITLE: 'Creación masiva de envíos',
  BULK_TICKETS_TRUNCATED:
    'Se pidieron {{requested}} órdenes; solo se procesaron las primeras {{cap}}.',
  BULK_TICKETS_SUMMARY: '{{ok}} creados · {{failed}} con error',
  BULK_TICKETS_EXISTING: 'ya existía',
  BULK_TICKETS_NEW: 'creado',
  BULK_TICKETS_COL_ORDER: 'Orden',
  BULK_TICKETS_COL_RESULT: 'Resultado',
  BULK_TICKETS_DOWNLOAD_LABELS: 'Descargar los rótulos de los que salieron',

  // ── Resultado por ítem de rótulos ──
  LABELS_TITLE: 'Descarga de rótulos',
  LABELS_SUMMARY_MIXED:
    '{{ok}} de {{total}} rótulos volvieron OK. {{failed}} fallaron.',
  LABELS_SUMMARY_ALL_OK: 'Los {{total}} rótulos volvieron OK.',
  LABELS_SUMMARY_ALL_FAILED: 'No se pudo bajar ninguno de los {{total}} rótulos.',
  LABELS_PARTIAL_NOTE:
    'Correo devuelve las fallas parciales con HTTP 200 y un resultado por ítem. El detalle por envío está abajo.',
  LABELS_TRUNCATED:
    'Se pidieron {{requested}} rótulos; el backend corta el lote en 200.',
  LABELS_COL_TRACKING: 'Tracking',
  LABELS_COL_RESULT: 'Resultado',
  LABELS_OK: 'OK',
  LABELS_FAILED: 'Falló',
  LABELS_OPEN: 'Abrir',
  LABELS_DOWNLOAD: 'Descargar',
  LABELS_DOWNLOAD_OK_ONES: 'Descargar los {{count}} que volvieron OK',
  LABEL_ERROR: 'No se pudo obtener el rótulo: {{message}}',

  // ── Modal de seguimiento ──
  TRACKING_TITLE: 'Seguimiento: {{code}}',
  MODAL_ORDER: 'Orden',
  MODAL_SERVICE: 'Servicio',
  MODAL_DELIVERY: 'Tipo de entrega',
  MODAL_AGENCY: 'Sucursal',
  MODAL_AGREEMENT: 'Acuerdo',
  MODAL_MEDUSA_STATUS: 'Estado Medusa',
  LOADING_TRACKING: 'Cargando seguimiento...',
  TRACKING_ERROR: 'No se pudo obtener el seguimiento. Intentá de nuevo.',
  CURRENT_STATUS: 'Estado actual:',
  NO_HISTORY:
    'El envío existe pero Correo todavía no registró ningún movimiento.',
  MOVEMENT_HISTORY: 'Historial de movimientos',
  NO_MOVEMENTS: 'Sin movimientos registrados aún.',
  UNMAPPED_TITLE: 'Códigos que no supimos mapear ({{count}})',
  UNMAPPED_NOTE:
    'Correo no publica la tabla completa de statusId. Estos pares son los que hay que agregar al normalizador.',
  LAST_UPDATE: 'Última actualización: {{date}}',
  VIEW_ON_CORREO: 'Ver en correoargentino.com.ar',
  CLOSE: 'Cerrar',
  BUCKET_PRE_SHIPMENT: 'Pre-imposición',
  BUCKET_ADMITTED: 'Admitido',
  BUCKET_IN_TRANSIT: 'En tránsito',
  BUCKET_OUT_FOR_DELIVERY: 'En distribución',
  BUCKET_DELIVERED: 'Entregado',
  BUCKET_RETURNED: 'Devuelto',
  BUCKET_CANCELED: 'Cancelado',
  BUCKET_FAILED: 'Fallido',
  BUCKET_UNKNOWN: 'Sin mapear',

  // ── Configuración ──
  CONFIG_TITLE: 'Configuración de Correo Argentino',
  CONFIG_SUBTITLE:
    'Estado de la integración, solo lectura. Los valores viven en variables de entorno y no se exponen acá.',
  CONFIG_PROVIDER_TITLE: 'Registro del provider',
  CONFIG_PROVIDER_REGISTERED: 'Registrado',
  CONFIG_PROVIDER_MISSING: 'Sin registrar',
  CONFIG_PROVIDER_MISSING_HINT:
    'El provider no aparece en /admin/fulfillment-providers. Revisá CORREO_ARGENTINO_API_KEY y que la extensión esté instalada.',
  CONFIG_PROVIDER_ENABLED: 'Habilitado',
  CONFIG_PROVIDER_DISABLED: 'Deshabilitado',
  CONFIG_OPTIONS_TITLE: 'Opciones de envío sembradas',
  CONFIG_OPTIONS_EMPTY:
    'No hay opciones de envío de Correo. Corré los seeds (seed-correo-domicilio / seed-correo-sucursal).',
  CONFIG_OPTIONS_COL_NAME: 'Opción',
  CONFIG_OPTIONS_COL_ID: 'data.id',
  CONFIG_OPTIONS_COL_SERVICE: 'service_type',
  CONFIG_OPTIONS_COL_DELIVERY: 'delivery_type',
  CONFIG_OPTIONS_COL_PRICE: 'Precio',
  CONFIG_OPTIONS_COL_ZONE: 'Zona',
  CONFIG_OPTIONS_MISSING_FIELD: 'falta',
  CONFIG_LOADING: 'Cargando estado...',

  // ── Estado de configuración ──
  CONFIG_ENV_TITLE: 'Configuración',
  CONFIG_ENV_NOTE:
    'Sólo estado: el backend informa si cada clave tiene valor efectivo y de qué capa sale, nunca el valor.',
  CONFIG_ENV_ERROR: 'No se pudo leer el estado de la configuración: {{message}}',
  CONFIG_ENV_CREDENTIALS_UNREADABLE:
    'Esta tienda tiene credenciales propias de Correo y no se pueden descifrar (lo más probable es que se haya rotado la clave de cifrado). Volvé a cargarlas en Ajustes → Credenciales: hasta entonces, generar envíos falla.',
  CONFIG_ENV_TARGET: 'Apunta a',
  CONFIG_ENV_TARGET_TEST: 'Test (apitest.correoargentino.com.ar)',
  CONFIG_ENV_TARGET_PROD: 'Producción (api.correoargentino.com.ar)',
  CONFIG_ENV_TARGET_CUSTOM: 'Host propio (override de hostname)',
  // Solo se muestran cuando paqar y MiCorreo apuntan a ambientes distintos.
  CONFIG_ENV_TARGET_API_PAQAR: 'paqar',
  CONFIG_ENV_TARGET_API_MICORREO: 'MiCorreo',
  CONFIG_ENV_ALL_OK:
    'Tienen valor efectivo todas las claves que esta integración necesita.',
  CONFIG_ENV_MISSING_REQUIRED:
    'Faltan obligatorias: {{names}}. Sin ellas paqar no autentica y ningún envío se puede dar de alta.',
  CONFIG_ENV_MISSING_QUOTING:
    'Faltan para cotizar: {{names}}. Sin ellas MiCorreo no cotiza y cada envío de Correo sale en $0.',
  CONFIG_ENV_MISSING_OPERATING:
    'Faltan para operar: {{names}}. El provider arranca, pero el alta de envíos sale con datos vacíos o por default.',
  CONFIG_ENV_STATE_OK: 'cargada',
  CONFIG_ENV_STATE_INVALIDA: 'cargada pero descartada',
  CONFIG_ENV_STATE_AUSENTE: 'sin cargar',
  CONFIG_ENV_INVALID_NOTE:
    'Cargada pero descartada por el módulo: revisá el formato (la API-Key no lleva el prefijo "Apikey "; el ext client son exactamente 3 dígitos).',
  // De qué capa sale el valor efectivo. `off` NO es "sin cargar": es el
  // fail-closed de una tienda secundaria que nunca declaró lo suyo.
  CONFIG_ENV_SOURCE_SITE: 'de esta tienda',
  CONFIG_ENV_SOURCE_GLOBAL: 'heredada (instancia)',
  CONFIG_ENV_SOURCE_CREDENTIAL: 'credencial de la tienda',
  CONFIG_ENV_SOURCE_ENV: 'archivo de entorno',
  CONFIG_ENV_SOURCE_DEFAULT: 'valor por defecto',
  CONFIG_ENV_SOURCE_OFF: 'apagada (no declarada en esta tienda)',
  CONFIG_ENV_SOURCE_UNSET: 'en ningún lado',
  CONFIG_ENV_GROUP_PAQAR: 'paqar — operar',
  CONFIG_ENV_GROUP_MICORREO: 'MiCorreo — cotizar',
  CONFIG_ENV_GROUP_ORIGEN: 'Dirección de origen',
  CONFIG_ENV_GROUP_REMITENTE: 'Remitente',
  CONFIG_ENV_GROUP_PRODUCTO: 'Producto y límites',
  CONFIG_ENV_GROUP_FALLBACK: 'Fallback de dimensiones',
  CONFIG_ENV_GROUP_OPERACION: 'Operación',
  CONFIG_ENV_GROUP_SEEDS: 'Seeds',

  // ── Prueba de conexión ──
  CONFIG_TEST_TITLE: 'Prueba de conexión',
  CONFIG_TEST_BUTTON: 'Probar conexión',
  CONFIG_TEST_RUNNING: 'Probando...',
  CONFIG_TEST_NEVER_RUN: 'Todavía no se probó.',
  CONFIG_TEST_ERROR: 'No se pudo ejecutar la prueba: {{message}}',
  CONFIG_TEST_AT: 'Última prueba: {{date}}',
  CONFIG_TEST_PAQAR: 'paqar — órdenes, rótulos, seguimiento',
  CONFIG_TEST_MICORREO: 'MiCorreo — cotización',
  CONFIG_TEST_HTTP: 'HTTP {{status}}',
  CONFIG_TEST_RETRYABLE: 'Reintentar puede servir.',
  CONFIG_TEST_PROBE_DETAIL: 'Cotización de sonda al código postal {{code}}.',
  CONFIG_TEST_ORIGIN_FALLBACK:
    'Se cotizó desde un CP de prueba porque CORREO_ARGENTINO_ORIGIN_POSTAL_CODE no está cargado.',
  CONFIG_TEST_ACCOUNT_NOT_ACTIVATED:
    'MiCorreo autentica pero devuelve la cotización vacía: la cuenta no está activada comercialmente. Mientras siga así, cada envío de Correo se cotiza en $0 y el comprador ve "Gratuito" — el flete lo paga el comercio. Pedile a Correo la activación del acuerdo; no hay nada que arreglar en el código.',

  HEALTH_STATUS_NO_PROBADO: 'Sin probar',
  HEALTH_STATUS_SIN_CREDENCIALES: 'Sin credenciales',
  HEALTH_STATUS_OK: 'OK',
  HEALTH_STATUS_CREDENCIALES_INVALIDAS: 'Credenciales inválidas',
  HEALTH_STATUS_GATEWAY_INALCANZABLE: 'Correo no responde',
  HEALTH_STATUS_ERROR_DESCONOCIDO: 'Error inesperado',
  HEALTH_STATUS_CUENTA_NO_ACTIVADA: 'Cuenta sin activar',
  HEALTH_STATUS_SIN_TARIFAS: 'Sin tarifas',

  // ── Widget de orden ──
  WIDGET_HEADING: 'Correo Argentino',
  WIDGET_LOADING: 'Cargando envíos…',
  WIDGET_GENERATE: 'Crear envío',
  WIDGET_GENERATE_OK: 'Envío creado — tracking {{tracking}}',
  WIDGET_GENERATE_EXISTING:
    'La orden ya tenía envío: {{tracking}} (no se creó nada nuevo)',
  WIDGET_GENERATE_ERR: 'No se pudo crear el envío: {{message}}',
  WIDGET_TICKET_BADGE: 'Envío #{{n}}',
  WIDGET_DOWNLOAD_LABEL: 'Descargar rótulo',
  WIDGET_SELF_TN: 'Tracking number propio',
  WIDGET_RECOVERED: 'Adoptado de un envío existente',
  WIDGET_RECOVERED_HINT:
    'El alta volvió con "tracking number duplicado", así que se adoptó el envío que ya existía en Correo en vez de crear un segundo.',
  WIDGET_PARCEL: 'Bulto',
  WIDGET_PARCEL_DIMENSIONS: '{{height}} × {{width}} × {{depth}} cm',
  WIDGET_PARCEL_ITEMS: '{{count}} ítem(s)',
  WIDGET_WEIGHT_REAL: 'Peso real',
  WIDGET_WEIGHT_BILLED: 'Peso facturado',
  WIDGET_WEIGHT_VOLUMETRIC: 'Peso volumétrico',
  WIDGET_WEIGHT_SURCHARGE: '+{{amount}} sobre el peso real',
  WIDGET_WEIGHT_VOLUMETRIC_WINS:
    'El peso volumétrico le gana al real: Correo factura {{billed}} por un bulto que pesa {{real}}.',
  WIDGET_DECLARED_VALUE: 'Valor declarado',
  WIDGET_AGENCY: 'Sucursal',
  WIDGET_GENERATED_AT: 'Creado el {{date}}',
};

/**
 * Registra los bundles de Correo Argentino en la instancia de i18n que el admin
 * de Medusa inicializó de verdad.
 *
 * IMPORTANTE: pasar el `i18n` de `useTranslation()`, NUNCA el singleton pelado de
 * `i18next`. Con pnpm el bundle del admin puede resolver una SEGUNDA copia de
 * i18next sin inicializar, cuyo `addResourceBundle` no existe
 * ("addResourceBundle is not a function"). La instancia del hook siempre es la
 * viva. Es el mismo problema que el dedupe de `medusa-config.ts` mitiga del lado
 * del build: sin las dos cosas, los labels custom se ven como claves crudas
 * (TITLE, COL_ORDER, ...) en producción mientras en dev anda bien.
 *
 * El `registered` de módulo hace que las N páginas puedan llamarlo sin costo.
 */
export const registerCorreoArgentinoTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', CORREO_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', CORREO_NAMESPACE, es, true, true);

  // Marcar el namespace como cargado para que react-i18next re-renderice los
  // componentes que lo leyeron ANTES del registro (si no, quedan las claves
  // crudas en pantalla).
  void i18n.loadNamespaces(CORREO_NAMESPACE);

  registered = true;
};

export { CORREO_NAMESPACE };
