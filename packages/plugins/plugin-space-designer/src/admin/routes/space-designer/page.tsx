import { defineRouteConfig } from '@medusajs/admin-sdk';
import '../../lib/register-meta';
import { SquaresPlus } from '@medusajs/icons';
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Heading,
  StatusBadge,
  Text,
  Toaster,
  toast,
  useDataTable,
} from '@medusajs/ui';
import { ExtensionVersion } from '@minimalart/mercatto-plugin-runtime/admin';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { SpaceConfigurator } from '../../../types';
import { ConfiguratorForm } from '../../components/configurator-form';
import {
  configuratorKey,
  deleteConfigurator,
  errorMessage,
  useConfigurators,
  useSalesChannels,
} from '../../lib/api';

const column = createDataTableColumnHelper<SpaceConfigurator>();

export default function SpaceDesignerPage() {
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [editing, setEditing] = useState<SpaceConfigurator | null | undefined>(undefined);
  const [deleting, setDeleting] = useState('');
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch } = useConfigurators(
    search,
    pagination.pageIndex * pagination.pageSize,
    pagination.pageSize
  );
  const { data: channels } = useSalesChannels();
  async function remove(item: SpaceConfigurator) {
    if (!window.confirm(`¿Eliminar “${item.title}”? Dejará de estar disponible en la tienda.`))
      return;
    setDeleting(item.id);
    try {
      await deleteConfigurator(item.id);
      await queryClient.invalidateQueries({ queryKey: configuratorKey });
      setPagination((current) => ({
        ...current,
        pageIndex:
          data?.configurators.length === 1 ? Math.max(0, current.pageIndex - 1) : current.pageIndex,
      }));
      toast.success('Diseñador eliminado');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting('');
    }
  }
  const columns = useMemo(
    () => [
      column.accessor('title', {
        header: 'Diseñador',
        cell: ({ row }) => (
          <div className="py-1">
            <Text weight="plus">{row.original.title}</Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {row.original.slug}
            </Text>
          </div>
        ),
      }),
      column.accessor('sales_channel_id', {
        header: 'Canal de venta',
        cell: ({ getValue }) => (
          <span>
            {channels?.sales_channels.find((item) => item.id === getValue())?.name ??
              (getValue() ? 'Canal asignado' : 'Todos los canales')}
          </span>
        ),
      }),
      column.display({
        id: 'products',
        header: 'Productos',
        cell: ({ row }) => row.original.config.products.length,
      }),
      column.display({
        id: 'templates',
        header: 'Templates',
        cell: ({ row }) => row.original.config.templates.length,
      }),
      column.accessor('status', {
        header: 'Estado',
        cell: ({ getValue }) => (
          <StatusBadge color={getValue() === 'published' ? 'green' : 'grey'}>
            {getValue() === 'published' ? 'Publicado' : 'Borrador'}
          </StatusBadge>
        ),
      }),
      column.display({
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
            <Button size="small" variant="transparent" onClick={() => setEditing(row.original)}>
              Editar
            </Button>
            <Button
              size="small"
              variant="transparent"
              disabled={!!deleting}
              isLoading={deleting === row.original.id}
              onClick={() => void remove(row.original)}
            >
              Eliminar
            </Button>
          </div>
        ),
      }),
    ],
    [channels, deleting, data?.configurators.length]
  );
  const table = useDataTable({
    columns,
    data: data?.configurators ?? [],
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
    onRowClick: (_event, row) => setEditing(row),
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div>
              <div className="flex items-center gap-2">
                <Heading>Diseñadores de espacios</Heading>
                <ExtensionVersion extension="space-designer" />
              </div>
              <Text size="small" className="mt-1 text-ui-fg-subtle">
                Prepará espacios equipados con productos reales de tu catálogo.
              </Text>
            </div>
            <div className="flex flex-wrap gap-2">
              <DataTable.Search placeholder="Buscar diseñadores…" />
              <Button onClick={() => setEditing(null)}>Crear diseñador</Button>
            </div>
          </DataTable.Toolbar>
          {error ? (
            <div role="alert" className="flex items-center justify-between gap-4 border-t p-6">
              <Text className="text-ui-fg-error">{errorMessage(error)}</Text>
              <Button variant="secondary" onClick={() => void refetch()}>
                Reintentar
              </Button>
            </div>
          ) : !isPending && !data?.count ? (
            <div className="border-t p-12 text-center">
              <Heading level="h2">Creá tu primer diseñador</Heading>
              <Text className="mt-2 text-ui-fg-subtle">
                Definí los productos, prepará los templates y publicá la experiencia en tu tienda.
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
      {editing !== undefined && (
        <ConfiguratorForm
          key={editing?.id ?? 'new'}
          configurator={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: configuratorKey });
            setEditing(undefined);
          }}
        />
      )}
      <Toaster />
    </>
  );
}

export const config = defineRouteConfig({
  label: 'Diseñadores de espacios',
  icon: SquaresPlus,
  rank: 12,
});
export const handle = { breadcrumb: () => 'Diseñadores de espacios' };
