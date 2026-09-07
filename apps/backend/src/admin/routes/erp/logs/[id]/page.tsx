import {
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Heading,
  Input,
  Select,
  Text,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useErpSyncLog, useErpSyncLogItems, type ErpSyncLogItem } from '../../../../hooks/api';
import {
  ErpStatusBadge,
  formatDateTime,
  formatDuration,
  statusLabelKey,
  useErpTranslationsReady,
} from '../../components/shared';

const PAGE_SIZE = 50;
const ALL = '__all__';

const columnHelper = createDataTableColumnHelper<ErpSyncLogItem>();

/** Serializa el response_payload del item a una línea legible. */
function payloadSummary(payload: Record<string, unknown> | null): string {
  if (!payload) return '—';
  const parts: string[] = [];
  if (payload.erp_quantity !== undefined) parts.push(`ERP: ${String(payload.erp_quantity)}`);
  if (payload.normalized_quantity !== undefined && payload.normalized_quantity !== payload.erp_quantity) {
    parts.push(`→ ${String(payload.normalized_quantity)}`);
  }
  if (payload.previous_stocked !== undefined) parts.push(`antes: ${String(payload.previous_stocked)}`);
  if (payload.reserved_quantity !== undefined) parts.push(`reservado: ${String(payload.reserved_quantity)}`);
  if (payload.reason) parts.push(String(payload.reason));
  // Normalización de título: el "recibido → normalizado" por SKU es lo que se
  // revisa en el dry-run antes de habilitar la escritura sobre el catálogo.
  const title = payload.title_rules as
    | { received?: string; normalized?: string; written?: boolean; warnings?: string[] }
    | undefined;
  if (title?.received) {
    parts.push(
      `${title.written ? 'título' : 'título (sin escribir)'}: ${title.received} → ${title.normalized ?? '—'}`
    );
    if (title.warnings?.length) parts.push(...title.warnings);
  }
  if (payload.barcode_warning) parts.push(`código de barras: ${String(payload.barcode_warning)}`);
  if (payload.warning) parts.push(String(payload.warning));
  return parts.length ? parts.join(' · ') : '—';
}

/**
 * Detalle de una sincronización: cabecera con estado/resumen (+ barra de
 * progreso y poll mientras corre) y tabla paginada del detalle por SKU con
 * filtro por resultado y búsqueda exacta de SKU.
 */
