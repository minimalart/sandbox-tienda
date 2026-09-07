import type { i18n as I18nInstance } from 'i18next';

const SHOP_BY_LOOKS_NAMESPACE = 'shop-by-looks';
let registered = false;

export const en = {
  // List page
  TITLE: 'Shop by Look',
  COLUMN_TITLE: 'Title',
  COLUMN_PLACEMENT: 'Placement',
  COLUMN_PRODUCTS: 'Products',
  COLUMN_ORDER: 'Order',
  COLUMN_STATUS: 'Status',
  COLUMN_ACTIONS: 'Actions',
  STATUS_ACTIVE: 'Active',
  STATUS_INACTIVE: 'Inactive',
  EMPTY_STATE: 'No looks yet. Create your first look to get started.',
  CREATE_BUTTON: 'Create',
  SEARCH_PLACEHOLDER: 'Search looks',

  // Global toggle
  GLOBAL_TOGGLE_LABEL: 'Shop by Look enabled',
  GLOBAL_TOGGLE_HELP: 'Master switch. When off, no look is shown in the storefront.',

  // Placement options
  PLACEMENT_TOP: 'Top of home',
  PLACEMENT_AFTER_COLLECTIONS: 'After collections',
  PLACEMENT_AFTER_FEATURED: 'After featured products',
  PLACEMENT_BEFORE_FOOTER: 'Before footer',

  // Form fields
  FIELD_TITLE_LABEL: 'Title *',
  FIELD_TITLE_PLACEHOLDER: 'Summer look',
  FIELD_SUBTITLE_LABEL: 'Subtitle',
  FIELD_SUBTITLE_PLACEHOLDER: 'Optional subtitle',
  FIELD_CTA_LABEL: 'CTA label',
  FIELD_CTA_PLACEHOLDER: 'Shop look',
  FIELD_IMAGE_LABEL: 'Main image *',
  FIELD_IMAGE_ALT_LABEL: 'Image alt text',
  FIELD_IMAGE_ALT_PLACEHOLDER: 'Describe the image for accessibility',
  FIELD_PLACEMENT_LABEL: 'Placement',
  FIELD_ACTIVE_LABEL: 'Active',
  FIELD_ACTIVE_HELP: 'Inactive looks are hidden from the storefront.',
  FIELD_SORT_ORDER_LABEL: 'Sort order',
  FIELD_SALES_CHANNELS_LABEL: 'Sales channels',
  FIELD_SALES_CHANNELS_HELP: 'Leave empty to show in all channels.',
  FIELD_REGIONS_LABEL: 'Regions',
  FIELD_REGIONS_HELP: 'Leave empty to show in all regions.',

  // Image upload
  UPLOAD_IMAGE: 'Upload image',
  IMAGE_URL_PLACEHOLDER: 'or paste an image URL',
  CLEAR_IMAGE: 'Remove',

  // Products / hotspots
  PRODUCTS_TITLE: 'Products & hotspots',
  PRODUCTS_HELP: 'Add products and place their hotspot (X/Y %) over the image.',
  PRODUCTS_CLICK_HELP: 'Search and add products, then click a product and click the image to place its hotspot.',
  PLACING_BADGE: 'Placing',
  PLACE_HINT: 'Click on the image to place the selected product. Drag a marker to fine-tune.',
  PLACE_HINT_SELECT: 'Select a product to place its hotspot on the image.',
  ADD_PRODUCTS: 'Add product',
  SEARCH_PRODUCTS_PLACEHOLDER: 'Search products by name',
  NO_PRODUCTS: 'No products added yet.',
  TYPE_AT_LEAST_2_CHARS: 'Type at least 2 characters',
  NO_PRODUCTS_FOUND: 'No products found for "{{query}}"',
  ALREADY_ADDED: 'Already added',
  HOTSPOT_X: 'X (%)',
  HOTSPOT_Y: 'Y (%)',
  VARIANT_LABEL: 'Variant',
  VARIANT_ANY: 'Choose in storefront',
  REMOVE: 'Remove',
  PREVIEW_TITLE: 'Preview',
  PREVIEW_EMPTY: 'Add a main image to see the preview.',

  // Create / edit
  CREATE_TITLE: 'Create look',
  CREATE_SUBMIT: 'Create',
  CREATE_SUCCESS: 'Look created',
  CREATE_ERROR: 'Failed to create look: {{msg}}',
  EDIT_TITLE: 'Edit look',
  SAVE_CHANGES: 'Save changes',
  UPDATE_SUCCESS: 'Look updated',
  UPDATE_ERROR: 'Failed to update look: {{msg}}',
  VALIDATION_REQUIRED: 'Title and image are required',

  // Actions
  ACTION_EDIT: 'Edit',
  ACTION_DELETE: 'Delete',
  DELETE_SUCCESS: 'Look deleted',
  DELETE_ERROR: 'Failed to delete look: {{msg}}',
  DELETE_CONFIRM: 'Delete this look? This cannot be undone.',

  CANCEL: 'Cancel',
  LOADING: 'Loading...',
};

