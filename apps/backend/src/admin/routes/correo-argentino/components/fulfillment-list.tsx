/**
 * Listado de envíos de Correo Argentino, con filtros, paginación y acciones
 * masivas.
 *
 * Espeja el de Andreani, con las diferencias que impone el contrato de Correo:
 *
 *  - **`tracking_number` vacío es un estado normal**, no un error de datos: el
 *    provider NO inventa placeholders `PENDING-*`, así que un envío sin TN es un
 *    envío que todavía nadie dio de alta en Correo. Se muestra como tal y es lo
 *    que habilita la acción "Crear envíos".
 *  - **Los rótulos se piden en UNA llamada** (`/labels` es bulk nativo), pero las
 *    fallas parciales vuelven con HTTP 200, así que el resultado se muestra POR
 *    ÍTEM en un modal (`LabelBatchModal`) en vez de un toast de "listo".
 */

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
  Switch,
  Text,
  toast,
  useDataTable,
} from '@medusajs/ui';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCorreoBulkDownloadLabels,
  useCorreoBulkGenerateTickets,
  useCorreoFulfillments,
  useCorreoLabelBatch,
  type CorreoBulkTicketsSummary,
  type CorreoFulfillmentItem,
  type CorreoLabelBatch,
} from '../../../hooks/api/correo-argentino';
import {
  correoFulfillmentStatusColor,
  correoPublicTrackingUrl,
} from '../../../lib/correo';
import { registerCorreoArgentinoTranslations } from '../../../translations/correo-argentino';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { BulkTicketsModal } from './bulk-tickets-modal';
import { LabelBatchModal } from './label-batch-modal';
import { TrackingModal } from './tracking-modal';

const PAGE_SIZE = 20;

// Los valores tienen que coincidir con `fulfillment.status` (status nativo de
// Medusa), porque el backend filtra por igualdad case-insensitive.
const STATUS_OPTIONS = ['pending', 'shipped', 'delivered', 'canceled'] as const;

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

const columnHelper = createDataTableColumnHelper<CorreoFulfillmentItem>();

