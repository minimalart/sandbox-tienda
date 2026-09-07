import type { i18n as I18nInstance } from 'i18next';

const BRANDS_NAMESPACE = 'brands';
let registered = false;

export const en = {
  // List page
  TITLE: 'Brands',
  COLUMN_NAME: 'Name',
  COLUMN_HANDLE: 'Handle',
  COLUMN_DESCRIPTION: 'Description',
  COLUMN_STATUS: 'Status',
  COLUMN_ACTIONS: 'Actions',
  STATUS_ACTIVE: 'Active',
  STATUS_INACTIVE: 'Inactive',
  EMPTY_STATE: 'No brands found. Create your first brand to get started.',
  CREATE_BUTTON: 'Create',
  SEARCH_PLACEHOLDER: 'Search brands',

  // Form fields (shared by create & edit)
  FIELD_NAME_LABEL: 'Name *',
  FIELD_NAME_PLACEHOLDER: 'Brand name',
  FIELD_HANDLE_LABEL: 'Handle *',
  FIELD_HANDLE_PLACEHOLDER: 'brand-handle',
  FIELD_HANDLE_HELP: 'URL-friendly identifier for the brand',
  FIELD_DESCRIPTION_LABEL: 'Description',
  FIELD_DESCRIPTION_PLACEHOLDER: 'Brand description',
  FIELD_ACTIVE_LABEL: 'Active',
  FIELD_ACTIVE_HELP: "Inactive brands won't be visible in the store",

  // Create drawer
  CREATE_TITLE: 'Create Brand',
  CREATE_SUBMIT: 'Create Brand',
  CREATE_SUCCESS: 'Brand created successfully',
  CREATE_ERROR: 'Failed to create brand: {{msg}}',
  VALIDATION_REQUIRED: 'Name and handle are required',

  // Edit drawer
  EDIT_TITLE: 'Edit Brand',
  EDIT_SUBMIT: 'Save Changes',
  UPDATE_SUCCESS: 'Brand updated successfully',
  UPDATE_ERROR: 'Failed to update brand: {{msg}}',

  // Common buttons
  CANCEL: 'Cancel',

  // Actions menu
  ACTION_EDIT: 'Edit',
  ACTION_DELETE: 'Delete',
  DELETE_PROMPT_TITLE: 'Delete Brand',
  DELETE_PROMPT_DESCRIPTION:
    'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
  DELETE_PROMPT_CONFIRM: 'Delete',
  DELETE_PROMPT_CANCEL: 'Cancel',
  DELETE_SUCCESS: 'Brand deleted successfully',
  DELETE_ERROR: 'Failed to delete brand: {{msg}}',

  // Export
  EXPORT_BUTTON: 'Export CSV',
  EXPORT_LOADING: 'Exporting...',
  EXPORT_SUCCESS: 'Brands exported successfully',
  EXPORT_ERROR: 'Failed to export brands: {{msg}}',

  // CSV bulk wizard
  BULK_TRIGGER: 'Bulk Upload CSV',
  BULK_TITLE: 'Bulk Link Products to Brands',
  BULK_STEP1_TITLE: 'How it works',
  BULK_STEP1_LINE1: 'Download the CSV template below',
  BULK_STEP1_LINE2: 'Fill in the product handle (or variant SKU) and brand handle',
  BULK_STEP1_LINE3: 'Upload the completed CSV file',
  BULK_SMART_UPDATE_LABEL: 'Smart Update:',
  BULK_SMART_UPDATE_TEXT: 'Existing brand links will be replaced with the new brand from the CSV',
  BULK_STEP2_TITLE: 'Download Template',
  BULK_DOWNLOAD_TEMPLATE: 'Download CSV Template',
  BULK_STEP3_TITLE: 'Upload Your CSV',
  BULK_UPLOAD_CLICK: 'Click to select CSV file',
  BULK_UPLOAD_DRAG: 'or drag and drop your file here',
  BULK_REMOVE_FILE: 'Remove file',
  BULK_RESULTS_TITLE: 'Processing Results',
  BULK_RESULTS_SUCCESS: 'Success',
  BULK_RESULTS_FAILED: 'Failed',
  BULK_ERROR_DETAILS: 'Error Details:',
  BULK_ROW: 'Row {{row}}:',
  BULK_SUBMIT: 'Process CSV',
  BULK_SUBMIT_LOADING: 'Processing...',
  BULK_TEMPLATE_DOWNLOADED: 'Template downloaded successfully',
  BULK_INVALID_FILE: 'Please select a CSV file',
  BULK_NO_FILE: 'Please select a file',
  BULK_NO_ROWS: 'No valid data rows found in CSV',
  BULK_LINK_SUCCESS: 'Successfully linked {{count}} products to brands',
  BULK_PROCESS_WITH_ERRORS: 'Processed with errors: {{success}} succeeded, {{failed}} failed',
  BULK_PROCESS_ERROR: 'Failed to process CSV: {{msg}}',

  // Image section
  IMAGES_TITLE: 'Brand Images',
  IMAGE_THUMBNAIL_LABEL: 'Thumbnail',
  IMAGE_THUMBNAIL_HELP: 'Main brand image displayed in listings',
  IMAGE_ADDITIONAL_LABEL: 'Additional Images',
  IMAGE_ADDITIONAL_HELP: 'Gallery images for the brand page',
  IMAGE_ADD_THUMBNAIL: 'Add thumbnail',
  IMAGE_ADD: 'Add',
  IMAGE_UPLOADING: 'Uploading...',
  IMAGE_LOADING: 'Loading images...',
  IMAGE_UPLOAD_SUCCESS: 'Image uploaded successfully',
  IMAGE_UPLOAD_ERROR: 'Failed to upload image: {{msg}}',
  IMAGE_DELETE_SUCCESS: 'Image deleted successfully',
  IMAGE_DELETE_ERROR: 'Failed to delete image: {{msg}}',
  IMAGE_UPLOAD_FAILED: 'Upload failed: {{msg}}',
  IMAGE_OR_URL: 'Or paste an image URL (recommended — persists across deploys)',
  IMAGE_URL_PLACEHOLDER: 'https://…/logo.png',
  IMAGE_URL_BUTTON: 'Use URL',
  IMAGE_URL_INVALID: 'Enter a valid image URL (http/https)',
  IMAGE_URL_SUCCESS: 'Image set from URL',
};

