import i18next, { type i18n as I18nInstance } from 'i18next';

const WHATSAPP_NAMESPACE = 'whatsapp';
let registered = false;

export const en = {
  // List / page
  TITLE: 'WhatsApp templates',
  CREATE_BUTTON: 'Create',
  EMPTY_STATE: 'No templates yet. Create one — it will go to Meta review (PENDING).',
  ERROR_LOAD_TITLE: 'Templates could not be loaded.',
  ERROR_LOAD_DESC:
    'Check KAPSO_API_KEY and KAPSO_BUSINESS_ACCOUNT_ID. The Kapso sandbox does not support template management: you need a production number.',
  ERROR_SANDBOX:
    "You're on a Kapso sandbox number, which only supports messaging — not template management. A production WhatsApp number is required to create, list or delete templates.",
  UNASSIGNED: 'Unassigned',

  // Columns
  COL_NAME: 'Name',
  COL_LANGUAGE: 'Language',
  COL_CATEGORY: 'Category',
  COL_STATUS: 'Status',
  COL_EVENT: 'Event',

  // Actions / row menu
  ACTIONS_MENU: 'Actions',
  ACTION_VIEW: 'View',
  ACTION_EDIT: 'Edit',
  ACTION_ASSIGN: 'Assign',
  ACTION_DELETE: 'Delete',
  CONFIRM_DELETE_TITLE: 'Delete template',
  CONFIRM_DELETE_DESC: 'Delete "{{name}}"? This action cannot be undone.',
  CONFIRM_DELETE_CONFIRM: 'Delete',
  CONFIRM_CANCEL: 'Cancel',
  TOAST_DELETED: 'Template "{{name}}" deleted',
  TOAST_DELETE_FAILED: 'The template could not be deleted',

  // View drawer (read-only)
  VIEW_TITLE: 'Template "{{name}}"',
  VIEW_ASSIGNED_EVENTS: 'Assigned events',
  VIEW_META_HEADING: 'Details',

  // Edit modal
  FORM_EDIT_TITLE: 'Edit WhatsApp template',
  EDIT_LOCKED_HINT: "Name and language can't be changed — Meta locks them when the template is created.",
  EDIT_APPROVED_WARNING:
    'Editing the content or category resubmits the template to Meta review (it goes back to PENDING).',
  EDIT_STATUS_LOCKED:
    'This template is under review or disabled by Meta, so its content cannot be edited right now. You can still change its event assignment.',
  BTN_SAVE_CHANGES: 'Save changes',
  TOAST_UPDATED: 'Template "{{name}}" updated',
  TOAST_UPDATE_FAILED: 'The template could not be updated',

  // Modal / tabs
  FORM_CREATE_TITLE: 'New WhatsApp template',
  TAB_BASICS: 'Basics',
  TAB_CONTENT: 'Content',
  TAB_ASSIGN: 'Assignment',

  // Chooser (step 0)
  CHOOSER_TITLE: 'How do you want to start?',
  CHOOSER_SCRATCH_TITLE: 'From scratch',
  CHOOSER_SCRATCH_DESC: 'Create an empty template and write it yourself.',
  CHOOSER_PRESETS_TITLE: 'Suggested templates',
  CHOOSER_PRESETS_DESC: 'Start from a predefined template and edit it before creating.',
  CHOOSER_PRESET_USE: 'Use',
  CHOOSER_PRESET_EXISTS: 'Already created',
  CHOOSER_VERIFY_FAILED:
    'Could not verify which ones already exist in Kapso (sandbox or no production number?). You can still open and edit them.',

  // Basics
  FIELD_NAME: 'Name',
  PLACEHOLDER_NAME: 'order_confirmation',
  HELP_NAME: 'Lowercase, numbers and underscore only.',
  FIELD_CATEGORY: 'Category',
  CATEGORY_UTILITY_INFO:
    'Transactional: order confirmation, shipping, receipts, account alerts. It is the cheapest and the one that matches order notifications.',
  CATEGORY_MARKETING_INFO:
    'Promotional: offers, news, cart recovery. It is the most expensive, requires opt-in and has per-user sending limits.',
  CATEGORY_AUTHENTICATION_INFO:
    'One-time codes (OTP) / account verification. Format restricted by Meta (no promotional content).',
  CATEGORY_RECATEGORIZE_NOTE:
    'Meta may recategorize the template during review if the content does not match the chosen category.',
  FIELD_LANGUAGE: 'Language',
  PLACEHOLDER_LANGUAGE: 'es',

  // Content
  FIELD_BODY: 'Body',
  BODY_PLACEHOLDER: 'Hi {{p1}} 👋 Your order #{{p2}} was confirmed. Total: $ {{p3}}.',
  BODY_HINT:
    'Detected variables: {{count}}. Use {{tokens}} in order. WhatsApp formatting: *bold* _italic_ ~strikethrough~.',
  TOOLBAR_BOLD: 'Bold  *text*',
  TOOLBAR_ITALIC: 'Italic  _text_',
  TOOLBAR_STRIKE: 'Strikethrough  ~text~',
  TOOLBAR_MONO: 'Monospace  ```text```',
  FIELD_EXAMPLES: 'Variable examples',
  EXAMPLES_HINT:
    'Meta requires one example per variable to review the template. One value per field — decimals with a comma (e.g. 12.500,00) are fine.',
  EXAMPLE_PLACEHOLDER: 'Example for {{token}}',

  // Assignment
  FIELD_ASSIGN_EVENT: 'Assign to event (optional)',
  ASSIGN_EVENT_PLACEHOLDER: 'Unassigned…',
  FIELD_VAR_MAPPING: 'Variable mapping',
  VAR_MAPPING_PLACEHOLDER: 'Pick a variable…',
  NO_VARS_HINT: 'This template has no variables — it will be sent as-is.',
  FIELD_PUBLISH: 'Publish the assignment (used when sending; the template must be approved)',
  ASSIGN_INFO_PENDING:
    'The template will be created and sent to Meta review. You can assign it to an event now (optional).',
  ASSIGN_INFO_READY: 'Assign this template to an event (optional) and finish.',

  // Preview
  PREVIEW_TITLE: 'Preview',
  PREVIEW_VARIABLES: 'Detected variables',
  PREVIEW_VAR_EMPTY: 'no example',
  PREVIEW_HINT: 'Live preview — replaces {{token}} with the examples.',

  // Buttons
  BTN_CANCEL: 'Cancel',
  BTN_BACK: 'Back',
  BTN_CONTINUE: 'Continue',
  BTN_CREATE: 'Create',
  BTN_CLOSE: 'Close',
  BTN_SAVE: 'Save',

  // Validation / toasts
  ERROR_NAME_BODY_REQUIRED: 'Name and body are required',
  ERROR_EXAMPLE_REQUIRED: 'Complete an example for each variable ({{range}})',
  ERROR_MAPPING_REQUIRED: 'Assign an event variable to each template position',
  ERROR_EVENT_REQUIRED: 'Pick which event to assign this template to',
  TOAST_CREATED: 'Template "{{name}}" sent to review.',
  TOAST_CREATE_FAILED: 'The template could not be created',
  TOAST_ASSIGNED: '"{{name}}" assigned to "{{event}}"',
  TOAST_ASSIGN_FAILED: 'The assignment could not be saved',
  TOAST_CREATED_ASSIGN_FAILED:
    'Template "{{name}}" created, but the assignment failed. Try saving the assignment again.',

  // Binding drawer
  ASSIGN_TITLE: 'Assign "{{name}}" to an event',
  BODY_PREVIEW_LABEL: 'Template body ({{language}}):',
  FIELD_EVENT: 'Event',
  SELECT_EVENT_PLACEHOLDER: 'Pick an event…',

  // Events
  EVENT_ORDER_CONFIRMATION: 'Order confirmation',
  EVENT_ORDER_TRACKING: 'Shipment tracking (Andreani)',
  EVENT_ORDER_DELIVERY: 'Out for delivery (own fleet)',
  EVENT_ORDER_READY_FOR_PICKUP: 'Ready for store pickup',
  EVENT_ORDER_CANCELLED: 'Order cancelled',
  EVENT_PASSWORD_RESET: 'Password reset',
  EVENT_CART_ABANDONED_1: 'Abandoned cart · step 1 (1h)',
  EVENT_CART_ABANDONED_2: 'Abandoned cart · step 2 (24h)',
  EVENT_CART_ABANDONED_3: 'Abandoned cart · step 3 (72h)',
  EVENT_RECURRING_ORDER_CREATED: 'Subscription · created',
  EVENT_RECURRING_ORDER_PAUSED: 'Subscription · paused',
  EVENT_RECURRING_ORDER_RESUMED: 'Subscription · resumed',
  EVENT_RECURRING_ORDER_SKIPPED: 'Subscription · delivery skipped',
  EVENT_RECURRING_ORDER_CANCELLED: 'Subscription · cancelled',
  EVENT_RECURRING_ORDER_GENERATED: 'Subscription · order created',
  EVENT_RECURRING_ORDER_UPDATED: 'Subscription · details updated',
  EVENT_RECURRING_RENEWAL_READY: 'Recurring purchase · ready to confirm',
  EVENT_RECURRING_RENEWAL_UPCOMING: 'Subscription · upcoming automatic charge',
  EVENT_RECURRING_RENEWAL_REMINDER: 'Recurring purchase · payment reminder',
  EVENT_RECURRING_ORDER_FAILED: 'Recurring purchase · needs attention',
  EVENT_RECURRING_STOCK_UNAVAILABLE: 'Subscription · waiting for stock',
  EVENT_RECURRING_STOCK_SKIPPED: 'Subscription · cycle skipped due to stock',
  EVENT_RECURRING_PAYMENT_FAILED: 'Subscription · automatic payment failed',

  // Variables
  VAR_CUSTOMER_NAME: 'Customer name',
  VAR_DISPLAY_ID: 'Order number',
  VAR_TOTAL: 'Total',
  VAR_CURRENCY_CODE: 'Currency',
  VAR_ORDER_DATE: 'Order date',
  VAR_SHIPPING_METHOD_NAME: 'Shipping method',
  VAR_CUSTOMER_EMAIL: 'Customer email',
  VAR_TRACKING_NUMBER: 'Tracking number',
  VAR_TRACKING_URL: 'Tracking link',
  VAR_DRIVER_NAME: 'Driver name',
  VAR_DRIVER_PHONE: 'Driver phone',
  VAR_VEHICLE_TYPE: 'Vehicle type',
  VAR_STORE_NAME: 'Pickup store',
  VAR_STORE_ADDRESS: 'Store address',
  VAR_RESET_URL: 'Reset link',
  VAR_RECOVERY_URL: 'Cart recovery link',
  VAR_CONFIRMATION_URL: 'Renewal payment link',
  VAR_FREQUENCY_LABEL: 'Subscription frequency',
  VAR_RECURRING_ORDER_ID: 'Subscription ID',
  VAR_CYCLE_ID: 'Cycle ID',
  VAR_NEXT_EXECUTION: 'Next delivery date',
  VAR_MANAGE_URL: 'Subscription management link',

  // Sidebar / nav labels
  NAV_TEMPLATES: 'Templates',
  NAV_ADVISOR: 'Advisor',
  NAV_FLOWS: 'Conversation flow',
  NAV_JOURNEYS: 'Journeys',
  NAV_SETTINGS: 'Settings',

  // Floating button (storefront)
  FAB_TITLE: 'Floating WhatsApp button',
  FAB_DESC:
    'Shows a WhatsApp button in the corner of the storefront so shoppers can start a chat from any page.',
  FAB_STATUS_LIVE: 'Visible in the store',
  FAB_STATUS_HIDDEN: 'Hidden',
  FAB_MISSING_PHONE:
    'Add a phone number: while it is empty the button stays hidden, even with the toggle on.',
  FAB_PHONE_LABEL: 'WhatsApp number',
  FAB_PHONE_PLACEHOLDER: '+54 9 11 5555 5555',
  FAB_PHONE_HELP:
    'International format, with country code. Spaces, dashes and the leading + are fine — only the digits are stored.',
  FAB_MESSAGE_LABEL: 'Prefilled message',
  FAB_MESSAGE_PLACEHOLDER: 'Hi! I have a question.',
  FAB_MESSAGE_HELP:
    'Text the chat opens with. Leave it empty to open an empty conversation.',
  FAB_LABEL_LABEL: 'Button text',
  FAB_LABEL_HELP:
    'Used as the tooltip and as the accessible name for screen readers.',
  FAB_PLACEMENT_NOTE:
    'The button sits in the bottom-right corner and moves up on its own to clear the mobile nav, the sticky add-to-cart bar and the back-to-top button.',
  FAB_TOAST_SAVED: 'Floating button saved',
  FAB_TOAST_FAILED: 'Could not save: {{message}}',

  // Inbox
  INBOX_TITLE: 'Inbox',
  INBOX_LOADING: 'Loading inbox…',
  INBOX_NOT_CONFIGURED: 'The WhatsApp inbox is not set up yet. To enable it:',
  INBOX_STEP_EMBED:
    'In the Kapso dashboard, go to <b>Project → Inbox Embeds</b> and create an embed (scope <c>project</c>).',
  INBOX_STEP_ORIGINS:
    'In <b>Allowed origins</b>, add this admin domain (with a wildcard if needed), or the iframe will not load.',
  INBOX_STEP_ENV:
    'Copy the <c>embed_url</c> and set it as the <c>KAPSO_INBOX_EMBED_URL</c> environment variable on the backend.',
  INBOX_STEP_RESTART: 'Restart the backend and reload this page.',
};

