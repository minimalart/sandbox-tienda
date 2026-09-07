import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ArrowPath } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Heading,
  Select,
  Text,
  Toaster,
  toast,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useErpOutboxEvents,
  useRetryOutboxEvent,
  type ErpOutboxEvent,
} from '../../../hooks/api';
import {
  ErpStatusBadge,
  formatDateTime,
  statusLabelKey,
  useErpTranslationsReady,
} from '../components/shared';

const PAGE_SIZE = 20;
const ALL = '__all__';

const columnHelper = createDataTableColumnHelper<ErpOutboxEvent>();

/**
 * Outbox de ventas → ERP: cada fila es una orden a notificar, con su estado,
 * intentos y reintento manual para failed/dead_letter. Poll suave mientras
 * haya eventos activos (pending/processing).
 */
const ErpOutboxPage = () => {
  const { t, i18n } = useTranslation('erp');
  useErpTranslationsReady(i18n);

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [statusFilter, setStatusFilter] = useState(ALL);

  const { data, isPending } = useErpOutboxEvents(
    {
      status: statusFilter === ALL ? undefined : statusFilter,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    },
    { refetchInterval: 10000 }
  );
  const counts = data?.counts ?? {};

  const { mutate: retryEvent, isPending: isRetrying } = useRetryOutboxEvent({
    onSuccess: () => toast.success(t('RETRY_OK')),
    onError: (error) => toast.error(t('RETRY_ERROR', { msg: error.message })),
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('created_at', {
        header: t('COL_CREATED'),
        cell: ({ getValue }) => <Text size="small">{formatDateTime(getValue())}</Text>,
      }),
      columnHelper.accessor('aggregate_id', {
        header: t('COL_ORDER'),
        cell: ({ getValue }) => (
          <Text size="small" weight="plus" className="font-mono">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor('status', {
        header: t('COL_STATUS'),
        cell: ({ getValue }) => (
          <ErpStatusBadge status={getValue()} label={t(statusLabelKey(getValue()))} />
        ),
      }),
      columnHelper.accessor('attempts', {
        header: t('COL_ATTEMPTS'),
        cell: ({ getValue }) => <Text size="small">{getValue()}</Text>,
      }),
      columnHelper.display({
        id: 'next_retry',
        header: t('COL_NEXT_RETRY'),
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {row.original.status === 'failed' ? formatDateTime(row.original.next_retry_at) : '—'}
          </Text>
        ),
      }),
      columnHelper.display({
        id: 'detail',
        header: t('COL_EXTERNAL_REF'),
        cell: ({ row }) => {
          if (row.original.external_ref) {
            return <Text size="small">{row.original.external_ref}</Text>;
          }
          return (
            <Text size="small" className="text-ui-fg-error" title={row.original.last_error ?? ''}>
              {(row.original.last_error ?? '').slice(0, 60) || '—'}
            </Text>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const canRetry = row.original.status === 'failed' || row.original.status === 'dead_letter';
          if (!canRetry) return null;
          return (
            <Button
              size="small"
              variant="secondary"
              disabled={isRetrying}
              onClick={(e) => {
                e.stopPropagation();
                retryEvent(row.original.id);
              }}
            >
              <ArrowPath />
              {t('RETRY')}
            </Button>
          );
        },
      }),
    ],
    [t, isRetrying, retryEvent]
  );

  const table = useDataTable({
    columns,
    data: data?.outbox_events ?? [],
    getRowId: (row) => row.id,
    rowCount: data?.count ?? 0,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <Heading>{t('OUTBOX_TITLE')}</Heading>
              <div className="flex items-center gap-1">
                {(counts.pending ?? 0) + (counts.processing ?? 0) > 0 ? (
                  <Badge size="2xsmall" color="orange">
                    {t('OUTBOX_PENDING')}: {(counts.pending ?? 0) + (counts.processing ?? 0)}
                  </Badge>
                ) : null}
                {(counts.failed ?? 0) > 0 ? (
                  <Badge size="2xsmall" color="red">
                    {t('OUTBOX_FAILED')}: {counts.failed}
                  </Badge>
                ) : null}
                {(counts.dead_letter ?? 0) > 0 ? (
                  <Badge size="2xsmall" color="red">
                    {t('OUTBOX_DEAD')}: {counts.dead_letter}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="w-52">
              <Select value={statusFilter} onValueChange={setStatusFilter} size="small">
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={ALL}>{t('FILTER_ALL')}</Select.Item>
                  <Select.Item value="pending">{t('ST_PENDING')}</Select.Item>
                  <Select.Item value="processing">{t('ST_PROCESSING')}</Select.Item>
                  <Select.Item value="sent">{t('ST_SENT')}</Select.Item>
                  <Select.Item value="failed">{t('ST_FAILED')}</Select.Item>
                  <Select.Item value="dead_letter">{t('ST_DEAD_LETTER')}</Select.Item>
                  <Select.Item value="skipped">{t('ST_SKIPPED')}</Select.Item>
                  <Select.Item value="duplicate">{t('ST_DUPLICATE')}</Select.Item>
                </Select.Content>
              </Select>
            </div>
          </DataTable.Toolbar>
          <DataTable.Table
            emptyState={{
              empty: { heading: t('OUTBOX_TITLE'), description: t('OUTBOX_EMPTY') },
            }}
          />
          <DataTable.Pagination />
        </DataTable>
      </Container>
      <Toaster />
    </>
  );
};

export const config = defineRouteConfig({
  label: 'Ventas',
  rank: 3,
});

export const handle = {
  breadcrumb: () => 'Ventas',
};

export default ErpOutboxPage;
