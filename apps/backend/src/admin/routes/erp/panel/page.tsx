import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ChartBar } from '@medusajs/icons';
import {
  Button,
  Container,
  Heading,
  StatusBadge,
  Text,
  Toaster,
  toast,
  usePrompt,
} from '@medusajs/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ExtensionVersion } from '../../../components/common/extension-version';
import {
  useErpConfig,
  useErpOutboxEvents,
  useErpSyncLogs,
  useRunCatalogSync,
  useRunStockSync,
} from '../../../hooks/api';
import {
  ErpStatusBadge,
  formatDateTime,
  statusLabelKey,
  useErpTranslationsReady,
} from '../components/shared';

/**
 * Panel de la extensión ERP: estado de la integración, última sincronización
 * de stock (con corrida manual + poll mientras corre) y resumen del outbox de
 * ventas. El item padre "ERP" redirige a Configuración; este panel es una
 * sub-ruta más (junto a Configuración / Logs / Ventas).
 */
const ErpPanelPage = () => {
  const { t, i18n } = useTranslation('erp');
  useErpTranslationsReady(i18n);
  const navigate = useNavigate();

  const { data: configData } = useErpConfig();
  const config = configData?.config ?? null;

  const { data: logsData } = useErpSyncLogs(
    { type: 'stock_sync', limit: 1, offset: 0 },
    // Poll corto mientras hay una corrida activa para ver el progreso en vivo.
    { refetchInterval: 4000 }
  );
  const lastSync = logsData?.sync_logs?.[0] ?? null;
  const isSyncing = lastSync?.status === 'running';

  const { data: outboxData } = useErpOutboxEvents({ limit: 1, offset: 0 }, { refetchInterval: 15000 });
  const counts = outboxData?.counts ?? {};

  const { mutate: runSync, isPending: isStarting } = useRunStockSync({
    onSuccess: () => toast.success(t('RUN_SYNC_STARTED')),
    onError: (error) => toast.error(t('RUN_SYNC_ERROR', { msg: error.message })),
  });

  const { data: catalogLogsData } = useErpSyncLogs(
    { type: 'catalog_sync', limit: 1, offset: 0 },
    { refetchInterval: 4000 }
  );
  const lastCatalogSync = catalogLogsData?.sync_logs?.[0] ?? null;
  const isCatalogSyncing = lastCatalogSync?.status === 'running';
  const catalogSummary = lastCatalogSync?.summary ?? null;

  const { mutate: runCatalogSync, isPending: isCatalogStarting } = useRunCatalogSync({
    onSuccess: (data) =>
      toast.success(
        data.dry_run
          ? t('CATALOG_DRY_RUN_STARTED')
          : data.full_sweep
            ? t('CATALOG_FULL_SWEEP_STARTED')
            : t('CATALOG_RUN_STARTED')
      ),
    onError: (error) => toast.error(t('CATALOG_RUN_ERROR', { msg: error.message })),
  });

  /**
   * El barrido completo pide confirmación y la corrida normal no: la normal trae
   * el delta que el ERP marcó como cambiado (decenas de artículos), mientras que
   * ésta pide el catálogo entero y puede reescribir miles de títulos de una — es
   * lo que hay que correr cuando cambian las reglas de normalización, y no algo
   * que convenga disparar de un clic distraído.
   */
  const confirm = usePrompt();
  const startFullSweep = async (): Promise<void> => {
    const confirmed = await confirm({
      title: t('CATALOG_RUN_FULL'),
      description: t('CATALOG_RUN_FULL_CONFIRM'),
      confirmText: t('CATALOG_RUN_FULL_CONFIRM_OK'),
      cancelText: t('CANCEL'),
    });
    if (confirmed) runCatalogSync({ fullSweep: true });
  };

  const providerLabel = useMemo(() => {
    const entry = configData?.providers?.find((p) => p.id === config?.provider);
    return entry?.label ?? config?.provider ?? '—';
  }, [configData?.providers, config?.provider]);

  const summary = lastSync?.summary ?? null;
  const errorish =
    (summary?.not_found ?? 0) +
    (summary?.duplicate_sku ?? 0) +
    (summary?.invalid_quantity ?? 0) +
    (summary?.failed ?? 0) +
    (summary?.skipped_other ?? 0);

  const connectionText = !config?.last_validated_at
    ? t('CONNECTION_NEVER')
    : config.last_validation_ok
      ? t('CONNECTION_OK', { date: formatDateTime(config.last_validated_at) })
      : t('CONNECTION_FAILED', { date: formatDateTime(config.last_validated_at) });

  return (
    <>
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Heading>{t('DASHBOARD_TITLE')}</Heading>
            <ExtensionVersion extension="erp" />
          </div>
          {config ? (
            <StatusBadge color={config.enabled ? 'green' : 'grey'}>
              {config.enabled ? t('STATUS_ENABLED') : t('STATUS_DISABLED')}
            </StatusBadge>
          ) : null}
        </div>

        {!config ? (
          <div className="flex flex-col items-start gap-3 border-t px-6 py-6">
            <Text className="text-ui-fg-subtle">{t('NOT_CONFIGURED')}</Text>
            <Button size="small" onClick={() => navigate('/erp/configuracion')}>
              {t('GO_TO_CONFIG')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 border-t px-6 py-4 lg:grid-cols-3">
            {/* Integración */}
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <Text size="small" weight="plus" className="text-ui-fg-muted">
                {t('CARD_INTEGRATION')}
              </Text>
              <div className="flex items-baseline justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('FIELD_PROVIDER')}
                </Text>
                <Text size="small" weight="plus">
                  {providerLabel}
                </Text>
              </div>
              <div className="flex items-baseline justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('FIELD_COUNTRY')}
                </Text>
                <Text size="small" weight="plus">
                  {config.country_code}
                </Text>
              </div>
              <div className="flex items-baseline justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('CONNECTION_LABEL')}
                </Text>
                <Text
                  size="small"
                  className={
                    config.last_validation_ok === false ? 'text-ui-fg-error' : 'text-ui-fg-base'
                  }
                >
                  {connectionText}
                </Text>
              </div>
              <div className="flex items-baseline justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('TOGGLE_STOCK')}
                </Text>
                <Text size="small">{config.stock_sync_enabled ? t('TOGGLE_ON') : t('TOGGLE_OFF')}</Text>
              </div>
              <div className="flex items-baseline justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('TOGGLE_CATALOG')}
                </Text>
                <Text size="small">
                  {config.catalog_sync_enabled ? t('TOGGLE_ON') : t('TOGGLE_OFF')}
                </Text>
              </div>
              <div className="flex items-baseline justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('TOGGLE_SALES')}
                </Text>
                <Text size="small">
                  {config.sales_notify_enabled ? t('TOGGLE_ON') : t('TOGGLE_OFF')}
                </Text>
              </div>
              <Button
                size="small"
                variant="secondary"
                className="mt-2 w-fit"
                onClick={() => navigate('/erp/configuracion')}
              >
                {t('GO_TO_CONFIG')}
              </Button>
            </div>

            {/* Última sync */}
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <Text size="small" weight="plus" className="text-ui-fg-muted">
                {t('CARD_LAST_SYNC')}
              </Text>
              {!lastSync ? (
                <Text size="small" className="text-ui-fg-subtle">
                  {t('LAST_SYNC_NONE')}
                </Text>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Text size="small" className="text-ui-fg-subtle">
                      {formatDateTime(lastSync.started_at)}
                    </Text>
                    <ErpStatusBadge status={lastSync.status} label={t(statusLabelKey(lastSync.status))} />
                  </div>
                  {isSyncing && summary?.total_skus ? (
                    <div className="flex flex-col gap-1">
                      <Text size="small" className="text-ui-fg-subtle">
                        {t('LOG_PROGRESS', {
                          processed: summary.processed ?? 0,
                          total: summary.total_skus,
                        })}
                      </Text>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
                        <div
                          className="h-full bg-ui-fg-interactive transition-all"
                          style={{
                            width: `${Math.min(100, Math.round(((summary.processed ?? 0) / summary.total_skus) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : summary ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <Text size="small">
                        {t('SUMMARY_TOTAL')}: <b>{summary.total_skus ?? 0}</b>
                      </Text>
                      <Text size="small">
                        {t('SUMMARY_UPDATED')}: <b>{summary.updated ?? 0}</b>
                      </Text>
                      <Text size="small">
                        {t('SUMMARY_ERRORS')}: <b>{errorish}</b>
                      </Text>
                    </div>
                  ) : null}
                </>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="small"
                  isLoading={isStarting}
                  disabled={!config.enabled || !config.stock_sync_enabled || isSyncing}
                  onClick={() => runSync()}
                >
                  {isSyncing ? t('SYNC_RUNNING') : t('RUN_SYNC')}
                </Button>
                <Button size="small" variant="secondary" onClick={() => navigate('/erp/logs')}>
                  {t('VIEW_LOGS')}
                </Button>
              </div>
            </div>

            {/* Catálogo (productos + listas de precios) */}
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <Text size="small" weight="plus" className="text-ui-fg-muted">
                {t('CARD_CATALOG_SYNC')}
              </Text>
              {!lastCatalogSync ? (
                <Text size="small" className="text-ui-fg-subtle">
                  {t('CATALOG_SYNC_NONE')}
                </Text>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Text size="small" className="text-ui-fg-subtle">
                      {formatDateTime(lastCatalogSync.started_at)}
                      {catalogSummary?.dry_run ? ` · ${t('CATALOG_DRY_RUN_TAG')}` : ''}
                    </Text>
                    <ErpStatusBadge
                      status={lastCatalogSync.status}
                      label={t(statusLabelKey(lastCatalogSync.status))}
                    />
                  </div>
                  {isCatalogSyncing && catalogSummary?.total_erp_rows ? (
                    <div className="flex flex-col gap-1">
                      <Text size="small" className="text-ui-fg-subtle">
                        {t('LOG_PROGRESS', {
                          processed: catalogSummary.processed ?? 0,
                          total: catalogSummary.total_erp_rows,
                        })}
                      </Text>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
                        <div
                          className="h-full bg-ui-fg-interactive transition-all"
                          style={{
                            width: `${Math.min(100, Math.round(((catalogSummary.processed ?? 0) / catalogSummary.total_erp_rows) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : catalogSummary ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <Text size="small">
                        {t('SUMMARY_TOTAL')}: <b>{catalogSummary.total_erp_rows ?? 0}</b>
                      </Text>
                      <Text size="small">
                        {t('SUMMARY_UPDATED')}: <b>{catalogSummary.updated ?? 0}</b>
                      </Text>
                      <Text size="small">
                        {t('CATALOG_SUMMARY_UNCHANGED')}: <b>{catalogSummary.price_unchanged ?? 0}</b>
                      </Text>
                      {catalogSummary.created ? (
                        <Text size="small">
                          {t('CATALOG_SUMMARY_CREATED')}: <b>{catalogSummary.created}</b>
                        </Text>
                      ) : null}
                      <Text size="small">
                        {t('SUMMARY_ERRORS')}: <b>{catalogSummary.failed ?? 0}</b>
                      </Text>
                      {/* Títulos y presentación, los dos contadores que faltaban.
                          Todos los de arriba son de PRECIOS, así que una corrida
                          que reescribió 1.237 títulos y renombró 1.193 etiquetas
                          se leía como "Actualizados: 0" y parecía no haber hecho
                          nada. Van SIEMPRE que la fase esté prendida, incluso en
                          cero: "0 títulos" dice que la fase corrió y no encontró
                          nada, que es distinto de que no exista. */}
                      {catalogSummary.titles?.enabled ? (
                        <Text size="small">
                          {t('CATALOG_SUMMARY_TITLES')}:{' '}
                          <b>{catalogSummary.titles.normalized ?? 0}</b>
                        </Text>
                      ) : null}
                      {catalogSummary.presentation?.enabled ? (
                        <Text size="small">
                          {t('CATALOG_SUMMARY_PRESENTATION')}:{' '}
                          <b>
                            {/* En dry-run lo que se planificó; en una corrida real
                                lo que efectivamente se renombró. */}
                            {(catalogSummary.dry_run
                              ? catalogSummary.presentation.planned
                              : catalogSummary.presentation.renamed) ?? 0}
                          </b>
                        </Text>
                      ) : null}
                      {/* Los avisos sí sólo si hay: son la excepción (unidad
                          desconocida, fracción sin regla) y en cero son ruido. */}
                      {catalogSummary.titles?.warnings ? (
                        <Text size="small" className="text-ui-fg-subtle">
                          {t('CATALOG_SUMMARY_TITLE_WARNINGS')}:{' '}
                          <b>{catalogSummary.titles.warnings}</b>
                        </Text>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  size="small"
                  isLoading={isCatalogStarting}
                  disabled={!config.enabled || !config.catalog_sync_enabled || isCatalogSyncing}
                  onClick={() => runCatalogSync({})}
                >
                  {isCatalogSyncing ? t('SYNC_RUNNING') : t('CATALOG_RUN')}
                </Button>
                {/* Barrido completo: ignora el watermark y pide el catálogo entero.
                    Es la única forma de aplicar un cambio de reglas de título sobre
                    lo que el ERP no volvió a tocar; sin este botón había que
                    esperar al cron de la madrugada o pegarle al endpoint a mano. */}
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!config.enabled || !config.catalog_sync_enabled || isCatalogSyncing}
                  onClick={() => void startFullSweep()}
                >
                  {t('CATALOG_RUN_FULL')}
                </Button>
                {/* Dry-run: valida el mapeo de listas contra datos reales sin escribir. */}
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!config.enabled || !config.catalog_sync_enabled || isCatalogSyncing}
                  onClick={() => runCatalogSync({ dryRun: true })}
                >
                  {t('CATALOG_RUN_DRY')}
                </Button>
              </div>
            </div>

            {/* Outbox */}
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <Text size="small" weight="plus" className="text-ui-fg-muted">
                {t('CARD_OUTBOX')}
              </Text>
              <div className="flex items-baseline justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('OUTBOX_PENDING')}
                </Text>
                <Text size="small" weight="plus">
                  {(counts.pending ?? 0) + (counts.processing ?? 0)}
                </Text>
              </div>
              <div className="flex items-baseline justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('OUTBOX_FAILED')}
                </Text>
                <Text size="small" weight="plus" className={counts.failed ? 'text-ui-fg-error' : ''}>
                  {counts.failed ?? 0}
                </Text>
              </div>
              <div className="flex items-baseline justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('OUTBOX_DEAD')}
                </Text>
                <Text
                  size="small"
                  weight="plus"
                  className={counts.dead_letter ? 'text-ui-fg-error' : ''}
                >
                  {counts.dead_letter ?? 0}
                </Text>
              </div>
              <div className="flex items-baseline justify-between">
                <Text size="small" className="text-ui-fg-subtle">
                  {t('OUTBOX_SENT')}
                </Text>
                <Text size="small" weight="plus">
                  {counts.sent ?? 0}
                </Text>
              </div>
              <Button
                size="small"
                variant="secondary"
                className="mt-2 w-fit"
                onClick={() => navigate('/erp/outbox')}
              >
                {t('VIEW_OUTBOX')}
              </Button>
            </div>
          </div>
        )}
      </Container>
      <Toaster />
    </>
  );
};

const ErpPanelIcon = () => <ChartBar />;

export const config = defineRouteConfig({
  label: 'Panel',
  icon: ErpPanelIcon,
});

export const handle = {
  breadcrumb: () => 'Panel',
};

export default ErpPanelPage;
