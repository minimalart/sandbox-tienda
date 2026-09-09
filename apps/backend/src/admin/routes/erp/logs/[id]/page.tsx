import {
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Drawer,
  Heading,
  Input,
  Select,
  Text,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useErpSyncLog, useErpSyncLogItems, type ErpSyncLogItem } from '../../../../hooks/api';
import {
  ErpStatusBadge,
  formatDateTime,
  formatDuration,
  statusLabelKey,
  useErpTranslationsReady,
} from '../../components/shared';
import { describeItemPayload, summarizeItemPayload } from '../../components/log-item-payload';

const PAGE_SIZE = 50;
const ALL = '__all__';

const columnHelper = createDataTableColumnHelper<ErpSyncLogItem>();

/**
 * Resultados que un log puede traer, por tipo de sync. La lista vieja era la de
 * `stock_sync` para los dos, así que en un `catalog_sync` el filtro no ofrecía
 * ninguno de sus estados reales: `price_unchanged` (2463 items de una corrida
 * medida), `variant_not_found` (723) ni `not_published` (251).
 */
const CATALOG_ITEM_STATUSES = [
  'created',
  'updated',
  'price_unchanged',
  'variant_not_found',
  'not_published',
  'no_price_set',
  'duplicate_sku',
  'invalid_quantity',
  'skipped',
  'failed',
] as const;

const STOCK_ITEM_STATUSES = [
  'updated',
  'not_found',
  'duplicate_sku',
  'invalid_quantity',
  'skipped',
  'failed',
] as const;

const TONE_CLASS = {
  default: 'text-ui-fg-base',
  muted: 'text-ui-fg-subtle',
  error: 'text-ui-fg-error',
} as const;

/**
 * Detalle de una sincronización: cabecera con estado/resumen (+ barra de
 * progreso y poll mientras corre) y tabla paginada del detalle por SKU con
 * filtro por resultado y búsqueda exacta de SKU.
 */
