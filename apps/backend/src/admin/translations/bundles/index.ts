import type { i18n as I18nInstance } from 'i18next';

const BUNDLES_NAMESPACE = 'bundles';
let registered = false;

export const en = {
  // Sidebar / route label
  TITLE: 'Bundles',

  // Listing
  COLUMN_TITLE: 'Bundle',
  COLUMN_STATUS: 'Status',
  COLUMN_STORES: 'Stores',
  COLUMN_ITEMS: 'Items',
  COLUMN_UPDATED: 'Updated',
  COLUMN_ACTIONS: 'Actions',
  STATUS_DRAFT: 'Draft',
  STATUS_PUBLISHED: 'Published',
  EMPTY_STATE: 'No bundles yet. Create one to start selling configurable sets.',
  CREATE_BUTTON: 'Create bundle',
  SEARCH_PLACEHOLDER: 'Search bundles',

  // Actions
  ACTION_EDIT: 'Edit',
  ACTION_DUPLICATE: 'Duplicate',
  ACTION_PUBLISH: 'Publish',
  ACTION_UNPUBLISH: 'Unpublish',
  ACTION_DELETE: 'Delete',

  // Wizard tabs
  TAB_GENERAL: 'General',
  TAB_PRODUCTS: 'Products',
  TAB_AVAILABILITY: 'Availability',
  TAB_REVIEW: 'Review',

  // General tab
  FIELD_NAME: 'Name',
  FIELD_HANDLE: 'Handle',
  FIELD_DESCRIPTION: 'Description',
  FIELD_THUMBNAIL: 'Thumbnail',
  FIELD_STATUS: 'Status',

  // Products tab
  ADD_PRODUCT: 'Add product',
  FIELD_QUANTITY: 'Quantity',
  PRODUCT_EMPTY_STATE: 'No products yet. Add existing products to compose this bundle.',

  // Availability tab
  AVAILABILITY_TITLE: 'Available in',
  AVAILABILITY_HELP: 'Select the stores where this bundle should appear.',
  AVAILABILITY_SINGLE_TENANT:
    'This project has no stores configured. The bundle will be available globally.',

  // Review tab
  REVIEW_TITLE: 'Review',
  REVIEW_STORES: 'Stores',
  REVIEW_PRODUCTS: 'Products',
  REVIEW_WARNINGS: 'Warnings',
  REVIEW_NO_WARNINGS: 'No issues detected.',
  PUBLISH_CONFIRM: 'Publish bundle',
  SAVE_DRAFT: 'Save draft',
};

export const es: typeof en = {
  TITLE: 'Bundles',

  COLUMN_TITLE: 'Bundle',
  COLUMN_STATUS: 'Estado',
  COLUMN_STORES: 'Tiendas',
  COLUMN_ITEMS: 'Productos',
  COLUMN_UPDATED: 'Actualizado',
  COLUMN_ACTIONS: 'Acciones',
  STATUS_DRAFT: 'Borrador',
  STATUS_PUBLISHED: 'Publicado',
  EMPTY_STATE: 'Todavía no hay bundles. Creá uno para empezar a vender conjuntos configurables.',
  CREATE_BUTTON: 'Crear bundle',
  SEARCH_PLACEHOLDER: 'Buscar bundles',

  ACTION_EDIT: 'Editar',
  ACTION_DUPLICATE: 'Duplicar',
  ACTION_PUBLISH: 'Publicar',
  ACTION_UNPUBLISH: 'Despublicar',
  ACTION_DELETE: 'Eliminar',

  TAB_GENERAL: 'General',
  TAB_PRODUCTS: 'Productos',
  TAB_AVAILABILITY: 'Disponibilidad',
  TAB_REVIEW: 'Revisión',

  FIELD_NAME: 'Nombre',
  FIELD_HANDLE: 'Handle',
  FIELD_DESCRIPTION: 'Descripción',
  FIELD_THUMBNAIL: 'Imagen',
  FIELD_STATUS: 'Estado',

  ADD_PRODUCT: 'Agregar producto',
  FIELD_QUANTITY: 'Cantidad',
  PRODUCT_EMPTY_STATE: 'Todavía no hay productos. Agregá productos existentes para armar el bundle.',

  AVAILABILITY_TITLE: 'Disponible en',
  AVAILABILITY_HELP: 'Seleccioná las tiendas donde este bundle debería aparecer.',
  AVAILABILITY_SINGLE_TENANT:
    'Este proyecto no tiene tiendas configuradas. El bundle estará disponible globalmente.',

  REVIEW_TITLE: 'Revisión',
  REVIEW_STORES: 'Tiendas',
  REVIEW_PRODUCTS: 'Productos',
  REVIEW_WARNINGS: 'Advertencias',
  REVIEW_NO_WARNINGS: 'Sin problemas detectados.',
  PUBLISH_CONFIRM: 'Publicar bundle',
  SAVE_DRAFT: 'Guardar borrador',
};

export const registerBundlesTranslations = (i18n: I18nInstance): void => {
  if (registered) return;
  i18n.addResourceBundle('en', BUNDLES_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', BUNDLES_NAMESPACE, es, true, true);
  registered = true;
};
