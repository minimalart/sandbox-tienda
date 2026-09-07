import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Toaster } from '@medusajs/ui';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

const CompaniesSettingsPage = () => (
  <SingleColumnLayout>
    {/*
      Header propio SÓLO para colgar el botón de ayuda: `ExtensionSettingsCard`
      trae su título pero no expone dónde meterle una acción, y agregarle un slot
      tocaría las ~28 páginas que la montan. Mismo patrón que
      `routes/ga4/config/page.tsx`.

      El slug es `b2b` —el del DESCRIPTOR y la clave de `help/index.ts`—, no
      `companies`, que es el directorio de la ruta.
    */}
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Configuración de empresas</Heading>
        <HelpDrawer slug="b2b" />
      </div>
    </Container>

    {/*
      `description` de UNA oración. Lo que decía de más —que el canal es lo que
      define a qué tienda pertenece la empresa y con qué lista cotiza, y que
      cambiarlo no reasigna las existentes— está en el drawer, en sus dos primeras
      secciones. Es cierto SIEMPRE: leerlo cada vez que se abre la pantalla no lo
      hace más útil.
    */}
    <ExtensionSettingsCard
      namespace="extension:b2b"
      title="Canal mayorista"
      description="Canal de ventas al que se atan las empresas nuevas."
    />
    <Toaster />
  </SingleColumnLayout>
);

// Sin `rank`: `sortMenuItemsByRank` ordena los hijos con rank ANTES que los sin
// rank, así que ponerle uno la subiría por encima del listado de empresas.
export const config = defineRouteConfig({ label: 'Configuración' });

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default CompaniesSettingsPage;
