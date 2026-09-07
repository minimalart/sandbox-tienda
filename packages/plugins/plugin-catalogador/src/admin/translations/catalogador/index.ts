import type { i18n as I18nInstance } from 'i18next';

const CATALOGADOR_NAMESPACE = 'catalogador';
let registered = false;

export const en = {
  TITLE: 'Catalogador',
  DESCRIPTION: 'Bulk-improve existing products with AI. The AI proposes, you decide.',
  NEW_EXECUTION: 'New execution',
  CONFIG: 'Settings',
  EMPTY_STATE: 'No executions yet. Create one to start improving your catalog.',
  COLUMN_NAME: 'Name',
  COLUMN_STATUS: 'Status',
  COLUMN_PRODUCTS: 'Products',
  COLUMN_PROGRESS: 'Progress',
  COLUMN_ERRORS: 'Errors',
  COLUMN_DATE: 'Date',
  STEP_SELECT: 'Select products',
  STEP_IMPROVE: 'Choose improvements',
  STEP_GENERATE: 'Generate & validate',
};

export const es: typeof en = {
  TITLE: 'Catalogador',
  DESCRIPTION: 'Mejorá masivamente productos existentes con IA. La IA propone, vos decidís.',
  NEW_EXECUTION: 'Nueva ejecución',
  CONFIG: 'Configuración',
  EMPTY_STATE: 'Todavía no hay ejecuciones. Creá una para empezar a mejorar tu catálogo.',
  COLUMN_NAME: 'Nombre',
  COLUMN_STATUS: 'Estado',
  COLUMN_PRODUCTS: 'Productos',
  COLUMN_PROGRESS: 'Progreso',
  COLUMN_ERRORS: 'Errores',
  COLUMN_DATE: 'Fecha',
  STEP_SELECT: 'Seleccionar productos',
  STEP_IMPROVE: 'Elegir mejoras',
  STEP_GENERATE: 'Generar y validar',
};

export function registerCatalogadorTranslations(i18n: I18nInstance): void {
  if (registered) return;
  i18n.addResourceBundle('en', CATALOGADOR_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', CATALOGADOR_NAMESPACE, es, true, true);
  registered = true;
}
