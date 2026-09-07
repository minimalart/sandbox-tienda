import type { i18n as I18nInstance } from 'i18next';

const VIDEOS_NAMESPACE = 'videos';
let registered = false;

export const en = {
  // Page
  TITLE: 'Videos',
  SUBTITLE: 'Manage your Vimeo videos and link them to products.',
  ADD_VIDEO: 'Add Video',
  CREATE_BUTTON: 'Create',

  // Common actions
  CANCEL: 'Cancel',
  REMOVE: 'Remove',
  PREVIOUS: 'Previous',
  NEXT: 'Next',
  YES: 'Yes',
  NO: 'No',
  LOADING: 'Loading...',

  // Videos table
  TABLE_LOADING: 'Loading videos...',
  TABLE_EMPTY_TITLE: 'No videos found',
  TABLE_EMPTY_SUBTITLE: 'Create your first video to get started',
  TABLE_COL_VIDEO: 'Video',
  TABLE_COL_STATUS: 'Status',
  STATUS_AVAILABLE: 'Available',
  STATUS_PROCESSING: 'Processing',
  STATUS_TRANSCODING: 'Transcoding',
  STATUS_UPLOADING: 'Uploading',
  STATUS_ERROR: 'Error',
  STATUS_UNKNOWN: 'Unknown',
  TABLE_COL_DURATION: 'Duration',
  TABLE_COL_ACTIVE: 'Active',
  TABLE_COL_SORT_ORDER: 'Sort Order',
  TABLE_COL_ACTIONS: 'Actions',
  SYNC_FROM_VIMEO: 'Sync from Vimeo',
  PAGINATION_SHOWING: 'Showing {{from}} to {{to}} of {{count}}',
  DELETE_CONFIRM: 'Are you sure you want to delete this video?',
  DELETE_TITLE: 'Delete video',
  DELETE_ACTION: 'Delete',

  // Create video drawer
  TAB_UPLOAD: 'Upload to Vimeo',
  TAB_LINK: 'Link Existing Video',
  FILE_DROP_PLACEHOLDER: 'Click to select video or drag and drop',
  FILE_FORMATS_HINT: 'MP4, MOV, AVI, WebM up to 500MB',
  FILE_READY: 'File ready: {{name}}',
  LABEL_TITLE: 'Title *',
  PLACEHOLDER_TITLE: 'Video title',
  UPLOADING_PROGRESS: 'Uploading... {{progress}}%',
  UPLOADING: 'Uploading...',
  SEARCH_VIMEO_PLACEHOLDER: 'Search your Vimeo videos...',
  GO_TO_VIMEO: 'Go to Vimeo',
  LOADING_VIMEO_VIDEOS: 'Loading your Vimeo videos...',
  SELECT_A_VIDEO: 'Select a Video',
  NO_DESCRIPTION: 'No description',
  NO_VIMEO_VIDEOS: 'No videos found in your Vimeo account.',
  VIDEO_DETAILS: 'Video Details',
  LABEL_DESCRIPTION: 'Description',
  PLACEHOLDER_DESCRIPTION: 'Video description',
  SELECTED_VIMEO_ID: 'Selected Vimeo ID: {{id}}',
  ADD_TO_CATALOG: 'Add to Catalog',
  // Create video toasts/alerts
  ERR_SELECT_FILE_TITLE: 'Please select a file and enter a title',
  ERR_NO_UPLOAD_LINK: 'No upload link received from Vimeo',
  ERR_TUS_NOT_INSTALLED:
    'tus-js-client is not installed. Run: pnpm add tus-js-client --filter @repo/backend',
  ERR_UPLOAD_FAILED: 'Upload failed: {{message}}',
  ERR_UPLOAD_UNKNOWN: 'Unknown error',
  ERR_UPLOADED_BUT_NOT_ADDED:
    'Video uploaded to Vimeo, but failed to add to catalog.\n\nVimeo URI: {{uri}}\n\nPlease add it manually from the Browse section.',

  // Edit video drawer
  EDIT_VIDEO: 'Edit Video',
  PREVIEW: 'Preview',
  VIMEO_ID_BADGE: 'Vimeo ID: {{id}}',
  LINKED_PRODUCTS: 'Linked Products',
  UPDATING_PRODUCTS: 'Updating products...',
  NO_PRODUCTS_LINKED: 'No products linked yet. Add products below.',
  ADD_PRODUCTS: 'Add Products',
  SEARCH_PRODUCTS_PLACEHOLDER: 'Type to search products...',
  ALREADY_LINKED: 'Already linked',
  NO_PRODUCTS_FOUND: 'No products found for "{{query}}"',
  TYPE_AT_LEAST_2_CHARS: 'Type at least 2 characters to search',
  SAVE_CHANGES: 'Save Changes',

  // Vimeo connection card
  VIMEO_CONNECTION: 'Vimeo Connection',
  CONNECTED: 'Connected',
  NOT_CONNECTED: 'Not Connected',
  CONNECTED_DESCRIPTION: 'Your Vimeo account is connected and ready to use.',
  NOT_CONNECTED_DESCRIPTION: 'Connect your Vimeo account to upload and manage videos.',
  CONNECTED_AS: 'Connected as:',
  DEFAULT_VIMEO_USER: 'Vimeo User',
  FOLDER: 'Folder:',
  TEST_CONNECTION: 'Test Connection',
  CONNECT_ACCOUNT: 'Connect Vimeo Account',
  HOW_TO_CONNECT: 'How to connect:',
  HOW_TO_STEP_1: 'Click "Connect Vimeo Account" above',
  HOW_TO_STEP_2: 'Authorize this app on Vimeo',
  HOW_TO_STEP_3: 'You will be redirected back here automatically',
  ENV_TOKEN_HINT: 'Alternatively, set VIMEO_ACCESS_TOKEN in the environment to skip OAuth.',
  CONNECTION_ERROR:
    'Failed to check connection status. Ensure the backend is running and configured correctly.',
};

