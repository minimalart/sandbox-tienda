import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Newspaper } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  Heading,
  Select,
  StatusBadge,
  Text,
  Toaster,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBanners } from '../../hooks/api/banners';
import { registerBannersTranslations } from '../../translations/banners';
import { BannerFormDrawer, type FormState } from './components/banner-form';
import { AiComposeDrawer } from './components/ai-compose-drawer';
import { PlacementThumbnail } from './components/placement-thumbnail';
import {
  groupByPlacement,
  isLive,
  nextScheduledAt,
  PLACEMENT_CONFIG,
  PLACEMENT_IDS,
  type PreviewKind,
} from './components/placement-config';
import { ExtensionVersion, SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';

type PlacementRow = {
  id: string;
  label: string;
  itemsLabel: string;
  preview: PreviewKind;
  total: number;
  live: number;
  drafts: number;
  next: string | null;
};

/**
 * Banners overview: one card per placement (the merchant edits an area of the
 * storefront, not individual banners), each led by a schematic thumbnail of the
 * banner type — like a block/component gallery. A card click opens the editor.
 */
const BannersPage = () => {
  const { t, i18n } = useTranslation('banners');
  registerBannersTranslations(i18n);
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newPlacement, setNewPlacement] = useState(PLACEMENT_IDS[0] ?? 'top_bar');
  // Generación con IA: el drawer arma el "slide" y pre-llena el editor.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiDraft, setAiDraft] = useState<Partial<FormState> | null>(null);

  const openManualCreate = () => {
    setAiDraft(null);
    setDrawerOpen(true);
  };

  const { data, isLoading } = useBanners({ limit: 200, offset: 0 });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === 'es' ? 'es-AR' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const rows = useMemo<PlacementRow[]>(() => {
    const grouped = groupByPlacement(data?.banners ?? []);
    return PLACEMENT_IDS.map((placementId) => {
      const config = PLACEMENT_CONFIG[placementId]!;
      const items = grouped[placementId] ?? [];
      const itemWord = t(
        items.length === 1 ? config.itemLabelKey : config.itemLabelPluralKey
      ).toLowerCase();
      return {
        id: placementId,
        label: t(config.labelKey),
        itemsLabel: items.length > 0 ? `${items.length} ${itemWord}` : t('PLACEMENT_EMPTY'),
        preview: config.preview,
        total: items.length,
        live: items.filter((b) => isLive(b)).length,
        drafts: items.filter((b) => b.status === 'draft').length,
        next: nextScheduledAt(items),
      };
    });
  }, [data?.banners, t]);

  return (
    <>
      <SiteScopeBar screen="banners" />
      <Container className="divide-y p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
          <div className="flex items-center gap-x-2">
            <Heading>{t('TITLE')}</Heading>
            <ExtensionVersion extension="banners" />
          </div>
          <div className="flex items-center gap-2">
            <Select value={newPlacement} onValueChange={setNewPlacement} size="small">
              <Select.Trigger className="w-48">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {PLACEMENT_IDS.map((placementId) => {
                  const config = PLACEMENT_CONFIG[placementId]!;
                  return (
                    <Select.Item key={placementId} value={placementId}>
                      {t(config.labelKey)}
                    </Select.Item>
                  );
                })}
              </Select.Content>
            </Select>
            <Button size="small" variant="secondary" onClick={openManualCreate}>
              {t('CREATE_BUTTON')}
            </Button>
            <Button size="small" onClick={() => setAiOpen(true)}>
              ✨ {t('AI_COMPOSE_BUTTON')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => navigate(`/banners/${row.id}`)}
              className="group flex flex-col gap-3 rounded-xl border border-ui-border-base bg-ui-bg-base p-3 text-left shadow-elevation-card-rest outline-none transition-shadow hover:shadow-elevation-card-hover focus-visible:shadow-borders-focus"
            >
              <PlacementThumbnail kind={row.preview} />
              <div className="flex items-start justify-between gap-2 px-1">
                <div className="min-w-0">
                  <Text size="small" weight="plus" className="truncate text-ui-fg-base">
                    {row.label}
                  </Text>
                  <Text size="small" className="truncate text-ui-fg-subtle">
                    {row.itemsLabel}
                  </Text>
                </div>
                {isLoading ? null : (
                  <StatusBadge color={row.live > 0 ? 'green' : 'grey'} className="shrink-0">
                    {row.live > 0 ? t('STATUS_LIVE') : t('STATUS_INACTIVE')}
                  </StatusBadge>
                )}
              </div>
              <div className="flex min-h-[24px] flex-wrap items-center gap-1.5 px-1">
                {isLoading ? (
                  <div className="h-5 w-28 animate-pulse rounded-full bg-ui-bg-component" />
                ) : (
                  <>
                    {row.live > 0 ? (
                      <Badge size="2xsmall" color="green">
                        {t('COL_ACTIVE')}: {row.live}
                      </Badge>
                    ) : null}
                    {row.drafts > 0 ? (
                      <Badge size="2xsmall" color="orange">
                        {t('COL_DRAFTS')}: {row.drafts}
                      </Badge>
                    ) : null}
                    {row.next ? (
                      <Badge size="2xsmall" color="blue">
                        {t('BADGE_NEXT', { date: formatDate(row.next) })}
                      </Badge>
                    ) : null}
                    {row.live === 0 && row.drafts === 0 && !row.next ? (
                      <Text size="small" className="text-ui-fg-muted">
                        —
                      </Text>
                    ) : null}
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      </Container>
      <BannerFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement={newPlacement}
        banner={null}
        initialForm={aiDraft}
      />
      <AiComposeDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onComposed={(result, placement) => {
          setAiDraft({
            content_title: result.content.title,
            content_subtitle: result.content.subtitle,
            content_body: result.content.body,
            cta_label: result.cta.label,
            cta_url: result.cta.url,
            media_url: result.image_url,
            status: 'draft',
          });
          setNewPlacement(placement);
          setAiOpen(false);
          setDrawerOpen(true);
        }}
      />
      <Toaster />
    </>
  );
};

const BannersIcon = () => <Newspaper style={{ color: '#4B8EEF' }} />;

export const config = defineRouteConfig({
  label: 'Banners',
  icon: BannersIcon,
  rank: 30,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Banners',
};

export default BannersPage;
