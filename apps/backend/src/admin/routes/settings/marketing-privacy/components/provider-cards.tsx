import merchantLogo from './google-merchant.svg';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Container,
  Heading,
  Text,
  Label,
  Input,
  Switch,
  Drawer,
  Select,
  DataTable,
  createDataTableColumnHelper,
  useDataTable,
  toast,
} from '@medusajs/ui';
import { sdk } from '../../../../lib/client';
import { appSettingsSiteHeaders } from '../../../../lib/app-settings-scope';
import { useAppSettings, useUpdateAppSettings } from '../../../../hooks/api/app-settings';
import { usePrivacyTranslation } from '../i18n';
import {
  emptyMerchant,
  validateMerchant,
  type MerchantConfig,
} from '../../../../../modules/app-settings/descriptors/google-merchant';
import {
  validateClarity,
  type ClarityConfig,
} from '../../../../../modules/app-settings/descriptors/clarity';
import { clarityOverview, type ClarityReport } from '../../../../../lib/clarity-report';

const blankClarity: ClarityConfig = { enabled: false, projectId: '', consentCategory: 'analytics' };
const copy = {
  es: {
    project: 'ID del proyecto',
    token: 'Token de Data Export (vacío conserva el actual)',
    tokenSaved: 'Token configurado',
    removeToken: 'Borrar token',
    report: 'Consultar métricas',
    window:
      'Últimas 72 horas. Caché de 6 horas. Hasta 1.000 filas por métrica; Clarity no permite paginar el export.',
    reportError: 'No se pudo consultar. Revisá la configuración y el token.',
    rate: 'Clarity alcanzó el límite diario de consultas.',
    fetched: 'Consultado',
    domain: 'URL pública de la tienda, incluido país o prefijo',
    region: 'ID de región',
    channel: 'ID del canal de ventas',
    location: 'ID de ubicación de stock',
    brand: 'Marca predeterminada (opcional)',
    inspect: 'Verificar feed',
    feed: 'URL del feed',
    count: 'Variantes publicadas',
    skipped: 'Variantes omitidas',
    generated: 'Generado',
    feedHelp:
      'Usá esta URL como fuente programada en Google Merchant Center. Revisá los productos omitidos antes de conectar el catálogo. El feed se renueva al consultarlo, con una vigencia de 15 minutos.',
    selectStore: 'Seleccioná una tienda para verificar el feed.',
    reason: 'Motivo',
    noRows: 'Sin datos para esta métrica.',
    legacy: 'Sin configuración: se conserva el ID del entorno sólo en la tienda principal.',
  },
  en: {
    project: 'Project ID',
    token: 'Data Export token (blank preserves current value)',
    tokenSaved: 'Token configured',
    removeToken: 'Delete token',
    report: 'Fetch metrics',
    window:
      'Last 72 hours. Cached for 6 hours. Up to 1,000 rows per metric; Clarity exports do not support pagination.',
    reportError: 'Unable to fetch. Check the configuration and token.',
    rate: 'Clarity daily request limit reached.',
    fetched: 'Fetched',
    domain: 'Public storefront URL, including country or prefix',
    region: 'Region ID',
    channel: 'Sales channel ID',
    location: 'Stock location ID',
    brand: 'Default brand (optional)',
    inspect: 'Check feed',
    feed: 'Feed URL',
    count: 'Published variants',
    skipped: 'Skipped variants',
    generated: 'Generated',
    feedHelp:
      'Add this URL as a scheduled data source in Google Merchant Center. Review skipped products before connecting the catalog. The feed refreshes on request and remains valid for 15 minutes.',
    selectStore: 'Select a store to check the feed.',
    reason: 'Reason',
    noRows: 'No data for this metric.',
    legacy: 'Not configured: the environment ID is preserved for the main store only.',
  },
};

