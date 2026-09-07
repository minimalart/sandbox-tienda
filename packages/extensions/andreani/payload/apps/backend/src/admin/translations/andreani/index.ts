import type { i18n as I18nInstance } from 'i18next';

const ANDREANI_NAMESPACE = 'andreani';
let registered = false;

export const en = {
  // Fulfillment list
  TITLE: 'Andreani Shipments',
  SUBTITLE: 'Global list of fulfillments processed by Andreani.',
  REFRESH: 'Refresh',
  SEARCH_LABEL: 'Search',
  SEARCH_PLACEHOLDER: 'Search by order or tracking...',
  FILTER_STATUS: 'Status',
  FILTER_DATE_FROM: 'From',
  FILTER_DATE_TO: 'To',
  STATUS_ALL: 'All',
  STATUS_PENDING: 'Pending',
  STATUS_SHIPPED: 'Shipped',
  STATUS_DELIVERED: 'Delivered',
  STATUS_CANCELED: 'Canceled',
  DOWNLOAD_ALL: 'Download all (filtered)',
  DOWNLOAD_ALL_OK: 'ZIP with the filtered labels is downloading.',
  DOWNLOAD_ALL_TRUNCATED:
    'Filter matched {{total}} labels; only the 200 most recent were included.',
  LABEL_ERROR: 'Could not open label: {{message}}',
  LOADING_SHIPMENTS: 'Loading shipments...',
  NO_RESULTS: 'No results for "{{search}}"',
  NO_SHIPMENTS: 'No Andreani shipments registered yet.',
  COL_ORDER: 'Order',
  COL_TRACKING: 'Tracking',
  COL_SERVICE: 'Service',
  COL_STATUS: 'Status',
  COL_DATE: 'Date',
  VIEW_TRACKING: 'View tracking',
  LABEL_BUTTON: 'Label',
  PAGINATION: 'Page {{current}} of {{total}} ({{count}} shipments)',
  PREVIOUS: 'Previous',
  NEXT: 'Next',

  // Tracking modal
  TRACKING_TITLE: 'Tracking: {{code}}',
  MODAL_ORDER: 'Order',
  MODAL_SERVICE: 'Service',
  MODAL_CONTRACT: 'Contract',
  MODAL_MEDUSA_STATUS: 'Medusa Status',
  LOADING_TRACKING: 'Loading tracking...',
  TRACKING_ERROR: 'Could not retrieve tracking information. Please try again.',
  CURRENT_STATUS: 'Current status:',
  ESTIMATED_DELIVERY: 'Estimated delivery',
  MOVEMENT_HISTORY: 'Movement history',
  NO_MOVEMENTS: 'No movements registered yet.',
  LAST_UPDATE: 'Last update: {{date}}',
  VIEW_ON_ANDREANI: 'View on Andreani.com',
  CLOSE: 'Close',

  // Tabs
  TAB_SHIPMENTS: 'Shipments',
  TAB_BOXES: 'Boxes',

  // Bulk
  BULK_GENERATE: 'Generate labels ({{count}})',
  // Rótulo de la acción masiva en la command bar del DataTable: ahí no hay
  // selección al momento de armar el label, así que no puede llevar {{count}}
  // como `BULK_GENERATE` (que quedó de cuando esto era un botón).
  BULK_GENERATE_LABEL: 'Generate labels',
  BULK_OK: 'Generated labels for {{count}} order(s)',

  // Boxes
  BOXES_TITLE: 'Boxes',
  // `BOXES_SUBTITLE` se borró: estaba definida en los dos idiomas y NINGÚN
  // componente la renderizaba (`box-list.tsx` sólo usa TITLE/LOADING/EMPTY). Una
  // clave muerta es peor que un texto de más: se traduce, se revisa y se arrastra
  // en cada auditoría sin que nadie pueda verificar cómo se ve.
  BOXES_LOADING: 'Loading boxes...',
  BOXES_EMPTY: 'No boxes yet. Without boxes, built-in defaults are used.',
  BOX_NAME: 'Name',
  BOX_HEIGHT: 'Height (cm)',
  BOX_WIDTH: 'Width (cm)',
  BOX_DEEP: 'Depth (cm)',
  BOX_MAX_CAPACITY: 'Max kg (0 = unlimited)',
  BOX_ACTIVE: 'Active',
  BOX_CREATE: 'Create box',
  BOX_UPDATE: 'Save changes',
  BOX_CANCEL: 'Cancel',
  BOX_EDIT: 'Edit',
  BOX_DELETE: 'Delete',
  BOX_INVALID: 'Name and positive height/width/depth are required.',
  BOX_SAVED: 'Box saved.',
  BOX_DELETED: 'Box deleted.',
  BOX_DELETE_CONFIRM: 'Delete box "{{name}}"?',
  BOX_ON: 'Active',
  BOX_OFF: 'Inactive',
};

