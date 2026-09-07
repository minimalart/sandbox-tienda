import { ArrowLeft } from '@medusajs/icons';
import { Button, Container, Heading, IconButton, Select, Text, Toaster } from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import type { Banner } from '../../../hooks/api/banners';
import { useBanners } from '../../../hooks/api/banners';
import { registerBannersTranslations } from '../../../translations/banners';
import { BannerFormDrawer } from '../components/banner-form';
import { BannerPreview, bannerToPreviewData } from '../components/banner-preview';
import { PlacementItemsTable } from '../components/placement-items-table';
import {
  getPlacementConfig,
  isLive,
  isScheduled,
  PLACEMENT_CONFIG,
  sortBanners,
} from '../components/placement-config';

const DEVICE_FILTERS = ['all', 'desktop', 'mobile', 'tablet'];

/**
 * Dedicated editor for one placement: live preview on top, items of this
 * placement only (grouped by state), and creation scoped to the placement.
 */
const PlacementEditorPage = () => {
  const { t, i18n } = useTranslation('banners');
  registerBannersTranslations(i18n);
  const navigate = useNavigate();
  const { placement = '' } = useParams<{ placement: string }>();

  const [deviceFilter, setDeviceFilter] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  const { data, isLoading } = useBanners({ limit: 200, offset: 0 });

  const isKnown = !!PLACEMENT_CONFIG[placement];
  const config = getPlacementConfig(placement);

  const items = useMemo(() => {
    const all = (data?.banners ?? []).filter((b) => b.placement === placement);
    const filtered =
      deviceFilter === 'all'
        ? all
        : all.filter((b) => !b.device_type || b.device_type === 'all' || b.device_type === deviceFilter);
    return filtered.sort(sortBanners);
  }, [data?.banners, placement, deviceFilter]);

  const live = items.filter((b) => isLive(b));
  const scheduled = items.filter((b) => isScheduled(b));
  const drafts = items.filter((b) => b.status === 'draft');
  const archived = items.filter((b) => b.status === 'archived');

  function openCreate() {
    setEditingBanner(null);
    setDrawerOpen(true);
  }

  function openEdit(banner: Banner) {
    setEditingBanner(banner);
    setDrawerOpen(true);
  }

  if (!isKnown) {
    return (
      <Container className="flex flex-col gap-4 p-6">
        <Text className="text-ui-fg-subtle">{t('PLACEMENT_UNKNOWN')}</Text>
        <div>
          <Button variant="secondary" size="small" onClick={() => navigate('/banners')}>
            {t('BACK_TO_PLACEMENTS')}
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-y-4">
        {/* Header */}
        <Container className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <IconButton size="small" variant="transparent" onClick={() => navigate('/banners')}>
              <ArrowLeft />
            </IconButton>
            <Heading>{t(config.labelKey)}</Heading>
          </div>
          <div className="flex items-center gap-2">
            <Select value={deviceFilter} onValueChange={setDeviceFilter} size="small">
              <Select.Trigger className="w-56 whitespace-nowrap">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {DEVICE_FILTERS.map((d) => (
                  <Select.Item key={d} value={d}>
                    {d === 'all' ? t('DEVICE_FILTER_ALL') : t(`DEVICE_${d.toUpperCase()}`)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Button variant="secondary" size="small" onClick={openCreate}>
              {t('ADD_ITEM', { item: t(config.itemLabelKey).toLowerCase() })}
            </Button>
          </div>
        </Container>

        {/* Live preview of what the storefront currently shows */}
        <Container className="flex flex-col gap-3 p-6">
          <Text size="xsmall" weight="plus" className="uppercase text-ui-fg-muted">
            {t('PREVIEW_TITLE')}
          </Text>
          {live.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-ui-border-base py-10">
              <Text size="small" className="text-ui-fg-subtle">
                {t('PREVIEW_EMPTY')}
              </Text>
            </div>
          ) : config.preview === 'card' ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {live.map((banner) => (
                <BannerPreview key={banner.id} kind="card" data={bannerToPreviewData(banner)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {live.map((banner) => (
                <BannerPreview
                  key={banner.id}
                  kind={config.preview}
                  data={bannerToPreviewData(banner)}
                />
              ))}
            </div>
          )}
        </Container>

        {/* Items of this placement only, grouped by state (standard tables) */}
        {isLoading ? (
          <Container className="p-6">
            <Text size="small" className="text-ui-fg-subtle">
              {t('LOADING')}
            </Text>
          </Container>
        ) : items.length === 0 ? (
          <Container className="p-6">
            <div className="flex flex-col items-center gap-3 py-8">
              <Text className="text-ui-fg-subtle">{t('PLACEMENT_EMPTY')}</Text>
              <Button variant="secondary" size="small" onClick={openCreate}>
                {t('ADD_ITEM', { item: t(config.itemLabelKey).toLowerCase() })}
              </Button>
            </div>
          </Container>
        ) : (
          <>
            <PlacementItemsTable titleKey="GROUP_PUBLISHED" items={live} onEdit={openEdit} />
            <PlacementItemsTable titleKey="GROUP_SCHEDULED" items={scheduled} onEdit={openEdit} />
            <PlacementItemsTable titleKey="GROUP_DRAFTS" items={drafts} onEdit={openEdit} />
            <PlacementItemsTable titleKey="GROUP_ARCHIVED" items={archived} onEdit={openEdit} />
          </>
        )}
      </div>

      <BannerFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement={placement}
        banner={editingBanner}
      />

      <Toaster />
    </>
  );
};

export default PlacementEditorPage;
