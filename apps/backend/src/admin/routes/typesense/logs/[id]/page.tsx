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
import type { TypesenseSyncLogItemRow } from '../../../../../modules/typesense/types';
import { useTypesenseSyncLog, useTypesenseSyncLogItems } from '../../../../hooks/api/typesense';
import {
  formatDateTime,
  formatDuration,
  statusLabelKey,
  TypesenseStatusBadge,
  useTypesenseTranslationsReady,
} from '../../components/shared';

const PAGE_SIZE = 50;
const ALL = '__all__';

const columnHelper = createDataTableColumnHelper<TypesenseSyncLogItemRow>();

/**
 * Detalle de una corrida: cabecera con estado/resumen (+ barra de progreso y
 * poll mientras corre) y tabla paginada del detalle por producto, filtrable por
 * resultado y por id exacto.
 */
const TypesenseLogDetailPage = () => {
  const { t, i18n } = useTranslation('typesense');
  useTypesenseTranslationsReady(i18n);
  const { id } = useParams<{ id: string }>();

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [idSearch, setIdSearch] = useState('');

  const { data: logData } = useTypesenseSyncLog(id, { refetchInterval: 3000 });
  const log = logData?.sync_log ?? null;
  const isRunning = log?.status === 'running';

  const { data: itemsData, isPending } = useTypesenseSyncLogItems(
    id,
    {
      status: statusFilter === ALL ? undefined : statusFilter,
      entity_id: idSearch.trim() || undefined,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    },
    { refetchInterval: isRunning ? 5000 : false }
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('entity_id', {
        header: t('COL_PRODUCT'),
        cell: ({ getValue }) => (
          <Text size="small" weight="plus">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor('status', {
        header: t('COL_ITEM_STATUS'),
        cell: ({ getValue }) => (
          <TypesenseStatusBadge status={getValue()} label={t(statusLabelKey(getValue()))} />
        ),
      }),
      columnHelper.display({
        id: 'phase',
        header: t('COL_ITEM_PHASE'),
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {(row.original.payload?.phase as string | undefined) ?? '—'}
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
  const total = summary?.total ?? 0;
  const progressPct =
    total > 0 ? Math.min(100, Math.round(((summary?.processed ?? 0) / total) * 100)) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading>{t('LOG_DETAIL_TITLE')}</Heading>
          {log ? (
            <TypesenseStatusBadge status={log.status} label={t(statusLabelKey(log.status))} />
          ) : null}
        </div>
        {log ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_STARTED')}: {formatDateTime(log.started_at)}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_MODE')}: {log.mode === 'recreate' ? t('MODE_RECREATE') : t('MODE_UPDATE')}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_TRIGGER')}:{' '}
                {log.trigger === 'manual'
                  ? t('TRIGGER_MANUAL')
                  : log.trigger === 'event'
                    ? t('TRIGGER_EVENT')
                    : t('TRIGGER_CRON')}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {t('CONFIG_COLLECTION')}: {log.collection ?? '—'}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_DURATION')}: {formatDuration(summary?.duration_ms)}
              </Text>
            </div>
            {isRunning && total > 0 ? (
              <div className="flex flex-col gap-1">
                <Text size="small">
                  {t('LOG_PROGRESS', { processed: summary?.processed ?? 0, total })}
                </Text>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
                  <div
                    className="h-full bg-ui-fg-interactive transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}
            {summary ? (
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <Text size="small">
                  {t('SUMMARY_TOTAL')}: <b>{summary.total ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('SUMMARY_INDEXED')}: <b>{summary.upserted ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('SUMMARY_DELETED')}: <b>{summary.deleted ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('ST_FAILED')}: <b>{summary.failed ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('SUMMARY_RECREATED')}:{' '}
                  <b>{summary.recreated ? t('ANSWER_YES') : t('ANSWER_NO')}</b>
                </Text>
                {summary.recreated ? (
                  <>
                    <Text size="small">
                      {t('SUMMARY_SYNONYMS_RESTORED')}: <b>{summary.synonyms_restored ?? 0}</b>
                    </Text>
                    <Text size="small">
                      {t('SUMMARY_CURATIONS_RESTORED')}: <b>{summary.curations_restored ?? 0}</b>
                    </Text>
                  </>
                ) : null}
              </div>
            ) : null}
            {log.error?.message ? (
              <Text size="small" className="text-ui-fg-error">
                {log.error.message}
              </Text>
            ) : null}
            {summary?.notes?.length ? (
              <div className="flex flex-col gap-1">
                {summary.notes.map((note, index) => (
                  <Text key={index} size="small" className="text-ui-fg-muted">
                    ⚠ {note}
                  </Text>
                ))}
              </div>
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
                placeholder={t('SEARCH_PRODUCT_ID')}
                value={idSearch}
                onChange={(e) => {
                  setIdSearch(e.target.value);
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
                    <Select.Item value="failed">{t('ST_FAILED')}</Select.Item>
                    <Select.Item value="deleted">{t('ST_DELETED')}</Select.Item>
                    <Select.Item value="skipped">{t('ST_SKIPPED')}</Select.Item>
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

export default TypesenseLogDetailPage;
