import type { i18n as I18nInstance } from 'i18next';

const BANNERS_NAMESPACE = 'banners';
let registered = false;

export const en = {
  // Page
  TITLE: 'Banners',
  SUBTITLE: 'Manage the storefront banners by placement and status.',
  NEW_BANNER: 'New banner',
  CREATE_BUTTON: 'Create',
  EMPTY_STATE: 'No banners yet. Create the first one.',

  // Table headers
  COL_INTERNAL_NAME: 'Internal name',
  COL_PLACEMENT: 'Placement',
  COL_STATUS: 'Status',
  COL_PRIORITY: 'Priority',
  COL_DEVICE: 'Device',

  // Row actions
  ACTION_EDIT: 'Edit',
  ACTION_PUBLISH: 'Publish',
  ACTION_UNPUBLISH: 'Unpublish',
  ACTION_ARCHIVE: 'Archive',
  ACTION_DELETE: 'Delete',

  // Confirm
  CONFIRM_DELETE: 'Delete this banner?',

  // Toasts
  TOAST_DELETED: 'Banner deleted',
  TOAST_DELETE_FAILED: 'Failed to delete the banner',
  TOAST_PUBLISHED: 'Banner published',
  TOAST_PUBLISH_FAILED: 'Failed to publish the banner',
  TOAST_UNPUBLISHED: 'Banner unpublished',
  TOAST_UNPUBLISH_FAILED: 'Failed to unpublish the banner',
  TOAST_ARCHIVED: 'Banner archived',
  TOAST_ARCHIVE_FAILED: 'Failed to archive the banner',

  // Form drawer
  FORM_EDIT_TITLE: 'Edit Banner',
  FORM_CREATE_TITLE: 'New Banner',

  FIELD_INTERNAL_NAME: 'Internal name',
  PLACEHOLDER_INTERNAL_NAME: 'E.g.: Top bar January 2025',

  FIELD_PLACEMENT: 'Placement *',
  PLACEHOLDER_PLACEMENT: 'Select placement',

  FIELD_STATUS: 'Status',

  FIELD_DEVICE: 'Device',
  PLACEHOLDER_DEVICE: 'All devices',

  FIELD_TYPE: 'Type',
  PLACEHOLDER_TYPE: 'E.g.: image, video, card',

  FIELD_PRIORITY: 'Priority',

  FIELD_COUNTDOWN_SECONDS: 'Auto-close countdown (seconds)',
  HELP_COUNTDOWN_SECONDS: 'Seconds before the splash closes by itself. 0 = no auto-close (only the X).',
  FIELD_SPLASH_BG: 'Splash background',
  HELP_SPLASH_BG: 'Choose a plain color or a full-screen background image. Title, subtitle and logo are always optional.',
  SPLASH_BG_COLOR: 'Background color',
  SPLASH_BG_COLOR_HELP: 'Plain color + centered image.',
  SPLASH_BG_IMAGE: 'Background image',
  SPLASH_BG_IMAGE_HELP: 'The image fills the whole screen.',
  FIELD_SHOW_LOGO: 'Show logo above the title',
  HELP_SHOW_LOGO: 'Displays the store logo above the title in the splash.',
  SECTION_LINKS: 'Links',
  FIELD_STICKY_LINKS: 'Links (logo + URL)',
  HELP_STICKY_LINKS: 'Add up to 4 items (image + link). You can leave it empty, but then set a button (label + URL) below.',
  FIELD_STICKY_LINK_IMAGE: 'Image (URL)',
  FIELD_STICKY_LINK_URL: 'Link',
  ADD_STICKY_LINK: 'Add link',

  SECTION_CONTENT: 'Content',
  FIELD_CONTENT_TITLE: 'Title',
  FIELD_CONTENT_SUBTITLE: 'Subtitle',
  FIELD_CONTENT_BODY: 'Body',

  SECTION_MEDIA: 'Media',
  FIELD_MEDIA_URL: 'Image/video URL',
  MEDIA_UPLOAD_BUTTON: 'Upload image',
  MEDIA_UPLOADING: 'Uploading...',
  MEDIA_UPLOAD_HINT: 'or paste a URL above',
  MEDIA_UPLOAD_SUCCESS: 'Image uploaded',
  MEDIA_UPLOAD_FAILED: 'Failed to upload image: {{msg}}',
  SECTION_TARGETING: 'Audience',
  FIELD_CUSTOMER_GROUPS: 'Customer groups',
  TARGETING_ALL_HINT: 'Shown to everyone. Select groups to restrict it.',
  TARGETING_SELECTED_HINT: 'Only shown to customers in the selected groups.',
  TARGETING_NO_GROUPS: 'No customer groups yet.',

  SECTION_CTA: 'CTA',
  FIELD_CTA_URL: 'URL',
  FIELD_CTA_LABEL: 'Button label',
  PLACEHOLDER_CTA_LABEL: 'E.g.: See more',
  FIELD_CTA_TARGET: 'Target',

  FIELD_CARD_COLOR: 'Card color (card_color)',
  FIELD_BACKGROUND_COLOR: 'Background color',
  FIELD_ICON_COLOR: 'Icon color',
  FIELD_TEXT_COLOR: 'Text color (title/subtitle)',
  FIELD_CTA_TEXT_COLOR: 'CTA text color',
  FIELD_ICON: 'Icon',
  PLACEHOLDER_ICON: 'Select an icon',
  PLACEHOLDER_CARD_COLOR: '#ffffff or CSS name',
  PLACEHOLDER_ICON_COLOR: '#2e7d32',
  PLACEHOLDER_TEXT_COLOR: '#ffffff',
  PLACEHOLDER_CTA_TEXT_COLOR: '#ffffff',
  ICON_CREDIT_CARD: 'Credit card',
  ICON_TRUCK: 'Truck',
  ICON_GIFT: 'Gift',
  ICON_SHIELD: 'Shield',
  ICON_STAR: 'Star',
  ICON_TAG: 'Tag',
  COLOR_THEME_PRIMARY: 'Theme primary',
  COLOR_THEME_PRIMARY_DARK: 'Theme primary dark',
  COLOR_THEME_PRIMARY_SOFT: 'Theme primary soft',
  COLOR_THEME_SURFACE: 'Surface',
  COLOR_THEME_TEXT: 'Text',
  COLOR_THEME_MUTED: 'Muted',

  FIELD_START_AT: 'Start',
  FIELD_END_AT: 'End',

  BTN_CANCEL: 'Cancel',
  BTN_SAVE: 'Save changes',
  BTN_CREATE: 'Create banner',

  TOAST_CREATED: 'Banner created',
  TOAST_UPDATED: 'Banner updated',
  TOAST_SAVE_FAILED: 'Failed to save the banner',

  // Placement-centric admin
  LOADING: 'Loading...',
  PLACEMENT_TOP_BAR: 'Top bar',
  PLACEMENT_BANNER_0: 'Banner',
  PLACEMENT_BANNER_1: 'Main banner',
  PLACEMENT_BANNER_2: 'Banner 2',
  PLACEMENT_BANNER_3: 'Banner 3',
  PLACEMENT_BANNER_4: 'Banner 4',
  PLACEMENT_BANNER_5: 'Banner 5',
  PLACEMENT_BANNER_6: 'Banner 6',
  PLACEMENT_STICKY_FOOTER: 'Sticky footer',
  PLACEMENT_WELCOME_SPLASH: 'Welcome splash (mobile)',
  ITEM_MESSAGE: 'Message',
  ITEM_MESSAGE_PLURAL: 'Messages',
  ITEM_SLIDE: 'Slide',
  ITEM_SLIDE_PLURAL: 'Slides',
  ITEM_CARD: 'Card',
  ITEM_CARD_PLURAL: 'Cards',
  ITEM_HIGHLIGHT: 'Highlight',
  ITEM_HIGHLIGHT_PLURAL: 'Highlights',
  ITEM_SPLASH: 'Splash',
  ITEM_SPLASH_PLURAL: 'Splashes',
  PLACEMENT_EMPTY: 'No items yet',
  PLACEMENT_UNKNOWN: 'Unknown placement.',
  BACK_TO_PLACEMENTS: 'Back to Banners',
  BADGE_ACTIVE: '{{count}} active',
  BADGE_DRAFTS: '{{count}} draft(s)',
  BADGE_NEXT: 'Next: {{date}}',
  DEVICE_FILTER_ALL: 'All devices',
  ADD_ITEM: 'Add {{item}}',
  PREVIEW_TITLE: 'Preview',
  PREVIEW_EMPTY: 'Nothing published right now for this placement.',
  PREVIEW_HINT: 'Live preview — updates as you type.',
  GROUP_PUBLISHED: 'Published',
  GROUP_SCHEDULED: 'Scheduled',
  GROUP_DRAFTS: 'Drafts',
  GROUP_ARCHIVED: 'Archived',
  SECTION_BASIC: 'Basics',
  SECTION_STYLE: 'Style',
  SECTION_SCHEDULE: 'Schedule',
  SECTION_ADVANCED: 'Advanced (not used by this placement)',
  FIELD_PLACEMENT_FIXED: 'Placement:',
  FORM_CREATE_ITEM_TITLE: 'New {{item}}',
  FORM_EDIT_ITEM_TITLE: 'Edit {{item}}',
  ERROR_INTERNAL_NAME: 'Internal name must have at least 2 characters',
  ERROR_STICKY_REQUIRES_CTA: 'Add at least one image + link, or set a button (label + URL).',
  ACTION_DUPLICATE: 'Duplicate',
  TOAST_DUPLICATED: 'Item duplicated as draft',
  DUPLICATE_SUFFIX: '(copy)',
  TOAST_PRIORITY_UPDATED: 'Priority updated',
  TAB_MEDIA_CTA: 'Media & CTA',
  TAB_ADVANCED: 'Advanced',
  BTN_CONTINUE: 'Continue',
  COL_ITEMS: 'Items',
  COL_ACTIVE: 'Active',
  COL_DRAFTS: 'Drafts',
  COL_NEXT_SCHEDULED: 'Next scheduled',
  STATUS_LIVE: 'Active',
  STATUS_INACTIVE: 'Inactive',
  // Display labels for technical values
  DEVICE_ALL: 'All',
  DEVICE_DESKTOP: 'Desktop',
  DEVICE_MOBILE: 'Mobile',
  DEVICE_TABLET: 'Tablet',
  STATUS_DRAFT: 'Draft',
  STATUS_PUBLISHED: 'Published',
  STATUS_ARCHIVED: 'Archived',
  TARGET_SELF: 'Same tab',
  TARGET_BLANK: 'New tab',

  // AI generation
  AI_TITLE: 'Generate with AI',
  AI_BRIEF_PLACEHOLDER: 'Describe the banner: product, promo, occasion…',
  AI_GOAL: 'Goal (e.g. sales)',
  AI_TONE: 'Tone (e.g. bold)',
  AI_AUDIENCE: 'Audience',
  AI_GENERATE_COPY: 'Generate copy',
  AI_GENERATE_IMAGE: 'Generate image',
  AI_HELP: 'Fills title/subtitle/CTA and can create the banner image. Review before saving.',
  AI_COPY_DONE: 'Copy generated',
  AI_IMAGE_DONE: 'Image generated',
  AI_ERROR: 'AI generation failed',
  // AI compose drawer (copy + product-aware image in one flow)
  AI_COMPOSE_BUTTON: 'Generate with AI',
  AI_COMPOSE_TITLE: 'Generate banner with AI',
  AI_COMPOSE_SUBTITLE:
    'Pick products and give context — AI writes the copy and composes an image featuring those products.',
  AI_COMPOSE_PLACEMENT: 'Placement',
  AI_BRIEF_LABEL: 'Brief',
  AI_COMPOSE_PRODUCTS_LABEL: 'Products (context & reference photos)',
  AI_COMPOSE_PRODUCTS_HELP:
    'Their photos are sent as references so the products appear in the banner without being altered.',
  AI_COMPOSE_GENERATE: 'Generate',
  AI_COMPOSE_DONE: 'Slide generated — review and save.',
  AI_COMPOSE_WARN: 'Generated with warnings: {{msg}}',
  AI_COMPOSE_PREVIEW: 'Preview',
  AI_COMPOSE_PREVIEW_HELP: 'This is how the slide will look. Regenerate for another variant or use it.',
  AI_COMPOSE_REGENERATE: 'Regenerate',
  AI_COMPOSE_USE: 'Use this slide',
};

