import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Toaster } from '@medusajs/ui';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SingleColumnLayout } from '../../../components/layouts/single-column';
import { ExtensionSettingsEditorCard } from '../../../components/app-settings/extension-settings-editor-card';
import { useTranslation } from 'react-i18next';

/**
 * Ajustes de instancia de Multitienda: el dominio público del storefront y el
 * ritmo con el que el importador le pega a la tienda de ORIGEN.
 *
 * Va en una sub-página del listado y no dentro del detalle de una tienda a
 * propósito: TODOS los ajustes del namespace son `scope: 'instance'`. El portón
 * de throttling es uno solo por proceso (`demo-store/catalog/util.ts:37`), y el
 * dominio es de la INSTALACIÓN —las tiendas cuelgan de él con `/tienda/<slug>`,
 * no lo eligen—. Ponerlos dentro de una tienda sugeriría que se afinan por
 * tienda, y no se puede.
 *
 * ─── POR QUÉ DOS CARDS Y NO UNA ──────────────────────────────────────────────
 *
 * Antes había una sola, sin `groups`, porque el namespace tenía un solo grupo.
 * Con el dominio adentro son dos cosas que no se parecen en nada, y una card
 * titulada "Importación de catálogo" con un campo de URL adentro es peor que dos
 * cards: el operador que viene a arreglar un link no la abre.
 *
 * Al partirla, `groups` pasa a ser OBLIGATORIO en las dos —`card-coverage.test.ts`
 * falla si un grupo del namespace no lo nombra ninguna card—, y los dos bloques
 * que son del NAMESPACE y no del grupo se muestran UNA sola vez: la barra de
 * tienda activa en la primera, y "Sólo por entorno" en la última, que es donde
 * las dos variables de MercadoPago dicen lo que hay que oír acá —que la cuenta de
 * cobro se edita en otro lado—.
 */
const SitesSettingsPage = () => {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  return (
  <SingleColumnLayout>
    {/*
      El header propio existe SÓLO para colgar el botón de ayuda: `ExtensionSettingsCard`
      trae su título pero no expone dónde meterle una acción. Mismo patrón que
      `routes/ga4/config/page.tsx`.

      El slug es `multistore` y no `sites`: la clave de `help/index.ts` es la del
      DESCRIPTOR, no la del directorio de la ruta.
    */}
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Multitienda</Heading>
        <HelpDrawer slug="multistore" />
      </div>
    </Container>

    {/*
      Primero el dominio: es el ajuste que se viene a buscar. `hideEnvOnly` porque
      las variables de MercadoPago no tienen nada que ver con la URL y el bloque se
      muestra completo en la card de abajo.
    */}
    <ExtensionSettingsCard
      namespace="extension:multistore"
      groups={['URL pública']}
      title="URL pública"
      description="El dominio desde el que se sirve el storefront de esta instalación."
      hideEnvOnly
    />

    {/*
      `description` de UNA oración. Las dos cosas que decía de más —qué hacer cuando la
      fuente devuelve 429 y que los cambios aplican a la importación en curso— están en
      el drawer, junto con lo que el resto de la extensión no dice en ninguna pantalla:
      que sin tienda elegida se ven TODAS, y que el slug de una tienda publicada no se
      renombra.

      `hideSiteContext`: la barra de tienda activa es del BACKOFFICE, no de la card,
      así que se muestra en la primera y se apaga acá para no repetirla.
    */}
    <ExtensionSettingsCard
      namespace="extension:multistore"
      groups={['Importación de catálogo']}
      title="Importación de catálogo"
      description="Cuán rápido se le pide el catálogo a la tienda de origen."
      hideSiteContext
    />
    <ExtensionSettingsEditorCard
      namespace="extension:multistore"
      groups={['Home del directorio']}
      title={en ? 'Directory home' : 'Home del directorio'}
      description={en ? 'Edit branding, sections and content with Puck.' : 'Editá la marca, las secciones y el contenido con Puck.'}
      href="/sites/directory"
      action={en ? 'Edit directory' : 'Editar directorio'}
    />
    <Toaster />
  </SingleColumnLayout>
  );
};

// Sin `rank`: `sortMenuItemsByRank` ordena los hijos con rank ANTES que los sin
// rank, así que ponerle uno la subiría por encima del listado de tiendas.
export const config = defineRouteConfig({ label: 'Configuración' });

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default SitesSettingsPage;
