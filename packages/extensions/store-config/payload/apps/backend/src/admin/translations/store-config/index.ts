import type { i18n as I18nInstance } from 'i18next';

const STORE_CONFIG_NAMESPACE = 'storeConfig';
let registered = false;

export const en = {
  // Page
  TITLE: 'Preferences',

  // Tabs
  TAB_COMMERCE: 'Commerce',
  TAB_BRANCHES: 'Branches',
  TAB_STOREFRONT: 'Storefront',
  TAB_EMAIL: 'Email',
  TAB_AI: 'AI',
  TAB_FISCAL: 'Fiscal documentation',
  TAB_MIN_PURCHASE: 'Minimum purchase',
  TAB_ACCESS: 'Access',
  TAB_LEGAL: 'Legal',

  // Password page (site gate)
  ACCESS_TITLE: 'Password page',
  ACCESS_DESCRIPTION:
    'While enabled, the site cannot be browsed without typing the password. Use it for a store that has not opened to the public yet.',
  ACCESS_COLUMN_SITE: 'Site',
  ACCESS_COLUMN_PASSWORD: 'Password',
  ACCESS_MAIN_STORE: 'Main store',
  ACCESS_ENABLED_LABEL: 'Enabled',
  ACCESS_EMPTY: 'No sites to configure.',
  ACCESS_PASSWORD_PLACEHOLDER: 'E.g.: launch26',
  ACCESS_PASSWORD_HELP:
    'Between {{min}} and {{max}} characters, no spaces. The form draws one box per character, so its length is visible.',
  ACCESS_UNLOCK_HINT: 'Visitors who get it right keep access for 24 hours.',
  ACCESS_NO_PASSWORD: 'Set a password to enable it',
  ACCESS_TOO_LONG:
    'Too long: shorten it to {{max}} characters. The one saved earlier still works until you replace it.',
  ACCESS_SAVE: 'Save',
  ACCESS_SAVED: 'Access settings saved',
  ACCESS_SAVE_ERROR: 'Could not save: {{msg}}',
  ACCESS_PROPAGATION_HINT:
    'Changes can take up to a minute to show up on the storefront (config cache).',

  // Minimum purchase section
  MIN_PURCHASE_TITLE: 'Minimum purchase',
  MIN_PURCHASE_CURRENT_LABEL: 'Current minimum',
  MIN_PURCHASE_NONE: 'No minimum',
  MIN_PURCHASE_CURRENT_UNTIL: 'Until {{date}}',
  MIN_PURCHASE_CURRENT_OPEN_ENDED: 'Open-ended',
  MIN_PURCHASE_AUDIT_HINT:
    'Changes are append-only: every change creates a new record so the history stays auditable.',

  // Table
  COLUMN_AMOUNT: 'Amount',
  COLUMN_CURRENCY: 'Currency',
  COLUMN_STARTS_AT: 'Start',
  COLUMN_ENDS_AT: 'End',
  COLUMN_NOTE: 'Note',
  COLUMN_CREATED_AT: 'Created',
  EMPTY_STATE: 'No minimum purchase records yet. Create the first one to get started.',
  CREATE_BUTTON: 'Create',

  // Create drawer
  CREATE_TITLE: 'New minimum purchase',
  CREATE_SUBMIT: 'Create',
  CREATE_SUCCESS: 'Minimum purchase created successfully',
  CREATE_ERROR: 'Failed to create minimum purchase: {{msg}}',
  FIELD_AMOUNT_LABEL: 'Amount *',
  FIELD_AMOUNT_PLACEHOLDER: 'E.g.: 15000',
  FIELD_CURRENCY_LABEL: 'Currency',
  FIELD_STARTS_AT_LABEL: 'Starts at *',
  FIELD_ENDS_AT_LABEL: 'Ends at',
  FIELD_ENDS_AT_HELP: 'Optional. Leave empty for an open-ended minimum.',
  FIELD_NOTE_LABEL: 'Note',
  FIELD_NOTE_PLACEHOLDER: 'Reason for the change (audit trail)',

  // Currencies
  CURRENCY_ARS: 'ARS — Argentine peso',
  CURRENCY_USD: 'USD — US dollar',
  CURRENCY_EUR: 'EUR — Euro',

  // Validation
  VALIDATION_AMOUNT: 'Amount must be a whole number greater than 0',
  VALIDATION_STARTS_AT: 'Start date is required',
  VALIDATION_ENDS_AT: 'End date must be after the start date',


  // Legal pages
  LEGAL_TITLE: 'Legal texts',
  LEGAL_DESCRIPTION:
    'Title, intro, last-updated date and sections of the three legal pages on the storefront. Until now this text lived in the site code, so every store published the same sample.',
  LEGAL_LOADING: 'Loading legal texts…',
  LEGAL_PAGE_legals: 'Privacy policy',
  LEGAL_PAGE_conditions: 'Terms and conditions',
  LEGAL_PAGE_exchangesAndReturns: 'Exchanges and returns',
  LEGAL_BADGE_SAMPLE: 'sample',
  LEGAL_SAMPLE_WARNING:
    'This page is publishing the boilerplate sample text — it names "La Empresa S.A." and "www.ejemplo.com.ar". Replace it with your own text: it is the page your customers read as a contract.',
  LEGAL_FIELD_TITLE: 'Title',
  LEGAL_FIELD_TITLE_HELP: 'The page heading and its browser title. Published at {{path}}.',
  LEGAL_FIELD_UPDATED: 'Last updated',
  LEGAL_FIELD_UPDATED_PLACEHOLDER: 'E.g.: August 2026',
  LEGAL_FIELD_UPDATED_HELP:
    'Free text, shown next to the title. Leave it empty to hide it — it is a claim about the document, so nothing fills it in for you.',
  LEGAL_FIELD_INTRO: 'Intro',
  LEGAL_FIELD_INTRO_HELP: 'One or two lines under the title, summarizing the document.',
  LEGAL_FIELD_SEO: 'Meta description',
  LEGAL_FIELD_SEO_HELP:
    'The summary search engines show. Leave it empty to use the default one.',
  LEGAL_SECTIONS_TITLE: 'Sections',
  LEGAL_SECTIONS_HELP:
    'Each section is one entry in the side index and one accordion panel. Their order here is the order on the page.',
  LEGAL_SECTIONS_EMPTY:
    'No sections. Saving like this does NOT blank the page: it goes back to the sample text.',
  LEGAL_SECTION_ADD: 'Add section',
  LEGAL_SECTION_NAME: 'Section {{n}}',
  LEGAL_SECTION_NAME_PLACEHOLDER: 'E.g.: Information we collect',
  LEGAL_SECTION_UP: 'Move up',
  LEGAL_SECTION_DOWN: 'Move down',
  LEGAL_SECTION_REMOVE: 'Remove section',
  LEGAL_SAVE: 'Save',
  LEGAL_SAVED: 'Legal text saved',
  LEGAL_SAVE_ERROR: 'Could not save: {{msg}}',
  LEGAL_RESET: 'Restore sample text',
  LEGAL_RESET_DONE: 'The page went back to the sample text',
  LEGAL_PROPAGATION_HINT:
    'Changes can take up to a minute to show up on the storefront (page cache).',
  LEGAL_TB_BOLD: 'Bold',
  LEGAL_TB_ITALIC: 'Italic',
  LEGAL_TB_UNDERLINE: 'Underline',
  LEGAL_TB_STRIKE: 'Strikethrough',
  LEGAL_TB_H3: 'Subheading',
  LEGAL_TB_H4: 'Minor subheading',
  LEGAL_TB_BULLET: 'Bullet list',
  LEGAL_TB_ORDERED: 'Numbered list',
  LEGAL_TB_QUOTE: 'Quote',
  LEGAL_TB_DIVIDER: 'Divider',
  LEGAL_TB_LINK: 'Link',
  LEGAL_LINK_HELP: 'URL — a site path (/contact) or a full address',
  LEGAL_LINK_APPLY: 'Apply',

  // Common
  CANCEL: 'Cancel',
};

