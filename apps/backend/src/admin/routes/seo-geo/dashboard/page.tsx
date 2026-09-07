import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Container, Heading, Text, toast } from '@medusajs/ui';
import { useNavigate } from 'react-router-dom';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { auditStatusLabel, useCreateAudit, useSeoDashboard, type SeoAudit } from '../../../hooks/api/seo-geo';

const scoreColor = (n: number | null): string => {
  if (n === null) return 'text-ui-fg-muted';
  if (n >= 80) return 'text-ui-tag-green-text';
  if (n >= 50) return 'text-ui-tag-orange-text';
  return 'text-ui-tag-red-text';
};

const ScoreCard = ({ label, value }: { label: string; value: number | null }) => (
  <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
    <p className="text-ui-fg-subtle text-xs">{label}</p>
    <p className={`mt-1 text-3xl font-semibold ${scoreColor(value)}`}>{value === null ? '—' : `${Math.round(value)}`}</p>
  </div>
);

const StatusBadge = ({ status }: { status: SeoAudit['status'] }) => {
  const color = status === 'completed' ? 'green' : status === 'failed' ? 'red' : status === 'running' ? 'orange' : 'grey';
  return <Badge size="2xsmall" color={color as never}>{auditStatusLabel(status)}</Badge>;
};

const SeoDashboardPage = () => {
  const { data, isLoading } = useSeoDashboard();
  const createAudit = useCreateAudit();
  const navigate = useNavigate();

  const onNewAudit = async () => {
    try {
      const res = await createAudit.mutateAsync({ trigger: 'manual' });
      toast.success('Auditoría encolada. El motor la ejecutará en breve.');
      navigate(`/seo-geo/auditorias/${res.audit.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo encolar la auditoría');
    }
  };

  const s = data?.findings_summary;

  return (
    /*
      Sin `divide-y`: la franja de tienda ya trae su propio `border-b` y el divisor
      del padre se le sumaba abajo — dos líneas de 1px pegadas se leen como una
      costura de 2px, no como un separador. Los hijos directos son dos —el header y
      UNA de las dos ramas del ternario—, así que el `border-b` del header repone la
      única línea que `divide-y` dibujaba.

      Y el borde va en el HEADER, no en la franja: `SiteScopeBar` devuelve `null` con
      0 ó 1 tienda (`site-scope-bar.tsx:110`), que es la instalación mayoritaria. Con
      el borde viviendo sólo en la franja, ahí el título quedaba pegado a los KPIs.
    */
    <Container className="p-0">
      <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
        <Heading level="h1">SEO &amp; GEO — Dashboard</Heading>
        <div className="flex items-center gap-3">
          <ExtensionVersion extension="seo-geo" />
          <Button size="small" onClick={onNewAudit} isLoading={createAudit.isPending}>
            Nueva auditoría
          </Button>
        </div>
      </div>

      {/*
        `scoped` con las DOS mitades verificadas, que es lo que el registro exige:

        LECTURA — `admin/seo-geo/dashboard` resuelve `siteChannelFilter(await
        siteFromRequest(req), undefined)` y lo spreadea en los DOS `listSeoAudits`
        del handler (`dashboard/route.ts:17-25`): la última completada —de la que
        salen SEO Score, AI Visibility y el resumen de hallazgos— y las diez
        recientes. No queda ningún KPI fuera del eje, que es justo lo que mantuvo
        `loyalty.dashboard` en `unscoped` durante un tiempo.

        ESCRITURA — "Nueva auditoría" pega a `POST admin/seo-geo/audits`, que estampa
        `siteDefaults(resolution, SEO_AUDIT_SITE_SCOPE)` y, sin `base_url`, resuelve
        el storefront de LA TIENDA (`audits/route.ts:70-84`). O sea que la auditoría
        que se lanza desde acá nace en la tienda que dice la franja y vuelve a
        aparecer en esta misma lista.

        Y el transporte, que el registro no cuenta: `hooks/api/seo-geo.tsx` va por
        `sdk.client.fetch`, que lleva `x-site-id` en `globalHeaders` (`lib/client.ts`).
        Es la mitad que faltaba en blog, loyalty y comments, cuyos hooks tienen su
        propio `fetchJson` sin el header.
      */}
      <SiteScopeBar screen="seo-geo.dashboard" />

      {isLoading ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-6 py-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ScoreCard label="SEO Score" value={data?.seo_score ?? null} />
            <ScoreCard label="AI Visibility" value={data?.ai_visibility_score ?? null} />
            <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
              <p className="text-ui-fg-subtle text-xs">Hallazgos críticos</p>
              <p className="mt-1 text-3xl font-semibold text-ui-tag-red-text">{s?.critical ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
              <p className="text-ui-fg-subtle text-xs">Hallazgos totales</p>
              <p className="mt-1 text-3xl font-semibold text-ui-fg-base">{s?.total ?? '—'}</p>
            </div>
          </div>

          {!data?.latest && (
            <Text className="text-ui-fg-subtle">
              Todavía no hay auditorías completadas. Ejecutá la primera con “Nueva auditoría”.
            </Text>
          )}

          {/*
            Un KPI en “—” no explica nada, y este es el estado en el que la extensión
            queda cuando los motores están apagados o el crawl no pudo entrar: la
            auditoría figura completada y el tablero se ve vacío sin decir por qué.
            El motivo lo escribe `run-audit.ts` en `error_summary.message`.
          */}
          {data?.latest && data.seo_score === null && (
            <Text className="text-ui-tag-orange-text">
              La última auditoría no pudo medirse.{' '}
              {String((data.latest.error_summary as { message?: string } | null)?.message ?? '')}
            </Text>
          )}

          <div>
            <Heading level="h2" className="mb-2 text-base">Auditorías recientes</Heading>
            {!data?.recent?.length ? (
              <Text className="text-ui-fg-subtle">Sin auditorías todavía.</Text>
            ) : (
              <div className="flex flex-col divide-y rounded-lg border border-ui-border-base">
                {data.recent.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/seo-geo/auditorias/${a.id}`)}
                    className="flex items-center justify-between px-4 py-3 text-left hover:bg-ui-bg-base-hover"
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={a.status} />
                      <span className="text-ui-fg-base text-sm">{a.base_url || 'storefront'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-ui-fg-subtle text-xs">
                      <span>{a.pages_crawled} págs.</span>
                      <span>SEO {a.seo_score ?? '—'}</span>
                      <span>{new Date(a.created_at).toLocaleString('es-AR')}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({ label: 'Dashboard' });
export const handle = { breadcrumb: () => 'Dashboard' };
export default SeoDashboardPage;
