import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Container, Heading, Table, Text } from '@medusajs/ui';
import { useState } from 'react';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import {
  engineLabel,
  findingCount,
  findingLabel,
  severityColor,
  severityLabel,
  useFindings,
  type FindingSeverity,
  type SeoFinding,
} from '../../../hooks/api/seo-geo';

type SeverityFilter = 'all' | FindingSeverity;

/**
 * Agrupa hallazgos por tipo con conteo y la severidad/motor representativos.
 *
 * "Afectados" cuenta ENTIDADES, no filas. Los de catálogo y GEO son una sola fila que
 * ya trae adentro cuántos productos abarca (`details.count`), así que contar filas
 * mostraba `1` sobre 2.660 productos sin descripción — y lo dejaba último en una tabla
 * ordenada por afectados, que es exactamente al revés de lo que hay que atender.
 */
function groupByType(findings: SeoFinding[]) {
  const map = new Map<string, { type: string; severity: FindingSeverity; engine: string; count: number }>();
  for (const f of findings) {
    const weight = findingCount(f) ?? 1;
    const g = map.get(f.type);
    if (g) g.count += weight;
    else map.set(f.type, { type: f.type, severity: f.severity, engine: f.engine, count: weight });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

const HallazgosPage = () => {
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const query: Record<string, unknown> = { limit: 500 };
  if (severity !== 'all') query.severity = severity;
  const { data, isLoading } = useFindings(query);

  const groups = groupByType(data?.findings ?? []);

  return (
    /*
      Sin `divide-y`: la franja trae su propio `border-b` y el divisor del padre se le
      sumaba abajo (costura de 2px). Con dos hijos —header y UNA rama del ternario—, el
      `border-b` del header repone la única línea que dibujaba. Va en el header porque
      `SiteScopeBar` devuelve `null` con 0 ó 1 tienda.
    */
    <Container className="p-0">
      <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
        <Heading level="h1">Hallazgos</Heading>
        <div className="flex items-center gap-1">
          {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map((s) => (
            <Button
              key={s}
              size="small"
              variant={severity === s ? 'primary' : 'secondary'}
              onClick={() => setSeverity(s)}
            >
              {s === 'all' ? 'Todos' : s}
            </Button>
          ))}
        </div>
      </div>

      {/*
        `scoped` con las DOS puertas cerradas, que acá no es una formalidad porque la
        pantalla entra por dos caminos distintos:

         1. SIN `audit_id` —que es como la abre el menú— el handler elige la última
            auditoría completada con `siteChannelFilter(resolution, undefined)`
            (`findings/route.ts:29-34`). Antes tomaba la última de CUALQUIER tienda y
            los hallazgos ajenos pasaban por propios: el peor modo de falla, porque
            parece que funciona.
         2. CON `audit_id` explícito corre `assertIdInSite(…, SEO_AUDIT_SITE_SCOPE, …)`
            (`findings/route.ts:25`), que responde 404 —no 403— para no confirmar que
            ese id existe en otra tienda.

        El `listAndCountSeoFindings` de abajo filtra por `audit_id`, así que el eje le
        llega por la auditoría: es el `via_parent` que declara
        `SEO_FINDING_SITE_SCOPE` (`modules/seo-geo/site-scope.ts:29`). El filtro de
        severidad de la derecha es del cliente y no toca nada de esto.
      */}
      <SiteScopeBar screen="seo-geo.hallazgos" />

      {isLoading ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        </div>
      ) : !data?.audit_id ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">
            No hay auditorías completadas todavía. Ejecutá una desde el Dashboard.
          </Text>
        </div>
      ) : !groups.length ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Sin hallazgos para este filtro. ¡Bien ahí!</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Severidad</Table.HeaderCell>
              <Table.HeaderCell>Motor</Table.HeaderCell>
              <Table.HeaderCell>Hallazgo</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Afectados</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {groups.map((g) => (
              <Table.Row key={g.type}>
                <Table.Cell>
                  <Badge size="2xsmall" color={severityColor(g.severity) as never}>{severityLabel(g.severity)}</Badge>
                </Table.Cell>
                <Table.Cell>{engineLabel(g.engine)}</Table.Cell>
                <Table.Cell>{findingLabel(g.type)}</Table.Cell>
                <Table.Cell className="text-right font-semibold">{g.count}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({ label: 'Hallazgos' });
export const handle = { breadcrumb: () => 'Hallazgos' };
export default HallazgosPage;