export const es = {
  // Page
  TITLE: 'Preferencias',

  // Tabs
  TAB_COMMERCE: 'Comercio',
  TAB_BRANCHES: 'Sucursales',
  TAB_STOREFRONT: 'Tienda',
  TAB_EMAIL: 'Email',
  TAB_AI: 'IA',
  TAB_FISCAL: 'Documentación Fiscal',
  TAB_MIN_PURCHASE: 'Mínimo de compra',
  TAB_ACCESS: 'Acceso',
  TAB_LEGAL: 'Legales',

  // Password page (site gate)
  ACCESS_TITLE: 'Página de contraseña',
  ACCESS_DESCRIPTION:
    'Mientras esté activa, el sitio no se puede navegar sin ingresar la contraseña. Sirve para una tienda que todavía no abrió al público.',
  ACCESS_COLUMN_SITE: 'Sitio',
  ACCESS_COLUMN_PASSWORD: 'Contraseña',
  ACCESS_MAIN_STORE: 'Tienda principal',
  ACCESS_ENABLED_LABEL: 'Activada',
  ACCESS_EMPTY: 'No hay sitios para configurar.',
  ACCESS_PASSWORD_PLACEHOLDER: 'Ej: lanzamiento26',
  ACCESS_PASSWORD_HELP:
    'Entre {{min}} y {{max}} caracteres, sin espacios. El formulario dibuja una casilla por carácter, así que el largo queda a la vista.',
  ACCESS_UNLOCK_HINT: 'Quien la acierta mantiene el acceso por 24 horas.',
  ACCESS_NO_PASSWORD: 'Poné una contraseña para poder activarla',
  ACCESS_TOO_LONG:
    'Muy larga: acortala a {{max}} caracteres. La que estaba guardada sigue funcionando hasta que la reemplaces.',
  ACCESS_SAVE: 'Guardar',
  ACCESS_SAVED: 'Configuración de acceso guardada',
  ACCESS_SAVE_ERROR: 'No se pudo guardar: {{msg}}',
  ACCESS_PROPAGATION_HINT:
    'Los cambios pueden tardar hasta un minuto en verse en la tienda (cache de configuración).',

  // Minimum purchase section
  MIN_PURCHASE_TITLE: 'Mínimo de compra',
  MIN_PURCHASE_CURRENT_LABEL: 'Mínimo vigente',
  MIN_PURCHASE_NONE: 'Sin mínimo',
  MIN_PURCHASE_CURRENT_UNTIL: 'Hasta {{date}}',
  MIN_PURCHASE_CURRENT_OPEN_ENDED: 'Sin fecha de fin',
  MIN_PURCHASE_AUDIT_HINT:
    'Los cambios son solo de alta: cada cambio crea un registro nuevo para mantener el historial auditable.',

  // Table
  COLUMN_AMOUNT: 'Monto',
  COLUMN_CURRENCY: 'Moneda',
  COLUMN_STARTS_AT: 'Inicio',
  COLUMN_ENDS_AT: 'Fin',
  COLUMN_NOTE: 'Nota',
  COLUMN_CREATED_AT: 'Creado',
  EMPTY_STATE: 'Todavía no hay registros de mínimo de compra. Creá el primero para empezar.',
  CREATE_BUTTON: 'Crear',

  // Create drawer
  CREATE_TITLE: 'Nuevo mínimo de compra',
  CREATE_SUBMIT: 'Crear',
  CREATE_SUCCESS: 'Mínimo de compra creado correctamente',
  CREATE_ERROR: 'Error al crear el mínimo de compra: {{msg}}',
  FIELD_AMOUNT_LABEL: 'Monto *',
  FIELD_AMOUNT_PLACEHOLDER: 'Ej: 15000',
  FIELD_CURRENCY_LABEL: 'Moneda',
  FIELD_STARTS_AT_LABEL: 'Inicio de vigencia *',
  FIELD_ENDS_AT_LABEL: 'Fin de vigencia',
  FIELD_ENDS_AT_HELP: 'Opcional. Dejalo vacío para un mínimo sin fecha de fin.',
  FIELD_NOTE_LABEL: 'Nota',
  FIELD_NOTE_PLACEHOLDER: 'Motivo del cambio (queda en el historial)',

  // Currencies
  CURRENCY_ARS: 'ARS — Peso argentino',
  CURRENCY_USD: 'USD — Dólar estadounidense',
  CURRENCY_EUR: 'EUR — Euro',

  // Validation
  VALIDATION_AMOUNT: 'El monto debe ser un número entero mayor a 0',
  VALIDATION_STARTS_AT: 'La fecha de inicio es obligatoria',
  VALIDATION_ENDS_AT: 'La fecha de fin debe ser posterior a la de inicio',


  // Legal pages
  LEGAL_TITLE: 'Textos legales',
  LEGAL_DESCRIPTION:
    'Título, bajada, fecha de última actualización y secciones de las tres páginas legales del storefront. Hasta ahora este texto vivía en el código del sitio, así que todas las tiendas publicaban el mismo texto de ejemplo.',
  LEGAL_LOADING: 'Cargando los textos legales…',
  LEGAL_PAGE_legals: 'Política de privacidad',
  LEGAL_PAGE_conditions: 'Términos y condiciones',
  LEGAL_PAGE_exchangesAndReturns: 'Cambios y devoluciones',
  LEGAL_BADGE_SAMPLE: 'ejemplo',
  LEGAL_SAMPLE_WARNING:
    'Esta página está publicando el texto de ejemplo del boilerplate: nombra a "La Empresa S.A." y a "www.ejemplo.com.ar". Reemplazalo por el propio — es la página que tus clientes leen como un contrato.',
  LEGAL_FIELD_TITLE: 'Título',
  LEGAL_FIELD_TITLE_HELP: 'El encabezado de la página y su título en el navegador. Se publica en {{path}}.',
  LEGAL_FIELD_UPDATED: 'Última actualización',
  LEGAL_FIELD_UPDATED_PLACEHOLDER: 'Ej.: Agosto de 2026',
  LEGAL_FIELD_UPDATED_HELP:
    'Texto libre, se muestra al lado del título. Vacío = no se muestra; es una afirmación sobre el documento, así que no se completa sola.',
  LEGAL_FIELD_INTRO: 'Bajada',
  LEGAL_FIELD_INTRO_HELP: 'Una o dos líneas bajo el título, que resumen el documento.',
  LEGAL_FIELD_SEO: 'Meta description',
  LEGAL_FIELD_SEO_HELP:
    'El resumen que muestran los buscadores. Vacío = se usa el que viene por defecto.',
  LEGAL_SECTIONS_TITLE: 'Secciones',
  LEGAL_SECTIONS_HELP:
    'Cada sección es un ítem del índice lateral y un panel del acordeón. El orden de acá es el orden de la página.',
  LEGAL_SECTIONS_EMPTY:
    'Sin secciones. Guardar así NO deja la página en blanco: vuelve al texto de ejemplo.',
  LEGAL_SECTION_ADD: 'Agregar sección',
  LEGAL_SECTION_NAME: 'Sección {{n}}',
  LEGAL_SECTION_NAME_PLACEHOLDER: 'Ej.: Información que recopilamos',
  LEGAL_SECTION_UP: 'Subir',
  LEGAL_SECTION_DOWN: 'Bajar',
  LEGAL_SECTION_REMOVE: 'Quitar sección',
  LEGAL_SAVE: 'Guardar',
  LEGAL_SAVED: 'Texto legal guardado',
  LEGAL_SAVE_ERROR: 'No se pudo guardar: {{msg}}',
  LEGAL_RESET: 'Volver al texto de ejemplo',
  LEGAL_RESET_DONE: 'La página volvió al texto de ejemplo',
  LEGAL_PROPAGATION_HINT:
    'Los cambios pueden tardar hasta un minuto en verse en el storefront (cache de la página).',
  LEGAL_TB_BOLD: 'Negrita',
  LEGAL_TB_ITALIC: 'Cursiva',
  LEGAL_TB_UNDERLINE: 'Subrayado',
  LEGAL_TB_STRIKE: 'Tachado',
  LEGAL_TB_H3: 'Subtítulo',
  LEGAL_TB_H4: 'Subtítulo menor',
  LEGAL_TB_BULLET: 'Lista',
  LEGAL_TB_ORDERED: 'Lista numerada',
  LEGAL_TB_QUOTE: 'Cita',
  LEGAL_TB_DIVIDER: 'Separador',
  LEGAL_TB_LINK: 'Link',
  LEGAL_LINK_HELP: 'URL — puede ser una ruta del sitio (/contact) o una dirección completa',
  LEGAL_LINK_APPLY: 'Aplicar',

  // Common
  CANCEL: 'Cancelar',
};

/**
 * Registers the Store Config translation bundles on the i18n instance that
 * Medusa's admin actually initialized.
 *
 * IMPORTANT: pass the `i18n` instance from `useTranslation()` — do NOT call the
 * bare `i18next` singleton (see translations/brands for the rationale).
 */
export const registerStoreConfigTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', STORE_CONFIG_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', STORE_CONFIG_NAMESPACE, es, true, true);

  // Mark the namespace as loaded so react-i18next re-renders components
  // that read it before registration (otherwise raw keys stick).
  void i18n.loadNamespaces(STORE_CONFIG_NAMESPACE);

  registered = true;
};
