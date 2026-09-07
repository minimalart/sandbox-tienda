import { defineRouteConfig } from '@medusajs/admin-sdk';
import { PlaySolid } from '@medusajs/icons';
import { Container, Heading, Text } from '@medusajs/ui';
import { SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';
import { useTranslation } from 'react-i18next';
import { registerVideosTranslations } from '../../translations/videos';
import { VideosTable } from './components/videos-table';

/**
 * En la extensión in-tree acá se renderizaba `<ExtensionSettingsCard>` — el
 * editor genérico de `app-settings` del host. Ese componente vive en
 * `apps/backend/src/admin/components/app-settings/` y el plugin no lo puede
 * importar (no cruza el límite del package publicado). Los ajustes editables
 * (`VIMEO_OAUTH_REDIRECT_SUCCESS`) se administran desde la card de
 * `app-settings` del host, con el namespace `extension:videos`.
 *
 * Mismo patrón que `plugin-ga4/src/admin/routes/ga4/config/page.tsx`.
 */
const VideosPage = () => {
  const { i18n } = useTranslation('videos');
  registerVideosTranslations(i18n);

  return (
    <div className="flex flex-col gap-y-4">
      <SiteScopeBar screen="videos" variant="card" />

      <VideosTable />
      <Container>
        <Heading level="h2" className="mb-2">
          Ajustes por sitio
        </Heading>
        <Text className="text-ui-fg-subtle">
          Los campos editables (destino del callback de OAuth, credenciales de la app de Vimeo) se
          administran desde la card de <code>app-settings</code>
          del host, con el namespace <code>extension:videos</code>. El plugin lee ese snapshot vía{' '}
          <code>@minimalart/mercatto-plugin-runtime</code> y cae a las variables de entorno cuando
          no hay override.
        </Text>
      </Container>
    </div>
  );
};

const VideosIcon = () => <PlaySolid style={{ color: '#FF4F51' }} />;

export const config = defineRouteConfig({
  label: 'Videos',
  icon: VideosIcon,
  rank: 20,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Videos',
};

export default VideosPage;