export const es: typeof en = {
  // List page
  TITLE: 'Shop by Look',
  COLUMN_TITLE: 'Título',
  COLUMN_PLACEMENT: 'Ubicación',
  COLUMN_PRODUCTS: 'Productos',
  COLUMN_ORDER: 'Orden',
  COLUMN_STATUS: 'Estado',
  COLUMN_ACTIONS: 'Acciones',
  STATUS_ACTIVE: 'Activo',
  STATUS_INACTIVE: 'Inactivo',
  EMPTY_STATE: 'Todavía no hay looks. Creá el primero para empezar.',
  CREATE_BUTTON: 'Crear',
  SEARCH_PLACEHOLDER: 'Buscar looks',

  // Global toggle
  GLOBAL_TOGGLE_LABEL: 'Shop by Look activo',
  GLOBAL_TOGGLE_HELP: 'Interruptor general. Si está apagado, no se muestra ningún look en el storefront.',

  // Placement options
  PLACEMENT_TOP: 'Arriba del home',
  PLACEMENT_AFTER_COLLECTIONS: 'Después de colecciones',
  PLACEMENT_AFTER_FEATURED: 'Después de destacados',
  PLACEMENT_BEFORE_FOOTER: 'Antes del footer',

  // Form fields
  FIELD_TITLE_LABEL: 'Título *',
  FIELD_TITLE_PLACEHOLDER: 'Look de verano',
  FIELD_SUBTITLE_LABEL: 'Subtítulo',
  FIELD_SUBTITLE_PLACEHOLDER: 'Subtítulo opcional',
  FIELD_CTA_LABEL: 'Texto del CTA',
  FIELD_CTA_PLACEHOLDER: 'Comprar look',
  FIELD_IMAGE_LABEL: 'Imagen principal *',
  FIELD_IMAGE_ALT_LABEL: 'Texto alternativo',
  FIELD_IMAGE_ALT_PLACEHOLDER: 'Describí la imagen para accesibilidad',
  FIELD_PLACEMENT_LABEL: 'Ubicación',
  FIELD_ACTIVE_LABEL: 'Activo',
  FIELD_ACTIVE_HELP: 'Los looks inactivos no se muestran en el storefront.',
  FIELD_SORT_ORDER_LABEL: 'Orden',
  FIELD_SALES_CHANNELS_LABEL: 'Canales de venta',
  FIELD_SALES_CHANNELS_HELP: 'Vacío = se muestra en todos los canales.',
  FIELD_REGIONS_LABEL: 'Regiones',
  FIELD_REGIONS_HELP: 'Vacío = se muestra en todas las regiones.',

  // Image upload
  UPLOAD_IMAGE: 'Subir imagen',
  IMAGE_URL_PLACEHOLDER: 'o pegá una URL de imagen',
  CLEAR_IMAGE: 'Quitar',

  // Products / hotspots
  PRODUCTS_TITLE: 'Productos y hotspots',
  PRODUCTS_HELP: 'Agregá productos y ubicá su hotspot (X/Y %) sobre la imagen.',
  PRODUCTS_CLICK_HELP: 'Buscá y agregá productos; después seleccioná un producto y hacé click en la imagen para ubicar su hotspot.',
  PLACING_BADGE: 'Ubicando',
  PLACE_HINT: 'Hacé click en la imagen para ubicar el producto seleccionado. Arrastrá un marcador para ajustarlo.',
  PLACE_HINT_SELECT: 'Seleccioná un producto para ubicar su hotspot en la imagen.',
  ADD_PRODUCTS: 'Agregar producto',
  SEARCH_PRODUCTS_PLACEHOLDER: 'Buscar productos por nombre',
  NO_PRODUCTS: 'Todavía no agregaste productos.',
  TYPE_AT_LEAST_2_CHARS: 'Escribí al menos 2 caracteres',
  NO_PRODUCTS_FOUND: 'No se encontraron productos para "{{query}}"',
  ALREADY_ADDED: 'Ya agregado',
  HOTSPOT_X: 'X (%)',
  HOTSPOT_Y: 'Y (%)',
  VARIANT_LABEL: 'Variante',
  VARIANT_ANY: 'Elegir en storefront',
  REMOVE: 'Quitar',
  PREVIEW_TITLE: 'Vista previa',
  PREVIEW_EMPTY: 'Agregá una imagen principal para ver la vista previa.',

  // Create / edit
  CREATE_TITLE: 'Crear look',
  CREATE_SUBMIT: 'Crear',
  CREATE_SUCCESS: 'Look creado',
  CREATE_ERROR: 'No se pudo crear el look: {{msg}}',
  EDIT_TITLE: 'Editar look',
  SAVE_CHANGES: 'Guardar cambios',
  UPDATE_SUCCESS: 'Look actualizado',
  UPDATE_ERROR: 'No se pudo actualizar el look: {{msg}}',
  VALIDATION_REQUIRED: 'El título y la imagen son obligatorios',

  // Actions
  ACTION_EDIT: 'Editar',
  ACTION_DELETE: 'Eliminar',
  DELETE_SUCCESS: 'Look eliminado',
  DELETE_ERROR: 'No se pudo eliminar el look: {{msg}}',
  DELETE_CONFIRM: '¿Eliminar este look? No se puede deshacer.',

  CANCEL: 'Cancelar',
  LOADING: 'Cargando...',
};

/**
 * Registra los bundles de traducción de Shop by Look en la instancia de i18n
 * que el admin de Medusa inicializó (la de `useTranslation()`, no el singleton).
 */
export const registerShopByLooksTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', SHOP_BY_LOOKS_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', SHOP_BY_LOOKS_NAMESPACE, es, true, true);

  void i18n.loadNamespaces(SHOP_BY_LOOKS_NAMESPACE);

  registered = true;
};
