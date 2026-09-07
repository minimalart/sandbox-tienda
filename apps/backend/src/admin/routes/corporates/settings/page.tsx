import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Toaster } from '@medusajs/ui';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

/**
 * Dos cards y no una sola, aunque sean tres campos. No son la misma clase de
 * ajuste: el modo de activación cambia el comportamiento AHORA MISMO (la próxima
 * empresa que se registre ya lo usa), y los dos de la lista mayorista no hacen
 * absolutamente nada hasta que alguien corra el script. Mezclarlos en una card
 * invita a guardar el descuento y quedarse esperando que los precios cambien
 * solos.
 */
const CorporatesSettingsPage = () => (
  <SingleColumnLayout>
    {/*
      Header propio SÓLO para colgar el botón de ayuda, mismo patrón que
      `routes/ga4/config/page.tsx`. UNO para las dos cards y no uno por card: la
      ayuda es de la EXTENSIÓN, y sus secciones se reparten entre las dos —"Automática
      significa sin nadie mirando" le importa a la de arriba, "El título es la clave
      de idempotencia" a la de abajo—.

      El slug es `corporate` en singular —el del DESCRIPTOR y la clave de
      `help/index.ts`—, no el directorio `corporates` de la ruta.
    */}
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Configuración de cuentas corporativas</Heading>
        <HelpDrawer slug="corporate" />
      </div>
    </Container>

    {/*
      `description` de UNA oración. Que aplica sólo a los registros NUEVOS es la
      misma regla que ya dice el `help` del campo, y el drawer la desarrolla con
      el riesgo que abre "Automática" sin validación de CUIT detrás.
    */}
    <ExtensionSettingsCard
      namespace="extension:corporate"
      title="Alta de cuentas"
      groups={['Alta de cuentas']}
      description="Qué pasa cuando una empresa se registra sola desde el storefront."
    />

    {/*
      `description` de UNA oración. El "guardar no reprecia nada" tiene sección
      propia en el drawer ("Guardar el descuento no reprecia nada"), que además
      explica lo que esta línea NO decía: qué pasa con la lista vieja cuando se
      corre el script con otro título.
    */}
    <ExtensionSettingsCard
      namespace="extension:corporate"
      title="Lista de precios mayorista"
      groups={['Lista mayorista']}
      description="Parámetros del script que crea la lista mayorista (`medusa exec ./src/scripts/create-wholesale-price-list.ts`)."
      hideEnvOnly
      // Misma tienda activa que la card de arriba: la barra de contexto va
      // en UNA sola card, la primera.
      hideSiteContext
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

export default CorporatesSettingsPage;
