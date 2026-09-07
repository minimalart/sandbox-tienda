import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  type DataTableRowSelectionState,
  Heading,
  Input,
  Select,
  StatusBadge,
  Text,
  toast,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAndreaniFulfillments,
  useBulkGenerateTickets,
  useBulkDownloadLabels,
} from '../../../hooks/api/andreani';
import type { AndreaniFulfillmentItem } from '../../../hooks/api/andreani';
import { registerAndreaniTranslations } from '../../../translations/andreani';
import { TrackingModal } from './tracking-modal';
import { ExtensionVersion } from '../../../components/common/extension-version';

type StatusColor = 'green' | 'blue' | 'orange' | 'red' | 'grey';

function statusColor(status: string): StatusColor {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'entregado':
      return 'green';
    case 'in_transit':
    case 'en_camino':
      return 'blue';
    case 'pending':
    case 'pendiente':
      return 'orange';
    case 'failed':
    case 'cancelled':
    case 'cancelado':
      return 'red';
    default:
      return 'grey';
  }
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

const PAGE_SIZE = 20;

// Estados relevantes para el filtro. Los valores deben coincidir con `f.status`
// (status nativo del fulfillment de Medusa).
const STATUS_OPTIONS = ['pending', 'shipped', 'delivered', 'canceled'] as const;

const columnHelper = createDataTableColumnHelper<AndreaniFulfillmentItem>();

