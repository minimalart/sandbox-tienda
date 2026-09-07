import type { i18n as I18nInstance } from 'i18next';
import { en as analyticsEn, es as analyticsEsBundle } from './analytics';
import { en as curationsEn, es as curationsEsBundle } from './curations';
import { en as presetsEn, es as presetsEsBundle } from './presets';
import { en as searchEn, es as searchEsBundle } from './search';
import { en as stopwordsEn, es as stopwordsEsBundle } from './stopwords';
import { en as synonymsEn, es as synonymsEsBundle } from './synonyms';

const TYPESENSE_NAMESPACE = 'typesense';
let registered = false;

export const en = {
  TITLE: 'Typesense',
  SUBTITLE: 'Manage search synchronization and verify collection status.',
  PRODUCT_SYNC_TITLE: 'Product Sync',
  PRODUCT_SYNC_SUBTITLE: 'Keep the Typesense collection in sync with the latest catalog data.',
  SYNC_BUTTON: 'Sync Products',
  SYNC_SUCCESS: 'Products synced successfully',
  SYNC_FAILED: 'Failed to sync products',
  LAST_SYNC_PREFIX: 'Last sync',
  CONFIG_TITLE: 'Configuration',
  CONFIG_HOST: 'Host',
  CONFIG_COLLECTION: 'Collection',
  CONFIG_API_KEY: 'API Key',
  CONFIG_STATUS_SET: 'Configured',
  CONFIG_STATUS_MISSING: 'Missing',
  STATUS_CONNECTED: 'Connected',
  STATUS_DISCONNECTED: 'Disconnected',
  ENV_NOT_SET: 'Not set',
  LABEL: 'Typesense',
  TEST_COLLECTION_BUTTON: 'Test Collection',
  TEST_RESULTS_TITLE: 'Test Results:',
  TEST_DOCUMENTS_IN_COLLECTION: 'Documents in collection:',
  TEST_SAMPLE_PRODUCTS: 'Sample products:',
  TEST_UNTITLED: 'Untitled',
  // ── Sync: update vs recreate ──────────────────────────────────────────────
  UPDATE_BUTTON: 'Update index',
  // `UPDATE_HINT` se fue al drawer de ayuda (`src/admin/help/typesense.ts`): era
  // texto visible SIEMPRE debajo de los botones. Se borra la clave y no sólo el
  // render porque una clave sin consumidor se sigue traduciendo a dos idiomas sin
  // que nadie pueda verificar cómo queda. `RECREATE_CONFIRM` se queda: es el
  // `window.confirm` de la acción destructiva, no ayuda de pantalla.
  RECREATE_BUTTON: 'Recreate collection',
  RECREATE_CONFIRM:
    'Are you sure? This will recreate the Typesense collection from scratch. Storefront search will be degraded for a few minutes (synonyms and curations are preserved).',
  SYNC_STARTED: 'Sync started. You can follow the progress here or in Logs.',
  LOGS_BUTTON: 'View logs',
  // ── Logs ──────────────────────────────────────────────────────────────────
  LOGS_TITLE: 'Sync runs',
  LOGS_EMPTY: 'No sync runs yet.',
  LOG_DETAIL_TITLE: 'Run detail',
  LOG_PROGRESS: 'Processed {{processed}} of {{total}} products',
  ITEMS_TITLE: 'Detail',
  ITEMS_EMPTY: 'No items with attention needed in this run.',
  SEARCH_PRODUCT_ID: 'Product id',
  COL_STARTED: 'Started',
  COL_MODE: 'Mode',
  COL_TRIGGER: 'Trigger',
  COL_STATUS: 'Status',
  COL_SUMMARY: 'Summary',
  COL_DURATION: 'Duration',
  COL_PRODUCT: 'Product',
  COL_ITEM_STATUS: 'Result',
  COL_ITEM_PHASE: 'Phase',
  COL_ERROR: 'Error',
  FILTER_ALL: 'All statuses',
  FILTER_ALL_MODES: 'All modes',
  MODE_UPDATE: 'Update',
  MODE_RECREATE: 'Recreate',
  TRIGGER_MANUAL: 'Manual',
  TRIGGER_CRON: 'Scheduled',
  TRIGGER_EVENT: 'Event',
  ST_RUNNING: 'Running',
  ST_COMPLETED: 'Completed',
  ST_COMPLETED_WITH_ERRORS: 'Completed with errors',
  ST_FAILED: 'Failed',
  ST_DELETED: 'Deleted',
  ST_SKIPPED: 'Skipped',
  SUMMARY_TOTAL: 'Total',
  SUMMARY_INDEXED: 'Indexed',
  SUMMARY_DELETED: 'Deleted',
  SUMMARY_ERRORS: 'Errors',
  SUMMARY_RECREATED: 'Collection recreated',
  SUMMARY_RECREATED_TAG: 'recreated',
  SUMMARY_SYNONYMS_RESTORED: 'Synonyms restored',
  SUMMARY_CURATIONS_RESTORED: 'Curations restored',
  ANSWER_YES: 'Yes',
  ANSWER_NO: 'No',
  ...searchEn,
  ...synonymsEn,
  ...stopwordsEn,
  ...curationsEn,
  ...presetsEn,
  ...analyticsEn,
};

