import type { i18n as I18nInstance } from 'i18next';

const EMAIL_TEMPLATES_NAMESPACE = 'emailTemplates';
let registered = false;

export const en = {
  TITLE: 'Sendgrid',
  SUBTITLE: '',
  CREATE_BUTTON: 'Create',
  BRANDING_BUTTON: 'Settings',
  BRANDING_TITLE: 'Email settings',
  EDIT: 'Edit',
  PUBLISH: 'Publish',
  UNPUBLISH: 'Unpublish',
  DELETE: 'Delete',
  EMPTY_STATE: 'No templates yet. Create one or run the seed to import the current ones.',

  COLUMN_NAME: 'Name',
  COLUMN_EVENT: 'Event',
  COLUMN_KEY: 'Key',
  COLUMN_STATUS: 'Status',
  COLUMN_LOCALE: 'Locale',
  COLUMN_UPDATED: 'Updated',

  STATUS_DRAFT: 'Draft',
  STATUS_PUBLISHED: 'Published',

  CREATE_TITLE: 'Create template',
  EDIT_TITLE: 'Edit template',
  FIELD_NAME: 'Name *',
  FIELD_NAME_PLACEHOLDER: 'Order confirmation',
  FIELD_KEY: 'Key',
  FIELD_KEY_PLACEHOLDER: 'order-confirmation',
  // UNA oración. Que la clave tiene que coincidir EXACTAMENTE con la del template
  // de código —y qué pasa si no— es la primera sección del drawer, que además
  // explica el síntoma: una plantilla que se ve publicada y no reemplaza nada. Se
  // conserva "se genera del nombre" porque es comportamiento del campo mismo:
  // dejarlo vacío no es un error, y eso no se deduce mirándolo.
  FIELD_KEY_HELP: 'Identifier matched when sending; generated from the name if left empty.',
  FIELD_SUBJECT: 'Subject *',
  FIELD_SUBJECT_PLACEHOLDER: 'Your order {{display_id}}',
  FIELD_STATUS: 'Status',
  FIELD_STATUS_HELP: 'Only published templates override the hardcoded code template.',
  FIELD_LOCALE: 'Locale',
  FIELD_LOCALE_PLACEHOLDER: 'es-AR',
  FIELD_DESCRIPTION: 'Description',
  EDIT_CONTENT: 'Edit content',
  SAVE: 'Save',
  CANCEL: 'Cancel',

  // Editor
  EDITOR_HTML: 'HTML (Handlebars)',
  EDITOR_BLOCK_LOADING: 'Loading block editor…',
  EDITOR_VARIABLES: 'Available variables',
  EDITOR_VARIABLES_EMPTY: 'No declared variables. Use {{name}} for values, {{#each items}} for lists.',
  EDITOR_PREVIEW: 'Preview',
  EDITOR_PREVIEW_REFRESH: 'Refresh preview',
  EDITOR_PREVIEW_SUBJECT: 'Subject',
  EDITOR_BACK: 'Back',
  EDITOR_TEST_SEND: 'Send test',
  EDITOR_TEST_SEND_PROMPT: 'Recipient email for the test send',
  EDITOR_SAMPLE_DATA: 'Sample data (JSON)',
  EDITOR_SAMPLE_DATA_HELP: 'Used to render the preview and test send.',
  EDITOR_SAMPLE_DATA_ADVANCED: 'Advanced (JSON)',
  EDITOR_VARIABLES_FORM: 'Test data (form)',
  EDITOR_VARIABLES_COPY_HINT: 'Click to copy the token.',
  EDITOR_VARIABLE_COPIED: 'Copied: {{token}}',

  // Real sends (notification.data) — NOT the demo sample_data
  // Botón propio en el header, y no una pestaña adentro de la vista previa: la
  // sección tiene que ser encontrable SIN pasar por "Vista previa", que es
  // justamente la pantalla de los valores de demo.
  SENDS_BUTTON: 'Real sends',
  SENDS_TITLE: 'Last real sends',
  // La oración que resuelve la confusión que motivó la feature: acá los dos bloques
  // se llamaban "variables" y uno era de mentira.
  SENDS_HELP:
    'The actual values each variable had in the emails that were really sent. This is NOT the test data above: nothing here is rendered from sample_data.',
  SENDS_VS_SAMPLE:
    'Test data = demo values you type in, for the preview. Real sends = what the system actually sent.',
  SENDS_EMPTY:
    'This template has not been sent yet. As soon as the event fires (an order, a password reset), the sends will show up here with their real values.',
  SENDS_EMPTY_HINT:
    'Admin test sends are not listed: they go out already rendered from the demo data, so they would not tell you anything about the real values.',
  SENDS_LOADING: 'Loading sends…',
  SENDS_ERROR: 'Could not load the sends: {{msg}}',
  SENDS_REFRESH: 'Refresh',
  SENDS_COLUMN_DATE: 'Date',
  SENDS_COLUMN_TO: 'Recipient',
  SENDS_COLUMN_STATUS: 'Status',
  SENDS_COLUMN_VALUE: 'Real value',
  SENDS_COLUMN_VARIABLE: 'Variable',
  SENDS_SELECT_HINT: 'Pick a send to see its values.',
  SENDS_STATE_OK: 'OK',
  SENDS_STATE_EMPTY: 'Empty',
  SENDS_STATE_MISSING: 'Not sent',
  SENDS_STATE_EMPTY_HELP:
    'The sender includes the key but it arrived blank: the email rendered an empty string here.',
  SENDS_STATE_MISSING_HELP:
    'No sender populates this key. Handlebars renders it as an empty string, and nothing shows up in the log.',
  SENDS_PROBLEMS_ONE: '1 variable with a problem',
  SENDS_PROBLEMS_OTHER: '{{count}} variables with a problem',
  SENDS_NO_PROBLEMS: 'All variables have a value',
  SENDS_UNDECLARED_TITLE: 'Undeclared keys ({{count}})',
  SENDS_UNDECLARED_HELP:
    'These travel in the payload and no one declared them. You can use them in the template.',
  SENDS_MASKED: 'Truncated for security: this value carries a token.',
  SENDS_UNATTRIBUTED:
    '{{count}} send(s) are hidden: their payload carries no store marker, so they cannot be attributed to the active store.',
  SENDS_VALUE_MISSING: '— not in the payload —',

  // Test-send modal
  TEST_SEND_DUAL_HINT:
    'This event notifies two audiences. You can send a test to both or just one.',
  TEST_SEND_SINGLE_HINT: 'Enter the email you want to send the test to.',
  TEST_SEND_ADMIN_EMAIL: 'Admin email',
  TEST_SEND_USER_EMAIL: 'User email',
  TEST_SEND_RECIPIENT: 'Recipient email',
  TEST_SEND_EMAIL_REQUIRED: 'Enter at least one email.',
  TEST_SEND_SIBLING_MISSING:
    'The sibling template does not exist yet. Create it first to include that audience in the test.',

  // List
  COLUMN_AUDIENCE: 'Audience',

  CREATE_SUCCESS: 'Template created',
  UPDATE_SUCCESS: 'Template saved',
  DELETE_SUCCESS: 'Template deleted',
  PUBLISH_SUCCESS: 'Template published',
  UNPUBLISH_SUCCESS: 'Template moved to draft',
  TEST_SEND_SUCCESS: 'Test email sent to {{to}}',
  ACTION_ERROR: 'Action failed: {{msg}}',
  VALIDATION_NAME_REQUIRED: 'Name is required',
  VALIDATION_SAMPLE_DATA_JSON: 'Sample data must be valid JSON',
  DELETE_CONFIRM: 'Delete this template? This cannot be undone.',
};

