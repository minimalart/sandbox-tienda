import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Container, Heading, Table, Text } from '@medusajs/ui';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { useKeywords } from '../../../hooks/api/seo-geo';

/**
 * CON franja de tienda desde que `keywords/route.ts` recorta las categorías por
 * `productIdsForSite`: las cuatro columnas siguen ahora a la tienda activa, no sólo
 * "Cobertura". Antes la franja habría mentido —Término, Pregunta y Productos salían de
 * un `query.graph` sobre `product_category` sin filtro— y por eso no estaba.
 *
 * El transporte también cierra: `useKeywords` va por `sdk.client.fetch`, que lleva
 * `x-site-id` en `globalHeaders` (`lib/client.ts`). Sin eso el selector cambiaría el
 * cartel y no la consulta.
 */
const KeywordsPage = () => {
  const { data, isLoading } = useKeywords();

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Keywords</Heading>
      </div>

      <SiteScopeBar screen="seo-geo.keywords" />

      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Preguntas derivadas de las categorías de los productos de esta tienda. “Cubierta” significa que al menos un
          producto de esa categoría tiene información suficiente (score GEO ≥ 70) para responderla.
        </Text>
      </div>

      {isLoading ? (
        <div className="px-6 py-8"><Text className="text-ui-fg-subtle">Cargando…</Text></div>
      ) : !data?.keywords?.length ? (
        <div className="px-6 py-8">
          {/*
            El vacío tiene UNA causa posible y conviene decirla: los productos de esta
            tienda no están categorizados. Antes decía sólo “sin categorías”, que en una
            tienda con el catálogo entero categorizado se leía como una pantalla rota.
          */}
          <Text className="text-ui-fg-subtle">
            Ningún producto de esta tienda tiene categoría, así que no hay taxonomía de la cual derivar preguntas.
            Asignales categorías desde Productos y volvé.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Término</Table.HeaderCell>
              <Table.HeaderCell>Pregunta</Table.HeaderCell>
              <Table.HeaderCell>Productos</Table.HeaderCell>
              <Table.HeaderCell>Cobertura</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.keywords.map((k) => (
              <Table.Row key={k.term}>
                <Table.Cell>{k.term}</Table.Cell>
                <Table.Cell className="text-ui-fg-subtle">{k.question}</Table.Cell>
                <Table.Cell>{k.product_count}</Table.Cell>
                <Table.Cell>
                  <Badge size="2xsmall" color={k.covered ? 'green' : 'red'}>
                    {k.covered ? 'Cubierta' : 'Sin cubrir'}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({ label: 'Keywords' });
export const handle = { breadcrumb: () => 'Keywords' };
export default KeywordsPage;
