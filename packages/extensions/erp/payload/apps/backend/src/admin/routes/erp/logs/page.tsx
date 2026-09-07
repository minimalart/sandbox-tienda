import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Heading,
  Select,
  Text,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useErpSyncLogs, type ErpSyncLog } from '../../../hooks/api';
import {
  ErpStatusBadge,
  formatDateTime,
  formatDuration,
  statusLabelKey,
  useErpTranslationsReady,
} from '../components/shared';

const PAGE_SIZE = 20;
const ALL = '__all__';

const columnHelper = createDataTableColumnHelper<ErpSyncLog>();

/** Listado de ejecuciones de sincronización, con poll suave si hay una corriendo. */
const ErpLogsPage = () => {
  const { t, i18n } = useTranslation('erp');
  useErpTranslationsReady(i18n);
  const navigate = useNavigate();

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [statusFilter, setStatusFilter] = useState(ALL);
  // Hay dos tipos de corrida (stock y catálogo) y comparten tabla, así que el
  // listado necesita poder filtrar en lugar de asumir stock_sync.
  const [typeFilter, setTypeFilter] = useState(ALL);

  const { data, isPending } = useErpSyncLogs(
    {
      type: typeFilter === ALL ? undefined : typeFilter,
      status: statusFilter === ALL ? undefined : statusFilter,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    },
    { refetchInterval: 5000 }
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('started_at', {
        header: t('COL_STARTED'),
        cell: ({ getValue }) => <Text size="small">{formatDateTime(getValue())}</Text>,
      }),
      columnHelper.accessor('trigger', {
        header: t('COL_TRIGGER'),
        cell: ({ getValue }) => (
          <Text size="small">{getValue() === 'manual' ? t('TRIGGER_MANUAL') : t('TRIGGER_CRON')}</Text>
        ),
      }),
      columnHelper.accessor('status', {
        header: t('COL_STATUS'),
        cell: ({ getValue }) => (
          <ErpStatusBadge status={getValue()} label={t(statusLabelKey(getValue()))} />
        ),
      }),
      columnHelper.accessor('type', {
        header: t('COL_TYPE'),
        cell: ({ getValue }) => (
          <Text size="small">
            {getValue() === 'catalog_sync' ? t('TYPE_CATALOG_SYNC') : t('TYPE_STOCK_SYNC')}
          </Text>
        ),
      }),
      columnHelper.display({
        id: 'summary',
        header: t('COL_SUMMARY'),
        cell: ({ row }) => {
          const summary = row.original.summary;
          if (!summary) {
            return (
              <Text size="small" className="text-ui-fg-subtle">
                {row.original.error?.message ?? '—'}
              </Text>
            );
          }
          // Los dos tipos de corrida cuentan cosas distintas: el catálogo mide
          // filas del ERP y el stock mide SKUs de Medusa.
          if (row.original.type === 'catalog_sync') {
            return (
              <Text size="small" className="text-ui-fg-subtle">
                {summary.dry_run ? `${t('CATALOG_DRY_RUN_TAG')} · ` : ''}
                {t('SUMMARY_TOTAL')} {summary.total_erp_rows ?? 0} · {t('SUMMARY_UPDATED')}{' '}
                {summary.updated ?? 0} · {t('CATALOG_SUMMARY_UNCHANGED')}{' '}
                {summary.price_unchanged ?? 0} · {t('SUMMARY_ERRORS')} {summary.failed ?? 0}
              </Text>
            );
          }
          // Sumar `not_found` y `skipped_other` como "errores" hacía leer una
          // corrida sana como catástrofe: en una plataforma con varios demos, la
          // enorme mayoría de los SKUs de Medusa NO existen en este ERP, y
          // saltear por "sin nivel en la location" es configuración, no falla.
          // Errores son sólo los que piden intervención.
          const errors =
            (summary.failed ?? 0) +
            (summary.duplicate_sku ?? 0) +
            (summary.invalid_quantity ?? 0);
          const unmatched = summary.not_found ?? 0;
          const skipped = summary.skipped_other ?? 0;
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {t('SUMMARY_TOTAL')} {summary.total_skus ?? 0} · {t('SUMMARY_UPDATED')}{' '}
              {summary.updated ?? 0}
              {summary.skipped_unchanged
                ? ` · ${t('CATALOG_SUMMARY_UNCHANGED')} ${summary.skipped_unchanged}`
                : ''}
              {unmatched ? ` · ${t('SUMMARY_UNMATCHED')} ${unmatched}` : ''}
              {skipped ? ` · ${t('SUMMARY_SKIPPED')} ${skipped}` : ''} · {t('SUMMARY_ERRORS')}{' '}
              {errors}
            </Text>
          );
        },
      }),
      columnHelper.display({
        id: 'duration',
        header: t('COL_DURATION'),
        cell: ({ row }) => (
          <Text size="small">{formatDuration(row.original.summary?.duration_ms)}</Text>
        ),
      }),
    ],
    [t]
  );

  const table = useDataTable({
    columns,
    data: data?.sync_logs ?? [],
    getRowId: (row) => row.id,
    rowCount: data?.count ?? 0,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_e, row) => navigate(`/erp/logs/${row.id}`),
  });

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <Heading>{t('LOGS_TITLE')}</Heading>
          <div className="flex items-center gap-2">
            <div className="w-48">
              <Select value={typeFilter} onValueChange={setTypeFilter} size="small">
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={ALL}>{t('FILTER_ALL_TYPES')}</Select.Item>
                  <Select.Item value="stock_sync">{t('TYPE_STOCK_SYNC')}</Select.Item>
                  <Select.Item value="catalog_sync">{t('TYPE_CATALOG_SYNC')}</Select.Item>
                </Select.Content>
              </Select>
            </div>
            <div className="w-52">
              <Select value={statusFilter} onValueChange={setStatusFilter} size="small">
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={ALL}>{t('FILTER_ALL')}</Select.Item>
                  <Select.Item value="running">{t('ST_RUNNING')}</Select.Item>
                  <Select.Item value="completed">{t('ST_COMPLETED')}</Select.Item>
                  <Select.Item value="completed_with_errors">
                    {t('ST_COMPLETED_WITH_ERRORS')}
                  </Select.Item>
                  <Select.Item value="failed">{t('ST_FAILED')}</Select.Item>
                </Select.Content>
              </Select>
            </div>
          </div>
        </DataTable.Toolbar>
        <DataTable.Table
          emptyState={{
            empty: { heading: t('LOGS_TITLE'), description: t('LOGS_EMPTY') },
          }}
        />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'Logs',
  rank: 2,
});

export const handle = {
  breadcrumb: () => 'Logs',
};

export default ErpLogsPage;
