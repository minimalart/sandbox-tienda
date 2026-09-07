import { defineRouteConfig } from '@medusajs/admin-sdk';
import { TagSolid } from '@medusajs/icons';
import {
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
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brand, useBrands } from '../../hooks/api';
import { registerBrandsTranslations } from '../../translations/brands';
import {
  BrandActionsMenu,
  BrandCreateDrawer,
  BrandCSVBulk,
  BrandEditDrawer,
  BrandExport,
} from './components';
import { ExtensionVersion, SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';

const PAGE_SIZE = 20;

const columnHelper = createDataTableColumnHelper<Brand>();

const Brands = () => {
  const { t, i18n } = useTranslation('brands');
  registerBrandsTranslations(i18n);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useBrands({
    limit: pagination.pageSize,
    offset,
    q: search || undefined,
  });

  const brands = data?.brands ?? [];
  const count = data?.count ?? 0;

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('COLUMN_NAME'),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      columnHelper.accessor('handle', {
        header: t('COLUMN_HANDLE'),
        cell: ({ getValue }) => <span className="text-ui-fg-subtle">{getValue()}</span>,
      }),
      columnHelper.accessor('description', {
        header: t('COLUMN_DESCRIPTION'),
        cell: ({ getValue }) => (
          <span className="block max-w-xs truncate">{getValue() || '-'}</span>
        ),
      }),
      columnHelper.accessor('is_active', {
        header: t('COLUMN_STATUS'),
        cell: ({ getValue }) => (
          <StatusBadge color={getValue() ? 'green' : 'grey'}>
            {getValue() ? t('STATUS_ACTIVE') : t('STATUS_INACTIVE')}
          </StatusBadge>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: t('COLUMN_ACTIONS'),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <BrandActionsMenu brand={row.original} />
          </div>
        ),
      }),
    ],
    [t]
  );

  const table = useDataTable({
    columns,
    data: brands,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      },
    },
    onRowClick: (_event, row) => setEditingBrand(row),
  });

  return (
    <>
      <SiteScopeBar screen="brands" />
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-x-2">
              <Heading>{t('TITLE')}</Heading>
              <ExtensionVersion extension="brands" />
            </div>
            <div className="flex items-center gap-2">
              <DataTable.Search placeholder={t('SEARCH_PLACEHOLDER')} />
              <BrandExport />
              <BrandCSVBulk />
              <BrandCreateDrawer />
            </div>
          </DataTable.Toolbar>
          {count > 0 || isPending ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-6 text-center">
              <Text className="text-ui-fg-subtle">{t('EMPTY_STATE')}</Text>
            </div>
          )}
        </DataTable>
      </Container>
      {editingBrand && (
        <BrandEditDrawer
          brand={editingBrand}
          open={!!editingBrand}
          onOpenChange={(open) => {
            if (!open) setEditingBrand(null);
          }}
        />
      )}
      <Toaster />
    </>
  );
};

const BrandsIcon = () => <TagSolid style={{ color: '#7270F5' }} />;

export const config = defineRouteConfig({
  label: 'Marcas',
  icon: BrandsIcon,
  rank: 10,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Marcas',
};

export default Brands;