export const es = {
  // Fulfillment list
  TITLE: 'Envíos Andreani',
  SUBTITLE: 'Lista global de fulfillments procesados por Andreani.',
  REFRESH: 'Actualizar',
  SEARCH_LABEL: 'Buscar',
  SEARCH_PLACEHOLDER: 'Buscar por orden o tracking...',
  FILTER_STATUS: 'Estado',
  FILTER_DATE_FROM: 'Desde',
  FILTER_DATE_TO: 'Hasta',
  STATUS_ALL: 'Todos',
  STATUS_PENDING: 'Pendiente',
  STATUS_SHIPPED: 'Enviado',
  STATUS_DELIVERED: 'Entregado',
  STATUS_CANCELED: 'Cancelado',
  DOWNLOAD_ALL: 'Descargar todas (filtradas)',
  DOWNLOAD_ALL_OK: 'Se está descargando el ZIP con las etiquetas filtradas.',
  DOWNLOAD_ALL_TRUNCATED:
    'El filtro matcheó {{total}} etiquetas; solo se incluyeron las 200 más recientes.',
  LABEL_ERROR: 'No se pudo abrir la etiqueta: {{message}}',
  LOADING_SHIPMENTS: 'Cargando envíos...',
  NO_RESULTS: 'Sin resultados para "{{search}}"',
  NO_SHIPMENTS: 'No hay envíos Andreani registrados aún.',
  COL_ORDER: 'Orden',
  COL_TRACKING: 'Tracking',
  COL_SERVICE: 'Servicio',
  COL_STATUS: 'Estado',
  COL_DATE: 'Fecha',
  VIEW_TRACKING: 'Ver seguimiento',
  LABEL_BUTTON: 'Etiqueta',
  PAGINATION: 'Página {{current}} de {{total}} ({{count}} envíos)',
  PREVIOUS: 'Anterior',
  NEXT: 'Siguiente',

  // Tracking modal
  TRACKING_TITLE: 'Seguimiento: {{code}}',
  MODAL_ORDER: 'Orden',
  MODAL_SERVICE: 'Servicio',
  MODAL_CONTRACT: 'Contrato',
  MODAL_MEDUSA_STATUS: 'Estado Medusa',
  LOADING_TRACKING: 'Cargando seguimiento...',
  TRACKING_ERROR: 'No se pudo obtener información de seguimiento. Intenta de nuevo.',
  CURRENT_STATUS: 'Estado actual:',
  ESTIMATED_DELIVERY: 'Entrega estimada',
  MOVEMENT_HISTORY: 'Historial de movimientos',
  NO_MOVEMENTS: 'Sin movimientos registrados aún.',
  LAST_UPDATE: 'Última actualización: {{date}}',
  VIEW_ON_ANDREANI: 'Ver en Andreani.com',
  CLOSE: 'Cerrar',

  // Tabs
  TAB_SHIPMENTS: 'Envíos',
  TAB_BOXES: 'Cajas',

  // Bulk
  BULK_GENERATE: 'Generar etiquetas ({{count}})',
  BULK_GENERATE_LABEL: 'Generar etiquetas',
  BULK_OK: 'Etiquetas generadas para {{count}} orden(es)',

  // Cajas
  BOXES_TITLE: 'Cajas',
  BOXES_LOADING: 'Cargando cajas...',
  BOXES_EMPTY: 'No hay cajas aún. Sin cajas se usan las predeterminadas.',
  BOX_NAME: 'Nombre',
  BOX_HEIGHT: 'Alto (cm)',
  BOX_WIDTH: 'Ancho (cm)',
  BOX_DEEP: 'Profundidad (cm)',
  BOX_MAX_CAPACITY: 'Máx kg (0 = sin límite)',
  BOX_ACTIVE: 'Activa',
  BOX_CREATE: 'Crear caja',
  BOX_UPDATE: 'Guardar cambios',
  BOX_CANCEL: 'Cancelar',
  BOX_EDIT: 'Editar',
  BOX_DELETE: 'Borrar',
  BOX_INVALID: 'Nombre y alto/ancho/profundidad positivos son obligatorios.',
  BOX_SAVED: 'Caja guardada.',
  BOX_DELETED: 'Caja borrada.',
  BOX_DELETE_CONFIRM: '¿Borrar la caja "{{name}}"?',
  BOX_ON: 'Activa',
  BOX_OFF: 'Inactiva',
};

/**
 * Registers the Andreani translation bundles on the i18n instance that
 * Medusa's admin actually initialized.
 *
 * IMPORTANT: pass the `i18n` instance from `useTranslation()` — do NOT call the
 * bare `i18next` singleton. With pnpm, the admin bundle can resolve a second,
 * uninitialized copy of i18next whose `addResourceBundle` is unavailable
 * ("addResourceBundle is not a function"). The hook's instance is always the
 * live, initialized one.
 */
export const registerAndreaniTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', ANDREANI_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', ANDREANI_NAMESPACE, es, true, true);

  // Mark the namespace as loaded so react-i18next re-renders components
  // that read it before registration (otherwise raw keys stick).
  void i18n.loadNamespaces(ANDREANI_NAMESPACE);

  registered = true;
};