export const es = {
  TITLE: 'Typesense',
  SUBTITLE: 'Gestiona la sincronización de búsqueda y verifica el estado de la colección.',
  PRODUCT_SYNC_TITLE: 'Sincronización de Productos',
  PRODUCT_SYNC_SUBTITLE:
    'Mantiene la colección de Typesense al día con los últimos datos del catálogo.',
  SYNC_BUTTON: 'Sincronizar productos',
  SYNC_SUCCESS: 'Productos sincronizados correctamente',
  SYNC_FAILED: 'Error al sincronizar los productos',
  LAST_SYNC_PREFIX: 'Última sincronización',
  CONFIG_TITLE: 'Configuración',
  CONFIG_HOST: 'Host',
  CONFIG_COLLECTION: 'Colección',
  CONFIG_API_KEY: 'Clave API',
  CONFIG_STATUS_SET: 'Configurado',
  CONFIG_STATUS_MISSING: 'No configurado',
  STATUS_CONNECTED: 'Conectado',
  STATUS_DISCONNECTED: 'Desconectado',
  ENV_NOT_SET: 'Sin definir',
  LABEL: 'Typesense',
  TEST_COLLECTION_BUTTON: 'Probar colección',
  TEST_RESULTS_TITLE: 'Resultados de prueba:',
  TEST_DOCUMENTS_IN_COLLECTION: 'Documentos en la colección:',
  TEST_SAMPLE_PRODUCTS: 'Productos de muestra:',
  TEST_UNTITLED: 'Sin título',
  // ── Sync: actualizar vs recrear ───────────────────────────────────────────
  UPDATE_BUTTON: 'Actualizar índice',
  RECREATE_BUTTON: 'Recrear colección',
  RECREATE_CONFIRM:
    '¿Estás seguro? Esto recreará la colección de Typesense desde cero. La búsqueda del storefront queda degradada unos minutos (los sinónimos y las curaciones se conservan).',
  SYNC_STARTED: 'Sincronización iniciada. Podés seguir el progreso acá o en Logs.',
  LOGS_BUTTON: 'Ver logs',
  // ── Logs ──────────────────────────────────────────────────────────────────
  LOGS_TITLE: 'Sincronizaciones',
  LOGS_EMPTY: 'Todavía no hay sincronizaciones.',
  LOG_DETAIL_TITLE: 'Detalle de la corrida',
  LOG_PROGRESS: 'Procesados {{processed}} de {{total}} productos',
  ITEMS_TITLE: 'Detalle',
  ITEMS_EMPTY: 'Esta corrida no dejó items que requieran atención.',
  SEARCH_PRODUCT_ID: 'Id de producto',
  COL_STARTED: 'Inicio',
  COL_MODE: 'Modo',
  COL_TRIGGER: 'Disparo',
  COL_STATUS: 'Estado',
  COL_SUMMARY: 'Resumen',
  COL_DURATION: 'Duración',
  COL_PRODUCT: 'Producto',
  COL_ITEM_STATUS: 'Resultado',
  COL_ITEM_PHASE: 'Etapa',
  COL_ERROR: 'Error',
  FILTER_ALL: 'Todos los estados',
  FILTER_ALL_MODES: 'Todos los modos',
  MODE_UPDATE: 'Actualizar',
  MODE_RECREATE: 'Recrear',
  TRIGGER_MANUAL: 'Manual',
  TRIGGER_CRON: 'Programado',
  TRIGGER_EVENT: 'Evento',
  ST_RUNNING: 'En curso',
  ST_COMPLETED: 'Completada',
  ST_COMPLETED_WITH_ERRORS: 'Completada con errores',
  ST_FAILED: 'Falló',
  ST_DELETED: 'Borrado',
  ST_SKIPPED: 'Salteado',
  SUMMARY_TOTAL: 'Total',
  SUMMARY_INDEXED: 'Indexados',
  SUMMARY_DELETED: 'Borrados',
  SUMMARY_ERRORS: 'Errores',
  SUMMARY_RECREATED: 'Colección recreada',
  SUMMARY_RECREATED_TAG: 'recreada',
  SUMMARY_SYNONYMS_RESTORED: 'Sinónimos restaurados',
  SUMMARY_CURATIONS_RESTORED: 'Curaciones restauradas',
  ANSWER_YES: 'Sí',
  ANSWER_NO: 'No',
  ...searchEsBundle,
  ...synonymsEsBundle,
  ...stopwordsEsBundle,
  ...curationsEsBundle,
  ...presetsEsBundle,
  ...analyticsEsBundle,
};

/**
 * Registers the Typesense translation bundles on the i18n instance that
 * Medusa's admin actually initialized.
 *
 * IMPORTANT: pass the `i18n` instance from `useTranslation()` — do NOT call the
 * bare `i18next` singleton. With pnpm, the admin bundle can resolve a second,
 * uninitialized copy of i18next whose `addResourceBundle` is unavailable
 * ("addResourceBundle is not a function"). The hook's instance is always the
 * live, initialized one.
 */
export const registerTypesenseTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', TYPESENSE_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', TYPESENSE_NAMESPACE, es, true, true);

  // Mark the namespace as loaded so react-i18next re-renders components
  // that read it before registration (otherwise raw keys stick).
  void i18n.loadNamespaces(TYPESENSE_NAMESPACE);

  registered = true;
};
