import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Toaster } from '@medusajs/ui';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

/**
 * Typesense → Configuración.
 *
 * Sigue siendo UNA card y no varias repartidas con `groups`: son 9 campos y
 * entran de un saque. El grupo "Colecciones por tienda" es el que hay que mirar
 * con cuidado — es el único mecanismo multitienda de Typesense y hasta esta
 * tanda no se podía tocar sin editar el `.env` y redeployar.
 *
 * El header propio existe SÓLO para colgar el botón de ayuda: `ExtensionSettingsCard`
 * trae su título pero no expone dónde meterle una acción. Mismo patrón que
 * `routes/ga4/config/page.tsx`.
 */
const TypesenseSettingsPage = () => (
  <SingleColumnLayout>
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Configuración de Typesense</Heading>
        <HelpDrawer slug="typesense" />
      </div>
    </Container>

    {/*
      `description` de UNA oración. Las dos cosas que decía de más —que lo guardado
      acá pisa las variables de entorno, y que en "Colecciones por tienda" vacío
      significa que todas usan la general— están en el drawer, que además explica lo
      que esta línea NO decía: que apuntar una tienda a una colección que no existe
      no devuelve error sino cero resultados, en silencio.
    */}
    <ExtensionSettingsCard
      namespace="extension:typesense"
      description="Conexión, colecciones y mantenimiento del índice de búsqueda."
    />
    <Toaster />
  </SingleColumnLayout>
);

// Sin `rank`: `sortMenuItemsByRank` ordena los hijos con rank ANTES que los sin
// rank, así que un rank acá la metería arriba de Búsqueda/Curaciones/Sinónimos
// en vez de dejarla al final, que es donde se busca una configuración.
export const config = defineRouteConfig({ label: 'Configuración' });

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default TypesenseSettingsPage;