export const es = {
  TITLE: 'Sendgrid',
  SUBTITLE: '',
  CREATE_BUTTON: 'Crear',
  BRANDING_BUTTON: 'Configuración',
  BRANDING_TITLE: 'Configuración de emails',
  EDIT: 'Editar',
  PUBLISH: 'Publicar',
  UNPUBLISH: 'Despublicar',
  DELETE: 'Eliminar',
  EMPTY_STATE: 'Todavía no hay plantillas. Creá una o corré el seed para importar las actuales.',

  COLUMN_NAME: 'Nombre',
  COLUMN_EVENT: 'Evento',
  COLUMN_KEY: 'Clave',
  COLUMN_STATUS: 'Estado',
  COLUMN_LOCALE: 'Idioma',
  COLUMN_UPDATED: 'Actualizada',

  STATUS_DRAFT: 'Borrador',
  STATUS_PUBLISHED: 'Publicada',

  CREATE_TITLE: 'Crear plantilla',
  EDIT_TITLE: 'Editar plantilla',
  FIELD_NAME: 'Nombre *',
  FIELD_NAME_PLACEHOLDER: 'Confirmación de pedido',
  FIELD_KEY: 'Clave',
  FIELD_KEY_PLACEHOLDER: 'order-confirmation',
  // Ver la nota de la clave en inglés.
  FIELD_KEY_HELP: 'Identificador con el que se busca al enviar; se genera del nombre si lo dejás vacío.',
  FIELD_SUBJECT: 'Asunto *',
  FIELD_SUBJECT_PLACEHOLDER: 'Tu pedido {{display_id}}',
  FIELD_STATUS: 'Estado',
  FIELD_STATUS_HELP: 'Solo las plantillas publicadas reemplazan al template hardcodeado en código.',
  FIELD_LOCALE: 'Idioma',
  FIELD_LOCALE_PLACEHOLDER: 'es-AR',
  FIELD_DESCRIPTION: 'Descripción',
  EDIT_CONTENT: 'Editar contenido',
  SAVE: 'Guardar',
  CANCEL: 'Cancelar',

  // Editor
  EDITOR_HTML: 'HTML (Handlebars)',
  EDITOR_BLOCK_LOADING: 'Cargando editor de bloques…',
  EDITOR_VARIABLES: 'Variables disponibles',
  EDITOR_VARIABLES_EMPTY: 'No hay variables declaradas. Usá {{name}} para valores y {{#each items}} para listas.',
  EDITOR_PREVIEW: 'Vista previa',
  EDITOR_PREVIEW_REFRESH: 'Actualizar vista previa',
  EDITOR_PREVIEW_SUBJECT: 'Asunto',
  EDITOR_BACK: 'Volver',
  EDITOR_TEST_SEND: 'Enviar prueba',
  EDITOR_TEST_SEND_PROMPT: 'Email del destinatario para la prueba',
  EDITOR_SAMPLE_DATA: 'Datos de ejemplo (JSON)',
  EDITOR_SAMPLE_DATA_HELP: 'Se usan para renderizar la vista previa y el envío de prueba.',
  EDITOR_SAMPLE_DATA_ADVANCED: 'Avanzado (JSON)',
  EDITOR_VARIABLES_FORM: 'Datos de prueba (formulario)',
  EDITOR_VARIABLES_COPY_HINT: 'Hacé click para copiar el token.',
  EDITOR_VARIABLE_COPIED: 'Copiado: {{token}}',

  // Envíos reales (notification.data) — NO son los datos de prueba
  // Ver la nota de la clave en inglés.
  SENDS_BUTTON: 'Envíos reales',
  SENDS_TITLE: 'Últimos envíos reales',
  // Ver la nota de la clave en inglés.
  SENDS_HELP:
    'Los valores que tuvo cada variable en los mails que salieron de verdad. NO son los datos de prueba de arriba: acá no hay nada renderizado con sample_data.',
  SENDS_VS_SAMPLE:
    'Datos de prueba = valores de demo que escribís vos, para la vista previa. Envíos reales = lo que el sistema mandó de verdad.',
  SENDS_EMPTY:
    'Esta plantilla todavía no se envió. En cuanto se dispare el evento (un pedido, un reseteo de contraseña), los envíos aparecen acá con sus valores reales.',
  SENDS_EMPTY_HINT:
    'Los envíos de prueba del admin no se listan: salen ya renderizados con los datos de demo, así que no dirían nada sobre los valores reales.',
  SENDS_LOADING: 'Cargando envíos…',
  SENDS_ERROR: 'No se pudieron cargar los envíos: {{msg}}',
  SENDS_REFRESH: 'Actualizar',
  SENDS_COLUMN_DATE: 'Fecha',
  SENDS_COLUMN_TO: 'Destinatario',
  SENDS_COLUMN_STATUS: 'Estado',
  SENDS_COLUMN_VALUE: 'Valor real',
  SENDS_COLUMN_VARIABLE: 'Variable',
  SENDS_SELECT_HINT: 'Elegí un envío para ver sus valores.',
  SENDS_STATE_OK: 'OK',
  SENDS_STATE_EMPTY: 'Vacía',
  SENDS_STATE_MISSING: 'No se envió',
  SENDS_STATE_EMPTY_HELP:
    'El emisor manda la clave pero llegó vacía: el mail renderizó una cadena vacía acá.',
  SENDS_STATE_MISSING_HELP:
    'Ningún emisor pobla esta clave. Handlebars la renderiza como cadena vacía y no queda nada en el log.',
  SENDS_PROBLEMS_ONE: '1 variable con problema',
  SENDS_PROBLEMS_OTHER: '{{count}} variables con problema',
  SENDS_NO_PROBLEMS: 'Todas las variables tienen valor',
  SENDS_UNDECLARED_TITLE: 'Claves no declaradas ({{count}})',
  SENDS_UNDECLARED_HELP:
    'Viajan en el payload y nadie las declaró. Las podés usar en la plantilla.',
  SENDS_MASKED: 'Truncado por seguridad: este valor lleva un token.',
  SENDS_UNATTRIBUTED:
    'Hay {{count}} envío(s) oculto(s): su payload no trae marcador de tienda, así que no se pueden atribuir a la tienda activa.',
  SENDS_VALUE_MISSING: '— no está en el payload —',

  // Modal test-send
  TEST_SEND_DUAL_HINT:
    'Este evento notifica dos audiencias. Podés enviar la prueba a ambas o solo a una.',
  TEST_SEND_SINGLE_HINT: 'Ingresá el email al que querés enviar la prueba.',
  TEST_SEND_ADMIN_EMAIL: 'Email del admin',
  TEST_SEND_USER_EMAIL: 'Email del usuario',
  TEST_SEND_RECIPIENT: 'Email del destinatario',
  TEST_SEND_EMAIL_REQUIRED: 'Ingresá al menos un email.',
  TEST_SEND_SIBLING_MISSING:
    'La plantilla hermana no existe todavía. Creala primero para incluir esa audiencia en la prueba.',

  // Listado
  COLUMN_AUDIENCE: 'Audiencia',

  CREATE_SUCCESS: 'Plantilla creada',
  UPDATE_SUCCESS: 'Plantilla guardada',
  DELETE_SUCCESS: 'Plantilla eliminada',
  PUBLISH_SUCCESS: 'Plantilla publicada',
  UNPUBLISH_SUCCESS: 'Plantilla pasada a borrador',
  TEST_SEND_SUCCESS: 'Email de prueba enviado a {{to}}',
  ACTION_ERROR: 'La acción falló: {{msg}}',
  VALIDATION_NAME_REQUIRED: 'El nombre es obligatorio',
  VALIDATION_SAMPLE_DATA_JSON: 'Los datos de ejemplo deben ser JSON válido',
  DELETE_CONFIRM: '¿Eliminar esta plantilla? No se puede deshacer.',
};

/**
 * Registers the Email Templates translation bundles on the live admin i18n
 * instance. Pass the `i18n` from `useTranslation()`.
 */
export const registerEmailTemplatesTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }
  i18n.addResourceBundle('en', EMAIL_TEMPLATES_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', EMAIL_TEMPLATES_NAMESPACE, es, true, true);
  void i18n.loadNamespaces(EMAIL_TEMPLATES_NAMESPACE);
  registered = true;
};
