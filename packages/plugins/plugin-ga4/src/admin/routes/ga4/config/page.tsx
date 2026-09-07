import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Text, Toaster } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { registerGa4EventsTranslations } from '../../../translations/ga4-events';
import { Ga4ConfigPanel } from '../components';

/**
 * Configuración de GA4: el estado de envío server-side, checklist de activación
 * y evento de prueba (`Ga4ConfigPanel`).
 *
 * En la extensión in-tree este page renderizaba además `<ExtensionSettingsCard>`
 * — el editor genérico de `app-settings` del host. Ese componente vive en
 * `apps/backend/src/admin/components/app-settings/` y el plugin no lo puede
 * importar (no cruza el límite del package publicado). El host debería seguir
 * mostrando esa card de ajustes en su propia sección de `app-settings`; acá
 * dejamos una nota para el operador y el formulario de la fila legacy queda
 * como respaldo detrás del panel de estado.
 */
const Ga4ConfigPage = () => {
  const { t, i18n } = useTranslation('ga4Events');
  registerGa4EventsTranslations(i18n);

  return (
    <>
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading>{t('CONFIG_TITLE')}</Heading>
        </div>
        <Ga4ConfigPanel />
      </Container>

      <Container>
        <Heading level="h2" className="mb-2">
          Ajustes por sitio
        </Heading>
        <Text className="text-ui-fg-subtle">
          Los campos editables (Measurement ID, API secret, GTM ID, Modo debug) se administran
          desde la card de ajustes de <code>app-settings</code> del host, con el namespace{' '}
          <code>extension:ga4</code>. Ese editor pisa siempre a la fila legacy{' '}
          <code>ga4_settings</code> y a las variables de entorno. Sin card montada en el host, el
          plugin usa <code>process.env</code> directo.
        </Text>
      </Container>

      <Toaster />
    </>
  );
};

export const config = defineRouteConfig({
  label: 'Configuración',
  rank: 1,
});

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default Ga4ConfigPage;
