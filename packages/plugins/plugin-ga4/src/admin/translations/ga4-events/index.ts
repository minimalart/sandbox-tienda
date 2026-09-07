import type { i18n as I18nInstance } from 'i18next';

const GA4_EVENTS_NAMESPACE = 'ga4Events';
let registered = false;

/**
 * Convierte un nombre de evento Medusa (con puntos) en una clave i18n segura.
 * Ej: 'customer.created' -> 'customer_created'. Se usa para resolver
 * `EVENTS.<key>.TITLE` / `EVENTS.<key>.DESC`.
 */
export const eventI18nKey = (medusaEvent: string) => medusaEvent.replace(/\./g, '_');

export const en = {
  // List page
  TITLE: 'GA4 Events',

  // Config panel (server-side status: checklist, GA link, test event)
  CONFIG_TITLE: 'GA4 configuration',
  CONFIG_MEASUREMENT_ID: 'GA4 Measurement ID',
  CONFIG_DISPATCH_ACTIVE: 'Server-side active',
  CONFIG_DISPATCH_INACTIVE: 'Server-side inactive',
  CONFIG_DISPATCH_HINT:
    'Set GA_MEASUREMENT_ID and GA_API_SECRET on the backend to send events to GA4.',
  CONFIG_DEBUG: 'Debug',
  CONFIG_OPEN_GA4: 'Open Google Analytics',
  CONFIG_TEST_BUTTON: 'Send test event',
  CONFIG_TEST_HELP:
    'The test sends this event to GA4’s validation endpoint — it does not record a real hit in your property:',
  CONFIG_TEST_SUCCESS: 'Connection OK — GA4 validated “{{event}}” with no errors.',
  CONFIG_TEST_INVALID: 'GA4 rejected the test event:',
  CONFIG_TEST_NOT_CONFIGURED:
    'Not configured — set GA_MEASUREMENT_ID and GA_API_SECRET on the backend first.',
  CONFIG_TEST_DISABLED_TOOLTIP:
    'Set GA_MEASUREMENT_ID and GA_API_SECRET on the backend to enable the test event.',
  CONFIG_CHECKLIST_TITLE: 'To activate server-side sending:',
  CONFIG_CHECKLIST_API_SECRET: 'Measurement Protocol API Secret (GA_API_SECRET)',

  // Config form (editable fields + save)
  CONFIG_SAVE: 'Save',
  CONFIG_SAVED: 'Configuration saved successfully',
  CONFIG_SAVE_ERROR: 'Failed to save the configuration: {{msg}}',
  CONFIG_FIELD_MEASUREMENT: 'GA4 Measurement ID',
  CONFIG_FIELD_SECRET: 'Measurement Protocol API Secret',
  CONFIG_FIELD_GTM: 'Google Tag Manager ID',
  CONFIG_FIELD_DEBUG: 'Debug mode',
  CONFIG_SECRET_SET_PLACEHOLDER: 'Already set — leave blank to keep it',

  // Why this mapping (rationale based on Google's recommended events)
  WHY_LABEL: 'Why this mapping',
  WHY_SOURCE: "Google's recommended events",
  WHY: {
    customer_created:
      'Google recommends sign_up to measure user registrations. Fires when the customer account is created.',
    contact_submission_created:
      'Google recommends generate_lead for lead capture (interest form submissions). A contact form is a direct lead capture.',
    company_created:
      'Creating a company is a B2B account sign-up; sign_up is Google’s recommended event for registrations.',
    company_member_joined:
      'Google recommends join_group when a user joins a group. A member joining a company is exactly that (group_id = the company).',
    corporate_created:
      'A corporate registration is a qualified B2B lead; generate_lead is Google’s lead-capture event.',
    corporate_activated:
      'Activation makes the corporate account live — mapped to sign_up (the effective account creation).',
    corporate_member_joined:
      'A member joining a corporate account → join_group (group_id = the corporate account).',
    purchase:
      'purchase is GA4’s core ecommerce conversion (revenue, transactions). Google recommends it to measure sales; fires when the order is placed.',
    refund:
      'refund is Google’s recommended ecommerce event to measure returned revenue. Fires when a payment is refunded; sends the refunded value and items.',
    add_to_cart:
      'A purchase-funnel event Google recommends; marks buying intent when a product is added to the cart.',
    remove_from_cart:
      'A funnel event Google recommends; measures friction/abandonment when items are removed from the cart.',
    add_shipping_info:
      'A checkout step Google recommends measuring; fires when shipping details are set.',
    add_payment_info:
      'A checkout step Google recommends measuring; fires when payment starts (payment session created).',
    begin_checkout:
      'Google recommends begin_checkout when checkout starts. It’s a navigation event (fired by the storefront) with no backend equivalent.',
  },
  COLUMN_TITLE: 'Title',
  COLUMN_TYPE: 'Type',
  COLUMN_MEDUSA_EVENT: 'Medusa event',
  COLUMN_GA4_EVENT: 'GA4 event',
  COLUMN_STATUS: 'Status',
  COLUMN_ACTIONS: 'Actions',
  STATUS_ACTIVE: 'Active',
  STATUS_INACTIVE: 'Inactive',
  STATUS_REMOVED: 'Removed',

  // "Status" table filter (radio). No filter = removed are hidden.
  FILTER_STATUS: 'Status',
  FILTER_STATUS_ACTIVE: 'Active',
  FILTER_STATUS_INACTIVE: 'Inactive',
  FILTER_STATUS_REMOVED: 'Removed',
  FILTER_CLEAR_ALL: 'Clear all',

  // Row type (how each event is managed)
  TYPE: {
    builtin: 'Automatic',
    generic: 'Custom',
    readonly: 'Storefront',
  },
  // Tooltip on the type badge explaining what each type means
  TYPE_HINT: {
    builtin:
      'Ecommerce funnel event sent by the backend. Its payload (items, value) is computed automatically — you can only turn it on/off and rename the GA4 event.',
    generic:
      'A mapping you fully control: pick the Medusa event, the GA4 event name and its parameters.',
    readonly:
      'Fired by the storefront in the browser (gtag.js). Shown for context — it can’t be managed from here.',
  },
  // Customer-journey stage (groups the list into a funnel)
  STAGE: {
    funnel: 'Ecommerce funnel',
    acquisition: 'Acquisition & leads',
    b2b: 'B2B lifecycle',
  },

  EMPTY_STATE: 'No event mappings yet. Create your first mapping to start sending events to GA4.',
  CREATE_BUTTON: 'Create',
  SEARCH_PLACEHOLDER: 'Search mappings',

  // Form fields (shared by create & edit)
  FIELD_MEDUSA_EVENT_LABEL: 'Medusa event *',
  FIELD_MEDUSA_EVENT_PLACEHOLDER: 'Select an event',
  FIELD_MEDUSA_EVENT_SEARCH: 'Search events…',
  SEARCH_NO_RESULTS: 'No results',
  FIELD_MEDUSA_EVENT_HELP: 'The Medusa event that triggers this mapping',
  FIELD_GA4_EVENT_LABEL: 'GA4 event name *',
  FIELD_GA4_EVENT_PLACEHOLDER: 'purchase',
  FIELD_GA4_EVENT_HELP: 'The event name reported to Google Analytics 4',
  FIELD_DESCRIPTION_LABEL: 'Description',
  FIELD_DESCRIPTION_PLACEHOLDER: 'What this mapping is for',
  FIELD_ACTIVE_LABEL: 'Active',
  FIELD_ACTIVE_HELP: 'Inactive mappings will not send events to GA4',

  // Advanced section
  ADVANCED_TITLE: 'Advanced options',

  // Param mappings editor
  PARAMS_TITLE: 'Parameter mappings',
  PARAMS_HELP: 'Map GA4 parameters to a value taken from the event payload or a fixed value.',
  PARAMS_SUGGESTED: 'Suggested parameters: {{params}}',
  PARAMS_EXAMPLE:
    'Example: a "Source path" of order.total reads that field from the event payload; a "Static value" of USD always sends that exact value. Use one or the other per row — static value wins if both are set.',
  PARAM_GA4_PARAM_LABEL: 'GA4 param',
  PARAM_GA4_PARAM_PLACEHOLDER: 'value',
  PARAM_SOURCE_PATH_LABEL: 'Source path',
  PARAM_SOURCE_PATH_PLACEHOLDER: 'order.total',
  PARAM_STATIC_VALUE_LABEL: 'Static value',
  PARAM_STATIC_VALUE_PLACEHOLDER: 'fixed value',
  PARAM_REMOVE: 'Remove',
  PARAM_ADD: 'Add parameter',

  // Create drawer
  CREATE_TITLE: 'Create mapping',
  CREATE_SUBMIT: 'Create mapping',
  CREATE_SUCCESS: 'Mapping created successfully',
  CREATE_ERROR: 'Failed to create mapping: {{msg}}',
  VALIDATION_REQUIRED: 'Medusa event and GA4 event name are required',

  // Edit drawer
  EDIT_TITLE: 'Edit mapping',
  EDIT_SUBMIT: 'Save changes',
  UPDATE_SUCCESS: 'Mapping updated successfully',
  UPDATE_ERROR: 'Failed to update mapping: {{msg}}',

  // Common buttons
  CANCEL: 'Cancel',

  // Actions menu
  ACTION_EDIT: 'Edit',
  ACTION_DELETE: 'Delete',
  ACTION_VIEW: 'View detail',
  ACTION_RESTORE: 'Restore',
  DELETE_PROMPT_TITLE: 'Delete mapping',
  DELETE_PROMPT_DESCRIPTION:
    'Are you sure you want to delete the mapping for "{{event}}"? This action cannot be undone.',
  DELETE_PROMPT_CONFIRM: 'Delete',
  DELETE_PROMPT_CANCEL: 'Cancel',
  DELETE_SUCCESS: 'Mapping deleted successfully',
  DELETE_ERROR: 'Failed to delete mapping: {{msg}}',
  DELETE_DISABLED_MANAGED: 'Storefront events are fired by the browser; they aren’t managed from the backend.',
  HIDE_BUILTIN_PROMPT_TITLE: 'Remove this event?',
  HIDE_BUILTIN_PROMPT_DESC:
    'It will disappear from the list and stop being sent to GA4. You can restore it later.',
  HIDE_BUILTIN_SUCCESS: 'Event removed',
  RESTORE_SUCCESS: 'Event restored',

  // Event category labels (keyed by category)
  CATEGORIES: {
    recomendados: 'Recommended',
    b2b: 'Companies & corporate (B2B)',
  },

  // Ecommerce events already tracked elsewhere (read-only rows)
  STATUS_TRACKED: 'Active',
  MANAGED_REASON:
    'Already sent automatically by {{source}} — managed outside this module to avoid duplicate events.',
  SOURCE: {
    plugin: 'Plugin (server)',
    storefront: 'Storefront (client)',
  },

  // Built-in ecommerce events (server-side; payload computed automatically)
  BUILTIN_NOTE: 'The event content (items, value, currency) is computed automatically.',
  BUILTIN: {
    purchase: {
      TITLE: 'Purchase',
      DESC: 'When an order is placed. Sends items, value, tax and shipping.',
    },
    refund: {
      TITLE: 'Refund',
      DESC: 'When a payment is refunded. Sends the refunded value, currency and items.',
    },
    add_to_cart: { TITLE: 'Add to cart', DESC: 'When items are added to the cart.' },
    remove_from_cart: { TITLE: 'Remove from cart', DESC: 'When items are removed from the cart.' },
    add_shipping_info: {
      TITLE: 'Add shipping info',
      DESC: 'When a shipping address is set on the cart.',
    },
    add_payment_info: { TITLE: 'Add payment info', DESC: 'When a payment session is created.' },
  },
  MANAGED: {
    begin_checkout: {
      TITLE: 'Checkout started',
      DESC: 'Fires when the shopper reaches the checkout page. Tracked by the storefront (gtag.js) in the browser.',
    },
  },
  MANAGED_MEDUSA_NONE: 'None — browser event (no Medusa backend event)',
  MANAGED_WHY: {
    storefront:
      'This is a client-side navigation event fired by the storefront when the shopper enters checkout. There is no equivalent Medusa backend event, so it can’t be managed from this extension.',
    plugin:
      'This event is sent automatically by an external integration, not by this module, so it can’t be managed here.',
  },
  DETAIL_TITLE: 'Event details',
  DETAIL_SOURCE_LABEL: 'Source',
  DETAIL_WHY_LABEL: 'Why it can’t be edited',

  // Friendly event titles & descriptions (keyed by eventI18nKey(medusa_event))
  EVENTS: {
    customer_created: {
      TITLE: 'Customer sign-up',
      DESC: 'When a new customer creates an account in the store.',
    },
    contact_submission_created: {
      TITLE: 'Contact form submitted',
      DESC: 'When a visitor submits the contact form — captured as a lead.',
    },
    company_created: {
      TITLE: 'Company created',
      DESC: 'When a company (B2B) is created (direct sign-up, no approval step).',
    },
    company_member_joined: {
      TITLE: 'Member joined company',
      DESC: 'When a user joins an existing company.',
    },
    corporate_created: {
      TITLE: 'Corporate registration submitted',
      DESC: 'When a corporate registration form is submitted (stays pending until approved) — a lead.',
    },
    corporate_member_joined: {
      TITLE: 'Member joined corporate',
      DESC: 'When a user accepts the invitation and joins the corporate account.',
    },
    corporate_activated: {
      TITLE: 'Corporate account activated',
      DESC: 'When a corporate account becomes active.',
    },
    corporate_suspended: {
      TITLE: 'Corporate account suspended',
      DESC: 'When a corporate account is suspended.',
    },
    corporate_member_invited: {
      TITLE: 'Corporate invitation',
      DESC: 'When a user is invited to a corporate account.',
    },
    corporate_rule_updated: {
      TITLE: 'Corporate rule updated',
      DESC: 'When a rule of the corporate account is modified.',
    },
    billing_profile_created: {
      TITLE: 'Billing profile created',
      DESC: 'When a customer creates a billing profile.',
    },
    billing_profile_updated: {
      TITLE: 'Billing profile updated',
      DESC: 'When a billing profile is modified.',
    },
    billing_profile_deleted: {
      TITLE: 'Billing profile deleted',
      DESC: 'When a billing profile is deleted.',
    },
    billing_profile_default_changed: {
      TITLE: 'Default billing profile changed',
      DESC: 'When the customer changes their default billing profile.',
    },
    order_fulfillment_created: {
      TITLE: 'Order shipped',
      DESC: 'When a fulfillment is created for an order.',
    },
    order_fulfillment_canceled: {
      TITLE: 'Shipment canceled',
      DESC: 'When an order fulfillment is canceled.',
    },
    product_created: {
      TITLE: 'Product created',
      DESC: 'When a product is created in the catalog (admin event, no user).',
    },
    product_updated: {
      TITLE: 'Product updated',
      DESC: 'When a product is modified in the catalog (admin event).',
    },
    product_deleted: {
      TITLE: 'Product deleted',
      DESC: 'When a product is deleted from the catalog (admin event).',
    },
  },
};