export const es: typeof en = {
  // List / page
  TITLE: 'Plantillas de WhatsApp',
  CREATE_BUTTON: 'Crear',
  EMPTY_STATE: 'No hay plantillas todavía. Creá una — quedará en revisión de Meta (PENDING).',
  ERROR_LOAD_TITLE: 'No se pudieron cargar las plantillas.',
  ERROR_LOAD_DESC:
    'Verificá KAPSO_API_KEY y KAPSO_BUSINESS_ACCOUNT_ID. El sandbox de Kapso no soporta gestión de plantillas: necesitás un número de producción.',
  ERROR_SANDBOX:
    'Estás usando un número sandbox de Kapso, que solo permite mensajería — no la gestión de plantillas. Para crear, listar o eliminar plantillas necesitás un número de WhatsApp de producción.',
  UNASSIGNED: 'Sin asignar',

  // Columns
  COL_NAME: 'Nombre',
  COL_LANGUAGE: 'Idioma',
  COL_CATEGORY: 'Categoría',
  COL_STATUS: 'Estado',
  COL_EVENT: 'Evento',

  // Actions / row menu
  ACTIONS_MENU: 'Acciones',
  ACTION_VIEW: 'Ver',
  ACTION_EDIT: 'Editar',
  ACTION_ASSIGN: 'Asignar',
  ACTION_DELETE: 'Eliminar',
  CONFIRM_DELETE_TITLE: 'Eliminar plantilla',
  CONFIRM_DELETE_DESC: '¿Eliminar "{{name}}"? Esta acción no se puede deshacer.',
  CONFIRM_DELETE_CONFIRM: 'Eliminar',
  CONFIRM_CANCEL: 'Cancelar',
  TOAST_DELETED: 'Plantilla "{{name}}" eliminada',
  TOAST_DELETE_FAILED: 'No se pudo eliminar la plantilla',

  // View drawer (solo lectura)
  VIEW_TITLE: 'Plantilla "{{name}}"',
  VIEW_ASSIGNED_EVENTS: 'Eventos asignados',
  VIEW_META_HEADING: 'Detalles',

  // Edit modal
  FORM_EDIT_TITLE: 'Editar plantilla de WhatsApp',
  EDIT_LOCKED_HINT: 'El nombre y el idioma no se pueden cambiar — Meta los fija al crear la plantilla.',
  EDIT_APPROVED_WARNING:
    'Editar el contenido o la categoría vuelve a enviar la plantilla a revisión de Meta (queda en PENDING).',
  EDIT_STATUS_LOCKED:
    'Esta plantilla está en revisión o deshabilitada por Meta, así que su contenido no se puede editar por ahora. Sí podés cambiar su asignación a evento.',
  BTN_SAVE_CHANGES: 'Guardar cambios',
  TOAST_UPDATED: 'Plantilla "{{name}}" actualizada',
  TOAST_UPDATE_FAILED: 'No se pudo actualizar la plantilla',

  // Modal / tabs
  FORM_CREATE_TITLE: 'Nueva plantilla de WhatsApp',
  TAB_BASICS: 'Datos',
  TAB_CONTENT: 'Contenido',
  TAB_ASSIGN: 'Asignación',

  // Chooser (step 0)
  CHOOSER_TITLE: '¿Cómo querés empezar?',
  CHOOSER_SCRATCH_TITLE: 'Desde cero',
  CHOOSER_SCRATCH_DESC: 'Creá una plantilla vacía y escribila vos.',
  CHOOSER_PRESETS_TITLE: 'Plantillas sugeridas',
  CHOOSER_PRESETS_DESC: 'Partí de una plantilla predefinida y editala antes de crearla.',
  CHOOSER_PRESET_USE: 'Usar',
  CHOOSER_PRESET_EXISTS: 'Ya creada',
  CHOOSER_VERIFY_FAILED:
    'No se pudo verificar cuáles ya existen en Kapso (¿sandbox o sin número de producción?). Podés abrirlas y editarlas igual.',

  // Basics
  FIELD_NAME: 'Nombre',
  PLACEHOLDER_NAME: 'order_confirmation',
  HELP_NAME: 'Solo minúsculas, números y guión bajo.',
  FIELD_CATEGORY: 'Categoría',
  CATEGORY_UTILITY_INFO:
    'Transaccional: confirmación de pedido, envío, recibos, alertas de cuenta. Es la más barata y la que corresponde a notificaciones de pedidos.',
  CATEGORY_MARKETING_INFO:
    'Promocional: ofertas, novedades, recuperación de carrito. Es la más cara, requiere opt-in y tiene límites de envío por usuario.',
  CATEGORY_AUTHENTICATION_INFO:
    'Códigos de un solo uso (OTP) / verificación de cuenta. Formato restringido por Meta (sin contenido promocional).',
  CATEGORY_RECATEGORIZE_NOTE:
    'Meta puede recategorizar la plantilla en la revisión si el contenido no coincide con la categoría elegida.',
  FIELD_LANGUAGE: 'Idioma',
  PLACEHOLDER_LANGUAGE: 'es',

  // Content
  FIELD_BODY: 'Cuerpo',
  BODY_PLACEHOLDER: 'Hola {{p1}} 👋 Tu pedido #{{p2}} fue confirmado. Total: $ {{p3}}.',
  BODY_HINT:
    'Variables detectadas: {{count}}. Usá {{tokens}} en orden. Formato de WhatsApp: *negrita* _cursiva_ ~tachado~.',
  TOOLBAR_BOLD: 'Negrita  *texto*',
  TOOLBAR_ITALIC: 'Cursiva  _texto_',
  TOOLBAR_STRIKE: 'Tachado  ~texto~',
  TOOLBAR_MONO: 'Monoespaciado  ```texto```',
  FIELD_EXAMPLES: 'Ejemplos de variables',
  EXAMPLES_HINT:
    'Meta exige un ejemplo por variable para revisar la plantilla. Un valor por campo — los decimales con coma (ej. 12.500,00) no son problema.',
  EXAMPLE_PLACEHOLDER: 'Ejemplo para {{token}}',

  // Assignment
  FIELD_ASSIGN_EVENT: 'Asignar a evento (opcional)',
  ASSIGN_EVENT_PLACEHOLDER: 'Sin asignar…',
  FIELD_VAR_MAPPING: 'Mapeo de variables',
  VAR_MAPPING_PLACEHOLDER: 'Elegí una variable…',
  NO_VARS_HINT: 'Esta plantilla no tiene variables — se enviará tal cual.',
  FIELD_PUBLISH: 'Publicar la asignación (se usa al enviar; la plantilla debe estar aprobada)',
  ASSIGN_INFO_PENDING:
    'La plantilla se creará y se enviará a revisión de Meta. Ya podés asignarla a un evento (opcional).',
  ASSIGN_INFO_READY: 'Asigná esta plantilla a un evento (opcional) y finalizá.',

  // Preview
  PREVIEW_TITLE: 'Vista previa',
  PREVIEW_VARIABLES: 'Variables detectadas',
  PREVIEW_VAR_EMPTY: 'sin ejemplo',
  PREVIEW_HINT: 'Vista previa en vivo — reemplaza {{token}} por los ejemplos.',

  // Buttons
  BTN_CANCEL: 'Cancelar',
  BTN_BACK: 'Atrás',
  BTN_CONTINUE: 'Continuar',
  BTN_CREATE: 'Crear',
  BTN_CLOSE: 'Cerrar',
  BTN_SAVE: 'Guardar',

  // Validation / toasts
  ERROR_NAME_BODY_REQUIRED: 'El nombre y el cuerpo son obligatorios',
  ERROR_EXAMPLE_REQUIRED: 'Completá un ejemplo para cada variable ({{range}})',
  ERROR_MAPPING_REQUIRED: 'Asigná una variable del evento a cada posición de la plantilla',
  ERROR_EVENT_REQUIRED: 'Elegí a qué evento asignar esta plantilla',
  TOAST_CREATED: 'Plantilla "{{name}}" enviada a revisión.',
  TOAST_CREATE_FAILED: 'No se pudo crear la plantilla',
  TOAST_ASSIGNED: '"{{name}}" asignada a "{{event}}"',
  TOAST_ASSIGN_FAILED: 'No se pudo guardar la asignación',
  TOAST_CREATED_ASSIGN_FAILED:
    'Plantilla "{{name}}" creada, pero falló la asignación. Reintentá guardar la asignación.',

  // Binding drawer
  ASSIGN_TITLE: 'Asignar "{{name}}" a un evento',
  BODY_PREVIEW_LABEL: 'Cuerpo de la plantilla ({{language}}):',
  FIELD_EVENT: 'Evento',
  SELECT_EVENT_PLACEHOLDER: 'Elegí un evento…',

  // Events
  EVENT_ORDER_CONFIRMATION: 'Confirmación de pedido',
  EVENT_ORDER_TRACKING: 'Seguimiento de envío (Andreani)',
  EVENT_ORDER_DELIVERY: 'En camino — flota propia',
  EVENT_ORDER_READY_FOR_PICKUP: 'Listo para retirar en tienda',
  EVENT_ORDER_CANCELLED: 'Pedido cancelado',
  EVENT_PASSWORD_RESET: 'Restablecer contraseña',
  EVENT_CART_ABANDONED_1: 'Carrito abandonado · paso 1 (1h)',
  EVENT_CART_ABANDONED_2: 'Carrito abandonado · paso 2 (24h)',
  EVENT_CART_ABANDONED_3: 'Carrito abandonado · paso 3 (72h)',
  EVENT_RECURRING_ORDER_CREATED: 'Suscripción · alta',
  EVENT_RECURRING_ORDER_PAUSED: 'Suscripción · pausada',
  EVENT_RECURRING_ORDER_RESUMED: 'Suscripción · reanudada',
  EVENT_RECURRING_ORDER_SKIPPED: 'Suscripción · entrega omitida',
  EVENT_RECURRING_ORDER_CANCELLED: 'Suscripción · cancelada',
  EVENT_RECURRING_ORDER_GENERATED: 'Suscripción · pedido generado',
  EVENT_RECURRING_ORDER_UPDATED: 'Suscripción · datos actualizados',
  EVENT_RECURRING_RENEWAL_READY: 'Compra recurrente · lista para confirmar',
  EVENT_RECURRING_RENEWAL_UPCOMING: 'Suscripción · próximo cobro automático',
  EVENT_RECURRING_RENEWAL_REMINDER: 'Compra recurrente · recordatorio de pago',
  EVENT_RECURRING_ORDER_FAILED: 'Compra recurrente · requiere atención',
  EVENT_RECURRING_STOCK_UNAVAILABLE: 'Suscripción · esperando stock',
  EVENT_RECURRING_STOCK_SKIPPED: 'Suscripción · ciclo omitido por stock',
  EVENT_RECURRING_PAYMENT_FAILED: 'Suscripción · cobro automático rechazado',

  // Variables
  VAR_CUSTOMER_NAME: 'Nombre del cliente',
  VAR_DISPLAY_ID: 'Número de orden',
  VAR_TOTAL: 'Total',
  VAR_CURRENCY_CODE: 'Moneda',
  VAR_ORDER_DATE: 'Fecha del pedido',
  VAR_SHIPPING_METHOD_NAME: 'Método de envío',
  VAR_CUSTOMER_EMAIL: 'Email del cliente',
  VAR_TRACKING_NUMBER: 'Nº de seguimiento',
  VAR_TRACKING_URL: 'Link de seguimiento',
  VAR_DRIVER_NAME: 'Nombre del conductor',
  VAR_DRIVER_PHONE: 'Teléfono del conductor',
  VAR_VEHICLE_TYPE: 'Tipo de vehículo',
  VAR_STORE_NAME: 'Sucursal de retiro',
  VAR_STORE_ADDRESS: 'Dirección de la sucursal',
  VAR_RESET_URL: 'Link de reseteo',
  VAR_RECOVERY_URL: 'Link de recuperación del carrito',
  VAR_CONFIRMATION_URL: 'Link de pago de la renovación',
  VAR_FREQUENCY_LABEL: 'Frecuencia de la suscripción',
  VAR_RECURRING_ORDER_ID: 'ID de la suscripción',
  VAR_CYCLE_ID: 'ID del ciclo',
  VAR_NEXT_EXECUTION: 'Fecha de próxima entrega',
  VAR_MANAGE_URL: 'Link de autogestión de la suscripción',

  // Sidebar / nav labels
  NAV_TEMPLATES: 'Plantillas',
  NAV_ADVISOR: 'Asesor',
  NAV_FLOWS: 'Recorrido',
  NAV_JOURNEYS: 'Recorridos de clientes',
  NAV_SETTINGS: 'Ajustes',

  // Botón flotante (storefront)
  FAB_TITLE: 'Botón flotante de WhatsApp',
  FAB_DESC:
    'Muestra un botón de WhatsApp en la esquina del storefront para que el cliente pueda escribir desde cualquier página.',
  FAB_STATUS_LIVE: 'Visible en la tienda',
  FAB_STATUS_HIDDEN: 'Oculto',
  FAB_MISSING_PHONE:
    'Falta el teléfono: mientras esté vacío el botón no se muestra, aunque el toggle esté activado.',
  FAB_PHONE_LABEL: 'Número de WhatsApp',
  FAB_PHONE_PLACEHOLDER: '+54 9 11 5555 5555',
  FAB_PHONE_HELP:
    'Formato internacional, con código de país. Podés escribirlo con espacios, guiones o + — se guardan solo los dígitos.',
  FAB_MESSAGE_LABEL: 'Mensaje pre-cargado',
  FAB_MESSAGE_PLACEHOLDER: 'Hola! Tengo una consulta.',
  FAB_MESSAGE_HELP:
    'Texto con el que se abre el chat. Dejalo vacío para abrir la conversación en blanco.',
  FAB_LABEL_LABEL: 'Texto del botón',
  FAB_LABEL_HELP:
    'Se usa como tooltip y como nombre accesible para lectores de pantalla.',
  FAB_PLACEMENT_NOTE:
    'El botón se ubica abajo a la derecha y se corre solo para no taparse con el nav mobile, la barra de agregar al carrito ni el botón de volver arriba.',
  FAB_TOAST_SAVED: 'Botón flotante guardado',
  FAB_TOAST_FAILED: 'No se pudo guardar: {{message}}',

  // Inbox
  INBOX_TITLE: 'Bandeja',
  INBOX_LOADING: 'Cargando bandeja…',
  INBOX_NOT_CONFIGURED: 'La bandeja de WhatsApp todavía no está configurada. Para activarla:',
  INBOX_STEP_EMBED:
    'En el dashboard de Kapso, ir a <b>Project → Inbox Embeds</b> y crear un embed (scope <c>project</c>).',
  INBOX_STEP_ORIGINS:
    'En <b>Allowed origins</b>, agregar el dominio de este admin (con wildcard si corresponde), o el iframe no carga.',
  INBOX_STEP_ENV:
    'Copiar la <c>embed_url</c> y setearla como variable de entorno <c>KAPSO_INBOX_EMBED_URL</c> en el backend.',
  INBOX_STEP_RESTART: 'Reiniciar el backend y recargar esta página.',
};

