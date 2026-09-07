import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Toaster } from '@medusajs/ui';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { EmailBrandingCard } from '../../store-config/components/email-branding-card';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

/**
 * Sendgrid → Configuración.
 *
 * El branding entra ACÁ y ya no en un Drawer disparado desde el listado: un
 * formulario de ajustes que se abre encima de una tabla no queda en la URL, no
 * tiene breadcrumb y no aparece en el menú, así que el único modo de saber que
 * existía era descubrir el botón. Se monta sin `embedded` porque ahora es
 * contenido de página y le corresponde el Container con su propio encabezado.
 *
 * Sigue siendo un ESPEJO del mismo componente que vive en Preferencias, no una
 * segunda copia del formulario: los dos escriben en
 * `/admin/store-config/email-branding`, así que no pueden divergir.
 */
const EmailTemplatesSettingsPage = () => (
  <SingleColumnLayout>
    {/*
      Header propio SÓLO para colgar el botón de ayuda, mismo patrón que
      `routes/ga4/config/page.tsx`. UNO para las dos cards: la ayuda es de la
      extensión, y "La marca se cachea un minuto" —que es del branding de abajo— es
      una de sus secciones.
    */}
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Configuración de emails</Heading>
        <HelpDrawer slug="email-templates" />
      </div>
    </Container>

    {/*
      `description` de UNA oración. La segunda decía que la clave y el remitente se
      listan ABAJO con el motivo — y ahí siguen, en el bloque "Sólo por entorno" que
      la card renderiza: un cartel que anuncia lo que se ve tres centímetros más
      abajo no agrega nada.
    */}
    <ExtensionSettingsCard
      namespace="extension:email-templates"
      description="Destinatario de los avisos internos, base de los iconos y IDs de plantilla de SendGrid."
    />

    <EmailBrandingCard />

    <Toaster />
  </SingleColumnLayout>
);

// Sin `rank`: `sortMenuItemsByRank` ordena los hijos con rank ANTES que los sin
// rank, así que ponerle uno la subiría por encima del listado de plantillas.
export const config = defineRouteConfig({ label: 'Configuración' });

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default EmailTemplatesSettingsPage;
