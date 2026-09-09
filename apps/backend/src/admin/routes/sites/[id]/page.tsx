import { ArrowPath, ArrowUpRightOnBox, ReceiptPercent } from '@medusajs/icons';
import { Badge, Button, Container, Heading, StatusBadge, Table, Text, toast } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import type { LoaderFunctionArgs, UIMatch } from 'react-router-dom';
import {
  useCreateDemoStorePromotions,
  useDemoStore,
  useDemoStoreImportJob,
  useRegionName,
  useRetryDemoStoreImport,
  useSalesChannelName,
  useStockLocationName,
  type AdminDemoStoreResponse,
  type ImportJob,
} from '../../../hooks/api';
import { useStorefrontBase } from '../../../hooks/use-storefront-base';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { sdk } from '../../../lib/client';
import { registerDemoStoresTranslations } from '../../../translations/demo-stores';
import {
  buildPublicUrlFrom,
  formatPublicUrlFrom,
  SITE_HOST_SUFFIX,
  STATUS_COLOR,
  STATUS_LABEL_KEY,
} from '../lib';

const SOURCE_LABEL: Record<string, string> = {
  woocommerce: 'WooCommerce',
  vtex: 'VTEX',
  shopify: 'Shopify',
  sales_channel: 'Sales channel',
  // La tienda principal: el catálogo ya es de esta instancia, no se importa.
  native: 'Catálogo propio',
};

const JOB_STATUS_COLOR: Record<string, 'green' | 'orange' | 'red' | 'grey' | 'blue'> = {
  pending: 'grey',
  running: 'orange',
  completed: 'green',
  failed: 'red',
};

/**
 * Label/value row. The value is kept on a single line and truncated with an
 * ellipsis; pass `title` (or rely on the value text) so the full content shows
 * on hover.
 */
const Row = ({
  label,
  children,
  title,
}: {
  label: string;
  children: React.ReactNode;
  title?: string;
}) => (
  <div className="flex items-center justify-between gap-x-4 py-1.5">
    <Text size="small" className="shrink-0 text-ui-fg-subtle">
      {label}
    </Text>
    <div className="min-w-0 truncate text-right text-sm" title={title}>
      {children}
    </div>
  </div>
);

/** A card section (widget) rendered directly on the page background. */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Container className="flex flex-col gap-y-1 p-6">
    <Text className="mb-2 font-medium">{title}</Text>
    {children}
  </Container>
);

/** Monospace value that copies itself to the clipboard on click. */
const CopyText = ({ value }: { value: string }) => (
  <button
    type="button"
    onClick={() => navigator.clipboard?.writeText(value)}
    className="max-w-full truncate font-mono text-xs text-ui-fg-interactive"
    title={value}
  >
    {value}
  </button>
);

const Swatch = ({ color }: { color?: string }) =>
  color ? (
    <span className="inline-flex items-center gap-x-1.5">
      <span
        className="inline-block h-4 w-4 rounded border border-ui-border-base"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono text-xs">{color}</span>
    </span>
  ) : (
    <span className="text-ui-fg-muted">—</span>
  );

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatDuration = (ms?: number | null): string => {
  if (!ms || ms <= 0) return '-';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
};

const JOB_STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'JOB_STATUS_PENDING',
  running: 'JOB_STATUS_RUNNING',
  completed: 'JOB_STATUS_COMPLETED',
  failed: 'JOB_STATUS_FAILED',
};

const MAX_SUMMARY_CHARS = 20;

// Build the summary text in the active locale from the run_log's structured data
// (not the raw English event message). Falls back to the error message — known
// importer errors are already localized at the source.
type SummaryT = (key: string, opts?: Record<string, unknown>) => string;
const jobSummary = (job: ImportJob, t: SummaryT): string => {
  const events = job.run_log?.events ?? [];
  const error =
    job.error_log?.samples?.[0] ?? [...events].reverse().find((event) => event.level === 'error')?.message;
  if (error) return error;

  const done = [...events].reverse().find((event) => ['completed', 'persisted'].includes(event.stage));
  if (done?.data) {
    const data = done.data as Record<string, number>;
    return t('JOB_SUMMARY_DONE', {
      created: data.created ?? 0,
      linked: data.linked_existing ?? 0,
      failed: data.failed ?? 0,
    });
  }

  const fetched = [...events].reverse().find((event) => event.stage === 'fetched');
  const fetchedCount = fetched?.data?.fetched_products;
  if (typeof fetchedCount === 'number') return t('JOB_SUMMARY_FETCHED', { count: fetchedCount });

  return '-';
};

