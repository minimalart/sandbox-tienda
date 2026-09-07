import type { i18n as I18nInstance } from 'i18next';

const STORE_LOCATIONS_NAMESPACE = 'storeLocations';
let registered = false;

export const en = {
  // List page
  TITLE: 'Stores',
  COLUMN_NAME: 'Name',
  COLUMN_TYPE: 'Type',
  COLUMN_CITY: 'City',
  COLUMN_PROVINCE: 'Province',
  COLUMN_VISIBLE: 'Visible',
  COLUMN_CHANNELS: 'Channels',
  COLUMN_ACTIONS: 'Actions',
  CHANNELS_ALL: 'All channels',
  CHANNELS_COUNT: '{{count}} channels',
  STATUS_VISIBLE: 'Visible',
  STATUS_HIDDEN: 'Hidden',
  EMPTY_STATE: 'No stores found. Create your first store to get started.',
  CREATE_BUTTON: 'Create',
  SEARCH_PLACEHOLDER: 'Search stores',

  // Store types
  TYPE_POINT_OF_SALE: 'Point of sale',
  TYPE_WHOLESALE: 'Wholesale',
  TYPE_DISTRIBUTION_CENTER: 'Distribution center',

  // Form sections
  SECTION_BASIC: 'Basic',
  SECTION_LOCATION: 'Location',
  SECTION_HOURS: 'Hours',
  SECTION_CONTACT: 'Contact',
  SECTION_SOCIAL: 'Social media',
  SECTION_IMAGES: 'Images',
  SECTION_OPTIONS: 'Options',

  // ProgressTabs (FocusModal form) — short labels so tabs don't overflow
  TAB_GENERAL: 'General',
  TAB_LOCATION: 'Location',
  TAB_CONTACT: 'Contact',
  TAB_MEDIA: 'Images',
  BTN_CONTINUE: 'Continue',

  // Form fields
  FIELD_NAME_LABEL: 'Name *',
  FIELD_NAME_PLACEHOLDER: 'Store name',
  FIELD_TYPE_LABEL: 'Type *',
  FIELD_CODE_LABEL: 'Code',
  FIELD_CODE_PLACEHOLDER: 'Internal code',
  FIELD_VISIBLE_LABEL: 'Visible',
  FIELD_VISIBLE_HELP: "Hidden stores won't be shown in the storefront",
  FIELD_CHANNELS_LABEL: 'Channel visibility',
  FIELD_CHANNELS_HELP:
    'Empty = visible in every channel. Pick channels to show this branch only in those stores. Not to be confused with "Channels operated by this branch" (Commercial tab), which drives inventory and payments.',
  FIELD_PROVINCE_LABEL: 'Province *',
  FIELD_PROVINCE_PLACEHOLDER: 'Province',
  FIELD_CITY_LABEL: 'City *',
  FIELD_CITY_PLACEHOLDER: 'City',
  FIELD_STREET_LABEL: 'Address *',
  FIELD_STREET_PLACEHOLDER: 'Street and number',
  FIELD_LAT_LABEL: 'Latitude',
  FIELD_LAT_PLACEHOLDER: '-34.6037',
  FIELD_LNG_LABEL: 'Longitude',
  FIELD_LNG_PLACEHOLDER: '-58.3816',
  FIELD_PHONE_LABEL: 'Phone',
  FIELD_PHONE_PLACEHOLDER: '+54 11 1234-5678',
  FIELD_WHATSAPP_LABEL: 'WhatsApp',
  FIELD_WHATSAPP_PLACEHOLDER: '+54 9 11 1234-5678',
  FIELD_EMAIL_LABEL: 'Email',
  FIELD_EMAIL_PLACEHOLDER: 'store@example.com',
  FIELD_WEBSITE_LABEL: 'Website',
  FIELD_WEBSITE_PLACEHOLDER: 'https://example.com',
  FIELD_INSTAGRAM_LABEL: 'Instagram',
  FIELD_INSTAGRAM_PLACEHOLDER: 'https://instagram.com/store',
  FIELD_FACEBOOK_LABEL: 'Facebook',
  FIELD_FACEBOOK_PLACEHOLDER: 'https://facebook.com/store',
  FIELD_TIKTOK_LABEL: 'TikTok',
  FIELD_TIKTOK_PLACEHOLDER: 'https://tiktok.com/@store',
  FIELD_LINKEDIN_LABEL: 'LinkedIn',
  FIELD_LINKEDIN_PLACEHOLDER: 'https://linkedin.com/company/store',
  FIELD_IMAGE_LABEL: 'Image {{n}}',
  FIELD_IMAGE_PLACEHOLDER: 'https://...',
  FIELD_IMAGES_HELP: 'Up to 3 images uploaded to storage.',
  FIELD_IMAGE_UPLOAD: 'Upload image',
  FIELD_IMAGE_CHANGE: 'Change',
  FIELD_IMAGE_REMOVE: 'Remove',
  FIELD_IMAGE_UPLOADING: 'Uploading…',
  FIELD_IMAGE_UPLOAD_ERROR: 'Failed to upload image: {{msg}}',
  FIELD_DELIVERS_KITS_LABEL: 'Delivers kits',
  FIELD_DELIVERS_KITS_HELP: 'This store hands out kits to customers',
  FIELD_DELIVERY_PIN_LABEL: 'Delivery PIN',
  FIELD_DELIVERY_PIN_PLACEHOLDER: '6-digit PIN',
  FIELD_DELIVERY_PIN_GENERATE: 'Generate',

  // Commercial config (Branch)
  SECTION_BRANCH: 'Commercial',
  BRANCH_HELP:
    'Wire this branch to its inventory and sales channels. Required for storefront resolution and per-branch payments.',
  BRANCH_ACTIVE_LABEL: 'Active (operational)',
  BRANCH_ACTIVE_HELP: 'Inactive branches are skipped during checkout resolution.',
  BRANCH_STOCK_LABEL: 'Inventory location',
  BRANCH_STOCK_NONE: 'Unassigned',
  BRANCH_CHANNELS_LABEL: 'Channels operated by this branch',
  BRANCH_CHANNELS_HELP:
    'Channels this branch sells through. Set the type of each. This is the operational channel→branch ownership (inventory, payments); to choose where the store is listed, use "Channel visibility" in General.',
  BRANCH_ADD_CHANNEL: 'Add channel…',
  BRANCH_CHANNEL_TYPE_B2C: 'B2C',
  BRANCH_CHANNEL_TYPE_B2B: 'B2B',
  BRANCH_CHANNEL_TYPE_IN_PERSON: 'In person',
  BRANCH_REMOVE_CHANNEL: 'Remove',
  BRANCH_SAVE: 'Save commercial config',
  BRANCH_SAVE_SUCCESS: 'Commercial config saved',
  BRANCH_SAVE_ERROR: 'Failed to save commercial config: {{msg}}',
  BRANCH_SAVE_HINT_NEW: 'Save the store first to configure its commercial wiring.',

  // Coverage (delivery zones / polygons)
  SECTION_COVERAGE: 'Coverage',
  COVERAGE_HELP:
    'Upload the polygons this branch delivers to (GeoJSON). An address is matched to the branch whose highest-priority polygon covers it.',
  COVERAGE_EMPTY: 'No coverage zones yet.',
  COVERAGE_ADD: 'Add zone',
  COVERAGE_NAME_LABEL: 'Zone name',
  COVERAGE_NAME_PLACEHOLDER: 'E.g.: Escobar centro',
  COVERAGE_PRIORITY_LABEL: 'Priority',
  COVERAGE_ACTIVE_LABEL: 'Active',
  COVERAGE_UPLOAD: 'Upload GeoJSON',
  COVERAGE_MAP_HINT: 'Upload a .geojson file with a Polygon to preview the coverage.',
  COVERAGE_PREVIEW_POINTS: 'Polygon loaded: {{n}} points',
  COVERAGE_GEOJSON_ERROR: 'Could not read a polygon from that file. Upload a valid GeoJSON Polygon.',
  COVERAGE_CLEAR: 'Remove polygon',
  COVERAGE_SAVE: 'Save zone',
  COVERAGE_SAVE_SUCCESS: 'Coverage saved',
  COVERAGE_SAVE_ERROR: 'Failed to save coverage: {{msg}}',
  COVERAGE_DELETE: 'Delete',
  COVERAGE_DELETE_SUCCESS: 'Coverage deleted',
  COVERAGE_DELETE_ERROR: 'Failed to delete coverage: {{msg}}',
  COVERAGE_NO_POLYGON: 'Upload a GeoJSON polygon before saving.',
  COVERAGE_POINTS: '{{n}} points',
  COVERAGE_CANCEL: 'Cancel',
  COVERAGE_DONE: 'Done',
  COVERAGE_DRAW: 'Draw on the map',
  COVERAGE_DRAW_FINISH: 'Finish polygon',
  COVERAGE_DRAW_UNDO: 'Undo last point',
  COVERAGE_DRAW_CANCEL: 'Cancel drawing',
  COVERAGE_DRAW_HINT: 'Click on the map to add points. Add at least 3, then finish to close the polygon. Drag a vertex to move it, or right-click a vertex to delete it.',
  COVERAGE_DRAW_NEED_THREE: 'A polygon needs at least 3 points.',
  COVERAGE_EDIT_HINT: 'Drag the vertices to adjust the polygon. Right-click a vertex to delete it (minimum 3).',

  // Multi-area GeoJSON import. A file can carry N independent polygons; one
  // polygon = one coverage row. Nothing is dropped silently.
  COVERAGE_GEOJSON_MULTI:
    'That file has {{n}} areas and only one fits here: the first one was used. To create all {{n}} as separate zones, use "Import GeoJSON" in the coverage list.',
  COVERAGE_GEOJSON_HOLES:
    '{{n}} inner rings (holes) were ignored: coverage only evaluates the outer ring.',
  COVERAGE_GEOJSON_DISCARDED: '{{n}} areas in the file were discarded (invalid geometry).',
  COVERAGE_IMPORT_OPEN: 'Import GeoJSON',
  COVERAGE_IMPORT_TITLE: 'Import areas from GeoJSON',
  COVERAGE_IMPORT_SUMMARY: 'The file has {{n}} areas ({{points}} vertices in total).',
  COVERAGE_IMPORT_HOLES:
    '{{n}} inner rings (holes) will be ignored: coverage only evaluates the outer ring.',
  COVERAGE_IMPORT_UNSUPPORTED: '{{n}} non-polygon geometries were skipped: {{types}}.',
  COVERAGE_IMPORT_DISCARDED: '{{n}} areas were discarded: {{detail}}',
  COVERAGE_IMPORT_ACTIVE_FROM_FILE:
    '{{n}} of {{total}} areas declare "active" in the file: that value wins. The switch below applies to the rest.',
  COVERAGE_IMPORT_IGNORED_PROPS:
    'The file carries {{n}} properties per area that are NOT imported: {{props}}.',
  COVERAGE_IMPORT_PRIORITY_NOTE:
    'The file uses "priority" as an order (1 = first), but here priority is a weight where the HIGHER number wins the tie-break. Copying it verbatim would invert it, so the value below is used for every zone.',
  COVERAGE_IMPORT_ADJUSTED_NAMES: '{{n}} names had to be adjusted: {{detail}}',
  COVERAGE_IMPORT_MODE_LABEL: 'What to do with the file',
  COVERAGE_IMPORT_MODE_ALL: 'Create the {{n}} areas as separate zones',
  COVERAGE_IMPORT_MODE_ONE: 'Use a single area (discard the rest)',
  COVERAGE_IMPORT_PICK_LABEL: 'Area to use',
  COVERAGE_IMPORT_PICK_WARN: 'The other {{n}} areas in the file will NOT be imported.',
  COVERAGE_IMPORT_CONFIRM_ALL: 'Create {{n}} zones',
  COVERAGE_IMPORT_CONFIRM_ONE: 'Create 1 zone',
  COVERAGE_IMPORT_PROGRESS: 'Creating {{done}} of {{total}}…',
  COVERAGE_IMPORT_RESULT: '{{ok}} of {{total}} zones created.',
  COVERAGE_IMPORT_RESULT_FAILED: '{{n}} failed: {{detail}}',
  COVERAGE_IMPORT_QUEUED:
    '{{n}} zones were added. They will be created when you save the store (nothing is created yet).',
  COVERAGE_IMPORT_AREA_FALLBACK: 'Area {{n}}',
  COVERAGE_IMPORT_ERROR: 'No usable area in that file: {{detail}}',
  COVERAGE_IMPORT_ERROR_NOT_GEOJSON: 'it is not a GeoJSON object',
  COVERAGE_IMPORT_ERROR_NO_POLYGON: 'there is no Polygon or MultiPolygon inside',
  COVERAGE_IMPORT_REASON_FEW_POINTS: 'only {{detail}} vertices',
  COVERAGE_IMPORT_REASON_NON_FINITE: 'invalid coordinate: {{detail}}',
  COVERAGE_IMPORT_REASON_OUT_OF_RANGE: 'coordinate out of range: {{detail}}',
  COVERAGE_IMPORT_REASON_MALFORMED: 'malformed ring',
  COVERAGE_IMPORT_SIMPLIFY_LABEL: 'Simplify the polygons',
  COVERAGE_IMPORT_SIMPLIFY_NONE: 'Do not simplify (keep the file as is)',
  COVERAGE_IMPORT_SIMPLIFY_OPTION: '{{n}} m tolerance',
  COVERAGE_IMPORT_SIMPLIFY_HELP:
    'Vertices that do not change the outline are dropped (no point is ever moved or invented). The tolerance is the upper bound on how far the border can shift: at {{n}} m, an address closer than {{n}} m to the limit may end up on the other side.',
  COVERAGE_IMPORT_SIMPLIFY_SUMMARY: '{{before}} → {{after}} vertices will be stored (−{{percent}}%).',
  COVERAGE_IMPORT_SIMPLIFY_UNCHANGED: 'The {{n}} vertices from the file will be stored untouched.',
  COVERAGE_IMPORT_SIMPLIFY_FLOORED:
    '{{n}} areas are left untouched: simplifying them would leave fewer than {{min}} positions, and a polygon with fewer than 3 vertices covers nobody. {{detail}}',
  COVERAGE_IMPORT_SIMPLIFY_DETAIL_SHOW: 'Show the per-area detail ({{n}})',
  COVERAGE_IMPORT_SIMPLIFY_DETAIL_HIDE: 'Hide the detail',
  COVERAGE_IMPORT_SIMPLIFY_ROW: '{{before}} → {{after}}',
  COVERAGE_IMPORT_SIMPLIFY_ROW_FLOORED: 'untouched (floor)',

  // Delivery (BranchDelivery)
  SECTION_DELIVERY: 'Delivery',
  DELIVERY_HELP:
    'Informational delivery settings (lead time + windows). Does not replace Medusa shipping options.',
  DELIVERY_ACTIVE_LABEL: 'Active',
  DELIVERY_TIMEZONE_LABEL: 'Timezone',
  DELIVERY_LEAD_TIME_LABEL: 'Lead time (hours)',
  DELIVERY_LEAD_TIME_PLACEHOLDER: 'E.g.: 24',
  DELIVERY_LEAD_TIME_HELP:
    'Hours between order confirmation and dispatch/delivery. The storefront uses it to show "delivers in N hours".',
  DELIVERY_SCHEDULES_LABEL: 'Delivery windows',
  DELIVERY_MAX_PER_DAY_LABEL: 'Max/day',
  DELIVERY_MAX_PER_DAY_HELP:
    'Maximum deliveries this branch can take per day. Leave empty for no cap.',
  DELIVERY_SAVE: 'Save delivery settings',
  DELIVERY_SAVE_SUCCESS: 'Delivery settings saved',
  DELIVERY_SAVE_ERROR: 'Failed to save delivery settings: {{msg}}',

  // Address search / map
  FIELD_ADDRESS_SEARCH_LABEL: 'Search address',
  FIELD_ADDRESS_SEARCH_PLACEHOLDER: 'E.g.: Av. Corrientes 1234, Buenos Aires',
  MAPS_NO_KEY_HINT:
    'Set VITE_GOOGLE_MAPS_API_KEY in the backend .env to enable address search and the map. You can still fill in the fields manually.',
  MAPS_KEY_ERROR:
    'Google Maps rejected the configured API key. Check that it is valid, Maps JavaScript API is enabled, and the admin domain is allowed. You can still fill in the fields manually.',
  MAPS_MARKER_HINT: 'Drag the marker or click on the map to adjust the coordinates.',
  MAPS_LOADING: 'Loading map…',

  // Business hours editor
  HOURS_OPEN: 'Open',
  HOURS_CLOSED: 'Closed',
  HOURS_OPEN_LABEL: 'Opens',
  HOURS_CLOSE_LABEL: 'Closes',
  HOURS_ADD_SLOT: 'Add a second time slot',
  HOURS_REMOVE_SLOT: 'Remove time slot',
  DAY_SHORT_LUNES: 'Mon',
  DAY_SHORT_MARTES: 'Tue',
  DAY_SHORT_MIERCOLES: 'Wed',
  DAY_SHORT_JUEVES: 'Thu',
  DAY_SHORT_VIERNES: 'Fri',
  DAY_SHORT_SABADO: 'Sat',
  DAY_SHORT_DOMINGO: 'Sun',

  // Validation
  VALIDATION_REQUIRED: 'Name, type, province, city and address are required',
  VALIDATION_EMAIL: 'Email is not valid',
  VALIDATION_PIN: 'PIN must be a 6-digit number (100000–999999)',

  // Create drawer
  CREATE_TITLE: 'Create store',
  CREATE_SUBMIT: 'Create store',
  CREATE_SUCCESS: 'Store created successfully',
  CREATE_ERROR: 'Failed to create store: {{msg}}',

  // Edit drawer
  EDIT_TITLE: 'Edit store',
  EDIT_SUBMIT: 'Save changes',
  UPDATE_SUCCESS: 'Store updated successfully',
  UPDATE_ERROR: 'Failed to update store: {{msg}}',

  // Common buttons
  CANCEL: 'Cancel',

  // Actions menu
  ACTION_EDIT: 'Edit',
  ACTION_DELETE: 'Delete',
  DELETE_PROMPT_TITLE: 'Delete store',
  DELETE_PROMPT_DESCRIPTION:
    'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
  DELETE_PROMPT_CONFIRM: 'Delete',
  DELETE_PROMPT_CANCEL: 'Cancel',
  DELETE_SUCCESS: 'Store deleted successfully',
  DELETE_ERROR: 'Failed to delete store: {{msg}}',
};

