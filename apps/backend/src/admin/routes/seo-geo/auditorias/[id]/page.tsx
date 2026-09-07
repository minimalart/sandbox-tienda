import { Badge, Button, Container, Heading, Table, Text, toast } from '@medusajs/ui';
import { useParams } from 'react-router-dom';
import {
  auditPhaseLabel,
  auditStatusLabel,
  findingTarget,
  engineLabel,
  findingLabel as label,
  severityColor,
  severityLabel,
  useAudit,
  useAuditAction,
  type SeoFinding,
} from '../../../../hooks/api/seo-geo';


/** La auditoría cerró bien pero su score no es medible (ver `run-audit.ts` §5). */
const unscored = (a: { status: string; error_summary?: unknown }): boolean =>
  a.status !== 'failed' && Boolean((a.error_summary as { unscored?: boolean } | null)?.unscored);

const statusColor = (s: string) =>
  s === 'completed' ? 'green' : s === 'failed' ? 'red' : s === 'cancelled' ? 'grey' : s === 'paused' ? 'blue' : 'orange';

/**
 * SIN franja de tienda, y acá no es por deuda del backend: las cuatro rutas que usa
 * —el GET del detalle y los tres verbos de ciclo de vida— corren `assertIdInSite` con
 * `SEO_AUDIT_SITE_SCOPE` antes de tocar nada, así que la auditoría que se ve es de la
 * tienda activa por construcción.
 *
 * Es una vista de DETALLE de un registro que YA pertenece a una tienda, y ahí un
 * selector no filtra: reasigna el contexto debajo de un registro que no se mueve. El
 * comportamiento real sería cambiar de tienda y recibir un 404 —`assertIdInSite`
 * responde 404 y no 403 justamente para no confirmar que el id existe en otra tienda—,
 * o sea un control cuyo único efecto visible es vaciar la pantalla que se estaba
 * mirando. El eje se elige en el listado, que es donde hay algo que recortar.
 *
 * Por eso tampoco entra en `SCREEN_SITE_SCOPE`: ese registro contesta "¿esta pantalla
 * filtra?", y una pantalla de un solo registro no filtra nada. Y por eso conserva su
 * `divide-y`: sin franja no hay `border-b` que se le sume, así que no hay costura que
 * reponer.
 */
const AuditDetailPage = () => {
  const { id = '' } = useParams();
  const { data, isLoading } = useAudit(id);
  const audit = data?.audit;

  const cancel = useAuditAction('cancel');
  const pause = useAuditAction('pause');
  const resume = useAuditAction('resume');
  const busy = cancel.isPending || pause.isPending || resume.isPending;

  const act = (m: ReturnType<typeof useAuditAction>, ok: string) =>
    m.mutateAsync(id).then(() => toast.success(ok)).catch((e) => toast.error(e instanceof Error ? e.message : 'Acción fallida'));

  const canPause = audit && ['queued', 'running'].includes(audit.status);
  const canCancel = audit && ['queued', 'running', 'paused'].includes(audit.status);
  const canResume = audit && ['paused', 'cancelled', 'failed'].includes(audit.status);

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Auditoría</Heading>
        <div className="flex items-center gap-2">
          {audit && (
            <Badge size="2xsmall" color={statusColor(audit.status) as never}>
              {auditStatusLabel(audit.status)}
              {audit.current_phase && audit.status === 'running' ? ` · ${auditPhaseLabel(audit.current_phase)}` : ''}
            </Badge>
          )}
          {canPause && (
            <Button size="small" variant="secondary" disabled={busy} onClick={() => act(pause, 'Auditoría pausada')}>
              Pausar
            </Button>
          )}
          {canResume && (
            <Button size="small" variant="secondary" disabled={busy} onClick={() => act(resume, 'Auditoría re-encolada')}>
              Volver a correr
            </Button>
          )}
          {canCancel && (
            <Button size="small" variant="danger" disabled={busy} onClick={() => act(cancel, 'Auditoría cancelada')}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {isLoading || !audit ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-6 py-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="SEO Score" value={audit.seo_score} />
            <Kpi label="AI Visibility" value={audit.ai_visibility_score} />
            <Kpi label="Páginas" value={audit.pages_crawled} raw />
            <Kpi label="Hallazgos" value={data?.findings_count ?? 0} raw />
          </div>

          {audit.status === 'running' && (
            <Text className="text-ui-fg-subtle">
              Crawleando… {audit.pages_crawled}/{audit.pages_total} páginas. Esta vista se actualiza sola.
            </Text>
          )}
          {/*
            `error_summary` ya no es exclusivo de las fallidas: una auditoría que corrió
            entera pero no pudo MEDIR nada (motores apagados, sitio gateado, crawl de una
            sola página) termina `completed` con el score en `null` y el motivo acá. Ese es
            justamente el caso que antes se publicaba como un 100 sin explicación, así que
            condicionar el cartel al estado `failed` lo dejaría invisible.
          */}
          {audit.error_summary && (
            <Text className={unscored(audit) ? 'text-ui-tag-orange-text' : 'text-ui-tag-red-text'}>
              {unscored(audit) ? 'Sin score: ' : 'Error: '}
              {String((audit.error_summary as { message?: string }).message ?? 'desconocido')}
            </Text>
          )}

          <div>
            <Heading level="h2" className="mb-2 text-base">Hallazgos</Heading>
            {!data?.findings?.length ? (
              <Text className="text-ui-fg-subtle">Sin hallazgos.</Text>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Severidad</Table.HeaderCell>
                    <Table.HeaderCell>Motor</Table.HeaderCell>
                    <Table.HeaderCell>Hallazgo</Table.HeaderCell>
                    <Table.HeaderCell>Objetivo</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {data.findings.map((f) => (
                    <Table.Row key={f.id}>
                      <Table.Cell>
                        <Badge size="2xsmall" color={severityColor(f.severity) as never}>{severityLabel(f.severity)}</Badge>
                      </Table.Cell>
                      <Table.Cell>{engineLabel(f.engine)}</Table.Cell>
                      <Table.Cell>{label(f.type)}</Table.Cell>
                      <Table.Cell className="max-w-[320px] truncate text-ui-fg-subtle">{findingTarget(f)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </div>
        </div>
      )}
    </Container>
  );
};

const Kpi = ({ label, value, raw }: { label: string; value: number | null | undefined; raw?: boolean }) => (
  <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
    <p className="text-ui-fg-subtle text-xs">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-ui-fg-base">
      {value === null || value === undefined ? '—' : raw ? value : Math.round(value)}
    </p>
  </div>
);

export const handle = { breadcrumb: () => 'Detalle' };
export default AuditDetailPage;
