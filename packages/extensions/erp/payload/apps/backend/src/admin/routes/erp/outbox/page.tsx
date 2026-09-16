import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ArrowPath } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  type DataTableRowSelectionState,
  Heading,
  Prompt,
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
  useErpUnregisteredOrders,
  useResyncOutboxEvents,
  type ErpOutboxEvent,
  type ErpResyncResponse,
} from '../../../hooks/api';
import { UnregisteredOrdersTable } from '../components/unregistered-orders-table';
import { SalePreviewDrawer } from '../components/sale-preview-drawer';
import {
  ErpStatusBadge,
  formatDateTime,
  statusLabelKey,
  useErpTranslationsReady,
} from '../components/shared';

const PAGE_SIZE = 20;
const ALL = '__all__';
/**
 * Filtro que NO es un estado del outbox: cambia la fuente de datos a las
 * órdenes sin fila. Va en el mismo Select porque para el operador es "otra
 * solapa de lo mismo", pero abajo son dos consultas distintas.
 */
const UNREGISTERED = '__unregistered__';

/**
 * Estados que se pueden volver a mandar al ERP sin `force`. Tiene que coincidir
 * con `RESYNC_BULK_STATUSES` del backend (`modules/erp/outbox/resync-decision.ts`),
 * que es quien decide de verdad: esto sólo pinta el botón.
 */
const RESYNCABLE = new Set(['skipped', 'failed', 'dead_letter']);

const columnHelper = createDataTableColumnHelper<ErpOutboxEvent>();

/**
 * Outbox de ventas → ERP: cada fila es una orden a notificar, con su estado,
 * intentos y el reenvío manual en los tres modos (masivo, parcial, singular).
 * Poll suave mientras haya eventos activos (pending/processing).
 *
 * El reenvío incluye `skipped`, y eso es el punto de la pantalla: una venta que
 * entró con la notificación de ventas apagada quedaba `skipped` PARA SIEMPRE
 * — `enqueueSaleForOrder` corta ante cualquier fila con el mismo `event_key`,
 * así que ni prender el toggle después la recuperaba. El botón de reintento
 * viejo tampoco: sólo aceptaba `failed`/`dead_letter`.
 */
