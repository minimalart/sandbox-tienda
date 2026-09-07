import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ShoppingCart } from '@medusajs/icons';
import {
  Badge,
  Button,
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

const PAGE_SIZE = 20;
import {
  type CheckoutLink,
  useCheckoutLinks,
} from '../../hooks/api/checkout-links';
import { ExtensionVersion, ExtensionSettingsCard, SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';
import { CheckoutLinkActionsMenu } from './components/checkout-link-actions-menu';
import { CheckoutLinkFormModal } from './components/checkout-link-form';

const columnHelper = createDataTableColumnHelper<CheckoutLink>();

/** Effective status considering expiry (computed client-side for display). */
function effectiveStatus(link: CheckoutLink): {
  label: string;
  color: 'green' | 'grey' | 'orange' | 'red';
} {
  if (link.status === 'disabled') return { label: 'Deshabilitado', color: 'grey' };
  if (link.status === 'used') return { label: 'Usado', color: 'orange' };
  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return { label: 'Vencido', color: 'red' };
  }
  return { label: 'Activo', color: 'green' };
}

const SalesLinksPage = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CheckoutLink | null>(null);
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isLoading } = useCheckoutLinks({ limit: pagination.pageSize, offset });

  const links = useMemo(() => data?.checkout_links ?? [], [data?.checkout_links]);
  const count = data?.count ?? 0;

  const columns = useMemo(
    () => [
      columnHelper.accessor('internal_name', {
        header: 'Nombre',
        cell: ({ row }) => (
          <Text size="small" weight="plus">
            {row.original.internal_name || row.original.token}
          </Text>
        ),
      }),
      columnHelper.accessor('country_code', {
        header: 'País',
        cell: ({ getValue }) => (
          <Text size="small" className="uppercase text-ui-fg-subtle">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.display({
        id: 'items',
        header: 'Ítems',
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {row.original.items?.length ?? 0}
          </Text>
        ),
      }),
      columnHelper.display({
        id: 'flags',
        header: 'Opciones',
        cell: ({ row }) => (
          <div className="flex gap-1">
            {row.original.email ? (
              <Badge size="2xsmall" color="blue">
                email
              </Badge>
            ) : null}
            {row.original.shipping_address ? (
              <Badge size="2xsmall" color="purple">
                dirección
              </Badge>
            ) : null}
            {row.original.promo_codes?.length ? (
              <Badge size="2xsmall" color="green">
                promo
              </Badge>
            ) : null}
            {row.original.single_use ? (
              <Badge size="2xsmall" color="orange">
                1 uso
              </Badge>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor('used_count', {
        header: 'Usos',
        cell: ({ getValue }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {getValue() ?? 0}
          </Text>
        ),
      }),
      columnHelper.display({
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const s = effectiveStatus(row.original);
          return <StatusBadge color={s.color}>{s.label}</StatusBadge>;
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <CheckoutLinkActionsMenu
              link={row.original}
              onEdit={() => setEditing(row.original)}
            />
          </div>
        ),
      }),
    ],
    [],
  );

  const table = useDataTable({
    columns,
    data: links,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    onRowClick: (_event, row) => setEditing(row.original),
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-x-2">
              <Heading>Links de Venta</Heading>
              <ExtensionVersion extension="checkout-links" />
            </div>
            <Button size="small" variant="secondary" onClick={() => setCreateOpen(true)}>
              Crear link
            </Button>
          </DataTable.Toolbar>
          <SiteScopeBar screen="checkout-links" />
          <DataTable.Table />
          <DataTable.Pagination />
        </DataTable>
      </Container>

      <ExtensionSettingsCard
        namespace="extension:checkout-links"
        title="Origen de los links"
        description="El dominio con el que se arman los links públicos sale del entorno del backend y no se puede cambiar desde el admin."
      />

      {/* Create */}
      <CheckoutLinkFormModal open={createOpen} onOpenChange={setCreateOpen} />

      {/* View / Edit */}
      {editing && (
        <CheckoutLinkFormModal
          open
          checkoutLink={editing}
          onOpenChange={(o) => {
            if (!o) setEditing(null);
          }}
        />
      )}

      <Toaster />
    </>
  );
};

const SalesLinksIcon = () => <ShoppingCart style={{ color: '#4B8EEF' }} />;

export const config = defineRouteConfig({
  label: 'Links de Venta',
  icon: SalesLinksIcon,
  rank: 35,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Links de Venta',
};

export default SalesLinksPage;
