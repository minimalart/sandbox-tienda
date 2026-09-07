import { InformationCircleSolid, Photo, Plus, Trash } from '@medusajs/icons';
import { Button, Heading, Input, Text, Tooltip, toast } from '@medusajs/ui';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrandImages, useCreateBrandImages, useDeleteBrandImage } from '../../../../hooks/api';
import { sdk } from '../../../../lib/client';
import { registerBrandsTranslations } from '../../../../translations/brands';

interface BrandImageSectionProps {
  brandId: string;
}

export const BrandImageSection = ({ brandId }: BrandImageSectionProps) => {
  const { t, i18n } = useTranslation('brands');
  registerBrandsTranslations(i18n);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [thumbUrl, setThumbUrl] = useState('');
  const [extraUrl, setExtraUrl] = useState('');
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  const { data, isPending, refetch } = useBrandImages(brandId);
  const images = data?.images || [];

  const { mutateAsync: createImages } = useCreateBrandImages(brandId, {
    onSuccess: () => {
      toast.success(t('IMAGE_UPLOAD_SUCCESS'));
      refetch();
    },
    onError: (error) => {
      toast.error(t('IMAGE_UPLOAD_ERROR', { msg: error.message }));
    },
  });

  const { mutateAsync: deleteImage, isPending: isDeleting } = useDeleteBrandImage(brandId, {
    onSuccess: () => {
      toast.success(t('IMAGE_DELETE_SUCCESS'));
      refetch();
    },
    onError: (error) => {
      toast.error(t('IMAGE_DELETE_ERROR', { msg: error.message }));
    },
  });

  const thumbnailImage = images.find((img) => img.type === 'thumbnail');
  const otherImages = images.filter((img) => img.type === 'image');

  // Guarda una imagen a partir de una URL externa (igual que el campo media_url
  // de los banners). A diferencia de subir un archivo —que va al disco efímero
  // del contenedor y se pierde en cada deploy— una URL externa persiste.
  const handleAddUrl = async (rawUrl: string, type: 'thumbnail' | 'image') => {
    const url = rawUrl.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      toast.error(t('IMAGE_URL_INVALID'));
      return;
    }
    setIsSavingUrl(true);
    try {
      // Para el thumbnail, reemplazamos el existente (mismo UX que al subir).
      if (type === 'thumbnail' && thumbnailImage) {
        await deleteImage(thumbnailImage.id);
      }
      await createImages({
        images: [{ type, url, file_id: `external:${url}` }],
      });
      toast.success(t('IMAGE_URL_SUCCESS'));
      if (type === 'thumbnail') setThumbUrl('');
      else setExtraUrl('');
    } catch (error: any) {
      toast.error(t('IMAGE_UPLOAD_FAILED', { msg: error?.message ?? '' }));
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'thumbnail' | 'image'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadResponse = await sdk.admin.upload.create({ files: [file] });

      if (uploadResponse.files && uploadResponse.files.length > 0) {
        const uploadedFile = uploadResponse.files[0]!;
        await createImages({
          images: [
            {
              type,
              url: uploadedFile.url,
              file_id: uploadedFile.id,
            },
          ],
        });
      }
    } catch (error: any) {
      toast.error(t('IMAGE_UPLOAD_FAILED', { msg: error.message }));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="bg-ui-bg-base border border-ui-border-base rounded-lg p-6">
      <Heading level="h2" className="mb-4">
        {t('IMAGES_TITLE')}
      </Heading>

      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Text className="font-medium">{t('IMAGE_THUMBNAIL_LABEL')}</Text>
              <Tooltip content={t('IMAGE_THUMBNAIL_HELP')}>
                <InformationCircleSolid className="text-ui-fg-muted" />
              </Tooltip>
            </div>
          </div>
          {thumbnailImage ? (
            <div className="relative group w-32 h-32 rounded-lg overflow-hidden border border-ui-border-base">
              <img
                src={thumbnailImage.url}
                alt="Brand thumbnail"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <label className="cursor-pointer p-2 bg-white/20 rounded-full hover:bg-white/40 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      await deleteImage(thumbnailImage.id);
                      handleFileSelect(e, 'thumbnail');
                    }}
                    disabled={isUploading || isDeleting}
                  />
                  <Photo className="w-4 h-4 text-white" />
                </label>
                <button
                  onClick={() => deleteImage(thumbnailImage.id)}
                  disabled={isDeleting}
                  className="p-2 bg-white/20 rounded-full hover:bg-red-500/80 transition-colors"
                >
                  <Trash className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-ui-border-base rounded-lg cursor-pointer hover:border-ui-border-interactive transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'thumbnail')}
                disabled={isUploading}
              />
              <Photo className="w-8 h-8 text-ui-fg-subtle mb-2" />
              <Text size="small" className="text-ui-fg-subtle">
                {isUploading ? t('IMAGE_UPLOADING') : t('IMAGE_ADD_THUMBNAIL')}
              </Text>
            </label>
          )}
          <div className="mt-3 flex max-w-md items-center gap-2">
            <Input
              size="small"
              placeholder={t('IMAGE_URL_PLACEHOLDER')}
              value={thumbUrl}
              onChange={(e) => setThumbUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && thumbUrl.trim()) {
                  e.preventDefault();
                  void handleAddUrl(thumbUrl, 'thumbnail');
                }
              }}
            />
            <Button
              size="small"
              variant="secondary"
              disabled={!thumbUrl.trim() || isSavingUrl}
              onClick={() => handleAddUrl(thumbUrl, 'thumbnail')}
            >
              {t('IMAGE_URL_BUTTON')}
            </Button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Text className="font-medium">{t('IMAGE_ADDITIONAL_LABEL')}</Text>
              <Tooltip content={t('IMAGE_ADDITIONAL_HELP')}>
                <InformationCircleSolid className="text-ui-fg-muted" />
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {otherImages.map((image) => (
              <div
                key={image.id}
                className="relative group w-24 h-24 rounded-lg overflow-hidden border border-ui-border-base"
              >
                <img src={image.url} alt="Brand image" className="w-full h-full object-cover" />
                <button
                  onClick={() => deleteImage(image.id)}
                  disabled={isDeleting}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"
                >
                  <Trash className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-ui-border-base rounded-lg cursor-pointer hover:border-ui-border-interactive transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'image')}
                disabled={isUploading}
              />
              <Plus className="w-6 h-6 text-ui-fg-subtle" />
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                {isUploading ? t('IMAGE_UPLOADING') : t('IMAGE_ADD')}
              </Text>
            </label>
          </div>
          <div className="mt-3 flex max-w-md items-center gap-2">
            <Input
              size="small"
              placeholder={t('IMAGE_URL_PLACEHOLDER')}
              value={extraUrl}
              onChange={(e) => setExtraUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && extraUrl.trim()) {
                  e.preventDefault();
                  void handleAddUrl(extraUrl, 'image');
                }
              }}
            />
            <Button
              size="small"
              variant="secondary"
              disabled={!extraUrl.trim() || isSavingUrl}
              onClick={() => handleAddUrl(extraUrl, 'image')}
            >
              {t('IMAGE_URL_BUTTON')}
            </Button>
          </div>
        </div>
      </div>

      {isPending && (
        <div className="mt-4">
          <Text size="small" className="text-ui-fg-subtle">
            {t('IMAGE_LOADING')}
          </Text>
        </div>
      )}
    </div>
  );
};