export function ProviderCard({
  kind,
  siteId,
}: {
  kind: 'clarity' | 'merchant';
  siteId: string | null;
}) {
  const { t, lang } = usePrivacyTranslation();
  const c = copy[lang];
  const namespace = kind === 'clarity' ? 'extension:clarity' : 'extension:google-merchant';
  const query = useAppSettings(namespace, siteId);
  const mutation = useUpdateAppSettings(siteId);
  const current = query.data?.settings.find((s) => s.key === 'CONFIG')?.value as
    | ClarityConfig
    | MerchantConfig
    | undefined;
  const tokenState = query.data?.settings.find((s) => s.key === 'EXPORT_TOKEN');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ClarityConfig | MerchantConfig>(
    kind === 'clarity' ? blankClarity : emptyMerchant
  );
  const report = useQuery({
    queryKey: [
      'marketing-provider-report',
      kind,
      siteId,
      JSON.stringify(current),
      tokenState?.updated_at,
    ],
    enabled: false,
    retry: false,
    queryFn: () =>
      sdk.client.fetch<any>(`/admin/marketing-privacy/${kind}`, {
        headers: appSettingsSiteHeaders(siteId),
      }),
  });
  const title = kind === 'clarity' ? 'Microsoft Clarity' : 'Google Merchant Center';
  const save = async () => {
    const invalid = kind === 'clarity' ? validateClarity(draft) : validateMerchant(draft);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    try {
      await mutation.mutateAsync({
        namespace,
        values: { CONFIG: draft },
      });
      setOpen(false);
      toast.success(t('saved'));
    } catch {
      toast.error(t('failed'));
    }
  };
  if (query.isPending)
    return (
      <Container>
        <Text>{t('loading')}</Text>
      </Container>
    );
  if (query.isError)
    return (
      <Container>
        <Text>{t('error')}</Text>
        <Button onClick={() => query.refetch()}>{t('manage')}</Button>
      </Container>
    );
  return (
    <Container className="flex flex-col gap-3">
      <div className="flex items-center gap-3">{kind === 'merchant' && <img src={merchantLogo} alt="" className="size-8" />}<Heading level="h2">{title}</Heading></div>
      <Text>
        {!current && kind === 'clarity' ? c.legacy : t(current?.enabled ? 'active' : 'inactive')}
      </Text>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setDraft(
              structuredClone(current ?? (kind === 'clarity' ? blankClarity : emptyMerchant))
            );
            setOpen(true);
          }}
        >
          {t('edit')}
        </Button>
        <Button
          variant="secondary"
          disabled={!current?.enabled || report.isFetching}
          onClick={() => report.refetch()}
        >
          {kind === 'clarity' ? c.report : c.inspect}
        </Button>
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        {kind === 'clarity' ? c.window : c.feedHelp}
      </Text>
      {report.isFetching && <Text>{t('loading')}</Text>}
      {report.isError && (
        <Text role="alert">{kind === 'merchant' && !siteId ? c.selectStore : c.reportError}</Text>
      )}
      {report.data && kind === 'clarity' && <ClarityResults report={report.data} />}
      {report.data && kind === 'merchant' && (
        <>
          <Text>
            {c.count}: {report.data.count} · {c.skipped}: {report.data.skippedCount}
          </Text>
          <Text>
            {c.generated}: {report.data.generatedAt} · {report.data.currency}
          </Text>
          <Label htmlFor="merchant-feed-url">{c.feed}</Label>
          <Input
            id="merchant-feed-url"
            readOnly
            value={new URL(report.data.feedPath, window.location.origin).href}
            onFocus={(e) => e.target.select()}
          />
          <Rows rows={report.data.skipped} />
        </>
      )}
      <Drawer
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending) {
            setOpen(value);
          }
        }}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{title}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
            <Label className="flex items-center justify-between">
              {t('enabled')}
              <Switch
                checked={draft.enabled}
                onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
              />
            </Label>
            {kind === 'clarity' ? (
              <>
                <Label htmlFor="clarity-project">{c.project}</Label>
                <Input
                  id="clarity-project"
                  value={(draft as ClarityConfig).projectId}
                  onChange={(e) =>
                    setDraft({ ...draft, projectId: e.target.value } as ClarityConfig)
                  }
                />
                <Text>
                  {t('consentCategory')}: {t('analytics')}
                </Text>

              </>
            ) : (
              (
                ['storefrontUrl', 'regionId', 'salesChannelId', 'stockLocationId', 'brand'] as const
              ).map((key, index) => (
                <div key={key} className="flex flex-col gap-2">
                  <Label htmlFor={`merchant-${key}`}>
                    {[c.domain, c.region, c.channel, c.location, c.brand][index]}
                  </Label>
                  <Input
                    id={`merchant-${key}`}
                    value={(draft as MerchantConfig)[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value } as MerchantConfig)
                    }
                  />
                </div>
              ))
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => {
                setOpen(false);
              }}
            >
              {t('cancel')}
            </Button>
            <Button isLoading={mutation.isPending} onClick={save}>
              {t('save')}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  );
}
function ClarityResults({ report }: { report: ClarityReport }) {
  const { lang } = usePrivacyTranslation();
  const c = copy[lang];
  const [selected, setSelected] = useState('');
  const metric = report.metrics.find((m) => m.name === selected) ?? report.metrics[0];
  const overview = clarityOverview(report.metrics);
  if (report.status !== 'success')
    return <Text role="alert">{report.status === 'rate_limited' ? c.rate : c.reportError}</Text>;
  return (
    <>
      <Text>
        {c.fetched}: {report.fetchedAt}
      </Text>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [lang === 'es' ? 'Sesiones sin bots' : 'Sessions excluding bots', overview.sessions],
          [lang === 'es' ? 'Páginas por sesión' : 'Pages per session', overview.pagesPerSession],
          [lang === 'es' ? 'Profundidad de scroll (%)' : 'Scroll depth (%)', overview.scrollDepth],
          [lang === 'es' ? 'Tiempo activo (s)' : 'Active time (s)', overview.activeTimeSeconds],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-ui-border-base p-3">
            <Text size="small" className="text-ui-fg-subtle">
              {label}
            </Text>
            <Heading level="h3">{value ?? '—'}</Heading>
          </div>
        ))}
      </div>
      {metric ? (
        <>
          <Select value={metric.name} onValueChange={setSelected}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {report.metrics.map((m) => (
                <Select.Item key={m.name} value={m.name}>
                  {m.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Rows key={metric.name} rows={metric.rows} />
        </>
      ) : (
        <Text>{c.noRows}</Text>
      )}
    </>
  );
}
function Rows({ rows }: { rows: Array<Record<string, string | number>> }) {
  const helper = createDataTableColumnHelper<Record<string, string | number>>();
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const table = useDataTable({
    data: rows.slice(
      pagination.pageIndex * pagination.pageSize,
      (pagination.pageIndex + 1) * pagination.pageSize
    ),
    columns: keys.map((key) =>
      helper.display({ id: key, header: key, cell: ({ row }) => String(row.original[key] ?? '—') })
    ),
    getRowId: (_row, index) => String(index),
    rowCount: rows.length,
    pagination: { state: pagination, onPaginationChange: setPagination },
  });
  return (
    <DataTable instance={table}>
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable>
  );
}
