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
import type { TypesenseSyncLogRow } from '../../../../modules/typesense/types';
import { useTypesenseSyncLogs } from '../../../hooks/api/typesense';
import {
  formatDateTime,
  formatDuration,
  statusLabelKey,
  TypesenseStatusBadge,
  useTypesenseTranslationsReady,
} from '../components/shared';

const PAGE_SIZE = 20;
const ALL = '__all__';

const columnHelper = createDataTableColumnHelper<TypesenseSyncLogRow>();

/** Listado de corridas de sincronización del índice, con poll suave. */
const TypesenseLogsPage = () => {
  const { t, i18n } = useTranslation('typesense');
  useTypesenseTranslationsReady(i18n);
  const navigate = useNavigate();

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [modeFilter, setModeFilter] = useState(ALL);

  const { data, isPending } = useTypesenseSyncLogs(
    {
      mode: modeFilter === ALL ? undefined : modeFilter,
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
      columnHelper.accessor('mode', {
        header: t('COL_MODE'),
        cell: ({ getValue }) => (
          <Text size="small">
            {getValue() === 'recreate' ? t('MODE_RECREATE') : t('MODE_UPDATE')}
          </Text>
        ),
      }),
      columnHelper.accessor('trigger', {
        header: t('COL_TRIGGER'),
        cell: ({ getValue }) => {
          const value = getValue();
          return (
            <Text size="small">
              {value === 'manual'
                ? t('TRIGGER_MANUAL')
                : value === 'event'
                  ? t('TRIGGER_EVENT')
                  : t('TRIGGER_CRON')}
            </Text>
          );
        },
      }),
      columnHelper.accessor('status', {
        header: t('COL_STATUS'),
        cell: ({ getValue }) => (
          <TypesenseStatusBadge status={getValue()} label={t(statusLabelKey(getValue()))} />
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
          return (
            <Text size="small" className="text-ui-fg-subtle">
              {t('SUMMARY_TOTAL')} {summary.total ?? 0} · {t('SUMMARY_INDEXED')}{' '}
              {summary.upserted ?? 0}
              {summary.deleted ? ` · ${t('SUMMARY_DELETED')} ${summary.deleted}` : ''} ·{' '}
              {t('SUMMARY_ERRORS')} {summary.failed ?? 0}
              {summary.recreated ? ` · ${t('SUMMARY_RECREATED_TAG')}` : ''}
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
    onRowClick: (_e, row) => navigate(`/typesense/logs/${row.id}`),
  });

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <Heading>{t('LOGS_TITLE')}</Heading>
          <div className="flex items-center gap-2">
            <div className="w-48">
              <Select
                value={modeFilter}
                onValueChange={(v) => {
                  setModeFilter(v);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                size="small"
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={ALL}>{t('FILTER_ALL_MODES')}</Select.Item>
                  <Select.Item value="update">{t('MODE_UPDATE')}</Select.Item>
                  <Select.Item value="recreate">{t('MODE_RECREATE')}</Select.Item>
                </Select.Content>
              </Select>
            </div>
            <div className="w-52">
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

export default TypesenseLogsPage;
