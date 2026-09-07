import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Toaster } from '@medusajs/ui';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

/**
 * Los dos grupos van en UNA card: son pocos campos y se configuran de una sola
 * vez, al poner en marcha la flota. Partirlos por `groups` sería tres cards de
 * dos campos cada una.
 *
 * El header propio existe SÓLO para colgar el botón de ayuda: `ExtensionSettingsCard`
 * ya trae su propio título pero no expone dónde meterle una acción, y agregarle un
 * slot tocaría las ~28 páginas que la montan. Se copia el header de
 * `routes/ga4/config/page.tsx` —un `Container` con el título y el drawer— porque es
 * el patrón que ya quedó cableado y repetirlo cuesta menos que abrir la card.
 */
const DeliverySettingsPage = () => (
  <SingleColumnLayout>
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Delivery</Heading>
        <HelpDrawer slug="delivery" />
      </div>
    </Container>

    {/*
      `description` de UNA oración. Lo que decía de más —que la key de Google Maps
      NO alimenta los mapas del admin ni los del storefront, que esos la leen del
      entorno de build de cada app— está en el drawer y en `docs/extensions/delivery.md`.
      Es un gotcha real, pero es cierto SIEMPRE: leerlo cada vez que se abre la
      pantalla no lo hace más útil.
    */}
    <ExtensionSettingsCard
      namespace="extension:delivery"
      title="Configuración de Delivery"
      description="Auto-fulfillment de flota propia y la API key del geocoding de respaldo."
    />
    <Toaster />
  </SingleColumnLayout>
);

// Sin `rank`: `sortMenuItemsByRank` ordena los hijos con rank ANTES que los sin
// rank, y ninguna de las otras secciones (Zonas, Reglas, Rutas…) lo declara, así
// que un rank acá la clavaría arriba de todas en vez de al final.
export const config = defineRouteConfig({ label: 'Configuración' });

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default DeliverySettingsPage;
