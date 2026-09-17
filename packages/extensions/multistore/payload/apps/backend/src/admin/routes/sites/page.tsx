import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Buildings } from '@medusajs/icons';
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
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type DemoStore, useDemoStores } from '../../hooks/api';
import { useStorefrontOrigins } from '../../hooks/use-storefront-base';
import { registerDemoStoresTranslations } from '../../translations/demo-stores';
import { ExtensionVersion } from '../../components/common/extension-version';
import { DemoStoreActions, DemoStoreCreate } from './components';
import {
  buildPublicUrlFrom,
  formatPublicUrlFrom,
  STATUS_COLOR,
  STATUS_LABEL_KEY,
} from './lib';

const PAGE_SIZE = 20;
const columnHelper = createDataTableColumnHelper<DemoStore>();

const SOURCE_LABEL: Record<string, string> = {
  woocommerce: 'WooCommerce',
  vtex: 'VTEX',
  shopify: 'Shopify',
  sales_channel: 'Sales channel',
  // La tienda principal: el catálogo ya es de esta instancia, no se importa.
  native: 'Catálogo propio',
};

const DemoStores = () => {
  const { t, i18n } = useTranslation('demo-stores');
  registerDemoStoresTranslations(i18n);
  const navigate = useNavigate();

  /**
   * La base sale del BACKEND, no del build.
   *
   * Es el único dato de esta pantalla que el bundle del admin no puede conocer: se
   * compila una vez como template y se despliega en cada instalación con su propio
   * dominio. Cuando lo resolvía en build, este `href` abría el storefront de otra
   * marca —y el operador no tiene forma de saber que el link, no su tienda, es el
   * que está mal—. Ojo: `base`, no `url`; `url` es la tienda ACTIVA y acá se linkea
   * a la de la FILA.
   */
  const { base: storefrontBase, sitesBase, hostSuffix } = useStorefrontOrigins();

  const [createOpen, setCreateOpen] = useState(false);
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const offset = pagination.pageIndex * pagination.pageSize;
  // Poll SOLO mientras alguna demo esté en transición (provisioning/importing).
  // Con todo `ready` no re-disparamos el endpoint. `refetchInterval` como
  // función evita el ciclo de depender de `data`.
  const { data, isPending } = useDemoStores(
    { limit: pagination.pageSize, offset },
    {
      staleTime: 5000,
      refetchInterval: (query: any) => {
        const list = query?.state?.data?.demo_stores ?? [];
        const transient = list.some(
          (d: DemoStore) => d.status === 'provisioning' || d.status === 'importing',
        );
        return transient ? 5000 : false;
      },
    } as any,
  );

  const demos = data?.demo_stores ?? [];
  const count = data?.count ?? 0;

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('COLUMN_NAME'),
        cell: ({ getValue, row }) => (
          <div className="flex items-center gap-x-2">
            <span className="font-medium">{getValue()}</span>
            {row.original.is_main && (
              // El backend ya la ordena primera (`order: { is_main: 'DESC' }`), pero
              // sin el badge no hay nada que explique por qué esta fila no ofrece
              // Eliminar ni Reintentar.
              <Badge size="2xsmall" color="purple">
                {t('BADGE_MAIN')}
              </Badge>
            )}
          </div>
        ),
      }),
      columnHelper.accessor('template_code', {
        header: t('COLUMN_TEMPLATE'),
        cell: ({ getValue }) => <span className="text-ui-fg-subtle capitalize">{getValue()}</span>,
      }),
      columnHelper.accessor('source_type', {
        header: t('COLUMN_SOURCE'),
        cell: ({ getValue }) => <span>{SOURCE_LABEL[getValue()] ?? getValue()}</span>,
      }),
      columnHelper.accessor('status', {
        header: t('COLUMN_STATUS'),
        cell: ({ getValue }) => {
          const status = getValue();
          return (
            <StatusBadge color={STATUS_COLOR[status]}>{t(STATUS_LABEL_KEY[status])}</StatusBadge>
          );
        },
      }),
      columnHelper.accessor('slug', {
        id: 'url',
        header: t('COLUMN_URL'),
        cell: ({ row }) =>
          row.original.status === 'ready' ? (
            <a
              href={buildPublicUrlFrom(row.original, {
                baseUrl: storefrontBase,
                sitesBaseUrl: sitesBase, hostSuffix,
              })}
              target="_blank"
              rel="noreferrer"
              className="text-ui-fg-interactive"
              onClick={(e) => e.stopPropagation()}
            >
              {/*
                Respeta `canonical_form`: subdominio (`moda.mercatto.ar`) o ruta
                (`/tienda/moda`). La principal se sirve en la raíz.
              */}
              {formatPublicUrlFrom(row.original, {
                baseUrl: storefrontBase,
                sitesBaseUrl: sitesBase, hostSuffix,
              })}
            </a>
          ) : (
            <span className="text-ui-fg-muted">—</span>
          ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DemoStoreActions demo={row.original} />
          </div>
        ),
      }),
    ],
    [t, storefrontBase, sitesBase, hostSuffix],
  );

  const table = useDataTable({
    columns,
    data: demos,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_e, row) => navigate(`/sites/${row.id}`),
  });

  return (
    <>
      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-x-2">
              <Heading>{t('TITLE')}</Heading>
              <ExtensionVersion extension="demo-stores" />
            </div>
            <Button size="small" variant="secondary" onClick={() => navigate('/sites/directory')}>{i18n.language.startsWith('en') ? 'Edit directory' : 'Editar directorio'}</Button>
            <Button size="small" variant="secondary" onClick={() => setCreateOpen(true)}>
              {t('CREATE_BUTTON')}
            </Button>
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

      <DemoStoreCreate open={createOpen} onOpenChange={setCreateOpen} />
      <Toaster />
    </>
  );
};

const DemoStoresIcon = () => <Buildings style={{ color: '#7270F5' }} />;

export const config = defineRouteConfig({
  label: 'Tiendas',
  icon: DemoStoresIcon,
  rank: 5,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Tiendas',
};

export default DemoStores;