/**
 * Registers the WhatsApp translation bundles on the i18n instance that
 * Medusa's admin actually initialized.
 *
 * IMPORTANT: pass the `i18n` instance from `useTranslation()` — do NOT call the
 * bare `i18next` singleton. With pnpm, the admin bundle can resolve a second,
 * uninitialized copy of i18next whose `addResourceBundle` is unavailable
 * ("addResourceBundle is not a function"). The hook's instance is always the
 * live, initialized one.
 */
export const registerWhatsappTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', WHATSAPP_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', WHATSAPP_NAMESPACE, es, true, true);

  // Mark the namespace as loaded so react-i18next re-renders components
  // that read it before registration (otherwise raw keys stick).
  void i18n.loadNamespaces(WHATSAPP_NAMESPACE);

  registered = true;
};

export { WHATSAPP_NAMESPACE };

/**
 * Resuelve el idioma del admin para contextos donde NO hay `useTranslation`
 * (los `label` de `defineRouteConfig` se evalúan al importar el módulo, cuando
 * `i18next.language` todavía puede no estar seteado).
 *
 * Medusa usa i18next-browser-languagedetector con la clave `lng` (orden:
 * cookie → localStorage → header). Leemos esa fuente ya persistida para acertar
 * el idioma en el primer render. Default `es`: este admin es español-first
 * (igual que el resto de las extensiones, que hardcodean labels en español).
 */
function resolveAdminLocale(): 'es' | 'en' {
  const pick = (raw?: string | null): 'es' | 'en' | undefined =>
    raw ? (raw.toLowerCase().startsWith('es') ? 'es' : 'en') : undefined;

  // Fuente persistida PRIMERO: con pnpm el `i18next` importado puede ser una
  // instancia secundaria con `.language` en 'en' por defecto — la cookie/
  // localStorage `lng` refleja lo que la instancia REAL detectó.
  if (typeof document !== 'undefined') {
    const cookie = document.cookie.match(/(?:^|;\s*)(?:lng|i18nextLng)=([^;]+)/);
    const fromCookie = pick(cookie ? decodeURIComponent(cookie[1]) : null);
    if (fromCookie) return fromCookie;
  }

  if (typeof localStorage !== 'undefined') {
    const fromLs = pick(localStorage.getItem('lng') ?? localStorage.getItem('i18nextLng'));
    if (fromLs) return fromLs;
  }

  const active = pick(i18next?.language);
  if (active) return active;

  return 'es';
}

/** Label de sidebar/breadcrumb resuelto por idioma, para usar fuera de React. */
export const whatsappLabel = (key: keyof typeof en): string =>
  (resolveAdminLocale() === 'es' ? es : en)[key];
