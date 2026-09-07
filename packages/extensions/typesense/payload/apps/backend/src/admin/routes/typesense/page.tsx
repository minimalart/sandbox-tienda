import { defineRouteConfig } from '@medusajs/admin-sdk';
import { MagnifyingGlass } from '@medusajs/icons';
import { Button, Container, Heading, StatusBadge, Text, Toaster, toast } from '@medusajs/ui';
import type { TypesenseSyncProgress } from '../../hooks/api/typesense';
import { useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import { useNavigate } from 'react-router-dom';
import { ExtensionVersion } from '../../components/common/extension-version';
import { HelpDrawer } from '../../components/common/help-drawer';

import {
  TYPESENSE_LAST_SYNC_QUERY_KEY,
  useTypesenseLastSync,
  useTypesenseConfig,
  useTypesenseSyncProducts,
  useTypesenseSyncProgress,
  useTypesenseTestCollection,
} from '../../hooks/api/typesense';
import { registerTypesenseTranslations } from '../../translations/typesense';
import SearchQueriesSection from './components/Analytics/SearchQueriesSection';
import { useSearchAnalytics } from './hooks/useSearchAnalytics';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const TypesenseDashboard = () => {
  const { t, i18n } = useTranslation('typesense');
  registerTypesenseTranslations(i18n);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [testResult, setTestResult] = useState<{ count: number; samples: any[] } | null>(null);
  const { mutateAsync: syncProducts, isPending } = useTypesenseSyncProducts();
  const { mutateAsync: testCollection, isPending: isTestPending } = useTypesenseTestCollection();
  // El POST responde 202 al instante, así que "está corriendo" NO es `isPending`
  // del mutation: lo dice el status de la última corrida en la DB. Gracias a eso,
  // reabrir la pantalla re-engancha una corrida en curso (antes se perdía).
  const { data: progress } = useTypesenseSyncProgress();
  const isSyncing = progress?.status === 'running';
  const { data: lastSyncData } = useTypesenseLastSync();
  const lastSync = lastSyncData?.lastSyncAt
    ? new Date(lastSyncData.lastSyncAt).toLocaleString()
    : null;
  const analytics = useSearchAnalytics();

  useEffect(() => {
    if (analytics.error) {
      toast.error(t('ANALYTICS_LOAD_FAILED'));
    }
  }, [analytics.error, t]);

  const handleReinitAnalytics = async () => {
    try {
      await analytics.reset();
      toast.success(t('ANALYTICS_INIT_SUCCESS'));
    } catch {
      toast.error(t('ANALYTICS_INIT_FAILED'));
    }
  };

  const runSync = async (mode: 'update' | 'recreate') => {
    try {
      await syncProducts({ mode });
      queryClient.invalidateQueries({ queryKey: TYPESENSE_LAST_SYNC_QUERY_KEY });
      toast.success(t('SYNC_STARTED'));
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error(message || t('SYNC_FAILED'));
    }
  };

  const handleUpdate = () => runSync('update');

  /**
   * Recrear BORRA la colección: la búsqueda del storefront queda degradada unos
   * minutos. Va detrás de un confirm y con variante `danger` para que no se
   * confunda con "actualizar".
   */
  const handleRecreate = () => {
    if (!window.confirm(t('RECREATE_CONFIRM'))) return;
    return runSync('recreate');
  };

  const handleTest = async () => {
    try {
      const result = await testCollection();
      setTestResult({
        count: result.documentCount,
        samples: result.sampleProducts,
      });
      toast.success(result.message || `Found ${result.documentCount} products in collection`);
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error(message || 'Failed to test collection');
      setTestResult(null);
    }
  };

  // Real, runtime status from the backend — the previous VITE_* build-time vars
  // were never injected into the admin bundle, so the panel always looked
  // "disconnected" even when Typesense was working.
  const { data: tsConfig } = useTypesenseConfig();
  const host = tsConfig
    ? `${tsConfig.protocol}://${tsConfig.host}:${tsConfig.port}`
    : t('ENV_NOT_SET');
  const collection = tsConfig?.collection || 'products';
  const apiKeyStatus = tsConfig?.apiKeySet
    ? t('CONFIG_STATUS_SET')
    : t('CONFIG_STATUS_MISSING');
  const isConnected = tsConfig?.connected ?? false;

  return (
    <>
      <Container className="flex flex-col gap-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-2">
            <Heading className="font-sans font-medium h1-core">{t('TITLE')}</Heading>
            <ExtensionVersion extension="typesense" />
          </div>
          {/* El drawer va acá y no sólo en Configuración: de esta pantalla se sacó
              `UPDATE_HINT`, y las dos acciones que ese texto explicaba (Actualizar y
              Recrear) viven acá, no allá. */}
          <HelpDrawer slug="typesense" />
        </div>

        {/* Connection status + config — flat row, no nested cards. */}
        <div className="flex flex-col gap-2 border-ui-border-base border-b pb-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <StatusBadge color={isConnected ? 'green' : 'red'}>
              {isConnected ? t('STATUS_CONNECTED') : t('STATUS_DISCONNECTED')}
            </StatusBadge>
            <Text size="small" className="text-ui-fg-subtle">
              {t('CONFIG_HOST')}:{' '}
              <span className="text-ui-fg-base">{host}</span>
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              {t('CONFIG_COLLECTION')}:{' '}
              <span className="text-ui-fg-base">{collection}</span>
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              {t('CONFIG_API_KEY')}:{' '}
              <span className="text-ui-fg-base">{apiKeyStatus}</span>
            </Text>
          </div>
        </div>

        {/* Product sync — flat section. */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ui-bg-subtle">
              <MagnifyingGlass className="text-ui-fg-muted" />
            </div>
            <div>
              <Heading level="h2" className="text-base">
                {t('PRODUCT_SYNC_TITLE')}
              </Heading>
              <Text size="small" className="text-ui-fg-subtle">
                {t('PRODUCT_SYNC_SUBTITLE')}
              </Text>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="small"
              variant="primary"
              onClick={handleUpdate}
              isLoading={isPending}
              disabled={isSyncing}
            >
              {t('UPDATE_BUTTON')}
            </Button>
            <Button
              size="small"
              variant="danger"
              onClick={handleRecreate}
              disabled={isPending || isSyncing}
            >
              {t('RECREATE_BUTTON')}
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={handleTest}
              isLoading={isTestPending}
            >
              {t('TEST_COLLECTION_BUTTON')}
            </Button>
            <Button size="small" variant="transparent" onClick={() => navigate('/typesense/logs')}>
              {t('LOGS_BUTTON')}
            </Button>
            {lastSync && !isSyncing && (
              <StatusBadge color="green" className="text-xs">
                {t('LAST_SYNC_PREFIX')}: {lastSync}
              </StatusBadge>
            )}
          </div>
          {/* Acá vivía `UPDATE_HINT`: la diferencia entre Actualizar y Recrear.
              Está en el drawer del header, sección "Actualizar no es lo mismo que
              recrear", que además dice CUÁNDO hace falta recrear —esquema cambiado
              o colección en un estado que refrescar no arregla—, que es la parte
              accionable y la que acá no entraba. Era cierto SIEMPRE y vivía debajo
              de cuatro botones, o sea después de que ya elegiste.
              El `window.confirm` de `RECREATE_CONFIRM` se queda: ése aparece con el
              dedo sobre el gatillo, no es ayuda de pantalla. */}
          {isSyncing && progress && progress.stage !== 'idle' && (
            <SyncProgress progress={progress} />
          )}
          {testResult && (
            <div className="rounded-lg bg-ui-bg-subtle p-3">
              <Text size="small" weight="plus" className="mb-2">
                {t('TEST_RESULTS_TITLE')}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                • {t('TEST_DOCUMENTS_IN_COLLECTION')}{' '}
                <span className="font-semibold text-ui-fg-base">{testResult.count}</span>
              </Text>
              {testResult.samples.length > 0 && (
                <div className="mt-2">
                  <Text size="xsmall" className="text-ui-fg-subtle mb-1">
                    {t('TEST_SAMPLE_PRODUCTS')}
                  </Text>
                  <ul className="list-disc list-inside space-y-1">
                    {testResult.samples.slice(0, 3).map((hit: any, idx: number) => (
                      <li key={idx} className="text-xs text-ui-fg-muted">
                        {hit.document?.title || t('TEST_UNTITLED')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <SearchQueriesSection
          popularQueries={analytics.popularQueries}
          queriesWithoutResults={analytics.queriesWithoutResults}
          loading={analytics.loading}
          reinitializing={analytics.resetting}
          onReinitialize={handleReinitAnalytics}
        />
      </Container>

      <Toaster />
    </>
  );
};

const STAGE_LABELS_ES: Record<TypesenseSyncProgress['stage'], string> = {
  idle: 'Esperando',
  loading: 'Contando productos publicados',
  mapping: 'Preparando documentos',
  listing: 'Listando documentos existentes',
  recreating: 'Recreando colección',
  upserting: 'Subiendo a Typesense',
  deleting: 'Eliminando documentos obsoletos',
  done: 'Finalizado',
  // Faltaba: el estado de error se renderizaba como el string crudo "error".
  error: 'Error',
};

const SyncProgress = ({ progress }: { progress: TypesenseSyncProgress }) => {
  const stageLabel = STAGE_LABELS_ES[progress.stage] ?? progress.stage;
  const total = progress.total || 0;
  const done = progress.done || 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const showCounter = total > 0 && progress.stage === 'upserting';

  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
      <div className="flex items-center justify-between mb-2">
        <Text size="small" weight="plus">
          {stageLabel}
          {showCounter ? ` · ${done}/${total}` : ''}
        </Text>
        {total > 0 && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {pct}%
          </Text>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ui-bg-base">
        <div
          className="h-full bg-ui-fg-interactive transition-all"
          style={{ width: total > 0 ? `${pct}%` : '40%' }}
        />
      </div>
      {progress.message && (
        <Text size="xsmall" className="text-ui-fg-subtle mt-2">
          {progress.message}
        </Text>
      )}
    </div>
  );
};

const TypesenseIcon = () => <MagnifyingGlass style={{ color: '#2EC4C7' }} />;

export const config = defineRouteConfig({
  label: i18next.language === 'es' ? 'Typesense' : 'Typesense',
  icon: TypesenseIcon,
  rank: 50,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Typesense',
};

export default TypesenseDashboard;
