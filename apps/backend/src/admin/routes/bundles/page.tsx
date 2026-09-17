import { defineRouteConfig } from '@medusajs/admin-sdk';
import { CubeSolid } from '@medusajs/icons';
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Heading,
  StatusBadge,
  Text,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBundles, type Bundle } from '../../hooks/api/bundles';
import { registerBundlesTranslations } from '../../translations/bundles';
import { BundleActionsMenu } from './components/bundle-actions-menu';
import { CreateBundleModal } from './components/create-bundle-modal';

const PAGE_SIZE = 20;
const columnHelper = createDataTableColumnHelper<Bundle>();

const BundlesPage = () => {
  const { t, i18n } = useTranslation('bundles');
  registerBundlesTranslations(i18n);

  const [createOpen, setCreateOpen] = useState(false);
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useBundles({ limit: pagination.pageSize, offset });

  const bundles = data?.bundles ?? [];
  const count = data?.count ?? 0;

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: t('COLUMN_TITLE'),
        cell: ({ row }) => (
          <Link to={`/bundles/${row.original.id}`} className="font-medium hover:underline">
            {row.original.title}
          </Link>
        ),
      }),
      columnHelper.accessor('status', {
        header: t('COLUMN_STATUS'),
        cell: ({ getValue }) => {
          const status = getValue();
          return status === 'published' ? (
            <StatusBadge color="green">{t('STATUS_PUBLISHED')}</StatusBadge>
          ) : (
            <StatusBadge color="grey">{t('STATUS_DRAFT')}</StatusBadge>
          );
        },
      }),
      columnHelper.display({
        id: 'stores',
        header: t('COLUMN_STORES'),
        cell: () => <Text size="small">—</Text>, // TODO F1: expand via link
      }),
      columnHelper.display({
        id: 'items',
        header: t('COLUMN_ITEMS'),
        cell: () => <Text size="small">—</Text>, // TODO F1: item count
      }),
      columnHelper.accessor('updated_at', {
        header: t('COLUMN_UPDATED'),
        cell: ({ getValue }) => (
          <Text size="small">{new Date(getValue()).toLocaleDateString()}</Text>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => <BundleActionsMenu bundle={row.original} />,
      }),
    ],
    [t],
  );

  const table = useDataTable({
    data: bundles,
    columns,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    getRowId: (row) => row.id,
  });

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{t('TITLE')}</Heading>
        <Button size="small" variant="primary" onClick={() => setCreateOpen(true)}>
          {t('CREATE_BUTTON')}
        </Button>
      </div>
      <div className="px-6 py-4">
        {bundles.length === 0 && !isPending ? (
          <Text className="text-ui-fg-subtle">{t('EMPTY_STATE')}</Text>
        ) : (
          <DataTable instance={table}>
            <DataTable.Table />
            <DataTable.Pagination />
          </DataTable>
        )}
      </div>
      <CreateBundleModal open={createOpen} onOpenChange={setCreateOpen} />
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'Bundles',
  icon: CubeSolid,
});

export default BundlesPage;