const ErpLogDetailPage = () => {
  const { t, i18n } = useTranslation('erp');
  useErpTranslationsReady(i18n);
  const { id } = useParams<{ id: string }>();

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [skuSearch, setSkuSearch] = useState('');

  const { data: logData } = useErpSyncLog(id, { refetchInterval: 3000 });
  const log = logData?.sync_log ?? null;
  const isRunning = log?.status === 'running';

  const { data: itemsData, isPending } = useErpSyncLogItems(
    id,
    {
      status: statusFilter === ALL ? undefined : statusFilter,
      entity_id: skuSearch.trim() || undefined,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    },
    { refetchInterval: isRunning ? 5000 : false }
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('entity_id', {
        header: t('COL_SKU'),
        cell: ({ getValue }) => (
          <Text size="small" weight="plus">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor('status', {
        header: t('COL_ITEM_STATUS'),
        cell: ({ getValue }) => (
          <ErpStatusBadge status={getValue()} label={t(statusLabelKey(getValue()))} />
        ),
      }),
      columnHelper.display({
        id: 'detail',
        header: t('COL_ITEM_DETAIL'),
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {payloadSummary(row.original.response_payload)}
          </Text>
        ),
      }),
      columnHelper.accessor('error', {
        header: t('COL_ERROR'),
        cell: ({ getValue }) => (
          <Text size="small" className="text-ui-fg-error">
            {getValue() ?? ''}
          </Text>
        ),
      }),
    ],
    [t]
  );

  const table = useDataTable({
    columns,
    data: itemsData?.items ?? [],
    getRowId: (row) => row.id,
    rowCount: itemsData?.count ?? 0,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
  });

  const summary = log?.summary ?? null;
  const isCatalog = log?.type === 'catalog_sync';
  // El total se llama distinto según el tipo: el catálogo cuenta filas del ERP,
  // el stock cuenta SKUs de Medusa.
  const totalUnits = (isCatalog ? summary?.total_erp_rows : summary?.total_skus) ?? 0;
  const progressPct =
    totalUnits > 0 ? Math.min(100, Math.round(((summary?.processed ?? 0) / totalUnits) * 100)) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading>{t('LOG_DETAIL_TITLE')}</Heading>
          {log ? <ErpStatusBadge status={log.status} label={t(statusLabelKey(log.status))} /> : null}
        </div>
        {log ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_STARTED')}: {formatDateTime(log.started_at)}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_TRIGGER')}: {log.trigger === 'manual' ? t('TRIGGER_MANUAL') : t('TRIGGER_CRON')}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {t('FIELD_PROVIDER')}: {log.provider}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_DURATION')}: {formatDuration(summary?.duration_ms)}
              </Text>
            </div>
            {isRunning && totalUnits > 0 ? (
              <div className="flex flex-col gap-1">
                <Text size="small">
                  {t('LOG_PROGRESS', { processed: summary?.processed ?? 0, total: totalUnits })}
                </Text>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
                  <div
                    className="h-full bg-ui-fg-interactive transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}
            {summary && isCatalog ? (
              <>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <Text size="small">
                    {t('SUMMARY_TOTAL')}: <b>{summary.total_erp_rows ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('SUMMARY_UPDATED')}: <b>{summary.updated ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_PRICE_UNCHANGED')}: <b>{summary.price_unchanged ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_CREATED')}: <b>{summary.created ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_VARIANT_NOT_FOUND')}: <b>{summary.variant_not_found ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_NO_PRICE_SET')}: <b>{summary.no_price_set ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_NOT_PUBLISHED')}: <b>{summary.not_published ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_FAILED')}: <b>{summary.failed ?? 0}</b>
                  </Text>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {summary.dry_run ? (
                    <Text size="small" weight="plus" className="text-ui-fg-interactive">
                      {t('CATALOG_DRY_RUN_TAG')}
                    </Text>
                  ) : null}
                  <Text size="small" className="text-ui-fg-subtle">
                    {t('CATALOG_LOG_MODE')}:{' '}
                    {summary.full_sweep ? t('CATALOG_MODE_FULL') : t('CATALOG_MODE_DELTA')}
                    {summary.since ? ` (${summary.since})` : ''}
                  </Text>
                  {summary.watermark ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('CFG_LAST_SYNCED_AT')}: {summary.watermark}
                    </Text>
                  ) : null}
                  {summary.price_lists?.length ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('CFG_PRICE_LISTS')}:{' '}
                      {summary.price_lists
                        .map((list) => `${list.title} (${list.zeus_index})`)
                        .join(', ')}
                    </Text>
                  ) : null}
                  {summary.reindexed_products ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('CATALOG_REINDEXED')}: {summary.reindexed_products}
                    </Text>
                  ) : null}
                  {/*
                    Los cambios de estado son lo más consecuente que hace el sync
                    (un producto despublicado deja de venderse), así que van a la
                    vista y no solo al payload de cada artículo.
                  */}
                  {summary.status_sync?.enabled ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('CATALOG_STATUS_SYNC')}: ↑
                      {summary.status_sync.published ?? summary.status_sync.planned_published ?? 0} / ↓
                      {summary.status_sync.unpublished ??
                        summary.status_sync.planned_unpublished ??
                        0}
                    </Text>
                  ) : null}
                  {summary.status_sync?.skipped_by_guard ? (
                    <Text size="small" weight="plus" className="text-ui-fg-error">
                      {t('CATALOG_STATUS_GUARD', { count: summary.status_sync.skipped_by_guard })}
                    </Text>
                  ) : null}
                </div>
                {summary.warnings?.length ? (
                  <div className="flex flex-col gap-1">
                    {summary.warnings.map((warning, index) => (
                      <Text key={index} size="small" className="text-ui-fg-muted">
                        {warning}
                      </Text>
                    ))}
                  </div>
                ) : null}
              </>
            ) : summary ? (
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <Text size="small">
                  {t('SUMMARY_TOTAL')}: <b>{summary.total_skus ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('SUMMARY_UPDATED')}: <b>{summary.updated ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('ST_NOT_FOUND')}: <b>{summary.not_found ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('ST_DUPLICATE_SKU')}: <b>{summary.duplicate_sku ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('ST_INVALID_QUANTITY')}: <b>{summary.invalid_quantity ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('SUMMARY_SKIPPED')}: <b>{(summary.skipped_unchanged ?? 0) + (summary.skipped_other ?? 0)}</b>
                </Text>
                <Text size="small">
                  {t('ST_FAILED')}: <b>{summary.failed ?? 0}</b>
                </Text>
              </div>
            ) : null}
            {log.error?.message ? (
              <Text size="small" className="text-ui-fg-error">
                {log.error.message}
              </Text>
            ) : null}
            {summary?.location_warning ? (
              <Text size="small" className="text-ui-fg-muted">
                ⚠ {summary.location_warning}
              </Text>
            ) : null}
          </div>
        ) : null}
      </Container>

      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between gap-3 px-6 py-4">
            <Heading level="h2">{t('ITEMS_TITLE')}</Heading>
            <div className="flex items-center gap-2">
              <Input
                size="small"
                placeholder={t('SEARCH_SKU')}
                value={skuSearch}
                onChange={(e) => {
                  setSkuSearch(e.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              />
              <div className="w-48">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                  size="small"
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>{t('FILTER_ALL')}</Select.Item>
                    <Select.Item value="updated">{t('ST_UPDATED')}</Select.Item>
                    <Select.Item value="not_found">{t('ST_NOT_FOUND')}</Select.Item>
                    <Select.Item value="duplicate_sku">{t('ST_DUPLICATE_SKU')}</Select.Item>
                    <Select.Item value="invalid_quantity">{t('ST_INVALID_QUANTITY')}</Select.Item>
                    <Select.Item value="skipped">{t('ST_SKIPPED')}</Select.Item>
                    <Select.Item value="failed">{t('ST_FAILED')}</Select.Item>
                  </Select.Content>
                </Select>
              </div>
            </div>
          </DataTable.Toolbar>
          <DataTable.Table
            emptyState={{
              empty: { heading: t('ITEMS_TITLE'), description: t('ITEMS_EMPTY') },
            }}
          />
          <DataTable.Pagination />
        </DataTable>
      </Container>
    </div>
  );
};

export const handle = {
  breadcrumb: () => 'Detalle',
};

export default ErpLogDetailPage;
