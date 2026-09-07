import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Toaster } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { BoxList } from '../components/box-list';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { registerAndreaniTranslations } from '../../../translations/andreani';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

/**
 * Andreani tiene 27 variables, demasiadas para una card sola: un formulario de 27
 * campos no se lee, se sufre. Se reparten por los mismos `group` que ya declaran los
 * descriptores, en el orden en que se configuran de verdad — primero se entra a la
 * cuenta, después se dice desde dónde sale el paquete, y al final se afina.
 *
 * `hideEnvOnly` en todas menos la primera: ese bloque es del NAMESPACE, no del
 * grupo, así que sin esto la lista de "sólo por entorno" saldría repetida seis veces.
 *
 * `hideSiteContext` con el mismo `index > 0`: la barra de tienda activa es del
 * BACKOFFICE, no de la card, y sin esto se repetiría cuatro veces en esta página.
 */
const GROUPS: { title: string; groups: string[]; description: string }[] = [
  {
    title: 'Conexión',
    groups: ['Credenciales', 'Conexión'],
    // UNA oración. El gotcha del ambiente —por defecto apunta a QA, y una
    // instalación productiva que no lo cambie cotiza contra el entorno de prueba—
    // abre el drawer: es su PRIMERA sección ("El entorno de la API es lo primero
    // que hay que mirar"), que además explica el síntoma, cosa que acá no entraba.
    description: 'Ambiente y conexión con la API de Andreani.',
  },
  {
    title: 'Contratos por servicio',
    groups: ['Contratos por servicio'],
    // UNA oración. La historia de por qué existen los overrides —antes salían del
    // entorno del proceso y todas las tiendas cotizaban con el contrato de una—
    // está en el drawer, sección "Credenciales por tienda". Es contexto de la
    // migración, no algo que se necesite para llenar el campo.
    description: 'El contrato general y los overrides por tipo de servicio.',
  },
  {
    title: 'Remitente y origen',
    groups: ['Remitente', 'Origen'],
    description: 'Quién figura como remitente y desde qué domicilio se despacha.',
  },
  {
    title: 'Bultos y operación',
    groups: ['Bultos', 'Operación'],
    description:
      'Medidas de respaldo para productos sin dimensiones cargadas, y el ritmo de ' +
      'sincronización de seguimientos.',
  },
];

const AndreaniConfigPage = () => {
  const { i18n } = useTranslation('andreani');
  registerAndreaniTranslations(i18n);

  return (
    <SingleColumnLayout>
      {/*
        Header propio SÓLO para colgar el botón de ayuda, mismo patrón que
        `routes/ga4/config/page.tsx`. No se cuelga de una de las cuatro cards
        porque la ayuda es de la extensión, no de un grupo de campos.
      */}
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading>Configuración de Andreani</Heading>
          <HelpDrawer slug="andreani" />
        </div>
      </Container>

      {GROUPS.map((section, index) => (
        <ExtensionSettingsCard
          key={section.title}
          namespace="extension:andreani"
          title={section.title}
          groups={section.groups}
          description={section.description}
          hideEnvOnly={index > 0}
          hideSiteContext={index > 0}
        />
      ))}
      <BoxList />
      <Toaster />
    </SingleColumnLayout>
  );
};

export const config = defineRouteConfig({ label: 'Configuración', rank: 1 });

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default AndreaniConfigPage;