export function FulfillmentList() {
  const { t, i18n } = useTranslation('andreani');
  registerAndreaniTranslations(i18n);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({});
  const [trackingFulfillment, setTrackingFulfillment] =
    useState<AndreaniFulfillmentItem | null>(null);

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isLoading, refetch } = useAndreaniFulfillments({
    search,
    status,
    date_from: dateFrom,
    date_to: dateTo,
    limit: pagination.pageSize,
    offset,
  });
  const bulkGenerate = useBulkGenerateTickets();
  const bulkDownload = useBulkDownloadLabels();

  const fulfillments = data?.fulfillments ?? [];
  const total = data?.total ?? 0;

  // Las URLs de etiqueta de Andreani requieren el token de la API, así que no
  // se pueden abrir directo en el browser (da "no autorizado"). Bajamos el PDF
  // vía el proxy del backend (que adjunta el token) y abrimos el blob.
  const downloadLabel = useCallback(
    async (labelUrl: string, trackingNumber: string) => {
      if (!labelUrl) return;
      try {
        const res = await fetch('/admin/andreani/labels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            label_url: labelUrl,
            tracking_number: trackingNumber || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error?.message || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (err) {
        toast.error(t('LABEL_ERROR', { message: (err as Error).message }));
      }
    },
    [t]
  );

  const handleBulkDownload = () => {
    bulkDownload.mutate(
      { search, status, date_from: dateFrom, date_to: dateTo },
      {
        onSuccess: ({ truncated, totalMatched }) => {
          if (truncated) {
            toast.warning(t('DOWNLOAD_ALL_TRUNCATED', { total: totalMatched }));
          } else {
            toast.success(t('DOWNLOAD_ALL_OK'));
          }
        },
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const handleStatus = useCallback((value: string) => {
    // El Select usa '__all__' como sentinela de "Todos" (no se puede usar '').
    setStatus(value === '__all__' ? '' : value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const handleDateFrom = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDateFrom(e.target.value);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    []
  );

  const handleDateTo = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDateTo(e.target.value);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    []
  );

  const columns = useMemo(
    () => [
      columnHelper.select(),
      columnHelper.accessor('order_display_id', {
        header: t('COL_ORDER'),
        cell: ({ row }) => (
          <div>
            <Text size="small" weight="plus">
              {row.original.order_display_id ?? '—'}
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              {row.original.order_id ?? ''}
            </Text>
          </div>
        ),
      }),
      columnHelper.accessor('tracking_number', {
        header: t('COL_TRACKING'),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Text size="small" weight="plus">
              {row.original.tracking_number || '—'}
            </Text>
            {row.original.tracking_number && (
              <a
                href={`https://www.andreani.com/seguimiento?codigo=${row.original.tracking_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-ui-fg-interactive underline"
              >
                andreani.com
              </a>
            )}
          </div>
        ),
      }),
      columnHelper.accessor('service_type', {
        header: t('COL_SERVICE'),
        cell: ({ getValue }) => <Text size="small">{getValue() || '—'}</Text>,
      }),
      columnHelper.accessor('status', {
        header: t('COL_STATUS'),
        cell: ({ getValue }) => (
          <StatusBadge color={statusColor(getValue())}>{getValue()}</StatusBadge>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: t('COL_DATE'),
        cell: ({ getValue }) => <Text size="small">{formatDate(getValue())}</Text>,
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {row.original.tracking_number && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => setTrackingFulfillment(row.original)}
              >
                {t('VIEW_TRACKING')}
              </Button>
            )}
            {row.original.label_url && (
              <Button
                variant="secondary"
                size="small"
                onClick={() =>
                  downloadLabel(row.original.label_url, row.original.tracking_number)
                }
              >
                {t('LABEL_BUTTON')}
              </Button>
            )}
          </div>
        ),
      }),
    ],
    [t, downloadLabel]
  );

  // Acción masiva: generar tickets de los pedidos seleccionados.
  const commands = useMemo(
    () => [
      {
        label: t('BULK_GENERATE_LABEL', { defaultValue: 'Generar tickets' }),
        shortcut: 'g',
        action: (selection: DataTableRowSelectionState) => {
          const ids = Array.from(
            new Set(
              fulfillments
                .filter((f) => selection[f.id])
                .map((f) => f.order_id)
                .filter((id): id is string => !!id)
            )
          );
          if (ids.length === 0) return;
          bulkGenerate.mutate(ids, {
            onSuccess: () => {
              toast.success(t('BULK_OK', { count: ids.length }));
              setRowSelection({});
            },
            onError: (e) => toast.error((e as Error).message),
          });
        },
      },
    ],
    [t, fulfillments, bulkGenerate]
  );

  const table = useDataTable({
    columns,
    data: fulfillments,
    getRowId: (row) => row.id,
    rowCount: total,
    isLoading,
    commands,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection,
      enableRowSelection: (row) => !!row.original.order_id,
    },
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: handleSearch },
  });

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start gap-y-4 px-6 py-4">
          {/* Título + versión, alineados a la izquierda (como el resto de las páginas) */}
          <div className="flex items-center gap-x-2">
            <Heading>{t('TITLE')}</Heading>
            <ExtensionVersion extension="andreani" />
          </div>
          {/* Acciones, alineadas a la izquierda en su propia fila */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              isLoading={bulkDownload.isPending}
              disabled={total === 0}
              onClick={handleBulkDownload}
            >
              {t('DOWNLOAD_ALL')}
            </Button>
            <Button variant="secondary" size="small" onClick={() => refetch()}>
              {t('REFRESH')}
            </Button>
          </div>
          {/* Buscador a la izquierda, filtros a la derecha */}
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="min-w-[200px] sm:w-72">
              <DataTable.Search placeholder={t('SEARCH_PLACEHOLDER')} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={status === '' ? '__all__' : status}
                onValueChange={handleStatus}
              >
                <Select.Trigger className="w-44">
                  <Select.Value placeholder={t('STATUS_ALL')} />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="__all__">{t('STATUS_ALL')}</Select.Item>
                  {STATUS_OPTIONS.map((s) => (
                    <Select.Item key={s} value={s}>
                      {t(`STATUS_${s.toUpperCase()}`)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              <Input
                type="date"
                className="w-44"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={handleDateFrom}
              />
              <Input
                type="date"
                className="w-44"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={handleDateTo}
              />
            </div>
          </div>
        </DataTable.Toolbar>
        {total > 0 || isLoading ? (
          <>
            <DataTable.Table />
            <DataTable.Pagination />
          </>
        ) : (
          <div className="flex items-center justify-center border-t p-6 text-center">
            <Text className="text-ui-fg-subtle">
              {search ? t('NO_RESULTS', { search }) : t('NO_SHIPMENTS')}
            </Text>
          </div>
        )}
        <DataTable.CommandBar
          selectedLabel={(count) => t('SELECTED_COUNT', { count, defaultValue: `${count} seleccionados` })}
        />
      </DataTable>

      {/* Modal de tracking */}
      {trackingFulfillment && (
        <TrackingModal
          fulfillment={trackingFulfillment}
          onClose={() => setTrackingFulfillment(null)}
        />
      )}
    </Container>
  );
}
