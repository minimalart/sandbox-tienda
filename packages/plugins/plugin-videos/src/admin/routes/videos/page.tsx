import { defineRouteConfig } from '@medusajs/admin-sdk';
import { PlaySolid } from '@medusajs/icons';
import { SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';
import { useTranslation } from 'react-i18next';
import { registerVideosTranslations } from '../../translations/videos';
import { VideosTable } from './components/videos-table';

const VideosPage = () => {
  const { i18n } = useTranslation('videos');
  registerVideosTranslations(i18n);

  return (
    <div className="flex flex-col gap-y-4">
      <SiteScopeBar screen="videos" variant="card" />

      <VideosTable />
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
