import { ArrowPath } from '@medusajs/icons';
import {
  Button,
  createDataTableColumnHelper,
  DataTable,
  type DataTableRowSelectionState,
  Heading,
  Prompt,
  Text,
  toast,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useErpUnregisteredOrders,
  useResyncOutboxEvents,
  type ErpResyncResponse,
  type ErpUnregisteredOrder,
} from '../../../hooks/api';
import { formatDateTime } from './shared';

const columnHelper = createDataTableColumnHelper<ErpUnregisteredOrder>();

/**
 * Órdenes que YA deberían estar notificadas al ERP y no tienen NI UNA fila en
 * el outbox.
 *
 * Es una tabla aparte, y no un estado más del outbox, porque la fuente de datos
 * es otra: acá se mira desde las ÓRDENES hacia la cola, que es la única forma
 * de ver lo que falta. La cola sólo puede mostrar lo que alcanzó a registrarse
 * — con el event bus caído, estas órdenes no existen para ninguna pantalla.
 *
 * Por eso las acciones mandan `order_ids` y no `event_ids`: no hay evento
 * todavía; el backend lo crea.
 */
export function UnregisteredOrdersTable({ onBack }: { onBack: () => void }): JSX.Element {
  const { t } = useTranslation('erp');
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({});
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data, isPending } = useErpUnregisteredOrders({ limit: 200 }, { refetchInterval: 30000 });
  const orders = data?.orders ?? [];

  const announce = (result: ErpResyncResponse) => {
    if (result.requeued > 0) {
      toast.success(t('RESYNC_OK', { count: result.requeued }));
    } else {
      toast.warning(t('RESYNC_NONE'));
    }
    const untouched = result.total - result.requeued;
    if (untouched > 0) toast.info(t('RESYNC_UNTOUCHED', { count: untouched }));
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

  const columns = useMemo(
    () => [
      columnHelper.select(),
      columnHelper.accessor('display_id', {
        header: t('COL_ORDER'),
        cell: ({ getValue, row }) => (
          <Text size="small" weight="plus">
            {getValue() != null ? `#${getValue()}` : row.original.order_id}
          </Text>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: t('COL_CREATED'),
        cell: ({ getValue }) => <Text size="small">{formatDateTime(getValue())}</Text>,
      }),
      columnHelper.accessor('payment_status', {
        header: t('COL_PAYMENT'),
        cell: ({ getValue }) => <Text size="small">{getValue() ?? '—'}</Text>,
      }),
      columnHelper.accessor('total', {
        header: t('COL_TOTAL'),
        cell: ({ getValue }) => {
          const value = getValue();
          return <Text size="small">{value == null ? '—' : value.toLocaleString('es-AR')}</Text>;
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            size="small"
            variant="secondary"
            disabled={isResyncing}
            onClick={(e) => {
              e.stopPropagation();
              resync({ order_ids: [row.original.order_id] });
            }}
          >
            <ArrowPath />
            {t('ENQUEUE_ONE')}
          </Button>
        ),
      }),
    ],
    [t, isResyncing, resync]
  );

  const commands = useMemo(
    () => [
      {
        label: t('ENQUEUE_SELECTED'),
        shortcut: 'e',
        action: (selection: DataTableRowSelectionState) => {
          const ids = orders
            .filter((order) => selection[order.order_id])
            .map((order) => order.order_id);
          if (!ids.length) return;
          resync({ order_ids: ids });
        },
      },
    ],
    [t, orders, resync]
  );

  const table = useDataTable({
    columns,
    data: orders,
    getRowId: (row) => row.order_id,
    rowCount: orders.length,
    isLoading: isPending,
    commands,
    rowSelection: { state: rowSelection, onRowSelectionChange: setRowSelection },
  });

  return (
    <>
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Heading level="h2">{t('UNREGISTERED_TITLE')}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {/* `scanned` va en el subtítulo a propósito: `count` es "de las
                  últimas N órdenes", no un total del histórico, y sin decirlo el
                  número se lee como si fuera todo. */}
              {t('UNREGISTERED_HELP', { count: orders.length, scanned: data?.scanned ?? 0 })}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Button size="small" variant="transparent" onClick={onBack}>
              {t('BACK_TO_QUEUE')}
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={isResyncing || orders.length === 0}
              onClick={() => setBulkOpen(true)}
            >
              <ArrowPath />
              {t('ENQUEUE_BULK', { count: orders.length })}
            </Button>
          </div>
        </DataTable.Toolbar>
        <DataTable.Table
          emptyState={{
            empty: {
              heading: t('UNREGISTERED_TITLE'),
              // Dos vacíos con causas opuestas: "nada atrasado" y "el ERP está
              // apagado y por eso no hay nada que encolar" no son lo mismo.
              description:
                data?.enabled === false ? t('UNREGISTERED_DISABLED') : t('UNREGISTERED_EMPTY'),
            },
          }}
        />
        <DataTable.CommandBar selectedLabel={(count) => t('RESYNC_SELECTED_COUNT', { count })} />
      </DataTable>

      <Prompt open={bulkOpen} onOpenChange={setBulkOpen}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>{t('ENQUEUE_BULK_TITLE')}</Prompt.Title>
            <Prompt.Description>
              {t('ENQUEUE_BULK_DESC', { count: orders.length })}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>{t('CANCEL')}</Prompt.Cancel>
            <Prompt.Action
              onClick={() => resync({ order_ids: orders.map((order) => order.order_id) })}
            >
              {t('ENQUEUE_BULK_CONFIRM')}
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </>
  );
}