export const es = {
  // List page
  TITLE: 'Marcas',
  COLUMN_NAME: 'Nombre',
  COLUMN_HANDLE: 'Identificador',
  COLUMN_DESCRIPTION: 'Descripción',
  COLUMN_STATUS: 'Estado',
  COLUMN_ACTIONS: 'Acciones',
  STATUS_ACTIVE: 'Activa',
  STATUS_INACTIVE: 'Inactiva',
  EMPTY_STATE: 'No se encontraron marcas. Creá tu primera marca para empezar.',
  CREATE_BUTTON: 'Crear',
  SEARCH_PLACEHOLDER: 'Buscar marcas',

  // Form fields (shared by create & edit)
  FIELD_NAME_LABEL: 'Nombre *',
  FIELD_NAME_PLACEHOLDER: 'Nombre de la marca',
  FIELD_HANDLE_LABEL: 'Identificador *',
  FIELD_HANDLE_PLACEHOLDER: 'identificador-marca',
  FIELD_HANDLE_HELP: 'Identificador amigable para la URL de la marca',
  FIELD_DESCRIPTION_LABEL: 'Descripción',
  FIELD_DESCRIPTION_PLACEHOLDER: 'Descripción de la marca',
  FIELD_ACTIVE_LABEL: 'Activa',
  FIELD_ACTIVE_HELP: 'Las marcas inactivas no se mostrarán en la tienda',

  // Create drawer
  CREATE_TITLE: 'Crear marca',
  CREATE_SUBMIT: 'Crear marca',
  CREATE_SUCCESS: 'Marca creada correctamente',
  CREATE_ERROR: 'Error al crear la marca: {{msg}}',
  VALIDATION_REQUIRED: 'El nombre y el identificador son obligatorios',

  // Edit drawer
  EDIT_TITLE: 'Editar marca',
  EDIT_SUBMIT: 'Guardar cambios',
  UPDATE_SUCCESS: 'Marca actualizada correctamente',
  UPDATE_ERROR: 'Error al actualizar la marca: {{msg}}',

  // Common buttons
  CANCEL: 'Cancelar',

  // Actions menu
  ACTION_EDIT: 'Editar',
  ACTION_DELETE: 'Eliminar',
  DELETE_PROMPT_TITLE: 'Eliminar marca',
  DELETE_PROMPT_DESCRIPTION:
    '¿Estás seguro de que querés eliminar "{{name}}"? Esta acción no se puede deshacer.',
  DELETE_PROMPT_CONFIRM: 'Eliminar',
  DELETE_PROMPT_CANCEL: 'Cancelar',
  DELETE_SUCCESS: 'Marca eliminada correctamente',
  DELETE_ERROR: 'Error al eliminar la marca: {{msg}}',

  // Export
  EXPORT_BUTTON: 'Exportar CSV',
  EXPORT_LOADING: 'Exportando...',
  EXPORT_SUCCESS: 'Marcas exportadas correctamente',
  EXPORT_ERROR: 'Error al exportar las marcas: {{msg}}',

  // CSV bulk wizard
  BULK_TRIGGER: 'Carga masiva CSV',
  BULK_TITLE: 'Vincular productos a marcas de forma masiva',
  BULK_STEP1_TITLE: 'Cómo funciona',
  BULK_STEP1_LINE1: 'Descargá la plantilla CSV de abajo',
  BULK_STEP1_LINE2: 'Completá el identificador del producto (o SKU de la variante) y el identificador de la marca',
  BULK_STEP1_LINE3: 'Subí el archivo CSV completado',
  BULK_SMART_UPDATE_LABEL: 'Actualización inteligente:',
  BULK_SMART_UPDATE_TEXT: 'Los vínculos de marca existentes se reemplazarán por la nueva marca del CSV',
  BULK_STEP2_TITLE: 'Descargar plantilla',
  BULK_DOWNLOAD_TEMPLATE: 'Descargar plantilla CSV',
  BULK_STEP3_TITLE: 'Subí tu CSV',
  BULK_UPLOAD_CLICK: 'Hacé clic para seleccionar el archivo CSV',
  BULK_UPLOAD_DRAG: 'o arrastrá y soltá tu archivo aquí',
  BULK_REMOVE_FILE: 'Quitar archivo',
  BULK_RESULTS_TITLE: 'Resultados del procesamiento',
  BULK_RESULTS_SUCCESS: 'Exitosos',
  BULK_RESULTS_FAILED: 'Fallidos',
  BULK_ERROR_DETAILS: 'Detalle de errores:',
  BULK_ROW: 'Fila {{row}}:',
  BULK_SUBMIT: 'Procesar CSV',
  BULK_SUBMIT_LOADING: 'Procesando...',
  BULK_TEMPLATE_DOWNLOADED: 'Plantilla descargada correctamente',
  BULK_INVALID_FILE: 'Seleccioná un archivo CSV',
  BULK_NO_FILE: 'Seleccioná un archivo',
  BULK_NO_ROWS: 'No se encontraron filas de datos válidas en el CSV',
  BULK_LINK_SUCCESS: 'Se vincularon {{count}} productos a marcas correctamente',
  BULK_PROCESS_WITH_ERRORS: 'Procesado con errores: {{success}} exitosos, {{failed}} fallidos',
  BULK_PROCESS_ERROR: 'Error al procesar el CSV: {{msg}}',

  // Image section
  IMAGES_TITLE: 'Imágenes de la marca',
  IMAGE_THUMBNAIL_LABEL: 'Miniatura',
  IMAGE_THUMBNAIL_HELP: 'Imagen principal de la marca que se muestra en los listados',
  IMAGE_ADDITIONAL_LABEL: 'Imágenes adicionales',
  IMAGE_ADDITIONAL_HELP: 'Imágenes de galería para la página de la marca',
  IMAGE_ADD_THUMBNAIL: 'Agregar miniatura',
  IMAGE_ADD: 'Agregar',
  IMAGE_UPLOADING: 'Subiendo...',
  IMAGE_LOADING: 'Cargando imágenes...',
  IMAGE_UPLOAD_SUCCESS: 'Imagen subida correctamente',
  IMAGE_UPLOAD_ERROR: 'Error al subir la imagen: {{msg}}',
  IMAGE_DELETE_SUCCESS: 'Imagen eliminada correctamente',
  IMAGE_DELETE_ERROR: 'Error al eliminar la imagen: {{msg}}',
  IMAGE_UPLOAD_FAILED: 'Error al subir: {{msg}}',
  IMAGE_OR_URL: 'O pegá una URL de imagen (recomendado — sobrevive a los deploys)',
  IMAGE_URL_PLACEHOLDER: 'https://…/logo.png',
  IMAGE_URL_BUTTON: 'Usar URL',
  IMAGE_URL_INVALID: 'Ingresá una URL de imagen válida (http/https)',
  IMAGE_URL_SUCCESS: 'Imagen asignada desde la URL',
};

/**
 * Registers the Brands translation bundles on the i18n instance that
 * Medusa's admin actually initialized.
 *
 * IMPORTANT: pass the `i18n` instance from `useTranslation()` — do NOT call the
 * bare `i18next` singleton. With pnpm, the admin bundle can resolve a second,
 * uninitialized copy of i18next whose `addResourceBundle` is unavailable
 * ("addResourceBundle is not a function"). The hook's instance is always the
 * live, initialized one.
 */
export const registerBrandsTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', BRANDS_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', BRANDS_NAMESPACE, es, true, true);

  // Mark the namespace as loaded so react-i18next re-renders components
  // that read it before registration (otherwise raw keys stick).
  void i18n.loadNamespaces(BRANDS_NAMESPACE);

  registered = true;
};
