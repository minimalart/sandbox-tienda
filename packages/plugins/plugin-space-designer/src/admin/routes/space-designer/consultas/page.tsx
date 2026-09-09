import { defineRouteConfig } from '@medusajs/admin-sdk';
import '../../../lib/register-meta';
import { ChatBubbleLeftRight, EllipsisHorizontal, Trash } from '@medusajs/icons';
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  StatusBadge,
  Text,
  Toaster,
  toast,
  useDataTable,
  usePrompt,
} from '@medusajs/ui';
import { ExtensionVersion } from '@minimalart/mercatto-plugin-runtime/admin';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SpaceQuote, SpaceQuoteStatus } from '../../../../types';
import {
  deleteQuote,
  errorMessage,
  quoteKey,
  updateQuoteStatus,
  useQuotes,
} from '../../../lib/api';

const column = createDataTableColumnHelper<SpaceQuote>();
const STATUS: Record<SpaceQuoteStatus, { label: string; color: 'orange' | 'blue' | 'green' }> = {
  new: { label: 'Nueva', color: 'orange' },
  contacted: { label: 'Contactada', color: 'blue' },
  closed: { label: 'Cerrada', color: 'green' },
};
const FILTERS: { id: SpaceQuoteStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'new', label: 'Nuevas' },
  { id: 'contacted', label: 'Contactadas' },
  { id: 'closed', label: 'Cerradas' },
];
const STATES = Object.keys(STATUS) as SpaceQuoteStatus[];
const when = (value?: string) =>
  value ? new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export default function SpaceQuotesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SpaceQuoteStatus | 'all'>('all');
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [detail, setDetail] = useState<SpaceQuote | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const prompt = usePrompt();
  const { data, isPending, error, refetch } = useQuotes(
    search,
    status,
    pagination.pageIndex * pagination.pageSize,
    pagination.pageSize
  );
  const refresh = () => queryClient.invalidateQueries({ queryKey: quoteKey });

  async function changeStatus(quote: SpaceQuote, next: SpaceQuoteStatus) {
    try {
      await updateQuoteStatus(quote.id, next);
      await refresh();
      setDetail((current) => (current?.id === quote.id ? { ...current, status: next } : current));
      toast.success(`Consulta marcada como ${STATUS[next].label.toLowerCase()}`);
    } catch (failure) {
      toast.error(errorMessage(failure));
    }
  }
  async function remove(quote: SpaceQuote) {
    const confirmed = await prompt({
      title: 'Eliminar consulta',
      description: `¿Seguro que querés eliminar la consulta de ${quote.name}?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await deleteQuote(quote.id);
      await refresh();
      setDetail((current) => (current?.id === quote.id ? null : current));
      toast.success('Consulta eliminada');
    } catch (failure) {
      toast.error(errorMessage(failure));
    }
  }

  const columns = useMemo(
    () => [
      column.accessor('name', {
        header: 'Contacto',
        cell: ({ row }) => (
          <div className="py-1">
            <Text weight="plus">{row.original.name}</Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {row.original.email}
              {row.original.phone ? ` · ${row.original.phone}` : ''}
            </Text>
          </div>
        ),
      }),
      column.accessor('configurator_title', {
        header: 'Espacio',
        cell: ({ row }) => (
          <div className="py-1">
            <Text size="small">{row.original.configurator_title}</Text>
            {row.original.template_name && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                {row.original.template_name}
              </Text>
            )}
          </div>
        ),
      }),
      column.display({
        id: 'items',
        header: 'Productos',
        cell: ({ row }) =>
          (row.original.items ?? []).reduce((total, item) => total + item.quantity, 0),
      }),
      column.accessor('created_at', {
        header: 'Recibida',
        cell: ({ getValue }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {when(getValue() as string | undefined)}
          </Text>
        ),
      }),
      column.accessor('status', {
        header: 'Estado',
        cell: ({ getValue }) => {
          const state = STATUS[getValue() as SpaceQuoteStatus] ?? STATUS.new;
          return <StatusBadge color={state.color}>{state.label}</StatusBadge>;
        },
      }),
      column.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <IconButton variant="transparent" aria-label="Acciones de la consulta">
                  <EllipsisHorizontal />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item onClick={() => setDetail(row.original)}>
                  Ver detalle
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                {STATES.filter((state) => state !== row.original.status).map((state) => (
                  <DropdownMenu.Item
                    key={state}
                    onClick={() => void changeStatus(row.original, state)}
                  >
                    Marcar como {STATUS[state].label.toLowerCase()}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  className="gap-x-2 text-ui-fg-error"
                  onClick={() => void remove(row.original)}
                >
                  <Trash className="text-ui-fg-error" />
                  Eliminar
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        ),
      }),
    ],
    []
  );

  const table = useDataTable({
    columns,
    data: data?.quotes ?? [],
    rowCount: data?.count ?? 0,
    getRowId: (row) => row.id,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value);
        setPagination((current) => ({ ...current, pageIndex: 0 }));
      },
    },
    onRowClick: (_event, row) =>
      setDetail((row as unknown as { original?: SpaceQuote }).original ?? row),
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div>
              <div className="flex items-center gap-2">
                <Heading>Consultas de espacios</Heading>
                <ExtensionVersion extension="space-designer" />
              </div>
              <Text size="small" className="mt-1 text-ui-fg-subtle">
                Pedidos de cotización enviados desde los espacios que cierran por consulta.
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DataTable.Search placeholder="Buscar por nombre o email…" />
              <Button variant="secondary" onClick={() => navigate('/space-designer')}>
                Ver espacios
              </Button>
            </div>
          </DataTable.Toolbar>
          <div className="flex flex-wrap gap-1 border-t border-ui-border-base px-6 py-3">
            {FILTERS.map((filter) => (
              <Button
                key={filter.id}
                size="small"
                variant={status === filter.id ? 'primary' : 'transparent'}
                onClick={() => {
                  setStatus(filter.id);
                  setPagination((current) => ({ ...current, pageIndex: 0 }));
                }}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          {error ? (
            <div role="alert" className="flex items-center justify-between gap-4 border-t p-6">
              <Text className="text-ui-fg-error">{errorMessage(error)}</Text>
              <Button variant="secondary" onClick={() => void refetch()}>
                Reintentar
              </Button>
            </div>
          ) : !isPending && !data?.count ? (
            <div className="border-t p-12 text-center">
              <Heading level="h2">Todavía no hay consultas</Heading>
              <Text className="mt-2 text-ui-fg-subtle">
                Cuando un espacio cierre por cotización, los pedidos van a aparecer acá.
              </Text>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <DataTable.Table />
              </div>
              <DataTable.Pagination />
            </>
          )}
        </DataTable>
      </Container>
      <Drawer open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{detail?.name ?? 'Consulta'}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-5 overflow-y-auto">
            {detail && (
              <>
                <div className="flex flex-col gap-1">
                  <Text size="small" className="text-ui-fg-subtle">
                    Contacto
                  </Text>
                  <Text>{detail.email}</Text>
                  {detail.phone && <Text>{detail.phone}</Text>}
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Recibida el {when(detail.created_at)}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="small" className="text-ui-fg-subtle">
                    Espacio
                  </Text>
                  <Text>{detail.configurator_title}</Text>
                  {detail.template_name && (
                    <Text size="small" className="text-ui-fg-subtle">
                      {detail.template_name}
                    </Text>
                  )}
                  <Text size="small" className="text-ui-fg-subtle">
                    {detail.snapshot?.room?.width} × {detail.snapshot?.room?.depth} m
                  </Text>
                </div>
                {detail.message && (
                  <div className="flex flex-col gap-1">
                    <Text size="small" className="text-ui-fg-subtle">
                      Mensaje
                    </Text>
                    <Text className="whitespace-pre-wrap">{detail.message}</Text>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Text size="small" className="text-ui-fg-subtle">
                    Productos pedidos
                  </Text>
                  {(detail.items ?? []).map((item) => (
                    <div
                      key={item.product_ref}
                      className="flex items-start justify-between gap-3 border-b border-ui-border-base pb-2"
                    >
                      <div>
                        <Text size="small">{item.title}</Text>
                        {item.sku && (
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            SKU {item.sku}
                          </Text>
                        )}
                      </div>
                      <Text size="small">{item.quantity}×</Text>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            {detail &&
              STATES.filter((state) => state !== detail.status).map((state) => (
                <Button
                  key={state}
                  variant="secondary"
                  onClick={() => void changeStatus(detail, state)}
                >
                  Marcar como {STATUS[state].label.toLowerCase()}
                </Button>
              ))}
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
      <Toaster />
    </>
  );
}

export const config = defineRouteConfig({
  label: 'Consultas',
  icon: ChatBubbleLeftRight,
  rank: 13,
});
export const handle = { breadcrumb: () => 'Consultas' };