export function FulfillmentList() {
  const { t, i18n } = useTranslation('correoArgentino');
  registerCorreoArgentinoTranslations(i18n);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ticketedOnly, setTicketedOnly] = useState(false);
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({});
  const [trackingFulfillment, setTrackingFulfillment] =
    useState<CorreoFulfillmentItem | null>(null);
  const [labelBatch, setLabelBatch] = useState<CorreoLabelBatch | null>(null);
  const [ticketsSummary, setTicketsSummary] =
    useState<CorreoBulkTicketsSummary | null>(null);

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isLoading, refetch } = useCorreoFulfillments({
    search,
    status,
    date_from: dateFrom,
    date_to: dateTo,
    ticketed_only: ticketedOnly,
    limit: pagination.pageSize,
    offset,
  });

  const labelBatchMutation = useCorreoLabelBatch();
  const bulkDownload = useCorreoBulkDownloadLabels();
  const bulkGenerate = useCorreoBulkGenerateTickets();

  const fulfillments = data?.fulfillments ?? [];
  const total = data?.total ?? 0;
  const pendingTicket = data?.pending_ticket ?? 0;

  /**
   * Pide los rótulos de N tracking numbers y abre el detalle POR ÍTEM.
   *
   * Nunca se resuelve con un toast de éxito: la llamada puede volver 200 con
   * fallas parciales y el operador necesita ver cuáles.
   */
  const requestLabels = useCallback(
    (trackingNumbers: string[]) => {
      if (trackingNumbers.length === 0) {
        toast.warning(t('BULK_NO_TRACKING'));
        return;
      }
      labelBatchMutation.mutate(
        { tracking_numbers: trackingNumbers },
        {
          onSuccess: (batch) => setLabelBatch(batch),
          onError: (error) =>
            toast.error(t('LABEL_ERROR', { message: (error as Error).message })),
        }
      );
    },
    [labelBatchMutation, t]
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
        onError: (error) => toast.error((error as Error).message),
      }
    );
  };

  const resetPage = () =>
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const handleStatus = useCallback((value: string) => {
    // El Select no admite '' como valor, así que '__all__' es el sentinela.
    setStatus(value === '__all__' ? '' : value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const serviceLabel = useCallback(
    (value: string): string => {
      if (value === 'CP') return t('SERVICE_CP');
      if (value === 'EP') return t('SERVICE_EP');
      return value || '—';
    },
    [t]
  );

  const deliveryLabel = useCallback(
    (value: string): string => {
      if (value === 'agency') return t('DELIVERY_AGENCY');
      if (value === 'homeDelivery') return t('DELIVERY_HOME');
      return value || '—';
    },
    [t]
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
          <div onClick={(event) => event.stopPropagation()}>
            {row.original.tracking_number ? (
              <>
                <Text size="small" weight="plus">
                  {row.original.tracking_number}
                </Text>
                <a
                  href={correoPublicTrackingUrl(row.original.tracking_number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ui-fg-interactive underline"
                >
                  correoargentino.com.ar
                </a>
              </>
            ) : (
              // Sin TN no hay envío en Correo. Es un estado válido y accionable
              // ("Crear envíos"), no un dato faltante.
              <Text size="small" className="text-ui-fg-muted">
                {t('NO_TRACKING')}
              </Text>
            )}
          </div>
        ),
      }),
      columnHelper.accessor('service_type', {
        header: t('COL_SERVICE'),
        cell: ({ getValue }) => (
          <Text size="small">{serviceLabel(getValue())}</Text>
        ),
      }),
      columnHelper.accessor('delivery_type', {
        header: t('COL_DELIVERY'),
        cell: ({ row }) => (
          <div>
            <Text size="small">{deliveryLabel(row.original.delivery_type)}</Text>
            {row.original.agency_id && (
              <Text size="xsmall" className="text-ui-fg-muted">
                {row.original.agency_id}
              </Text>
            )}
          </div>
        ),
      }),
      columnHelper.accessor('status', {
        header: t('COL_STATUS'),
        cell: ({ getValue }) => (
          <StatusBadge color={correoFulfillmentStatusColor(getValue())}>
            {getValue()}
          </StatusBadge>
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
          <div
            className="flex items-center gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            {row.original.tracking_number && (
              <>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setTrackingFulfillment(row.original)}
                >
                  {t('VIEW_TRACKING')}
                </Button>
                <Button
                  variant="transparent"
                  size="small"
                  onClick={() => requestLabels([row.original.tracking_number])}
                >
                  {t('LABEL_BUTTON')}
                </Button>
              </>
            )}
          </div>
        ),
      }),
    ],
    [t, serviceLabel, deliveryLabel, requestLabels]
  );

  const commands = useMemo(
    () => [
      {
        // Rótulos de la selección: una sola llamada bulk, resultado por ítem.
        label: t('BULK_LABELS'),
        shortcut: 'r',
        action: (selection: DataTableRowSelectionState) => {
          const trackingNumbers = Array.from(
            new Set(
              fulfillments
                .filter((f) => selection[f.id])
                .map((f) => f.tracking_number)
                .filter(Boolean)
            )
          );
          requestLabels(trackingNumbers);
        },
      },
      {
        // Alta en Correo de las órdenes seleccionadas. Es facturable, así que el
        // resultado se muestra orden por orden.
        label: t('BULK_GENERATE'),
        shortcut: 'g',
        action: (selection: DataTableRowSelectionState) => {
          const orderIds = Array.from(
            new Set(
              fulfillments
                .filter((f) => selection[f.id])
                .map((f) => f.order_id)
                .filter((id): id is string => !!id)
            )
          );
          if (orderIds.length === 0) return;
          bulkGenerate.mutate(
            { order_ids: orderIds },
            {
              onSuccess: (summary) => {
                setTicketsSummary(summary);
                setRowSelection({});
              },
              onError: (error) => toast.error((error as Error).message),
            }
          );
        },
      },
    ],
    [t, fulfillments, bulkGenerate, requestLabels]
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
          <div className="flex items-center gap-x-2">
            <Heading>{t('TITLE')}</Heading>
            <ExtensionVersion extension="correo-argentino" />
          </div>

          <Text size="small" className="text-ui-fg-subtle">
            {t('SUBTITLE')}
          </Text>

          <div className="flex flex-wrap items-center gap-2">
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

          {/* El backend calcula `pending_ticket` sobre el conjunto filtrado
              COMPLETO, no sobre la página: contarlo en el cliente daría mal. */}
          {pendingTicket > 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              {t('PENDING_TICKET_NOTE', { count: pendingTicket })}
            </Text>
          )}

          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="min-w-[200px] sm:w-72">
              <DataTable.Search placeholder={t('SEARCH_PLACEHOLDER')} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <Switch
                  checked={ticketedOnly}
                  onCheckedChange={(checked) => {
                    setTicketedOnly(checked === true);
                    resetPage();
                  }}
                />
                <Text size="small">{t('ONLY_TICKETED')}</Text>
              </label>
              <Select
                value={status === '' ? '__all__' : status}
                onValueChange={handleStatus}
              >
                <Select.Trigger className="w-44">
                  <Select.Value placeholder={t('STATUS_ALL')} />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="__all__">{t('STATUS_ALL')}</Select.Item>
                  {STATUS_OPTIONS.map((option) => (
                    <Select.Item key={option} value={option}>
                      {t(`STATUS_${option.toUpperCase()}`)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              <Input
                type="date"
                className="w-44"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  resetPage();
                }}
              />
              <Input
                type="date"
                className="w-44"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  resetPage();
                }}
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
          selectedLabel={(count) => t('SELECTED_COUNT', { count })}
        />
      </DataTable>

      {trackingFulfillment && (
        <TrackingModal
          fulfillment={trackingFulfillment}
          onClose={() => setTrackingFulfillment(null)}
        />
      )}

      {labelBatch && (
        <LabelBatchModal
          batch={labelBatch}
          onClose={() => setLabelBatch(null)}
        />
      )}

      {ticketsSummary && (
        <BulkTicketsModal
          summary={ticketsSummary}
          isDownloadingLabels={labelBatchMutation.isPending}
          onDownloadLabels={(trackingNumbers) => {
            setTicketsSummary(null);
            requestLabels(trackingNumbers);
          }}
          onClose={() => setTicketsSummary(null)}
        />
      )}
    </Container>
  );
}
