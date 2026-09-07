import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Container, Heading, Table, Text } from '@medusajs/ui';
import { useNavigate } from 'react-router-dom';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import {
  AI_DIMENSION_LABELS,
  CORRECTION_GAP_BY_FINDING,
  findingCount,
  findingLabel,
  severityColor,
  severityLabel,
  useAiVisibility,
  useFindings,
  type AiVisibilityBreakdown,
  type SeoFinding,
} from '../../../hooks/api/seo-geo';

const barColor = (n: number) => (n >= 80 ? 'bg-ui-tag-green-icon' : n >= 50 ? 'bg-ui-tag-orange-icon' : 'bg-ui-tag-red-icon');

const DimensionBar = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="mb-1 flex items-center justify-between">
      <Text size="small" className="text-ui-fg-subtle">{label}</Text>
      <Text size="small" className="font-semibold">{Math.round(value)}</Text>
    </div>
    <div className="h-2 w-full overflow-hidden rounded-full bg-ui-bg-subtle">
      <div className={`h-full rounded-full ${barColor(value)}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  </div>
);

/**
 * Los hallazgos que explican el score, de mayor a menor impacto.
 *
 * Sólo catálogo y GEO: son los dos motores que leen el catálogo, que es lo que esta
 * pantalla puntúa. Los técnicos y de arquitectura describen el HTML del storefront y
 * viven en Hallazgos.
 *
 * El orden es por productos afectados y no por severidad: acá la pregunta no es qué tan
 * grave es un tipo de gap, sino cuántos productos mueve cerrarlo — que es lo único que
 * cambia el score de arriba.
 */
const actionablesOf = (findings: SeoFinding[]): SeoFinding[] =>
  findings
    .filter((f) => f.engine === 'catalog' || f.engine === 'geo')
    .sort((a, b) => (findingCount(b) ?? 0) - (findingCount(a) ?? 0));

const AiVisibilityPage = () => {
  const { data, isLoading } = useAiVisibility();
  // Sin `audit_id`: la ruta cae en la última auditoría completada DE ESTA TIENDA, que es
  // la misma de la que salió el snapshot que se muestra arriba.
  const { data: findingsData } = useFindings({ limit: 200 });
  const navigate = useNavigate();
  const latest = data?.latest;
  const breakdown = latest?.breakdown;
  const actionables = actionablesOf(findingsData?.findings ?? []);

  return (
    /*
      Sin `divide-y`, por la costura de 2px que dejaba contra el `border-b` de la
      franja. Dos hijos —header y UNA rama del ternario—, así que el `border-b`
      explícito del header repone la única línea. En el header y no en la franja:
      `SiteScopeBar` devuelve `null` con 0 ó 1 tienda.
    */
    <Container className="p-0">
      <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
        <Heading level="h1">AI Visibility</Heading>
      </div>

      {/*
        `scoped` sobre la ÚNICA consulta de la pantalla: `admin/seo-geo/ai-visibility`
        arma `filters` con `siteChannelFilter(await siteFromRequest(req), …)` y se los
        pasa a `listSeoAiVisibilitySnapshots` (`ai-visibility/route.ts:16-27`). De ahí
        salen las tres cosas que se ven —el score, el desglose por dimensión y las 24
        barras del historial—, porque `latest` y `history` son la misma lista ordenada
        al derecho y al revés. No hay dato en esta pantalla que venga de otro lado.

        La ruta es de sólo lectura: los snapshots los escribe el job de auditoría, que
        ya nace con el canal de la corrida. Por eso acá no hay mitad de escritura que
        verificar, a diferencia del tablero o del listado de auditorías.
      */}
      <SiteScopeBar screen="seo-geo.ai-visibility" />

      {isLoading ? (
        <div className="px-6 py-8"><Text className="text-ui-fg-subtle">Cargando…</Text></div>
      ) : !latest ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">
            Todavía no hay datos de AI Visibility. Ejecutá una auditoría con el motor GEO activo.
          </Text>
        </div>
      ) : (
        <div className="flex flex-col gap-8 px-6 py-6">
          <div className="flex flex-wrap items-center gap-8">
            <div>
              <p className="text-ui-fg-subtle text-xs">AI Visibility Score</p>
              <p className="mt-1 text-5xl font-semibold text-ui-fg-base">{Math.round(latest.score)}<span className="text-ui-fg-muted text-2xl">/100</span></p>
            </div>
            <div>
              <p className="text-ui-fg-subtle text-xs">AI Coverage</p>
              <p className="mt-1 text-3xl font-semibold text-ui-fg-base">{latest.coverage_percent}%</p>
              <Text size="small" className="text-ui-fg-subtle">
                {latest.products_sufficient} de {latest.products_total} productos con información suficiente
              </Text>
            </div>
          </div>

          {breakdown && (
            <div>
              <Heading level="h2" className="mb-3 text-base">Desglose por dimensión</Heading>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(Object.keys(AI_DIMENSION_LABELS) as Array<keyof AiVisibilityBreakdown>).map((k) => (
                  <DimensionBar key={k} label={AI_DIMENSION_LABELS[k]} value={breakdown[k]} />
                ))}
              </div>
            </div>
          )}

          {/*
            El agujero que esta pantalla tenía: decía “Cobertura 0 %” y ahí terminaba. El
            dato de qué le falta al catálogo YA existía —los motores lo emiten con el
            conteo de productos adentro— pero vivía en otra pantalla y sin copy, así que
            desde acá no había ningún camino a la acción.
          */}
          <div>
            <Heading level="h2" className="mb-3 text-base">Qué cerrar primero</Heading>
            {!actionables.length ? (
              <Text className="text-ui-fg-subtle">
                Sin accionables de catálogo. Corré una auditoría con los motores Catálogo y GEO prendidos.
              </Text>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Severidad</Table.HeaderCell>
                    <Table.HeaderCell>Le falta al catálogo</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Productos</Table.HeaderCell>
                    <Table.HeaderCell />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {actionables.map((f) => {
                    const gap = CORRECTION_GAP_BY_FINDING[f.type];
                    /*
                      Los ids afectados viajan en la URL para que Correcciones abra con
                      LA LISTA y no con un buscador vacío. Es una muestra (los motores
                      guardan hasta 20 en `sample_product_ids`), y por eso la pantalla
                      de destino la presenta como tal: sirve para empezar y para ver el
                      resultado en un producto real, no para cerrar el gap entero.
                    */
                    const sample = ((f.details as { sample_product_ids?: string[] } | null)?.sample_product_ids ?? [])
                      .slice(0, 20)
                      .join(',');
                    return (
                      <Table.Row key={f.id}>
                        <Table.Cell>
                          <Badge size="2xsmall" color={severityColor(f.severity) as never}>
                            {severityLabel(f.severity)}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>{findingLabel(f.type)}</Table.Cell>
                        <Table.Cell className="text-right font-semibold">{findingCount(f) ?? '—'}</Table.Cell>
                        <Table.Cell className="text-right">
                          {/*
                            Sólo los gaps que la IA puede REDACTAR llevan botón. Un producto
                            sin SKU o sin imágenes no se arregla escribiendo, y ofrecer
                            Correcciones ahí prometería que la IA inventa el dato.
                          */}
                          {gap ? (
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() =>
                                navigate(
                                  `/seo-geo/correcciones?gap=${gap}${sample ? `&ids=${encodeURIComponent(sample)}` : ''}`
                                )
                              }
                            >
                              Corregir con IA
                            </Button>
                          ) : (
                            <Button size="small" variant="transparent" onClick={() => navigate('/seo-geo/hallazgos')}>
                              Ver hallazgo
                            </Button>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table>
            )}
          </div>

          <div>
            <Heading level="h2" className="mb-3 text-base">Historial</Heading>
            {!data?.history?.length ? (
              <Text className="text-ui-fg-subtle">Sin historial todavía.</Text>
            ) : (
              <div className="flex items-end gap-3">
                {data.history.map((s) => (
                  <div key={s.id} className="flex flex-1 flex-col items-center gap-1" title={new Date(s.captured_at).toLocaleString('es-AR')}>
                    <div className="flex h-32 w-full items-end">
                      <div className={`w-full rounded-t ${barColor(s.score)}`} style={{ height: `${Math.max(4, s.score)}%` }} />
                    </div>
                    <span className="text-ui-fg-base text-xs font-semibold">{Math.round(s.score)}</span>
                    <span className="text-ui-fg-muted text-[10px]">
                      {new Date(s.captured_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({ label: 'AI Visibility' });
export const handle = { breadcrumb: () => 'AI Visibility' };
export default AiVisibilityPage;
