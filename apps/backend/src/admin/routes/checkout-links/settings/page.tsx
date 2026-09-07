import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Toaster } from '@medusajs/ui';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

/**
 * Pantalla sin un solo campo editable: la única variable de la extensión es de
 * instalación. Existe para que el bloque "Sólo por entorno" conteste "¿por qué
 * los links salen con el dominio equivocado?" donde se la va a buscar.
 */
const CheckoutLinksSettingsPage = () => (
  <SingleColumnLayout>
    {/*
      Header propio SÓLO para colgar el botón de ayuda, mismo patrón que
      `routes/ga4/config/page.tsx`. Acá rinde más que en otras: una pantalla con
      CERO campos editables sin nada que explique por qué es indistinguible de una
      pantalla rota.
    */}
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Links de Venta</Heading>
        <HelpDrawer slug="checkout-links" />
      </div>
    </Container>

    {/*
      `description` de UNA oración. "No se puede cambiar desde el admin" se sacó
      porque lo dice DOS VECES la misma pantalla: el bloque "Sólo por entorno" que
      la card renderiza justo debajo existe exactamente para eso, con la razón
      completa al lado.
    */}
    <ExtensionSettingsCard
      namespace="extension:checkout-links"
      title="Origen de los links"
      description="El dominio con el que se arman los links públicos sale del entorno del backend."
    />
    <Toaster />
  </SingleColumnLayout>
);

// Sin `rank`: `sortMenuItemsByRank` ordena los hijos con rank ANTES que los sin
// rank, así que ponerle uno la subiría por encima del listado.
export const config = defineRouteConfig({ label: 'Configuración' });

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default CheckoutLinksSettingsPage;
