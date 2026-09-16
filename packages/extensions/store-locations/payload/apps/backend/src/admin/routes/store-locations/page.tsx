import { defineRouteConfig } from '@medusajs/admin-sdk';
import { BuildingStorefront } from '@medusajs/icons';
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
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StoreLocation,
  useAdminSalesChannels,
  useBranchTypes,
  useStoreLocations,
} from '../../hooks/api';
import { BRANCH_TYPE_COLORS, branchTypeColor } from '../../../lib/branch-types';
import { registerStoreLocationsTranslations } from '../../translations/store-locations';
import { StoreLocationActionsMenu, StoreLocationForm } from './components';
import { ExtensionVersion } from '../../components/common/extension-version';
import { SiteScopeBar } from '../../components/common/site-scope-bar';

const PAGE_SIZE = 20;

const columnHelper = createDataTableColumnHelper<StoreLocation>();

const StoreLocations = () => {
  const { t, i18n } = useTranslation('storeLocations');
  registerStoreLocationsTranslations(i18n);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StoreLocation | null>(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useStoreLocations({
    limit: pagination.pageSize,
    offset,
    q: search || undefined,
  });

  const locations = data?.store_locations ?? [];
  const count = data?.count ?? 0;

  // Channel names for the visibility column (a scoped store must not look like
  // a global one in the table).
  const { data: channelsData } = useAdminSalesChannels();
  const channelNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const channel of channelsData?.sales_channels ?? []) {
      map.set(channel.id, channel.name);
    }
    return map;
  }, [channelsData]);

  // Sin canales: la unión de los tipos de todas las tiendas, que es lo único
  // con lo que se puede resolver una tabla donde las filas son de varias.
  const { data: typesData } = useBranchTypes();
  const branchTypes = typesData?.branch_types ?? [];

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('COLUMN_NAME'),
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      columnHelper.accessor('store_type', {
        header: t('COLUMN_TYPE'),
        cell: ({ getValue }) => {
          const id = getValue();
          if (!id) return <span className="text-ui-fg-muted">—</span>;
          // Sin la tienda a mano en la fila, se resuelve contra la unión de los
          // tipos de todas: alcanza para el label y el color, y un id que ya no
          // existe se muestra crudo en vez de desaparecer.
          const index = branchTypes.findIndex((type) => type.id === id);
          const type = index >= 0 ? branchTypes[index] : undefined;
          return (
            <Badge size="small" color={BRANCH_TYPE_COLORS[branchTypeColor(type, index)].badge}>
              {type?.label ?? id}
            </Badge>
          );
        },
      }),
      columnHelper.accessor('city', {
        header: t('COLUMN_CITY'),
        cell: ({ getValue }) => <span className="text-ui-fg-subtle">{getValue()}</span>,
      }),
      columnHelper.accessor('province', {
        header: t('COLUMN_PROVINCE'),
        cell: ({ getValue }) => <span className="text-ui-fg-subtle">{getValue()}</span>,
      }),
      columnHelper.accessor('is_visible', {
        header: t('COLUMN_VISIBLE'),
        cell: ({ getValue }) => (
          <StatusBadge color={getValue() ? 'green' : 'grey'}>
            {getValue() ? t('STATUS_VISIBLE') : t('STATUS_HIDDEN')}
          </StatusBadge>
        ),
      }),
      columnHelper.accessor('sales_channel_ids', {
        header: t('COLUMN_CHANNELS'),
        cell: ({ getValue }) => {
          const ids = getValue();
          if (!Array.isArray(ids) || ids.length === 0) {
            return (
              <Badge size="small" color="grey">
                {t('CHANNELS_ALL')}
              </Badge>
            );
          }
          const names = ids.map((id) => channelNames.get(id) ?? id);
          return (
            <span title={names.join(', ')}>
              <Badge size="small" color="orange">
                {names.length === 1 ? names[0] : t('CHANNELS_COUNT', { count: names.length })}
              </Badge>
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: t('COLUMN_ACTIONS'),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <StoreLocationActionsMenu location={row.original} />
          </div>
        ),
      }),
    ],
    [t, channelNames, branchTypes]
  );

  const table = useDataTable({
    columns,
    data: locations,
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
    onRowClick: (_event, row) => setEditingLocation(row),
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-x-2">
              <Heading>{t('TITLE')}</Heading>
              <ExtensionVersion extension="store-locations" />
            </div>
            <div className="flex items-center gap-2">
              <DataTable.Search placeholder={t('SEARCH_PLACEHOLDER')} />
              <StoreLocationForm open={createOpen} onOpenChange={setCreateOpen} withTrigger />
            </div>
          </DataTable.Toolbar>

          {/*
            La barra va DENTRO de la card y debajo del título, no flotando arriba:
            misma posición que la franja de tienda de las pantallas de ajustes. Una
            barra suelta sobre la card se lee como si hablara de la página; adentro
            y bajo el header se lee como lo que es: de qué tienda son ESTAS sucursales.
            El `variant` por defecto (`bar`) ya trae `border-b px-6 py-2`.
          */}
          <SiteScopeBar screen="store-locations" />

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
      {editingLocation && (
        <StoreLocationForm
          location={editingLocation}
          open={!!editingLocation}
          onOpenChange={(open) => {
            if (!open) setEditingLocation(null);
          }}
        />
      )}
      <Toaster />
    </>
  );
};

const StoreLocationsIcon = () => (
  <BuildingStorefront style={{ color: '#45B572' }} />
);

export const config = defineRouteConfig({
  label: 'Sucursales',
  icon: StoreLocationsIcon,
  rank: 60,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Sucursales',
};

export default StoreLocations;