export const es: typeof en = {
  // Page
  TITLE: 'Videos',
  SUBTITLE: 'Gestiona tus videos de Vimeo y vincúlalos a productos.',
  ADD_VIDEO: 'Agregar video',
  CREATE_BUTTON: 'Crear',

  // Common actions
  CANCEL: 'Cancelar',
  REMOVE: 'Quitar',
  PREVIOUS: 'Anterior',
  NEXT: 'Siguiente',
  YES: 'Sí',
  NO: 'No',
  LOADING: 'Cargando...',

  // Videos table
  TABLE_LOADING: 'Cargando videos...',
  TABLE_EMPTY_TITLE: 'No se encontraron videos',
  TABLE_EMPTY_SUBTITLE: 'Crea tu primer video para empezar',
  TABLE_COL_VIDEO: 'Video',
  TABLE_COL_STATUS: 'Estado',
  STATUS_AVAILABLE: 'Disponible',
  STATUS_PROCESSING: 'Procesando',
  STATUS_TRANSCODING: 'Transcodificando',
  STATUS_UPLOADING: 'Subiendo',
  STATUS_ERROR: 'Error',
  STATUS_UNKNOWN: 'Desconocido',
  TABLE_COL_DURATION: 'Duración',
  TABLE_COL_ACTIVE: 'Activo',
  TABLE_COL_SORT_ORDER: 'Orden',
  TABLE_COL_ACTIONS: 'Acciones',
  SYNC_FROM_VIMEO: 'Sincronizar desde Vimeo',
  PAGINATION_SHOWING: 'Mostrando {{from}} a {{to}} de {{count}}',
  DELETE_CONFIRM: '¿Estás seguro de que quieres eliminar este video?',
  DELETE_TITLE: 'Eliminar video',
  DELETE_ACTION: 'Eliminar',

  // Create video drawer
  TAB_UPLOAD: 'Subir a Vimeo',
  TAB_LINK: 'Vincular video existente',
  FILE_DROP_PLACEHOLDER: 'Haz clic para seleccionar un video o arrástralo aquí',
  FILE_FORMATS_HINT: 'MP4, MOV, AVI, WebM hasta 500 MB',
  FILE_READY: 'Archivo listo: {{name}}',
  LABEL_TITLE: 'Título *',
  PLACEHOLDER_TITLE: 'Título del video',
  UPLOADING_PROGRESS: 'Subiendo... {{progress}}%',
  UPLOADING: 'Subiendo...',
  SEARCH_VIMEO_PLACEHOLDER: 'Busca tus videos de Vimeo...',
  GO_TO_VIMEO: 'Ir a Vimeo',
  LOADING_VIMEO_VIDEOS: 'Cargando tus videos de Vimeo...',
  SELECT_A_VIDEO: 'Selecciona un video',
  NO_DESCRIPTION: 'Sin descripción',
  NO_VIMEO_VIDEOS: 'No se encontraron videos en tu cuenta de Vimeo.',
  VIDEO_DETAILS: 'Detalles del video',
  LABEL_DESCRIPTION: 'Descripción',
  PLACEHOLDER_DESCRIPTION: 'Descripción del video',
  SELECTED_VIMEO_ID: 'ID de Vimeo seleccionado: {{id}}',
  ADD_TO_CATALOG: 'Agregar al catálogo',
  // Create video toasts/alerts
  ERR_SELECT_FILE_TITLE: 'Selecciona un archivo e ingresa un título',
  ERR_NO_UPLOAD_LINK: 'No se recibió un enlace de subida de Vimeo',
  ERR_TUS_NOT_INSTALLED:
    'tus-js-client no está instalado. Ejecuta: pnpm add tus-js-client --filter @repo/backend',
  ERR_UPLOAD_FAILED: 'Error al subir: {{message}}',
  ERR_UPLOAD_UNKNOWN: 'Error desconocido',
  ERR_UPLOADED_BUT_NOT_ADDED:
    'El video se subió a Vimeo, pero no se pudo agregar al catálogo.\n\nURI de Vimeo: {{uri}}\n\nAgrégalo manualmente desde la sección Explorar.',

  // Edit video drawer
  EDIT_VIDEO: 'Editar video',
  PREVIEW: 'Vista previa',
  VIMEO_ID_BADGE: 'ID de Vimeo: {{id}}',
  LINKED_PRODUCTS: 'Productos vinculados',
  UPDATING_PRODUCTS: 'Actualizando productos...',
  NO_PRODUCTS_LINKED: 'Aún no hay productos vinculados. Agrega productos abajo.',
  ADD_PRODUCTS: 'Agregar productos',
  SEARCH_PRODUCTS_PLACEHOLDER: 'Escribe para buscar productos...',
  ALREADY_LINKED: 'Ya vinculado',
  NO_PRODUCTS_FOUND: 'No se encontraron productos para "{{query}}"',
  TYPE_AT_LEAST_2_CHARS: 'Escribe al menos 2 caracteres para buscar',
  SAVE_CHANGES: 'Guardar cambios',

  // Vimeo connection card
  VIMEO_CONNECTION: 'Conexión con Vimeo',
  CONNECTED: 'Conectado',
  NOT_CONNECTED: 'No conectado',
  CONNECTED_DESCRIPTION: 'Tu cuenta de Vimeo está conectada y lista para usar.',
  NOT_CONNECTED_DESCRIPTION: 'Conecta tu cuenta de Vimeo para subir y administrar videos.',
  CONNECTED_AS: 'Conectado como:',
  DEFAULT_VIMEO_USER: 'Usuario de Vimeo',
  FOLDER: 'Carpeta:',
  TEST_CONNECTION: 'Probar conexión',
  CONNECT_ACCOUNT: 'Conectar cuenta de Vimeo',
  HOW_TO_CONNECT: 'Cómo conectar:',
  HOW_TO_STEP_1: 'Haz clic en "Conectar cuenta de Vimeo" arriba',
  HOW_TO_STEP_2: 'Autoriza esta app en Vimeo',
  HOW_TO_STEP_3: 'Volverás aquí automáticamente',
  ENV_TOKEN_HINT:
    'Como alternativa, define VIMEO_ACCESS_TOKEN en el entorno para omitir OAuth.',
  CONNECTION_ERROR:
    'No se pudo verificar el estado de la conexión. Asegúrate de que el backend esté en ejecución y configurado correctamente.',
};

/**
 * Registers the Videos translation bundles on the i18n instance that
 * Medusa's admin actually initialized.
 *
 * IMPORTANT: pass the `i18n` instance from `useTranslation()` — do NOT call the
 * bare `i18next` singleton. With pnpm, the admin bundle can resolve a second,
 * uninitialized copy of i18next whose `addResourceBundle` is unavailable
 * ("addResourceBundle is not a function"). The hook's instance is always the
 * live, initialized one.
 */
export const registerVideosTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', VIDEOS_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', VIDEOS_NAMESPACE, es, true, true);

  // Mark the namespace as loaded so react-i18next re-renders components
  // that read it before registration (otherwise raw keys stick).
  void i18n.loadNamespaces(VIDEOS_NAMESPACE);

  registered = true;
};
