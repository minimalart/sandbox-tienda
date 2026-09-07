import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Text } from '@medusajs/ui';

/**
 * Competidores — placeholder (PRD §18, roadmap V4). La comparación con
 * competidores (cobertura, schema, performance, AI Visibility) requiere una
 * fuente externa tipo DataForSEO, que se integra en V4.
 *
 * Sin franja de tienda y sin entrada en `lib/site-scope.ts`: no hay ruta que la
 * alimente, así que no hay eje que declarar ni migración pendiente que anotar. Una
 * entrada `unscoped` acá se leería como deuda del backend y no lo es. Cuando la
 * pantalla tenga datos, entra por la puerta normal: ruta primero, franja después.
 */
const CompetidoresPage = () => (
  <Container className="divide-y p-0">
    <div className="flex items-center justify-between px-6 py-4">
      <Heading level="h1">Competidores</Heading>
    </div>
    <div className="px-6 py-10 text-center">
      <Text className="text-ui-fg-subtle">
        La comparación con competidores llega en una próxima versión (V4). Requiere una fuente externa de datos SEO
        (p. ej. DataForSEO) para comparar cobertura, schema, performance y visibilidad en IA.
      </Text>
    </div>
  </Container>
);

export const config = defineRouteConfig({ label: 'Competidores' });
export const handle = { breadcrumb: () => 'Competidores' };
export default CompetidoresPage;