export const es = {
  // List page
  TITLE: 'Sucursales',
  COLUMN_NAME: 'Nombre',
  COLUMN_TYPE: 'Tipo',
  COLUMN_CITY: 'Ciudad',
  COLUMN_PROVINCE: 'Provincia',
  COLUMN_VISIBLE: 'Visible',
  COLUMN_CHANNELS: 'Canales',
  COLUMN_ACTIONS: 'Acciones',
  CHANNELS_ALL: 'Todos los canales',
  CHANNELS_COUNT: '{{count}} canales',
  STATUS_VISIBLE: 'Visible',
  STATUS_HIDDEN: 'Oculta',
  EMPTY_STATE: 'No se encontraron sucursales. Creá tu primera sucursal para empezar.',
  CREATE_BUTTON: 'Crear',
  SEARCH_PLACEHOLDER: 'Buscar sucursales',

  // Store types
  TYPE_POINT_OF_SALE: 'Punto de venta',
  TYPE_WHOLESALE: 'Mayorista',
  TYPE_DISTRIBUTION_CENTER: 'Centro de distribución',

  // Form sections
  SECTION_BASIC: 'Básico',
  SECTION_LOCATION: 'Ubicación',
  SECTION_HOURS: 'Horarios',
  SECTION_CONTACT: 'Contacto',
  SECTION_SOCIAL: 'Redes',
  SECTION_IMAGES: 'Imágenes',
  SECTION_OPTIONS: 'Opciones',

  // ProgressTabs (form en FocusModal) — labels cortos para que no se corten
  TAB_GENERAL: 'General',
  TAB_LOCATION: 'Ubicación',
  TAB_CONTACT: 'Contacto',
  TAB_MEDIA: 'Imágenes',
  BTN_CONTINUE: 'Continuar',

  // Form fields
  FIELD_NAME_LABEL: 'Nombre *',
  FIELD_NAME_PLACEHOLDER: 'Nombre de la sucursal',
  FIELD_TYPE_LABEL: 'Tipo *',
  FIELD_CODE_LABEL: 'Código',
  FIELD_CODE_PLACEHOLDER: 'Código interno',
  FIELD_VISIBLE_LABEL: 'Visible',
  FIELD_VISIBLE_HELP: 'Las sucursales ocultas no se muestran en la tienda',
  FIELD_CHANNELS_LABEL: 'Visibilidad por canal',
  FIELD_CHANNELS_HELP:
    'Vacío = visible en todos los canales. Elegí canales para mostrar la sucursal solo en esas tiendas. No confundir con "Canales que opera esta sucursal" (pestaña Comercial), que define inventario y cobros.',
  FIELD_PROVINCE_LABEL: 'Provincia *',
  FIELD_PROVINCE_PLACEHOLDER: 'Provincia',
  FIELD_CITY_LABEL: 'Ciudad *',
  FIELD_CITY_PLACEHOLDER: 'Ciudad',
  FIELD_STREET_LABEL: 'Dirección *',
  FIELD_STREET_PLACEHOLDER: 'Calle y número',
  FIELD_LAT_LABEL: 'Latitud',
  FIELD_LAT_PLACEHOLDER: '-34.6037',
  FIELD_LNG_LABEL: 'Longitud',
  FIELD_LNG_PLACEHOLDER: '-58.3816',
  FIELD_PHONE_LABEL: 'Teléfono',
  FIELD_PHONE_PLACEHOLDER: '+54 11 1234-5678',
  FIELD_WHATSAPP_LABEL: 'WhatsApp',
  FIELD_WHATSAPP_PLACEHOLDER: '+54 9 11 1234-5678',
  FIELD_EMAIL_LABEL: 'Email',
  FIELD_EMAIL_PLACEHOLDER: 'sucursal@ejemplo.com',
  FIELD_WEBSITE_LABEL: 'Sitio web',
  FIELD_WEBSITE_PLACEHOLDER: 'https://ejemplo.com',
  FIELD_INSTAGRAM_LABEL: 'Instagram',
  FIELD_INSTAGRAM_PLACEHOLDER: 'https://instagram.com/sucursal',
  FIELD_FACEBOOK_LABEL: 'Facebook',
  FIELD_FACEBOOK_PLACEHOLDER: 'https://facebook.com/sucursal',
  FIELD_TIKTOK_LABEL: 'TikTok',
  FIELD_TIKTOK_PLACEHOLDER: 'https://tiktok.com/@sucursal',
  FIELD_LINKEDIN_LABEL: 'LinkedIn',
  FIELD_LINKEDIN_PLACEHOLDER: 'https://linkedin.com/company/sucursal',
  FIELD_IMAGE_LABEL: 'Imagen {{n}}',
  FIELD_IMAGE_PLACEHOLDER: 'https://...',
  FIELD_IMAGES_HELP: 'Hasta 3 imágenes subidas al almacenamiento.',
  FIELD_IMAGE_UPLOAD: 'Subir imagen',
  FIELD_IMAGE_CHANGE: 'Cambiar',
  FIELD_IMAGE_REMOVE: 'Quitar',
  FIELD_IMAGE_UPLOADING: 'Subiendo…',
  FIELD_IMAGE_UPLOAD_ERROR: 'Error al subir la imagen: {{msg}}',
  FIELD_DELIVERS_KITS_LABEL: 'Entrega kits',
  FIELD_DELIVERS_KITS_HELP: 'Esta sucursal entrega kits a los clientes',
  FIELD_DELIVERY_PIN_LABEL: 'PIN de entrega',
  FIELD_DELIVERY_PIN_PLACEHOLDER: 'PIN de 6 dígitos',
  FIELD_DELIVERY_PIN_GENERATE: 'Generar',

  // Configuración comercial (Sucursal)
  SECTION_BRANCH: 'Comercial',
  BRANCH_HELP:
    'Conectá esta sucursal con su inventario y sus canales de venta. Necesario para la resolución en la tienda y los pagos por sucursal.',
  BRANCH_ACTIVE_LABEL: 'Activa (operativa)',
  BRANCH_ACTIVE_HELP: 'Las sucursales inactivas se omiten en la resolución del checkout.',
  BRANCH_STOCK_LABEL: 'Ubicación de inventario',
  BRANCH_STOCK_NONE: 'Sin asignar',
  BRANCH_CHANNELS_LABEL: 'Canales que opera esta sucursal',
  BRANCH_CHANNELS_HELP:
    'Canales por los que vende esta sucursal. Definí el tipo de cada uno. Es la propiedad operativa canal→sucursal (inventario, cobros); para elegir en qué canales se muestra la sucursal, usá "Visibilidad por canal" en General.',
  BRANCH_ADD_CHANNEL: 'Agregar canal…',
  BRANCH_CHANNEL_TYPE_B2C: 'B2C',
  BRANCH_CHANNEL_TYPE_B2B: 'B2B',
  BRANCH_CHANNEL_TYPE_IN_PERSON: 'Presencial',
  BRANCH_REMOVE_CHANNEL: 'Quitar',
  BRANCH_SAVE: 'Guardar configuración comercial',
  BRANCH_SAVE_SUCCESS: 'Configuración comercial guardada',
  BRANCH_SAVE_ERROR: 'Error al guardar la configuración: {{msg}}',
  BRANCH_SAVE_HINT_NEW: 'Guardá la sucursal primero para configurar su parte comercial.',

  // Cobertura (zonas de entrega / polígonos)
  SECTION_COVERAGE: 'Cobertura',
  COVERAGE_HELP:
    'Subí los polígonos a los que entrega esta sucursal (GeoJSON). Una dirección se asigna a la sucursal cuyo polígono de mayor prioridad la cubra.',
  COVERAGE_EMPTY: 'Todavía no hay zonas de cobertura.',
  COVERAGE_ADD: 'Agregar zona',
  COVERAGE_NAME_LABEL: 'Nombre de la zona',
  COVERAGE_NAME_PLACEHOLDER: 'Ej: Escobar centro',
  COVERAGE_PRIORITY_LABEL: 'Prioridad',
  COVERAGE_ACTIVE_LABEL: 'Activa',
  COVERAGE_UPLOAD: 'Subir GeoJSON',
  COVERAGE_MAP_HINT: 'Subí un archivo .geojson con un polígono para previsualizar la cobertura.',
  COVERAGE_PREVIEW_POINTS: 'Polígono cargado: {{n}} puntos',
  COVERAGE_GEOJSON_ERROR: 'No se pudo leer un polígono de ese archivo. Subí un GeoJSON con un Polygon válido.',
  COVERAGE_CLEAR: 'Quitar polígono',
  COVERAGE_SAVE: 'Guardar zona',
  COVERAGE_SAVE_SUCCESS: 'Cobertura guardada',
  COVERAGE_SAVE_ERROR: 'Error al guardar la cobertura: {{msg}}',
  COVERAGE_DELETE: 'Eliminar',
  COVERAGE_DELETE_SUCCESS: 'Cobertura eliminada',
  COVERAGE_DELETE_ERROR: 'Error al eliminar la cobertura: {{msg}}',
  COVERAGE_NO_POLYGON: 'Subí un polígono (GeoJSON) antes de guardar.',
  COVERAGE_POINTS: '{{n}} puntos',
  COVERAGE_CANCEL: 'Cancelar',
  COVERAGE_DONE: 'Listo',
  COVERAGE_DRAW: 'Dibujar en el mapa',
  COVERAGE_DRAW_FINISH: 'Terminar polígono',
  COVERAGE_DRAW_UNDO: 'Deshacer último punto',
  COVERAGE_DRAW_CANCEL: 'Cancelar dibujo',
  COVERAGE_DRAW_HINT: 'Hacé clic en el mapa para agregar puntos. Agregá al menos 3 y terminá para cerrar el polígono. Arrastrá un vértice para moverlo, o hacé clic derecho sobre un vértice para borrarlo.',
  COVERAGE_DRAW_NEED_THREE: 'Un polígono necesita al menos 3 puntos.',
  COVERAGE_EDIT_HINT: 'Arrastrá los vértices para ajustar el polígono. Clic derecho sobre un vértice para borrarlo (mínimo 3).',

  // Importación de GeoJSON multi-área. Un archivo puede traer N polígonos
  // independientes; un polígono = una fila de cobertura. Nada se pierde callado.
  COVERAGE_GEOJSON_MULTI:
    'Ese archivo trae {{n}} áreas y acá entra una sola: se usó la primera. Para crear las {{n}} como zonas separadas, usá "Importar GeoJSON" en la lista de coberturas.',
  COVERAGE_GEOJSON_HOLES:
    'Se ignoraron {{n}} anillos interiores (agujeros): la cobertura evalúa sólo el anillo exterior.',
  COVERAGE_GEOJSON_DISCARDED: 'Se descartaron {{n}} áreas del archivo (geometría inválida).',
  COVERAGE_IMPORT_OPEN: 'Importar GeoJSON',
  COVERAGE_IMPORT_TITLE: 'Importar áreas de un GeoJSON',
  COVERAGE_IMPORT_SUMMARY: 'El archivo tiene {{n}} áreas ({{points}} vértices en total).',
  COVERAGE_IMPORT_HOLES:
    'Se van a ignorar {{n}} anillos interiores (agujeros): la cobertura evalúa sólo el anillo exterior.',
  COVERAGE_IMPORT_UNSUPPORTED: 'Se saltearon {{n}} geometrías que no son polígonos: {{types}}.',
  COVERAGE_IMPORT_DISCARDED: 'Se descartaron {{n}} áreas: {{detail}}',
  COVERAGE_IMPORT_ACTIVE_FROM_FILE:
    '{{n}} de {{total}} áreas declaran "active" en el archivo: gana el valor del archivo. El switch de abajo se aplica a las demás.',
  COVERAGE_IMPORT_IGNORED_PROPS:
    'El archivo trae {{n}} propiedades por área que NO se importan: {{props}}.',
  COVERAGE_IMPORT_PRIORITY_NOTE:
    'El archivo usa "priority" como un orden (1 = primero), pero acá la prioridad es un peso donde gana el número MAYOR en un empate. Copiarlo tal cual lo invertiría, así que se usa el valor de abajo para todas las zonas.',
  COVERAGE_IMPORT_ADJUSTED_NAMES: 'Hubo que ajustar {{n}} nombres: {{detail}}',
  COVERAGE_IMPORT_MODE_LABEL: 'Qué hacer con el archivo',
  COVERAGE_IMPORT_MODE_ALL: 'Crear las {{n}} áreas como zonas separadas',
  COVERAGE_IMPORT_MODE_ONE: 'Usar una sola área (descartar el resto)',
  COVERAGE_IMPORT_PICK_LABEL: 'Área a usar',
  COVERAGE_IMPORT_PICK_WARN: 'Las otras {{n}} áreas del archivo NO se van a importar.',
  COVERAGE_IMPORT_CONFIRM_ALL: 'Crear {{n}} zonas',
  COVERAGE_IMPORT_CONFIRM_ONE: 'Crear 1 zona',
  COVERAGE_IMPORT_PROGRESS: 'Creando {{done}} de {{total}}…',
  COVERAGE_IMPORT_RESULT: 'Se crearon {{ok}} de {{total}} zonas.',
  COVERAGE_IMPORT_RESULT_FAILED: 'Fallaron {{n}}: {{detail}}',
  COVERAGE_IMPORT_QUEUED:
    'Se agregaron {{n}} zonas. Se van a crear cuando guardes la sucursal (todavía no se creó nada).',
  COVERAGE_IMPORT_AREA_FALLBACK: 'Área {{n}}',
  COVERAGE_IMPORT_ERROR: 'Ese archivo no tiene ningún área usable: {{detail}}',
  COVERAGE_IMPORT_ERROR_NOT_GEOJSON: 'no es un objeto GeoJSON',
  COVERAGE_IMPORT_ERROR_NO_POLYGON: 'no hay ningún Polygon ni MultiPolygon adentro',
  COVERAGE_IMPORT_REASON_FEW_POINTS: 'sólo {{detail}} vértices',
  COVERAGE_IMPORT_REASON_NON_FINITE: 'coordenada inválida: {{detail}}',
  COVERAGE_IMPORT_REASON_OUT_OF_RANGE: 'coordenada fuera de rango: {{detail}}',
  COVERAGE_IMPORT_REASON_MALFORMED: 'anillo mal formado',
  COVERAGE_IMPORT_SIMPLIFY_LABEL: 'Simplificar los polígonos',
  COVERAGE_IMPORT_SIMPLIFY_NONE: 'Sin simplificar (tal cual viene el archivo)',
  COVERAGE_IMPORT_SIMPLIFY_OPTION: '{{n}} m de tolerancia',
  COVERAGE_IMPORT_SIMPLIFY_HELP:
    'Se descartan los vértices que no cambian el contorno (ningún punto se mueve ni se inventa). La tolerancia es la cota de cuánto se puede correr el borde: con {{n}} m, una dirección a menos de {{n}} m del límite puede quedar del otro lado.',
  COVERAGE_IMPORT_SIMPLIFY_SUMMARY: 'Se van a guardar {{before}} → {{after}} vértices (−{{percent}} %).',
  COVERAGE_IMPORT_SIMPLIFY_UNCHANGED: 'Se van a guardar los {{n}} vértices del archivo, sin tocar.',
  COVERAGE_IMPORT_SIMPLIFY_FLOORED:
    '{{n}} áreas quedan intactas: simplificarlas las dejaría con menos de {{min}} posiciones, y un polígono de menos de 3 vértices no cubre a nadie. {{detail}}',
  COVERAGE_IMPORT_SIMPLIFY_DETAIL_SHOW: 'Ver el detalle por área ({{n}})',
  COVERAGE_IMPORT_SIMPLIFY_DETAIL_HIDE: 'Ocultar el detalle',
  COVERAGE_IMPORT_SIMPLIFY_ROW: '{{before}} → {{after}}',
  COVERAGE_IMPORT_SIMPLIFY_ROW_FLOORED: 'intacta (piso)',

  // Entrega (BranchDelivery)
  SECTION_DELIVERY: 'Entrega',
  DELIVERY_HELP:
    'Configuración informativa de entrega (lead time + ventanas). No reemplaza las shipping options de Medusa.',
  DELIVERY_ACTIVE_LABEL: 'Activa',
  DELIVERY_TIMEZONE_LABEL: 'Zona horaria',
  DELIVERY_LEAD_TIME_LABEL: 'Lead time (horas)',
  DELIVERY_LEAD_TIME_PLACEHOLDER: 'Ej: 24',
  DELIVERY_LEAD_TIME_HELP:
    'Horas entre que se confirma el pedido y el despacho/entrega. La tienda lo usa para mostrar "entrega en N horas".',
  DELIVERY_SCHEDULES_LABEL: 'Ventanas de entrega',
  DELIVERY_MAX_PER_DAY_LABEL: 'Máx./día',
  DELIVERY_MAX_PER_DAY_HELP:
    'Máximo de entregas que la sucursal puede tomar por día. Dejalo vacío para no topear.',
  DELIVERY_SAVE: 'Guardar entrega',
  DELIVERY_SAVE_SUCCESS: 'Entrega guardada',
  DELIVERY_SAVE_ERROR: 'Error al guardar la entrega: {{msg}}',

  // Address search / map
  FIELD_ADDRESS_SEARCH_LABEL: 'Buscar dirección',
  FIELD_ADDRESS_SEARCH_PLACEHOLDER: 'Ej: Av. Corrientes 1234, Buenos Aires',
  MAPS_NO_KEY_HINT:
    'Configurá VITE_GOOGLE_MAPS_API_KEY en el .env del backend para habilitar el buscador de direcciones y el mapa. Mientras tanto podés completar los campos a mano.',
  MAPS_KEY_ERROR:
    'Google Maps rechazó la API key configurada. Revisá que sea válida, que Maps JavaScript API esté habilitada y que el dominio del admin esté permitido. Mientras tanto podés completar los campos a mano.',
  MAPS_MARKER_HINT: 'Arrastrá el marcador o hacé clic en el mapa para ajustar las coordenadas.',
  MAPS_LOADING: 'Cargando mapa…',

  // Business hours editor
  HOURS_OPEN: 'Abierto',
  HOURS_CLOSED: 'Cerrado',
  HOURS_OPEN_LABEL: 'Apertura',
  HOURS_CLOSE_LABEL: 'Cierre',
  HOURS_ADD_SLOT: 'Agregar segunda franja',
  HOURS_REMOVE_SLOT: 'Quitar franja',
  DAY_SHORT_LUNES: 'Lun',
  DAY_SHORT_MARTES: 'Mar',
  DAY_SHORT_MIERCOLES: 'Mié',
  DAY_SHORT_JUEVES: 'Jue',
  DAY_SHORT_VIERNES: 'Vie',
  DAY_SHORT_SABADO: 'Sáb',
  DAY_SHORT_DOMINGO: 'Dom',

  // Validation
  VALIDATION_REQUIRED: 'Nombre, tipo, provincia, ciudad y dirección son obligatorios',
  VALIDATION_EMAIL: 'El email no es válido',
  VALIDATION_PIN: 'El PIN debe ser un número de 6 dígitos (100000–999999)',

  // Create drawer
  CREATE_TITLE: 'Crear sucursal',
  CREATE_SUBMIT: 'Crear sucursal',
  CREATE_SUCCESS: 'Sucursal creada correctamente',
  CREATE_ERROR: 'Error al crear la sucursal: {{msg}}',

  // Edit drawer
  EDIT_TITLE: 'Editar sucursal',
  EDIT_SUBMIT: 'Guardar cambios',
  UPDATE_SUCCESS: 'Sucursal actualizada correctamente',
  UPDATE_ERROR: 'Error al actualizar la sucursal: {{msg}}',

  // Common buttons
  CANCEL: 'Cancelar',

  // Actions menu
  ACTION_EDIT: 'Editar',
  ACTION_DELETE: 'Eliminar',
  DELETE_PROMPT_TITLE: 'Eliminar sucursal',
  DELETE_PROMPT_DESCRIPTION:
    '¿Estás seguro de que querés eliminar "{{name}}"? Esta acción no se puede deshacer.',
  DELETE_PROMPT_CONFIRM: 'Eliminar',
  DELETE_PROMPT_CANCEL: 'Cancelar',
  DELETE_SUCCESS: 'Sucursal eliminada correctamente',
  DELETE_ERROR: 'Error al eliminar la sucursal: {{msg}}',
};

/**
 * Registers the Store Locations translation bundles on the i18n instance that
 * Medusa's admin actually initialized.
 *
 * IMPORTANT: pass the `i18n` instance from `useTranslation()` — do NOT call the
 * bare `i18next` singleton (see translations/brands for the rationale).
 */
export const registerStoreLocationsTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', STORE_LOCATIONS_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', STORE_LOCATIONS_NAMESPACE, es, true, true);

  // Mark the namespace as loaded so react-i18next re-renders components
  // that read it before registration (otherwise raw keys stick).
  void i18n.loadNamespaces(STORE_LOCATIONS_NAMESPACE);

  registered = true;
};
