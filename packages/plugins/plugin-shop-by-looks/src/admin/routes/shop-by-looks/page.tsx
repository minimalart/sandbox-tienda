import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Photo } from '@medusajs/icons';
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
import { ExtensionVersion, SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';
import { ShopByLook, ShopByLookPlacement, useShopByLooks } from '../../hooks/api';
import { registerShopByLooksTranslations } from '../../translations/shop-by-looks';
import {
  GlobalToggle,
  ShopByLookActionsMenu,
  ShopByLookCreateButton,
  ShopByLookFormDrawer,
} from './components';

const PAGE_SIZE = 20;
const columnHelper = createDataTableColumnHelper<ShopByLook>();

const PLACEMENT_LABEL_KEY: Record<ShopByLookPlacement, string> = {
  top: 'PLACEMENT_TOP',
  after_collections: 'PLACEMENT_AFTER_COLLECTIONS',
  after_featured: 'PLACEMENT_AFTER_FEATURED',
  before_footer: 'PLACEMENT_BEFORE_FOOTER',
};

const ShopByLooks = () => {
  const { t, i18n } = useTranslation('shop-by-looks');
  registerShopByLooksTranslations(i18n);
  const [editing, setEditing] = useState<ShopByLook | null>(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useShopByLooks({
    limit: pagination.pageSize,
    offset,
    q: search || undefined,
  });

  const looks = data?.shop_by_looks ?? [];
  const count = data?.count ?? 0;

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: t('COLUMN_TITLE'),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      columnHelper.accessor('placement', {
        header: t('COLUMN_PLACEMENT'),
        cell: ({ getValue }) => (
          <span className="text-ui-fg-subtle">
            {t(PLACEMENT_LABEL_KEY[getValue() as ShopByLookPlacement] ?? 'PLACEMENT_AFTER_FEATURED')}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'products',
        header: t('COLUMN_PRODUCTS'),
        cell: ({ row }) => (
          <span className="text-ui-fg-subtle">{row.original.products?.length ?? 0}</span>
        ),
      }),
      columnHelper.accessor('sort_order', {
        header: t('COLUMN_ORDER'),
        cell: ({ getValue }) => <span className="text-ui-fg-subtle">{getValue()}</span>,
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
            <ShopByLookActionsMenu look={row.original} />
          </div>
        ),
      }),
    ],
    [t]
  );

  const table = useDataTable({
    columns,
    data: looks,
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
    onRowClick: (_event, row) => setEditing(row),
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-x-2">
              <Heading>{t('TITLE')}</Heading>
              <ExtensionVersion extension="shop-by-looks" />
            </div>
            <div className="flex items-center gap-4">
              <GlobalToggle />
              <DataTable.Search placeholder={t('SEARCH_PLACEHOLDER')} />
              <ShopByLookCreateButton />
            </div>
          </DataTable.Toolbar>

          {/* La barra va DENTRO de la card y debajo del título, no flotando arriba:
              misma posición que la franja de tienda de las pantallas de ajustes. */}
          <SiteScopeBar screen="shop-by-looks" />

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
      {editing && (
        <ShopByLookFormDrawer
          look={editing}
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

const ShopByLookIcon = () => <Photo style={{ color: '#7270F5' }} />;

export const config = defineRouteConfig({
  label: 'Shop by Look',
  icon: ShopByLookIcon,
  rank: 11,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Shop by Look',
};

export default ShopByLooks;
