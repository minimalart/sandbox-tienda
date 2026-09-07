import { useState, useEffect, useRef } from 'react';
import { Button, Drawer, Input, Label, Textarea, Heading, Text, Badge, StatusBadge, Switch } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { registerVideosTranslations } from '../../../translations/videos';
import { sdk } from '../../../lib/client';
import {
  useVideo,
  useUpdateVideo,
  useLinkProducts,
  useUnlinkProducts,
} from '../../../hooks/api/videos';
import { SalesChannelMultiSelect } from '../../../components/sales-channel-multiselect';
import { ProductSelector } from '../../../components/product-selector';

interface EditVideoDrawerProps {
  videoId: string | null;
  open: boolean;
  onClose: () => void;
}

export const EditVideoDrawer = ({ videoId, open, onClose }: EditVideoDrawerProps) => {
  const { t, i18n } = useTranslation('videos');
  registerVideosTranslations(i18n);
  // El `ProductSelector` vendored en el plugin usa el mismo namespace `videos`
  // con `defaultValue` fallbacks — no hace falta registrar `blog`.
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showInCarousel, setShowInCarousel] = useState(true);
  const [posterUrl, setPosterUrl] = useState('');
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [salesChannelIds, setSalesChannelIds] = useState<string[]>([]);
  // Productos vinculados: modelo controlado (como blog); se persiste al Guardar
  // con un diff contra el snapshot original.
  const [productIds, setProductIds] = useState<string[]>([]);
  const originalProductIdsRef = useRef<string[]>([]);
  const posterInputRef = useRef<HTMLInputElement>(null);

  const { data: videoData, isLoading } = useVideo(videoId || '');
  const updateMutation = useUpdateVideo(videoId || '');
  const linkProductsMutation = useLinkProducts(videoId || '');
  const unlinkProductsMutation = useUnlinkProducts(videoId || '');

  const video = videoData?.video;

  useEffect(() => {
    if (video) {
      setTitle(video.title || '');
      setDescription(video.description || '');
      setIsActive(video.is_active ?? true);
      setShowInCarousel(video.show_in_carousel ?? true);
      setPosterUrl(video.poster_url || '');
      setSortOrder(video.sort_order || 0);
      setSalesChannelIds(video.sales_channel_ids ?? []);
      const links = (video.product_links ?? []).map(
        (l: Record<string, unknown>) => l.product_id as string,
      );
      setProductIds(links);
      originalProductIdsRef.current = links;
    }
  }, [video]);

  const handlePosterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingPoster(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const uploaded = res.files?.[0];
      if (uploaded?.url) setPosterUrl(uploaded.url);
    } catch (error) {
      console.error('[EditVideoDrawer] Poster upload failed:', error);
    } finally {
      setIsUploadingPoster(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!videoId) return;

    try {
      await updateMutation.mutateAsync({
        title,
        description,
        is_active: isActive,
        show_in_carousel: showInCarousel,
        poster_url: posterUrl || null,
        sort_order: sortOrder,
        sales_channel_ids: salesChannelIds.length ? salesChannelIds : null,
      });

      // Persistir productos vinculados: diff contra el snapshot original.
      const original = originalProductIdsRef.current;
      const added = productIds.filter((id) => !original.includes(id));
      const removed = original.filter((id) => !productIds.includes(id));
      if (added.length) await linkProductsMutation.mutateAsync(added);
      if (removed.length) await unlinkProductsMutation.mutateAsync(removed);
      originalProductIdsRef.current = productIds;

      onClose();
    } catch (error) {
      console.error('[EditVideoDrawer] Failed to update video:', error);
    }
  };

  if (isLoading) {
    return (
      <Drawer open={open} onOpenChange={onClose}>
        <Drawer.Content>
          <Drawer.Header>
            <Heading>{t('LOADING')}</Heading>
          </Drawer.Header>
        </Drawer.Content>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Heading>{t('EDIT_VIDEO')}</Heading>
        </Drawer.Header>

        <Drawer.Body className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {video?.thumbnail_url && (
            <div className="flex flex-col gap-2">
              <Label>{t('PREVIEW')}</Label>
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="w-full h-48 object-cover rounded-lg"
              />
              <div className="flex items-center gap-2">
                <Badge size="small">{t('VIMEO_ID_BADGE', { id: video.vimeo_id })}</Badge>
                <StatusBadge color={video.status === 'available' ? 'green' : 'blue'}>
                  {t(`STATUS_${(video.status || 'unknown').toUpperCase()}`, { defaultValue: video.status })}
                </StatusBadge>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="title">{t('LABEL_TITLE')}</Label>
              <Input
                id="title"
                type="text"
                placeholder={t('PLACEHOLDER_TITLE')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">{t('LABEL_DESCRIPTION')}</Label>
              <Textarea
                id="description"
                placeholder={t('PLACEHOLDER_DESCRIPTION')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">{t('TABLE_COL_ACTIVE')}</Label>
              <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label htmlFor="show_in_carousel">
                  {t('LABEL_SHOW_IN_CAROUSEL', { defaultValue: 'Mostrar en el carrousel de la home' })}
                </Label>
                <Text size="small" className="text-ui-fg-subtle">
                  {t('SHOW_IN_CAROUSEL_HELP', {
                    defaultValue: 'Si está apagado, el video sigue activo pero no aparece en el carrousel.',
                  })}
                </Text>
              </div>
              <Switch
                id="show_in_carousel"
                checked={showInCarousel}
                onCheckedChange={setShowInCarousel}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t('LABEL_POSTER', { defaultValue: 'Miniatura (poster)' })}</Label>
              <Text size="small" className="text-ui-fg-subtle">
                {t('POSTER_HELP', {
                  defaultValue:
                    'Se muestra en el front mientras el video carga. Si no elegís una, se usa la de Vimeo.',
                })}
              </Text>
              {(posterUrl || video?.thumbnail_url) && (
                <img
                  src={posterUrl || video?.thumbnail_url}
                  alt={t('LABEL_POSTER', { defaultValue: 'Miniatura (poster)' })}
                  className="h-48 w-full rounded-lg object-cover"
                />
              )}
              <input
                ref={posterInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePosterFile}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  onClick={() => posterInputRef.current?.click()}
                  isLoading={isUploadingPoster}
                >
                  {t('UPLOAD_POSTER', { defaultValue: 'Subir imagen' })}
                </Button>
                {posterUrl && (
                  <Button
                    type="button"
                    size="small"
                    variant="transparent"
                    onClick={() => setPosterUrl('')}
                  >
                    {t('CLEAR_POSTER', { defaultValue: 'Quitar' })}
                  </Button>
                )}
              </div>
              <Input
                type="text"
                placeholder={t('POSTER_URL_PLACEHOLDER', { defaultValue: 'o pegá una URL de imagen' })}
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="sort_order">{t('TABLE_COL_SORT_ORDER')}</Label>
              <Input
                id="sort_order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="border-t pt-4">
              <SalesChannelMultiSelect
                value={salesChannelIds}
                onChange={setSalesChannelIds}
                label="Canales de venta"
                help="Vacío = visible en todos los canales. Elegí canales para mostrar el video solo en esas demos."
              />
            </div>
          </form>

          <div className="flex flex-col gap-3 border-t pt-4">
            <Heading level="h3">{t('LINKED_PRODUCTS')}</Heading>
            <ProductSelector value={productIds} onChange={setProductIds} />
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <div className="flex items-center gap-2 justify-end w-full">
            <Button variant="secondary" onClick={onClose}>
              {t('CANCEL')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!title || updateMutation.isPending}
              isLoading={updateMutation.isPending}
            >
              {t('SAVE_CHANGES')}
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