export const es = {
  // List page
  TITLE: 'Eventos GA4',

  // Panel de configuración (estado server-side: checklist, link a GA, prueba)
  CONFIG_TITLE: 'Configuración de GA4',
  CONFIG_MEASUREMENT_ID: 'Measurement ID de GA4',
  CONFIG_DISPATCH_ACTIVE: 'Envío server-side activo',
  CONFIG_DISPATCH_INACTIVE: 'Envío server-side inactivo',
  CONFIG_DISPATCH_HINT:
    'Configurá GA_MEASUREMENT_ID y GA_API_SECRET en el backend para enviar eventos a GA4.',
  CONFIG_DEBUG: 'Debug',
  CONFIG_OPEN_GA4: 'Abrir Google Analytics',
  CONFIG_TEST_BUTTON: 'Enviar evento de prueba',
  CONFIG_TEST_HELP:
    'La prueba envía este evento al endpoint de validación de GA4 — no registra un hit real en tu propiedad:',
  CONFIG_TEST_SUCCESS: 'Conexión OK — GA4 validó “{{event}}” sin errores.',
  CONFIG_TEST_INVALID: 'GA4 rechazó el evento de prueba:',
  CONFIG_TEST_NOT_CONFIGURED:
    'Sin configurar — primero seteá GA_MEASUREMENT_ID y GA_API_SECRET en el backend.',
  CONFIG_TEST_DISABLED_TOOLTIP:
    'Configurá GA_MEASUREMENT_ID y GA_API_SECRET en el backend para habilitar el evento de prueba.',
  CONFIG_CHECKLIST_TITLE: 'Para activar el envío server-side:',
  CONFIG_CHECKLIST_API_SECRET: 'API Secret del Measurement Protocol (GA_API_SECRET)',

  // Formulario de configuración (campos editables + guardar)
  CONFIG_SAVE: 'Guardar',
  CONFIG_SAVED: 'Configuración guardada correctamente',
  CONFIG_SAVE_ERROR: 'Error al guardar la configuración: {{msg}}',
  CONFIG_FIELD_MEASUREMENT: 'Measurement ID de GA4',
  CONFIG_FIELD_SECRET: 'API Secret del Measurement Protocol',
  CONFIG_FIELD_GTM: 'ID de Google Tag Manager',
  CONFIG_FIELD_DEBUG: 'Modo debug',
  CONFIG_SECRET_SET_PLACEHOLDER: 'Ya está configurado — dejalo vacío para conservarlo',

  // Por qué esta asociación (rationale basado en los eventos recomendados de Google)
  WHY_LABEL: 'Por qué esta asociación',
  WHY_SOURCE: 'Eventos recomendados de Google',
  WHY: {
    customer_created:
      'Google recomienda sign_up para medir altas de usuarios. Se dispara cuando el cliente crea su cuenta.',
    contact_submission_created:
      'Google recomienda generate_lead para la captura de leads (envío de formularios de interés). El form de contacto es una captura de lead directa.',
    company_created:
      'El alta de una empresa es la creación de una cuenta B2B; sign_up es el evento que Google recomienda para registros.',
    company_member_joined:
      'Google recomienda join_group cuando un usuario se une a un grupo. Un miembro sumándose a una empresa es exactamente eso (group_id = la empresa).',
    corporate_created:
      'El registro corporativo es un lead calificado B2B; generate_lead es el evento de captura de leads de Google.',
    corporate_activated:
      'La activación deja la cuenta corporativa operativa — se mapea a sign_up (el alta efectiva de la cuenta).',
    corporate_member_joined:
      'Un miembro que se suma a un corporativo → join_group (group_id = el corporativo).',
    purchase:
      'purchase es la conversión central de ecommerce en GA4 (revenue, transacciones). Google lo recomienda para medir ventas; se dispara al confirmarse la orden.',
    refund:
      'refund es el evento de ecommerce que Google recomienda para medir revenue devuelto. Se dispara al reembolsar un pago; envía el valor reembolsado y los ítems.',
    add_to_cart:
      'Evento del embudo de compra que Google recomienda; marca la intención de compra al agregar un producto al carrito.',
    remove_from_cart:
      'Evento del embudo recomendado por Google; mide fricción/abandono al quitar productos del carrito.',
    add_shipping_info:
      'Paso del checkout que Google recomienda medir; se dispara al cargar los datos de envío.',
    add_payment_info:
      'Paso del checkout que Google recomienda medir; se dispara al iniciar el pago (sesión de pago creada).',
    begin_checkout:
      'Google recomienda begin_checkout al iniciar el checkout. Es un evento de navegación (lo dispara el storefront); no tiene equivalente de backend.',
  },
  COLUMN_TITLE: 'Título',
  COLUMN_TYPE: 'Tipo',
  COLUMN_MEDUSA_EVENT: 'Evento de Medusa',
  COLUMN_GA4_EVENT: 'Evento de GA4',
  COLUMN_STATUS: 'Estado',
  COLUMN_ACTIONS: 'Acciones',
  STATUS_ACTIVE: 'Activo',
  STATUS_INACTIVE: 'Inactivo',
  STATUS_REMOVED: 'Eliminado',

  // Filtro "Estado" de la tabla (radio). Sin filtro = los eliminados se ocultan.
  FILTER_STATUS: 'Estado',
  FILTER_STATUS_ACTIVE: 'Activo',
  FILTER_STATUS_INACTIVE: 'Inactivo',
  FILTER_STATUS_REMOVED: 'Eliminado',
  FILTER_CLEAR_ALL: 'Limpiar todo',

  // Tipo de fila (cómo se gestiona cada evento)
  TYPE: {
    builtin: 'Automático',
    generic: 'Personalizable',
    readonly: 'Storefront',
  },
  // Tooltip del badge de tipo, explicando qué significa cada uno
  TYPE_HINT: {
    builtin:
      'Evento del embudo ecommerce que envía el backend. El payload (ítems, valor) se calcula solo — solo podés activarlo/desactivarlo y renombrar el evento GA4.',
    generic:
      'Un mapeo que controlás por completo: elegís el evento de Medusa, el nombre del evento GA4 y sus parámetros.',
    readonly:
      'Lo dispara el storefront en el navegador (gtag.js). Se muestra como referencia — no se puede gestionar desde acá.',
  },
  // Etapa del recorrido del cliente (agrupa la lista como un embudo)
  STAGE: {
    funnel: 'Embudo ecommerce',
    acquisition: 'Adquisición y leads',
    b2b: 'Ciclo de vida B2B',
  },

  EMPTY_STATE:
    'Todavía no hay mapeos de eventos. Creá tu primer mapeo para empezar a enviar eventos a GA4.',
  CREATE_BUTTON: 'Crear',
  SEARCH_PLACEHOLDER: 'Buscar mapeos',

  // Form fields (shared by create & edit)
  FIELD_MEDUSA_EVENT_LABEL: 'Evento de Medusa *',
  FIELD_MEDUSA_EVENT_PLACEHOLDER: 'Elegí un evento',
  FIELD_MEDUSA_EVENT_SEARCH: 'Buscar eventos…',
  SEARCH_NO_RESULTS: 'Sin resultados',
  FIELD_MEDUSA_EVENT_HELP: 'El evento de Medusa que dispara este mapeo',
  FIELD_GA4_EVENT_LABEL: 'Nombre del evento de GA4 *',
  FIELD_GA4_EVENT_PLACEHOLDER: 'purchase',
  FIELD_GA4_EVENT_HELP: 'El nombre del evento que se reporta a Google Analytics 4',
  FIELD_DESCRIPTION_LABEL: 'Descripción',
  FIELD_DESCRIPTION_PLACEHOLDER: 'Para qué sirve este mapeo',
  FIELD_ACTIVE_LABEL: 'Activo',
  FIELD_ACTIVE_HELP: 'Los mapeos inactivos no envían eventos a GA4',

  // Advanced section
  ADVANCED_TITLE: 'Opciones avanzadas',

  // Param mappings editor
  PARAMS_TITLE: 'Mapeo de parámetros',
  PARAMS_HELP:
    'Asociá parámetros de GA4 a un valor tomado del payload del evento o a un valor fijo.',
  PARAMS_SUGGESTED: 'Parámetros sugeridos: {{params}}',
  PARAMS_EXAMPLE:
    'Ejemplo: una "Ruta de origen" order.total toma ese campo del payload del evento; un "Valor fijo" USD manda siempre ese valor exacto. Usá uno u otro por fila — si ponés los dos, gana el valor fijo.',
  PARAM_GA4_PARAM_LABEL: 'Parámetro GA4',
  PARAM_GA4_PARAM_PLACEHOLDER: 'value',
  PARAM_SOURCE_PATH_LABEL: 'Ruta de origen',
  PARAM_SOURCE_PATH_PLACEHOLDER: 'order.total',
  PARAM_STATIC_VALUE_LABEL: 'Valor fijo',
  PARAM_STATIC_VALUE_PLACEHOLDER: 'valor fijo',
  PARAM_REMOVE: 'Quitar',
  PARAM_ADD: 'Agregar parámetro',

  // Create drawer
  CREATE_TITLE: 'Crear mapeo',
  CREATE_SUBMIT: 'Crear mapeo',
  CREATE_SUCCESS: 'Mapeo creado correctamente',
  CREATE_ERROR: 'Error al crear el mapeo: {{msg}}',
  VALIDATION_REQUIRED: 'El evento de Medusa y el nombre del evento de GA4 son obligatorios',

  // Edit drawer
  EDIT_TITLE: 'Editar mapeo',
  EDIT_SUBMIT: 'Guardar cambios',
  UPDATE_SUCCESS: 'Mapeo actualizado correctamente',
  UPDATE_ERROR: 'Error al actualizar el mapeo: {{msg}}',

  // Common buttons
  CANCEL: 'Cancelar',

  // Actions menu
  ACTION_EDIT: 'Editar',
  ACTION_DELETE: 'Eliminar',
  ACTION_VIEW: 'Ver detalle',
  ACTION_RESTORE: 'Restaurar',
  DELETE_PROMPT_TITLE: 'Eliminar mapeo',
  DELETE_PROMPT_DESCRIPTION:
    '¿Estás seguro de que querés eliminar el mapeo de "{{event}}"? Esta acción no se puede deshacer.',
  DELETE_PROMPT_CONFIRM: 'Eliminar',
  DELETE_PROMPT_CANCEL: 'Cancelar',
  DELETE_SUCCESS: 'Mapeo eliminado correctamente',
  DELETE_ERROR: 'Error al eliminar el mapeo: {{msg}}',
  DELETE_DISABLED_MANAGED:
    'Los eventos del storefront los dispara el navegador; no se gestionan desde el backend.',
  HIDE_BUILTIN_PROMPT_TITLE: '¿Eliminar este evento?',
  HIDE_BUILTIN_PROMPT_DESC:
    'Desaparecerá de la lista y dejará de enviarse a GA4. Podés restaurarlo después.',
  HIDE_BUILTIN_SUCCESS: 'Evento eliminado',
  RESTORE_SUCCESS: 'Evento restaurado',

  // Etiquetas de categoría (por clave de categoría)
  CATEGORIES: {
    recomendados: 'Recomendados',
    b2b: 'Empresas y corporativo (B2B)',
  },

  // Eventos de ecommerce ya trackeados en otro lado (filas de solo lectura)
  STATUS_TRACKED: 'Ya activo',
  MANAGED_REASON:
    'Ya lo envía {{source}} automáticamente — se gestiona fuera de este módulo para no duplicar eventos.',
  SOURCE: {
    plugin: 'Plugin (servidor)',
    storefront: 'Storefront (cliente)',
  },

  // Eventos ecommerce built-in (server-side; payload calculado automáticamente)
  BUILTIN_NOTE: 'El contenido del evento (ítems, valor, moneda) se calcula automáticamente.',
  BUILTIN: {
    purchase: {
      TITLE: 'Compra',
      DESC: 'Cuando se coloca una orden. Envía ítems, valor, impuestos y envío.',
    },
    refund: {
      TITLE: 'Reembolso',
      DESC: 'Cuando se reembolsa un pago. Envía el valor reembolsado, la moneda y los ítems.',
    },
    add_to_cart: { TITLE: 'Agregar al carrito', DESC: 'Cuando se agregan ítems al carrito.' },
    remove_from_cart: { TITLE: 'Quitar del carrito', DESC: 'Cuando se quitan ítems del carrito.' },
    add_shipping_info: {
      TITLE: 'Datos de envío',
      DESC: 'Cuando se establece una dirección de envío en el carrito.',
    },
    add_payment_info: { TITLE: 'Datos de pago', DESC: 'Cuando se crea una sesión de pago.' },
  },
  MANAGED: {
    begin_checkout: {
      TITLE: 'Inicio de checkout',
      DESC: 'Se dispara cuando el cliente llega a la página de checkout. Lo trackea el storefront (gtag.js) en el navegador.',
    },
  },
  MANAGED_MEDUSA_NONE: 'Ninguno — evento del navegador (no hay evento de Medusa)',
  MANAGED_WHY: {
    storefront:
      'Es un evento de navegación del lado del cliente que dispara el storefront cuando el cliente entra al checkout. No existe un evento de Medusa equivalente en el backend, así que no se puede gestionar desde esta extensión.',
    plugin:
      'Este evento lo envía automáticamente una integración externa, no este módulo, así que no se puede gestionar acá.',
  },
  DETAIL_TITLE: 'Detalle del evento',
  DETAIL_SOURCE_LABEL: 'Fuente',
  DETAIL_WHY_LABEL: 'Por qué no se puede editar',

  // Títulos y descripciones amigables (por eventI18nKey(medusa_event))
  EVENTS: {
    customer_created: {
      TITLE: 'Registro de cliente',
      DESC: 'Cuando un cliente nuevo crea su cuenta en la tienda.',
    },
    contact_submission_created: {
      TITLE: 'Formulario de contacto enviado',
      DESC: 'Cuando un visitante envía el formulario de contacto — se registra como lead.',
    },
    company_created: {
      TITLE: 'Alta de empresa',
      DESC: 'Cuando se crea una empresa (B2B) — alta directa, sin aprobación.',
    },
    company_member_joined: {
      TITLE: 'Miembro se une a empresa',
      DESC: 'Cuando un usuario se suma a una empresa existente.',
    },
    corporate_created: {
      TITLE: 'Registro corporativo enviado',
      DESC: 'Cuando se envía el formulario de registro corporativo (queda pendiente hasta aprobación) — un lead.',
    },
    corporate_member_joined: {
      TITLE: 'Miembro se une a corporativo',
      DESC: 'Cuando un usuario acepta la invitación y se suma al corporativo.',
    },
    corporate_activated: {
      TITLE: 'Cuenta corporativa activada',
      DESC: 'Cuando una cuenta corporativa pasa a estado activo.',
    },
    corporate_suspended: {
      TITLE: 'Cuenta corporativa suspendida',
      DESC: 'Cuando una cuenta corporativa se suspende.',
    },
    corporate_member_invited: {
      TITLE: 'Invitación a corporativo',
      DESC: 'Cuando se invita a un usuario a una cuenta corporativa.',
    },
    corporate_rule_updated: {
      TITLE: 'Regla corporativa actualizada',
      DESC: 'Cuando se modifica una regla de la cuenta corporativa.',
    },
    billing_profile_created: {
      TITLE: 'Perfil de facturación creado',
      DESC: 'Cuando un cliente crea un perfil de facturación.',
    },
    billing_profile_updated: {
      TITLE: 'Perfil de facturación actualizado',
      DESC: 'Cuando se modifican los datos de un perfil de facturación.',
    },
    billing_profile_deleted: {
      TITLE: 'Perfil de facturación eliminado',
      DESC: 'Cuando se elimina un perfil de facturación.',
    },
    billing_profile_default_changed: {
      TITLE: 'Perfil de facturación por defecto cambiado',
      DESC: 'Cuando el cliente cambia su perfil de facturación predeterminado.',
    },
    order_fulfillment_created: {
      TITLE: 'Pedido enviado',
      DESC: 'Cuando se genera el envío (fulfillment) de un pedido.',
    },
    order_fulfillment_canceled: {
      TITLE: 'Envío cancelado',
      DESC: 'Cuando se cancela el envío de un pedido.',
    },
    product_created: {
      TITLE: 'Producto creado',
      DESC: 'Cuando se crea un producto en el catálogo (evento de admin, sin usuario).',
    },
    product_updated: {
      TITLE: 'Producto actualizado',
      DESC: 'Cuando se modifica un producto del catálogo (evento de admin).',
    },
    product_deleted: {
      TITLE: 'Producto eliminado',
      DESC: 'Cuando se elimina un producto del catálogo (evento de admin).',
    },
  },
};

/**
 * Registers the GA4 Events translation bundles on the i18n instance that
 * Medusa's admin actually initialized.
 *
 * IMPORTANT: pass the `i18n` instance from `useTranslation()` — do NOT call the
 * bare `i18next` singleton. With pnpm, the admin bundle can resolve a second,
 * uninitialized copy of i18next whose `addResourceBundle` is unavailable
 * ("addResourceBundle is not a function"). The hook's instance is always the
 * live, initialized one.
 */
export const registerGa4EventsTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', GA4_EVENTS_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', GA4_EVENTS_NAMESPACE, es, true, true);

  // Mark the namespace as loaded so react-i18next re-renders components
  // that read it before registration (otherwise raw keys stick).
  void i18n.loadNamespaces(GA4_EVENTS_NAMESPACE);

  registered = true;
};
