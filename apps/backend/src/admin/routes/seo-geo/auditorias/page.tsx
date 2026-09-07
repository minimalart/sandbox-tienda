import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Container, Heading, Table, Text, toast } from '@medusajs/ui';
import { useNavigate } from 'react-router-dom';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { auditStatusLabel, useAudits, useCreateAudit, type SeoAudit } from '../../../hooks/api/seo-geo';

const statusColor = (status: SeoAudit['status']) =>
  status === 'completed' ? 'green' : status === 'failed' ? 'red' : status === 'running' ? 'orange' : 'grey';

const AuditoriasPage = () => {
  const { data, isLoading } = useAudits({ limit: 50 });
  const createAudit = useCreateAudit();
  const navigate = useNavigate();

  const onNewAudit = async () => {
    try {
      const res = await createAudit.mutateAsync({ trigger: 'manual' });
      toast.success('Auditoría encolada.');
      navigate(`/seo-geo/auditorias/${res.audit.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo encolar la auditoría');
    }
  };

  return (
    /*
      Sin `divide-y`, misma razón que en el tablero: la franja ya trae `border-b` y el
      divisor del padre se le sumaba abajo (costura de 2px). Los hijos son dos —header
      y UNA rama del ternario—, así que el `border-b` explícito del header repone la
      única línea que había. Va en el header y no en la franja porque `SiteScopeBar`
      devuelve `null` con 0 ó 1 tienda y ahí el título quedaría pegado a la tabla.
    */
    <Container className="p-0">
      <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
        <Heading level="h1">Auditorías</Heading>
        <Button size="small" onClick={onNewAudit} isLoading={createAudit.isPending}>
          Nueva auditoría
        </Button>
      </div>

      {/*
        `scoped` por las dos mitades del MISMO endpoint, que es el caso más limpio de
        toda la extensión: `GET admin/seo-geo/audits` mete
        `siteChannelFilter(await siteFromRequest(req), …)` en los `filters` que van al
        `listAndCountSeoAudits` (`audits/route.ts:31-40`), y el `POST` hermano estampa
        `siteDefaults(resolution, SEO_AUDIT_SITE_SCOPE)` más el `base_url` de la tienda
        (`audits/route.ts:70-84`). Se lee y se crea en la misma capa.

        El descriptor filtra por LOS DOS canales de una tienda B2B (`channel_column`
        sobre `seo_audit.sales_channel_id`, `modules/seo-geo/site-scope.ts:11`), así
        que una auditoría del canal mayorista no desaparece del listado minorista.
      */}
      <SiteScopeBar screen="seo-geo.auditorias" />

      {isLoading ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        </div>
      ) : !data?.audits?.length ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Sin auditorías. Creá la primera.</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Estado</Table.HeaderCell>
              <Table.HeaderCell>URL</Table.HeaderCell>
              <Table.HeaderCell>Páginas</Table.HeaderCell>
              <Table.HeaderCell>SEO</Table.HeaderCell>
              <Table.HeaderCell>AI Vis.</Table.HeaderCell>
              <Table.HeaderCell>Fecha</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.audits.map((a) => (
              <Table.Row
                key={a.id}
                className="cursor-pointer"
                onClick={() => navigate(`/seo-geo/auditorias/${a.id}`)}
              >
                <Table.Cell>
                  <Badge size="2xsmall" color={statusColor(a.status) as never}>{auditStatusLabel(a.status)}</Badge>
                </Table.Cell>
                <Table.Cell className="max-w-[280px] truncate">{a.base_url || 'storefront'}</Table.Cell>
                <Table.Cell>{a.pages_crawled}</Table.Cell>
                <Table.Cell>{a.seo_score ?? '—'}</Table.Cell>
                <Table.Cell>{a.ai_visibility_score ?? '—'}</Table.Cell>
                <Table.Cell>{new Date(a.created_at).toLocaleString('es-AR')}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({ label: 'Auditorías' });
export const handle = { breadcrumb: () => 'Auditorías' };
export default AuditoriasPage;