const ErpLogDetailPage = () => {
  const { t, i18n } = useTranslation('erp');
  useErpTranslationsReady(i18n);
  const { id } = useParams<{ id: string }>();

  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [skuSearch, setSkuSearch] = useState('');
  /**
   * El item abierto en el drawer. Se guarda el OBJETO y no el id porque la tabla
   * se repuebla sola mientras la corrida está viva (`refetchInterval`), y buscar
   * por id dejaría el drawer en blanco justo cuando cambia de página.
   */
  const [openItem, setOpenItem] = useState<ErpSyncLogItem | null>(null);

  const { data: logData } = useErpSyncLog(id, { refetchInterval: 3000 });
  const log = logData?.sync_log ?? null;
  const isRunning = log?.status === 'running';

  const { data: itemsData, isPending } = useErpSyncLogItems(
    id,
    {
      status: statusFilter === ALL ? undefined : statusFilter,
      entity_id: skuSearch.trim() || undefined,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    },
    { refetchInterval: isRunning ? 5000 : false }
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('entity_id', {
        header: t('COL_SKU'),
        cell: ({ getValue }) => (
          <Text size="small" weight="plus">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor('status', {
        header: t('COL_ITEM_STATUS'),
        cell: ({ getValue }) => (
          <ErpStatusBadge status={getValue()} label={t(statusLabelKey(getValue()))} />
        ),
      }),
      columnHelper.display({
        id: 'detail',
        header: t('COL_ITEM_DETAIL'),
        cell: ({ row }) => (
          // Dos líneas y corta: el resumen de un item de catálogo con precios y
          // price lists no entra en una, y el resto está a un clic en el drawer.
          <Text size="small" className="line-clamp-2 text-ui-fg-subtle">
            {summarizeItemPayload(row.original.response_payload)}
          </Text>
        ),
      }),
      columnHelper.accessor('error', {
        header: t('COL_ERROR'),
        cell: ({ getValue }) => (
          <Text size="small" className="line-clamp-2 text-ui-fg-error">
            {getValue() ?? ''}
          </Text>
        ),
      }),
    ],
    [t]
  );

  const table = useDataTable({
    columns,
    data: itemsData?.items ?? [],
    getRowId: (row) => row.id,
    rowCount: itemsData?.count ?? 0,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    /**
     * OJO CON EL SEGUNDO ARGUMENTO. El tipo de `@medusajs/ui` 4.2.0 lo declara
     * `row: TData`, pero la implementación pasa el `Row` de TanStack:
     *
     *     onClick: (e) => instance.onRowClick?.call(instance, e, row)
     *
     * sobre `getRowModel().rows` (`data-table-table.js`). O sea que acá llega
     * `{ id, index, original, … }` y NO el item. El tipo MIENTE, así que `tsc`
     * pasa limpio y el error aparece recién en runtime: `row.status` es
     * undefined, `statusLabelKey` le hacía `.toUpperCase()` y se llevaba la
     * PANTALLA ENTERA (`Cannot read properties of undefined`).
     *
     * Se acepta cualquiera de las dos formas por si una versión futura de
     * `@medusajs/ui` hace honor a su propio tipo.
     */
    onRowClick: (_event, row) => {
      const candidate = row as ErpSyncLogItem & { original?: ErpSyncLogItem };
      setOpenItem(candidate.original ?? candidate);
    },
  });

  const summary = log?.summary ?? null;
  const isCatalog = log?.type === 'catalog_sync';
  // El total se llama distinto según el tipo: el catálogo cuenta filas del ERP,
  // el stock cuenta SKUs de Medusa.
  const totalUnits = (isCatalog ? summary?.total_erp_rows : summary?.total_skus) ?? 0;
  const progressPct =
    totalUnits > 0 ? Math.min(100, Math.round(((summary?.processed ?? 0) / totalUnits) * 100)) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading>{t('LOG_DETAIL_TITLE')}</Heading>
          {log ? <ErpStatusBadge status={log.status} label={t(statusLabelKey(log.status))} /> : null}
        </div>
        {log ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_STARTED')}: {formatDateTime(log.started_at)}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_TRIGGER')}: {log.trigger === 'manual' ? t('TRIGGER_MANUAL') : t('TRIGGER_CRON')}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {t('FIELD_PROVIDER')}: {log.provider}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {t('COL_DURATION')}: {formatDuration(summary?.duration_ms)}
              </Text>
            </div>
            {isRunning && totalUnits > 0 ? (
              <div className="flex flex-col gap-1">
                <Text size="small">
                  {t('LOG_PROGRESS', { processed: summary?.processed ?? 0, total: totalUnits })}
                </Text>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
                  <div
                    className="h-full bg-ui-fg-interactive transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}
            {summary && isCatalog ? (
              <>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <Text size="small">
                    {t('SUMMARY_TOTAL')}: <b>{summary.total_erp_rows ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('SUMMARY_UPDATED')}: <b>{summary.updated ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_PRICE_UNCHANGED')}: <b>{summary.price_unchanged ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_CREATED')}: <b>{summary.created ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_VARIANT_NOT_FOUND')}: <b>{summary.variant_not_found ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_NO_PRICE_SET')}: <b>{summary.no_price_set ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_NOT_PUBLISHED')}: <b>{summary.not_published ?? 0}</b>
                  </Text>
                  <Text size="small">
                    {t('ST_FAILED')}: <b>{summary.failed ?? 0}</b>
                  </Text>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {summary.dry_run ? (
                    <Text size="small" weight="plus" className="text-ui-fg-interactive">
                      {t('CATALOG_DRY_RUN_TAG')}
                    </Text>
                  ) : null}
                  <Text size="small" className="text-ui-fg-subtle">
                    {t('CATALOG_LOG_MODE')}:{' '}
                    {summary.full_sweep ? t('CATALOG_MODE_FULL') : t('CATALOG_MODE_DELTA')}
                    {summary.since ? ` (${summary.since})` : ''}
                  </Text>
                  {summary.watermark ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('CFG_LAST_SYNCED_AT')}: {summary.watermark}
                    </Text>
                  ) : null}
                  {summary.price_lists?.length ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('CFG_PRICE_LISTS')}:{' '}
                      {summary.price_lists
                        .map((list) => `${list.title} (${list.zeus_index})`)
                        .join(', ')}
                    </Text>
                  ) : null}
                  {summary.reindexed_products ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('CATALOG_REINDEXED')}: {summary.reindexed_products}
                    </Text>
                  ) : null}
                  {/*
                    Los cambios de estado son lo más consecuente que hace el sync
                    (un producto despublicado deja de venderse), así que van a la
                    vista y no solo al payload de cada artículo.
                  */}
                  {summary.status_sync?.enabled ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('CATALOG_STATUS_SYNC')}: ↑
                      {summary.status_sync.published ?? summary.status_sync.planned_published ?? 0} / ↓
                      {summary.status_sync.unpublished ??
                        summary.status_sync.planned_unpublished ??
                        0}
                    </Text>
                  ) : null}
                  {summary.status_sync?.skipped_by_guard ? (
                    <Text size="small" weight="plus" className="text-ui-fg-error">
                      {t('CATALOG_STATUS_GUARD', { count: summary.status_sync.skipped_by_guard })}
                    </Text>
                  ) : null}
                </div>
                {summary.warnings?.length ? (
                  <div className="flex flex-col gap-1">
                    {summary.warnings.map((warning, index) => (
                      <Text key={index} size="small" className="text-ui-fg-muted">
                        {warning}
                      </Text>
                    ))}
                  </div>
                ) : null}
              </>
            ) : summary ? (
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <Text size="small">
                  {t('SUMMARY_TOTAL')}: <b>{summary.total_skus ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('SUMMARY_UPDATED')}: <b>{summary.updated ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('ST_NOT_FOUND')}: <b>{summary.not_found ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('ST_DUPLICATE_SKU')}: <b>{summary.duplicate_sku ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('ST_INVALID_QUANTITY')}: <b>{summary.invalid_quantity ?? 0}</b>
                </Text>
                <Text size="small">
                  {t('SUMMARY_SKIPPED')}: <b>{(summary.skipped_unchanged ?? 0) + (summary.skipped_other ?? 0)}</b>
                </Text>
                <Text size="small">
                  {t('ST_FAILED')}: <b>{summary.failed ?? 0}</b>
                </Text>
              </div>
            ) : null}
            {log.error?.message ? (
              <Text size="small" className="text-ui-fg-error">
                {log.error.message}
              </Text>
            ) : null}
            {summary?.location_warning ? (
              <Text size="small" className="text-ui-fg-muted">
                ⚠ {summary.location_warning}
              </Text>
            ) : null}
          </div>
        ) : null}
      </Container>

      <Container className="p-0">
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex flex-col gap-0.5">
              <Heading level="h2">{t('ITEMS_TITLE')}</Heading>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('ITEM_DRAWER_HINT')}
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Input
                size="small"
                placeholder={t('SEARCH_SKU')}
                value={skuSearch}
                onChange={(e) => {
                  setSkuSearch(e.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              />
              <div className="w-48">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                  size="small"
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>{t('FILTER_ALL')}</Select.Item>
                    {(isCatalog ? CATALOG_ITEM_STATUSES : STOCK_ITEM_STATUSES).map((status) => (
                      <Select.Item key={status} value={status}>
                        {t(statusLabelKey(status))}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            </div>
          </DataTable.Toolbar>
          <DataTable.Table
            emptyState={{
              empty: { heading: t('ITEMS_TITLE'), description: t('ITEMS_EMPTY') },
            }}
          />
          <DataTable.Pagination />
        </DataTable>
      </Container>

      {/*
        El drawer es el único lugar donde el payload se ve COMPLETO. La tabla
        recorta a dos líneas y la columna "Error" sólo tiene contenido cuando el
        item falló de verdad — el motivo de un item que no falló pero tampoco
        hizo nada (los 723 `variant_not_found` de un barrido, por ejemplo) vive
        en el payload y nunca tuvo dónde mostrarse.
      */}
      <Drawer open={Boolean(openItem)} onOpenChange={(open) => !open && setOpenItem(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t('ITEM_DRAWER_TITLE', { code: openItem?.entity_id ?? '' })}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-6 overflow-y-auto">
            {openItem ? (
              <>
                <div className="flex items-center gap-2">
                  <ErpStatusBadge
                    status={openItem.status}
                    label={t(statusLabelKey(openItem.status))}
                  />
                  <Text size="small" className="text-ui-fg-subtle">
                    {openItem.entity_type}
                  </Text>
                </div>

                {openItem.error ? (
                  <div className="rounded-lg bg-ui-bg-subtle p-3">
                    <Text size="small" weight="plus" className="text-ui-fg-error">
                      {t('COL_ERROR')}
                    </Text>
                    <Text size="small" className="whitespace-pre-wrap text-ui-fg-error">
                      {openItem.error}
                    </Text>
                  </div>
                ) : null}

                {describeItemPayload(openItem.response_payload).map((section) => (
                  <div key={section.title} className="flex flex-col gap-2">
                    <Text size="small" weight="plus">
                      {section.title}
                    </Text>
                    <div className="flex flex-col gap-1.5">
                      {section.fields.map((field) => (
                        <div
                          key={`${section.title}-${field.label}`}
                          className="flex flex-col gap-0.5 border-b border-ui-border-base pb-1.5 last:border-0"
                        >
                          <Text size="xsmall" className="text-ui-fg-muted">
                            {field.label}
                          </Text>
                          <Text
                            size="small"
                            className={`break-words ${TONE_CLASS[field.tone ?? 'default']}`}
                          >
                            {field.value}
                          </Text>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {openItem.response_payload || openItem.request_payload ? (
                  // El volcado crudo se queda: las formas del payload cambian con
                  // cada fase nueva del sync y el resumen siempre va un paso
                  // atrás. Sin esto, un campo nuevo es invisible hasta que
                  // alguien se acuerde de agregarlo acá.
                  <details className="flex flex-col gap-2">
                    <summary className="cursor-pointer text-ui-fg-muted txt-small">
                      {t('ITEM_RAW_PAYLOAD')}
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-ui-bg-subtle p-3 text-xs text-ui-fg-subtle">
                      {JSON.stringify(
                        openItem.request_payload
                          ? { request: openItem.request_payload, response: openItem.response_payload }
                          : openItem.response_payload,
                        null,
                        2
                      )}
                    </pre>
                  </details>
                ) : (
                  <Text size="small" className="text-ui-fg-muted">
                    {t('ITEM_NO_PAYLOAD')}
                  </Text>
                )}
              </>
            ) : null}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </div>
  );
};

export const handle = {
  breadcrumb: () => 'Detalle',
};

export default ErpLogDetailPage;