const DemoStoreDetail = () => {
  const { t, i18n } = useTranslation('demo-stores');
  registerDemoStoresTranslations(i18n);
  const { id = '' } = useParams();

  const { data } = useDemoStore(id);
  const demo = data?.demo_store;

  /**
   * La base la sirve el backend en runtime, no el build del admin.
   *
   * El bundle es el mismo para todas las instalaciones, así que en build no hay
   * forma de saber cuál es el dominio de esta: cuando se resolvía ahí, estos links
   * apuntaban al storefront de otra marca. Y es `base`, no `url`: `url` sería la
   * tienda ACTIVA y esta pantalla linkea a la del `[id]` de la URL.
   */
  const storefrontBase = useStorefrontBase();
  const publicUrl = (site: Parameters<typeof buildPublicUrlFrom>[0]) =>
    buildPublicUrlFrom(site, { baseUrl: storefrontBase, hostSuffix: SITE_HOST_SUFFIX });
  const publicUrlLabel = (site: Parameters<typeof formatPublicUrlFrom>[0]) =>
    formatPublicUrlFrom(site, { baseUrl: storefrontBase, hostSuffix: SITE_HOST_SUFFIX });

  const isImporting = demo?.status === 'importing' || demo?.status === 'provisioning';
  const { data: jobData } = useDemoStoreImportJob(id, {
    refetchInterval: isImporting ? 2000 : false,
  } as any);
  const job = jobData?.import_job ?? demo?.latest_import_job ?? null;

  const { mutate: retryImport, isPending: retrying } = useRetryDemoStoreImport(id, {
    onSuccess: () => toast.success(t('RETRY_STARTED')),
    onError: (err) => toast.error(t('RETRY_ERROR', { msg: err.message })),
  });

  const { mutate: createPromotions, isPending: creatingPromos } = useCreateDemoStorePromotions(id, {
    onSuccess: (data) =>
      toast.success(t('PROMOS_SUCCESS', { promos: data.promotions, products: data.promotedProducts })),
    onError: (err) => toast.error(t('PROMOS_ERROR', { msg: err.message })),
  });

  // Resolve the names behind the operational IDs so the config section reads
  // "Canal Depot Express" instead of "sc_01…". Falls back to the raw id below.
  const { data: scData } = useSalesChannelName(demo?.sales_channel_id);
  const { data: regionData } = useRegionName(demo?.region_id);
  const { data: stockLocationData } = useStockLocationName(demo?.stock_location_id);
  const { data: b2bScData } = useSalesChannelName(demo?.b2b_sales_channel_id);
  // Con origen interno, `source_url` es el ID del canal de origen: se resuelve su
  // nombre para no mostrar un `sc_01…` pelado.
  const isChannelSource = demo?.source_type === 'sales_channel';
  const { data: sourceScData } = useSalesChannelName(
    isChannelSource ? demo?.source_url : undefined,
  );

  if (!demo) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-subtle">…</Text>
      </Container>
    );
  }

  const total = job?.total_products ?? 0;
  const imported = job?.imported_products ?? 0;
  const linked = job?.linked_products ?? 0;
  const skipped = job?.skipped_products ?? 0;
  const failed = job?.failed_products ?? 0;
  const processed = imported + linked + skipped + failed;
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const theme = demo.theme ?? {};
  // Allow retry from any non-draft state, including a stuck 'importing'/'provisioning'
  // (a background import killed by a restart leaves the store stuck there). The
  // retry endpoint supersedes the orphaned job.
  const importInFlight = demo.status === 'importing' || demo.status === 'provisioning';
  /**
   * La tienda PRINCIPAL no importa catálogo (`source_type: 'native'`) y el backend
   * devuelve 409 en /retry, /promotions y /import-job. Mostrar esos controles sería
   * ofrecerle al usuario un error garantizado; mostrar el progreso y el historial de
   * import sería mostrar bloques vacíos para siempre.
   *
   * Lo que SÍ es editable en la principal: nombre, marca, contenido, home (Puck) y
   * los flags. Su gate NO se toca desde acá: va por Preferencias → Acceso, con scope
   * `store` (ver `modules/store-config/site-gate.ts`).
   */
  const isMain = Boolean(demo.is_main);
  const canRetry =
    !isMain && ['failed', 'ready', 'importing', 'provisioning'].includes(demo.status);
  const jobs = data?.import_jobs ?? [];

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex items-center justify-between p-6">
        <div className="flex items-center gap-x-3">
          <Heading>{demo.name}</Heading>
          {isMain && (
            <Badge size="2xsmall" color="purple">
              {t('BADGE_MAIN')}
            </Badge>
          )}
          <StatusBadge color={STATUS_COLOR[demo.status]}>
            {t(STATUS_LABEL_KEY[demo.status])}
          </StatusBadge>
        </div>
        <div className="flex items-center gap-x-2">
          {!isMain && demo.status === 'ready' && (
            <Button
              size="small"
              variant="secondary"
              isLoading={creatingPromos}
              onClick={() => createPromotions()}
            >
              <ReceiptPercent /> {t('ACTION_PROMOTIONS')}
            </Button>
          )}
          {canRetry && (
            <Button
              size="small"
              variant="secondary"
              isLoading={retrying}
              onClick={() => {
                if (importInFlight && !window.confirm(t('RETRY_CONFIRM_STUCK'))) return;
                retryImport();
              }}
            >
              <ArrowPath /> {t('ACTION_RETRY')}
            </Button>
          )}
          {demo.status === 'ready' && (
            <Button
              size="small"
              variant="secondary"
              onClick={() => window.open(publicUrl(demo), '_blank')}
            >
              <ArrowUpRightOnBox /> {t('DETAIL_OPEN')}
            </Button>
          )}
          {/*
            El Importador de catálogo no tiene pantalla propia: se OPERA desde acá
            —el botón de reintentar, la barra de progreso y el historial de abajo—,
            así que su ayuda cuelga de este header y no de `sites/settings`, que es
            la del ritmo de la importación (`multistore`).

            Es lo único que responde la pregunta que hace esta pantalla y que ningún
            texto de acá contesta: una tienda que dice "Importando" hace veinte
            minutos, ¿está viva o el job murió?
          */}
          <HelpDrawer slug="store-importer" />
        </div>
      </Container>

      {/* La principal se edita como cualquier otra tienda (nombre, marca, contenido,
          home, flags), pero le faltan bloques y acciones a propósito. Sin explicarlo la
          pantalla se lee como incompleta o rota, así que se dice por qué. */}
      {isMain && (
        <Container className="p-4">
          <Text size="small" className="text-ui-fg-subtle">
            {t('MAIN_HINT')}
          </Text>
        </Container>
      )}

      {/* Import progress + historial. Ocultos en la principal: no importa catálogo,
          así que serían dos bloques vacíos permanentes. */}
      {!isMain && (
      <>
      <Container className="flex flex-col gap-y-2 p-6">
        <Text className="font-medium">{t('DETAIL_IMPORT_PROGRESS')}</Text>
        <div className="h-2 w-full overflow-hidden rounded bg-ui-bg-subtle">
          <div
            className="h-full bg-ui-fg-interactive transition-all"
            style={{ width: `${demo.status === 'ready' ? 100 : pct}%` }}
          />
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t('DETAIL_IMPORT_COUNTS', { imported, linked, skipped, failed, total })}
        </Text>
      </Container>

      <Container className="flex flex-col p-6">
        <Text className="mb-2 font-medium">{t('DETAIL_IMPORT_HISTORY')}</Text>
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('DETAIL_JOB_DATE')}</Table.HeaderCell>
                <Table.HeaderCell>{t('DETAIL_JOB_STATUS')}</Table.HeaderCell>
                <Table.HeaderCell>{t('DETAIL_JOB_DURATION')}</Table.HeaderCell>
                <Table.HeaderCell>{t('DETAIL_JOB_TARGET')}</Table.HeaderCell>
                <Table.HeaderCell>{t('DETAIL_JOB_FETCHED')}</Table.HeaderCell>
                <Table.HeaderCell>{t('DETAIL_JOB_CREATED')}</Table.HeaderCell>
                <Table.HeaderCell>{t('DETAIL_JOB_LINKED')}</Table.HeaderCell>
                <Table.HeaderCell>{t('DETAIL_JOB_SKIPPED')}</Table.HeaderCell>
                <Table.HeaderCell>{t('DETAIL_JOB_FAILED')}</Table.HeaderCell>
                <Table.HeaderCell>{t('DETAIL_JOB_SUMMARY')}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {jobs.map((item) => {
                const summary = jobSummary(item, t);
                const truncated =
                  summary.length > MAX_SUMMARY_CHARS
                    ? `${summary.slice(0, MAX_SUMMARY_CHARS)}…`
                    : summary;
                return (
                  <Table.Row key={item.id}>
                    <Table.Cell>{formatDateTime(item.started_at ?? item.created_at)}</Table.Cell>
                    <Table.Cell>
                      <StatusBadge color={JOB_STATUS_COLOR[item.status] ?? 'grey'}>
                        {t(JOB_STATUS_LABEL_KEY[item.status] ?? 'JOB_STATUS_PENDING')}
                      </StatusBadge>
                    </Table.Cell>
                    <Table.Cell>{formatDuration(item.duration_ms)}</Table.Cell>
                    <Table.Cell>{item.target_count ?? t('DETAIL_JOB_TARGET_ALL')}</Table.Cell>
                    <Table.Cell>{item.fetched_products ?? item.total_products ?? 0}</Table.Cell>
                    <Table.Cell>{item.imported_products ?? 0}</Table.Cell>
                    <Table.Cell>{item.linked_products ?? 0}</Table.Cell>
                    <Table.Cell>{item.skipped_products ?? 0}</Table.Cell>
                    <Table.Cell>{item.failed_products ?? 0}</Table.Cell>
                    <Table.Cell>
                      <span className="block" title={summary}>
                        {truncated}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      </Container>
      </>
      )}

      {/* Info en dos columnas (widgets sobre el fondo, como la página de producto):
          a la izquierda datos generales + origen del catálogo; a la derecha
          branding + configuración operativa + B2B. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          {/* General */}
          <Section title={t('DETAIL_SECTION_GENERAL')}>
            <Row label={t('FIELD_SLUG')} title={demo.slug}>
              {demo.slug}
            </Row>
            <Row label={t('DETAIL_PUBLIC_URL')} title={publicUrlLabel(demo)}>
              <a
                href={publicUrl(demo)}
                target="_blank"
                rel="noreferrer"
                className="text-ui-fg-interactive"
              >
                {publicUrlLabel(demo)}
              </a>
            </Row>
            <Row label={t('FIELD_COUNTRY')}>{demo.country_code.toUpperCase()}</Row>
            <Row label={t('FIELD_CURRENCY')}>{demo.currency_code.toUpperCase()}</Row>
            <Row label={t('FIELD_LOCALE')}>{demo.locale}</Row>
            <Row label={t('COLUMN_TEMPLATE')} title={demo.template_code}>
              <span className="capitalize">{demo.template_code}</span>
            </Row>
          </Section>

          {/* Source. Oculto en la principal: su catálogo ya es de esta instancia
              (`source_type: 'native'`), no viene de ninguna parte. */}
          {!isMain && (
          <Section title={t('DETAIL_SECTION_SOURCE')}>
            <Row label={t('FIELD_SOURCE_TYPE')}>
              {SOURCE_LABEL[demo.source_type] ?? demo.source_type}
            </Row>
            <Row label={t('FIELD_TARGET_COUNT')}>
              {demo.target_count ?? t('DETAIL_JOB_TARGET_ALL')}
            </Row>
            {isChannelSource ? (
              // No es una URL: mostrarlo como link daría un href roto.
              <Row label={t('FIELD_SOURCE_CHANNEL')} title={demo.source_url}>
                {sourceScData?.sales_channel?.name ?? demo.source_url}
              </Row>
            ) : (
              <Row label={t('FIELD_SOURCE_URL')} title={demo.source_url}>
                <a
                  href={demo.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-fg-interactive"
                >
                  {demo.source_url}
                </a>
              </Row>
            )}
          </Section>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {/* Branding */}
          <Section title={t('DETAIL_SECTION_BRANDING')}>
            <Row label={t('FIELD_PRIMARY_COLOR')}>
              <Swatch color={theme.primary_color} />
            </Row>
            <Row label={t('FIELD_SECONDARY_COLOR')}>
              <Swatch color={theme.secondary_color} />
            </Row>
            <Row label={t('FIELD_ACCENT_COLOR')}>
              <Swatch color={theme.accent_color} />
            </Row>
            <Row label={t('FIELD_TYPOGRAPHY')} title={theme.typography || 'Inter'}>
              {theme.typography || 'Inter'}
            </Row>
            <Row label={t('FIELD_LOGO')} title={theme.logo}>
              {theme.logo ? (
                <a href={theme.logo} target="_blank" rel="noreferrer" className="text-ui-fg-interactive">
                  {theme.logo}
                </a>
              ) : (
                <span className="text-ui-fg-muted">—</span>
              )}
            </Row>
            <Row label={t('FIELD_MOBILE_LOGO')} title={theme.mobile_logo}>
              {theme.mobile_logo ? (
                <a href={theme.mobile_logo} target="_blank" rel="noreferrer" className="text-ui-fg-interactive">
                  {theme.mobile_logo}
                </a>
              ) : (
                <span className="text-ui-fg-muted">—</span>
              )}
            </Row>
            <Row label={t('FIELD_FAVICON')} title={theme.favicon}>
              {theme.favicon ? (
                <a href={theme.favicon} target="_blank" rel="noreferrer" className="text-ui-fg-interactive">
                  {theme.favicon}
                </a>
              ) : (
                <span className="text-ui-fg-muted">—</span>
              )}
            </Row>
          </Section>

          {/* Operational config */}
          <Section title={t('DETAIL_SECTION_CONFIG')}>
            <Row
              label={t('DETAIL_SALES_CHANNEL')}
              title={scData?.sales_channel?.name ?? demo.sales_channel_id ?? undefined}
            >
              {scData?.sales_channel?.name ? (
                <span>{scData.sales_channel.name}</span>
              ) : (
                <span className="text-ui-fg-muted">{demo.sales_channel_id ?? '—'}</span>
              )}
            </Row>
            <Row
              label={t('DETAIL_REGION')}
              title={regionData?.region?.name ?? demo.region_id ?? undefined}
            >
              {regionData?.region?.name ? (
                <span>{regionData.region.name}</span>
              ) : (
                <span className="text-ui-fg-muted">{demo.region_id ?? '—'}</span>
              )}
            </Row>
            <Row
              label={t('DETAIL_STOCK_LOCATION')}
              title={stockLocationData?.stock_location?.name ?? demo.stock_location_id ?? undefined}
            >
              {stockLocationData?.stock_location?.name ? (
                <span>{stockLocationData.stock_location.name}</span>
              ) : (
                <span className="text-ui-fg-muted">{demo.stock_location_id ?? '—'}</span>
              )}
            </Row>
          </Section>

          {/* B2B / Mayorista */}
          {demo.b2b_enabled && (
            <Section title={t('B2B_SECTION_TITLE')}>
              <Row label={t('B2B_PORTAL_URL')} title={`${publicUrlLabel(demo).replace(/\/$/, '')}/b2b`}>
                <a
                  href={`${publicUrl(demo)}/b2b`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-fg-interactive"
                >
                  {publicUrlLabel(demo).replace(/\/$/, '')}/b2b
                </a>
              </Row>
              <Row label={t('B2B_TEST_EMAIL')} title={demo.b2b_test_email ?? undefined}>
                {demo.b2b_test_email ? (
                  <CopyText value={demo.b2b_test_email} />
                ) : (
                  <span className="text-ui-fg-muted">—</span>
                )}
              </Row>
              <Row label={t('B2B_TEST_PASSWORD')} title={demo.b2b_test_password ?? undefined}>
                {demo.b2b_test_password ? (
                  <CopyText value={demo.b2b_test_password} />
                ) : (
                  <span className="text-ui-fg-muted">{t('B2B_EXISTING_ACCOUNT')}</span>
                )}
              </Row>
              <Row
                label={t('DETAIL_SALES_CHANNEL')}
                title={b2bScData?.sales_channel?.name ?? demo.b2b_sales_channel_id ?? undefined}
              >
                {b2bScData?.sales_channel?.name ? (
                  <span>{b2bScData.sales_channel.name}</span>
                ) : (
                  <span className="text-ui-fg-muted">{demo.b2b_sales_channel_id ?? '—'}</span>
                )}
              </Row>
              <Row label={t('B2B_PRICE_LIST')} title={demo.b2b_price_list_id ?? undefined}>
                <span className="font-mono text-xs">{demo.b2b_price_list_id ?? '—'}</span>
              </Row>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
};

type DetailLoaderData = { breadcrumb: string };

// Resolve the store name for the breadcrumb so it reads "Tiendas › <name>"
// instead of the raw id. Falls back to the id if the fetch fails.
export async function loader({ params }: LoaderFunctionArgs): Promise<DetailLoaderData> {
  const id = params.id ?? '';
  try {
    const { demo_store } = await sdk.client.fetch<AdminDemoStoreResponse>(`/admin/sites/${id}`, {
      method: 'GET',
    });
    return { breadcrumb: demo_store?.name ?? id };
  } catch {
    return { breadcrumb: id };
  }
}

export const handle = {
  breadcrumb: ({ data }: UIMatch<DetailLoaderData>) => data?.breadcrumb ?? '',
};

export default DemoStoreDetail;
