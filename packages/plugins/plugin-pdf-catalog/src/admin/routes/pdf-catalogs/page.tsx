import { defineRouteConfig } from '@medusajs/admin-sdk';
import { BookOpen } from '@medusajs/icons';
import {
  Badge,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Heading,
  StatusBadge,
  Text,
  Toaster,
  useDataTable,
} from '@medusajs/ui';
import { SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';
import { useMemo, useState } from 'react';
import { PdfCatalog, usePdfCatalogs } from '../../hooks/api/pdf-catalogs';
import {
  GlobalToggle,
  PdfCatalogActionsMenu,
  PdfCatalogCreateButton,
  PdfCatalogFormDrawer,
} from './components';

const PAGE_SIZE = 20;
const columnHelper = createDataTableColumnHelper<PdfCatalog>();

const PdfCatalogsPage = () => {
  const [editing, setEditing] = useState<PdfCatalog | null>(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = usePdfCatalogs({
    limit: pagination.pageSize,
    offset,
    q: search || undefined,
  });

  const catalogs = data?.pdf_catalogs ?? [];
  const count = data?.count ?? 0;

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Nombre',
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      columnHelper.accessor('pages', {
        header: 'Páginas',
        cell: ({ getValue }) => <span className="text-ui-fg-subtle">{getValue()}</span>,
      }),
      columnHelper.display({
        id: 'hotspots',
        header: 'Hotspots',
        cell: ({ row }) => (
          <span className="text-ui-fg-subtle">{row.original.hotspots?.length ?? 0}</span>
        ),
      }),
      columnHelper.display({
        id: 'channels',
        header: 'Canales activos',
        cell: ({ row }) => (
          <span className="text-ui-fg-subtle">{row.original.sales_channel_ids?.length ?? 0}</span>
        ),
      }),
      columnHelper.accessor('published', {
        header: 'Estado',
        cell: ({ getValue }) => (
          <StatusBadge color={getValue() ? 'green' : 'grey'}>
            {getValue() ? 'Publicado' : 'Borrador'}
          </StatusBadge>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <PdfCatalogActionsMenu catalog={row.original} />
          </div>
        ),
      }),
    ],
    []
  );

  const table = useDataTable({
    columns,
    data: catalogs,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      },
    },
    onRowClick: (_event, row) => setEditing(row),
  });

  return (
    <>
      <Container className="p-0">
        <SiteScopeBar screen="pdf-catalogs" />
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-x-2">
              <Heading>Catálogos PDF</Heading>
              <Badge size="2xsmall">v1.3.2</Badge>
            </div>
            <div className="flex items-center gap-4">
              <GlobalToggle />
              <DataTable.Search placeholder="Buscar catálogos" />
              <PdfCatalogCreateButton />
            </div>
          </DataTable.Toolbar>
          {count > 0 || isPending ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-6 text-center">
              <Text className="text-ui-fg-subtle">
                Todavía no hay catálogos. Creá el primero para empezar.
              </Text>
            </div>
          )}
        </DataTable>
      </Container>
      {editing && (
        <PdfCatalogFormDrawer
          catalog={editing}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
      <Toaster />
    </>
  );
};

const PdfCatalogIcon = () => <BookOpen style={{ color: '#7270F5' }} />;

export const config = defineRouteConfig({
  label: 'Catálogos PDF',
  icon: PdfCatalogIcon,
  rank: 12,
});

export const handle = {
  breadcrumb: () => 'Catálogos PDF',
};

export default PdfCatalogsPage;