export const es = {
  // Page
  TITLE: 'Banners',
  SUBTITLE: 'Gestioná los banners del storefront por placement y estado.',
  NEW_BANNER: 'Nuevo banner',
  CREATE_BUTTON: 'Crear',
  EMPTY_STATE: 'No hay banners aún. Crea el primero.',

  // Table headers
  COL_INTERNAL_NAME: 'Nombre interno',
  COL_PLACEMENT: 'Placement',
  COL_STATUS: 'Estado',
  COL_PRIORITY: 'Prioridad',
  COL_DEVICE: 'Dispositivo',

  // Row actions
  ACTION_EDIT: 'Editar',
  ACTION_PUBLISH: 'Publicar',
  ACTION_UNPUBLISH: 'Despublicar',
  ACTION_ARCHIVE: 'Archivar',
  ACTION_DELETE: 'Eliminar',

  // Confirm
  CONFIRM_DELETE: '¿Eliminar este banner?',

  // Toasts
  TOAST_DELETED: 'Banner eliminado',
  TOAST_DELETE_FAILED: 'Error al eliminar el banner',
  TOAST_PUBLISHED: 'Banner publicado',
  TOAST_PUBLISH_FAILED: 'Error al publicar el banner',
  TOAST_UNPUBLISHED: 'Banner despublicado',
  TOAST_UNPUBLISH_FAILED: 'Error al despublicar el banner',
  TOAST_ARCHIVED: 'Banner archivado',
  TOAST_ARCHIVE_FAILED: 'Error al archivar el banner',

  // Form drawer
  FORM_EDIT_TITLE: 'Editar Banner',
  FORM_CREATE_TITLE: 'Nuevo Banner',

  FIELD_INTERNAL_NAME: 'Nombre interno',
  PLACEHOLDER_INTERNAL_NAME: 'Ej: Top bar enero 2025',

  FIELD_PLACEMENT: 'Placement *',
  PLACEHOLDER_PLACEMENT: 'Seleccionar placement',

  FIELD_STATUS: 'Estado',

  FIELD_DEVICE: 'Dispositivo',
  PLACEHOLDER_DEVICE: 'Todos los dispositivos',

  FIELD_TYPE: 'Tipo',
  PLACEHOLDER_TYPE: 'Ej: image, video, card',

  FIELD_PRIORITY: 'Prioridad',

  FIELD_COUNTDOWN_SECONDS: 'Cuenta regresiva de autocierre (segundos)',
  HELP_COUNTDOWN_SECONDS: 'Segundos antes de que el splash se cierre solo. 0 = sin autocierre (solo la X).',
  FIELD_SPLASH_BG: 'Fondo del splash',
  HELP_SPLASH_BG: 'Elegí un color pleno o una imagen de fondo a pantalla completa. El título, subtítulo y logo son siempre opcionales.',
  SPLASH_BG_COLOR: 'Color de fondo',
  SPLASH_BG_COLOR_HELP: 'Color pleno + imagen centrada.',
  SPLASH_BG_IMAGE: 'Imagen de fondo',
  SPLASH_BG_IMAGE_HELP: 'La imagen ocupa toda la pantalla.',
  FIELD_SHOW_LOGO: 'Mostrar logo arriba del título',
  HELP_SHOW_LOGO: 'Muestra el logo de la tienda arriba del título en el splash.',
  SECTION_LINKS: 'Enlaces',
  FIELD_STICKY_LINKS: 'Enlaces (logo + URL)',
  HELP_STICKY_LINKS: 'Agregá hasta 4 items (imagen + link). Podés dejarlo vacío, pero en ese caso completá un botón (etiqueta + URL) abajo.',
  FIELD_STICKY_LINK_IMAGE: 'Imagen (URL)',
  FIELD_STICKY_LINK_URL: 'Enlace',
  ADD_STICKY_LINK: 'Agregar enlace',

  SECTION_CONTENT: 'Contenido',
  FIELD_CONTENT_TITLE: 'Título',
  FIELD_CONTENT_SUBTITLE: 'Subtítulo',
  FIELD_CONTENT_BODY: 'Cuerpo',

  SECTION_MEDIA: 'Media',
  FIELD_MEDIA_URL: 'URL de imagen/video',
  MEDIA_UPLOAD_BUTTON: 'Subir imagen',
  MEDIA_UPLOADING: 'Subiendo...',
  MEDIA_UPLOAD_HINT: 'o pegá una URL arriba',
  MEDIA_UPLOAD_SUCCESS: 'Imagen subida',
  MEDIA_UPLOAD_FAILED: 'Error al subir la imagen: {{msg}}',
  SECTION_TARGETING: 'Audiencia',
  FIELD_CUSTOMER_GROUPS: 'Grupos de clientes',
  TARGETING_ALL_HINT: 'Se muestra a todos. Seleccioná grupos para restringirlo.',
  TARGETING_SELECTED_HINT: 'Solo se muestra a clientes de los grupos seleccionados.',
  TARGETING_NO_GROUPS: 'Todavía no hay grupos de clientes.',

  SECTION_CTA: 'CTA',
  FIELD_CTA_URL: 'URL',
  FIELD_CTA_LABEL: 'Etiqueta del botón',
  PLACEHOLDER_CTA_LABEL: 'Ej: Ver más',
  FIELD_CTA_TARGET: 'Target',

  FIELD_CARD_COLOR: 'Color de tarjeta (card_color)',
  FIELD_BACKGROUND_COLOR: 'Color de fondo',
  FIELD_ICON_COLOR: 'Color del icono',
  FIELD_TEXT_COLOR: 'Color del texto (título/subtítulo)',
  FIELD_CTA_TEXT_COLOR: 'Color del texto del CTA',
  FIELD_ICON: 'Icono',
  PLACEHOLDER_ICON: 'Seleccionar icono',
  PLACEHOLDER_CARD_COLOR: '#ffffff o nombre CSS',
  PLACEHOLDER_ICON_COLOR: '#2e7d32',
  PLACEHOLDER_TEXT_COLOR: '#ffffff',
  PLACEHOLDER_CTA_TEXT_COLOR: '#ffffff',
  ICON_CREDIT_CARD: 'Tarjeta',
  ICON_TRUCK: 'Envio',
  ICON_GIFT: 'Regalo',
  ICON_SHIELD: 'Escudo',
  ICON_STAR: 'Estrella',
  ICON_TAG: 'Etiqueta',
  COLOR_THEME_PRIMARY: 'Primario del tema',
  COLOR_THEME_PRIMARY_DARK: 'Primario oscuro',
  COLOR_THEME_PRIMARY_SOFT: 'Primario suave',
  COLOR_THEME_SURFACE: 'Superficie',
  COLOR_THEME_TEXT: 'Texto',
  COLOR_THEME_MUTED: 'Muted',

  FIELD_START_AT: 'Inicio',
  FIELD_END_AT: 'Fin',

  BTN_CANCEL: 'Cancelar',
  BTN_SAVE: 'Guardar cambios',
  BTN_CREATE: 'Crear banner',

  TOAST_CREATED: 'Banner creado',
  TOAST_UPDATED: 'Banner actualizado',
  TOAST_SAVE_FAILED: 'Error al guardar el banner',

  // Placement-centric admin
  LOADING: 'Cargando...',
  PLACEMENT_TOP_BAR: 'Top bar',
  PLACEMENT_BANNER_0: 'Banner',
  PLACEMENT_BANNER_1: 'Banner principal',
  PLACEMENT_BANNER_2: 'Banner 2',
  PLACEMENT_BANNER_3: 'Banner 3',
  PLACEMENT_BANNER_4: 'Banner 4',
  PLACEMENT_BANNER_5: 'Banner 5',
  PLACEMENT_BANNER_6: 'Banner 6',
  PLACEMENT_STICKY_FOOTER: 'Footer sticky',
  PLACEMENT_WELCOME_SPLASH: 'Splash de bienvenida (mobile)',
  ITEM_MESSAGE: 'Mensaje',
  ITEM_MESSAGE_PLURAL: 'Mensajes',
  ITEM_SLIDE: 'Slide',
  ITEM_SLIDE_PLURAL: 'Slides',
  ITEM_CARD: 'Card',
  ITEM_CARD_PLURAL: 'Cards',
  ITEM_HIGHLIGHT: 'Destacado',
  ITEM_HIGHLIGHT_PLURAL: 'Destacados',
  ITEM_SPLASH: 'Splash',
  ITEM_SPLASH_PLURAL: 'Splashes',
  PLACEMENT_EMPTY: 'Sin items todavía',
  PLACEMENT_UNKNOWN: 'Placement desconocido.',
  BACK_TO_PLACEMENTS: 'Volver a Banners',
  BADGE_ACTIVE: '{{count}} activos',
  BADGE_DRAFTS: '{{count}} draft(s)',
  BADGE_NEXT: 'Próximo: {{date}}',
  DEVICE_FILTER_ALL: 'Todos los dispositivos',
  ADD_ITEM: 'Agregar {{item}}',
  PREVIEW_TITLE: 'Vista previa',
  PREVIEW_EMPTY: 'No hay nada publicado ahora para este placement.',
  PREVIEW_HINT: 'Vista previa en vivo — se actualiza mientras escribís.',
  GROUP_PUBLISHED: 'Publicados',
  GROUP_SCHEDULED: 'Programados',
  GROUP_DRAFTS: 'Drafts',
  GROUP_ARCHIVED: 'Archivados',
  SECTION_BASIC: 'Básico',
  SECTION_STYLE: 'Estilo',
  SECTION_SCHEDULE: 'Programación',
  SECTION_ADVANCED: 'Avanzado (no usado por este placement)',
  FIELD_PLACEMENT_FIXED: 'Placement:',
  FORM_CREATE_ITEM_TITLE: 'Nuevo {{item}}',
  FORM_EDIT_ITEM_TITLE: 'Editar {{item}}',
  ERROR_INTERNAL_NAME: 'El nombre interno debe tener al menos 2 caracteres',
  ERROR_STICKY_REQUIRES_CTA: 'Agregá al menos una imagen + link, o completá un botón (etiqueta + URL).',
  ACTION_DUPLICATE: 'Duplicar',
  TOAST_DUPLICATED: 'Item duplicado como draft',
  DUPLICATE_SUFFIX: '(copia)',
  TOAST_PRIORITY_UPDATED: 'Prioridad actualizada',
  TAB_MEDIA_CTA: 'Media y CTA',
  TAB_ADVANCED: 'Avanzado',
  BTN_CONTINUE: 'Continuar',
  COL_ITEMS: 'Items',
  COL_ACTIVE: 'Activos',
  COL_DRAFTS: 'Drafts',
  COL_NEXT_SCHEDULED: 'Próximo programado',
  STATUS_LIVE: 'Activo',
  STATUS_INACTIVE: 'Inactivo',
  // Display labels for technical values
  DEVICE_ALL: 'Todos',
  DEVICE_DESKTOP: 'Escritorio',
  DEVICE_MOBILE: 'Móvil',
  DEVICE_TABLET: 'Tablet',
  STATUS_DRAFT: 'Borrador',
  STATUS_PUBLISHED: 'Publicado',
  STATUS_ARCHIVED: 'Archivado',
  TARGET_SELF: 'Misma pestaña',
  TARGET_BLANK: 'Nueva pestaña',

  // Generación con IA
  AI_TITLE: 'Generar con IA',
  AI_BRIEF_PLACEHOLDER: 'Describí el banner: producto, promo, ocasión…',
  AI_GOAL: 'Objetivo (ej: ventas)',
  AI_TONE: 'Tono (ej: audaz)',
  AI_AUDIENCE: 'Audiencia',
  AI_GENERATE_COPY: 'Generar textos',
  AI_GENERATE_IMAGE: 'Generar imagen',
  AI_HELP: 'Completa título/subtítulo/CTA y puede crear la imagen del banner. Revisá antes de guardar.',
  AI_COPY_DONE: 'Textos generados',
  AI_IMAGE_DONE: 'Imagen generada',
  AI_ERROR: 'Falló la generación con IA',
  // Drawer de generación con IA (copy + imagen con productos, en un solo flujo)
  AI_COMPOSE_BUTTON: 'Generar con IA',
  AI_COMPOSE_TITLE: 'Generar banner con IA',
  AI_COMPOSE_SUBTITLE:
    'Elegí productos y dales contexto: la IA escribe el copy y compone una imagen con esos productos.',
  AI_COMPOSE_PLACEMENT: 'Ubicación',
  AI_BRIEF_LABEL: 'Brief',
  AI_COMPOSE_PRODUCTS_LABEL: 'Productos (contexto y fotos de referencia)',
  AI_COMPOSE_PRODUCTS_HELP:
    'Sus fotos se mandan como referencia para que los productos aparezcan en el banner sin deformarse.',
  AI_COMPOSE_GENERATE: 'Generar',
  AI_COMPOSE_DONE: 'Slide generado: revisá y guardá.',
  AI_COMPOSE_WARN: 'Generado con avisos: {{msg}}',
  AI_COMPOSE_PREVIEW: 'Vista previa',
  AI_COMPOSE_PREVIEW_HELP: 'Así va a quedar el slide. Regenerá para otra variante o usalo.',
  AI_COMPOSE_REGENERATE: 'Regenerar',
  AI_COMPOSE_USE: 'Usar este slide',
};

/**
 * Registers the Banners translation bundles on the i18n instance that
 * Medusa's admin actually initialized.
 *
 * IMPORTANT: pass the `i18n` instance from `useTranslation()` — do NOT call the
 * bare `i18next` singleton. With pnpm, the admin bundle can resolve a second,
 * uninitialized copy of i18next whose `addResourceBundle` is unavailable
 * ("addResourceBundle is not a function"). The hook's instance is always the
 * live, initialized one.
 */
export const registerBannersTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', BANNERS_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', BANNERS_NAMESPACE, es, true, true);

  // Mark the namespace as loaded so react-i18next re-renders components
  // that read it before registration (otherwise raw keys stick).
  void i18n.loadNamespaces(BANNERS_NAMESPACE);

  registered = true;
};