const ErpOutboxPage = () => {
  const { t, i18n } = useTranslation('erp');
  useErpTranslationsReady(i18n);

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  /** Evento cuyo documento se está mirando; null = drawer cerrado. */
  const [previewId, setPreviewId] = useState<string | null>(null);

  const showUnregistered = statusFilter === UNREGISTERED;

  const { data, isPending } = useErpOutboxEvents(
    {
      // `UNREGISTERED` no es un estado del outbox: mandarlo filtraría por un
      // valor inexistente y devolvería una cola vacía que se lee como "no hay
      // nada", en vez de "estás mirando otra cosa".
      status: statusFilter === ALL || showUnregistered ? undefined : statusFilter,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    },
    { refetchInterval: 10000 }
  );
  const counts = data?.counts ?? {};
  const events = data?.outbox_events ?? [];

  /**
   * Conteo de órdenes atrasadas SIN fila. Se pide siempre, incluso mirando el
   * outbox, y eso es el punto: es la única señal de que faltan ventas. El
   * outbox no puede mostrar lo que nunca se registró, así que sin este badge el
   * operador ve una cola prolija y nueve ventas perdidas.
   */
  const { data: unregistered } = useErpUnregisteredOrders(
    { limit: 200 },
    {
      refetchInterval: 30000,
    }
  );
  const unregisteredCount = unregistered?.count ?? 0;

  /**
   * Un solo toast para los tres modos: lo importante es cuántas salieron y
   * cuántas no, porque en un barrido de 200 nadie lee 200 filas.
   */
  const announce = (result: ErpResyncResponse) => {
    if (result.requeued > 0) {
      toast.success(t('RESYNC_OK', { count: result.requeued }));
    } else {
      toast.warning(t('RESYNC_NONE'));
    }
    const untouched = result.total - result.requeued;
    if (untouched > 0) toast.info(t('RESYNC_UNTOUCHED', { count: untouched }));
    if (result.remaining > 0) toast.info(t('RESYNC_REMAINING', { count: result.remaining }));
  };

  const { mutate: resync, isPending: isResyncing } = useResyncOutboxEvents({
    onSuccess: (result) => {
      announce(result);
      setRowSelection({});
      setBulkOpen(false);
    },
    onError: (error) => {
      toast.error(t('RESYNC_ERROR', { msg: error.message }));
      setBulkOpen(false);
    },
  });

  /** Cuántas filas barrería el masivo: respeta el filtro de estado visible. */
  const bulkCount =
    statusFilter === ALL
      ? (counts.skipped ?? 0) + (counts.failed ?? 0) + (counts.dead_letter ?? 0)
      : RESYNCABLE.has(statusFilter)
        ? (counts[statusFilter as keyof typeof counts] ?? 0)
        : 0;

  const columns = useMemo(
    () => [
      columnHelper.select(),
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
          // Una fila `skipped` no tiene error: tiene un MOTIVO, y decirlo evita
          // que el operador busque una falla que no existe.
          if (row.original.status === 'skipped') {
            return (
              <Text size="small" className="text-ui-fg-subtle">
                {t('SKIPPED_REASON')}
              </Text>
            );
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
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            {/*
              El documento se ofrece para toda venta, no sólo para las enviadas:
              en una `pending` o `skipped` muestra con qué parámetros SALDRÍA, que
              es justo lo que hay que revisar antes de destrabarla.
            */}
            {row.original.event_type === 'sale_created' ? (
              <Button
                size="small"
                variant="transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewId(row.original.id);
                }}
              >
                {t('PREVIEW_ACTION')}
              </Button>
            ) : null}
            {RESYNCABLE.has(row.original.status) ? (
              <Button
                size="small"
                variant="secondary"
                disabled={isResyncing}
                onClick={(e) => {
                  e.stopPropagation();
                  resync({ event_ids: [row.original.id] });
                }}
              >
                <ArrowPath />
                {t('RESYNC_ONE')}
              </Button>
            ) : null}
          </div>
        ),
      }),
    ],
    [t, isResyncing, resync]
  );

  /**
   * Acción parcial: los ids seleccionados. Las filas no reenviables no se
   * pueden seleccionar (`enableRowSelection`), así que acá no hace falta
   * filtrar de nuevo — y si alguna se colara, el backend la deja en `noop`.
   */
  const commands = useMemo(
    () => [
      {
        label: t('RESYNC_SELECTED'),
        shortcut: 'r',
        action: (selection: DataTableRowSelectionState) => {
          const ids = events.filter((event) => selection[event.id]).map((event) => event.id);
          if (!ids.length) return;
          resync({ event_ids: ids });
        },
      },
    ],
    [t, events, resync]
  );

  const table = useDataTable({
    columns,
    data: events,
    getRowId: (row) => row.id,
    rowCount: data?.count ?? 0,
    isLoading: isPending,
    commands,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection,
      enableRowSelection: (row) => RESYNCABLE.has(row.original.status),
    },
    pagination: { state: pagination, onPaginationChange: setPagination },
  });

  if (showUnregistered) {
    return (
      <>
        <Container className="p-0">
          <UnregisteredOrdersTable onBack={() => setStatusFilter(ALL)} />
        </Container>
        <Toaster />
      </>
    );
  }

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <Heading>{t('OUTBOX_TITLE')}</Heading>
              <div className="flex items-center gap-1">
                {(counts.pending ?? 0) + (counts.processing ?? 0) > 0 ? (
                  <Badge size="2xsmall" color="orange">
                    {t('OUTBOX_PENDING')}: {(counts.pending ?? 0) + (counts.processing ?? 0)}
                  </Badge>
                ) : null}
                {(counts.sent ?? 0) > 0 ? (
                  <Badge size="2xsmall" color="green">
                    {t('OUTBOX_SENT')}: {counts.sent}
                  </Badge>
                ) : null}
                {(counts.skipped ?? 0) > 0 ? (
                  <Badge size="2xsmall" color="grey">
                    {t('OUTBOX_SKIPPED')}: {counts.skipped}
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
                {unregisteredCount > 0 ? (
                  <button type="button" onClick={() => setStatusFilter(UNREGISTERED)}>
                    <Badge size="2xsmall" color="red">
                      {t('OUTBOX_UNREGISTERED')}: {unregisteredCount}
                    </Badge>
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="small"
                variant="secondary"
                disabled={isResyncing || bulkCount === 0}
                onClick={() => setBulkOpen(true)}
              >
                <ArrowPath />
                {t('RESYNC_BULK', { count: bulkCount })}
              </Button>
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
                    <Select.Item value={UNREGISTERED}>{t('ST_UNREGISTERED')}</Select.Item>
                  </Select.Content>
                </Select>
              </div>
            </div>
          </DataTable.Toolbar>
          <DataTable.Table
            emptyState={{
              empty: { heading: t('OUTBOX_TITLE'), description: t('OUTBOX_EMPTY') },
            }}
          />
          <DataTable.CommandBar selectedLabel={(count) => t('RESYNC_SELECTED_COUNT', { count })} />
          <DataTable.Pagination />
        </DataTable>
      </Container>

      {/**
       * El masivo se confirma. No es destructivo, pero cada fila reencolada es
       * un pedido que va a entrar al ERP del cliente: 150 comprobantes de golpe
       * no puede salir de un click sin pregunta.
       */}
      <Prompt open={bulkOpen} onOpenChange={setBulkOpen}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>{t('RESYNC_BULK_TITLE')}</Prompt.Title>
            <Prompt.Description>
              {statusFilter === ALL
                ? t('RESYNC_BULK_DESC', { count: bulkCount })
                : t('RESYNC_BULK_DESC_FILTERED', {
                    count: bulkCount,
                    status: t(statusLabelKey(statusFilter)),
                  })}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>{t('CANCEL')}</Prompt.Cancel>
            <Prompt.Action
              onClick={() => resync(statusFilter === ALL ? {} : { statuses: [statusFilter] })}
            >
              {t('RESYNC_BULK_CONFIRM')}
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>

      <SalePreviewDrawer eventId={previewId} onClose={() => setPreviewId(null)} />

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
