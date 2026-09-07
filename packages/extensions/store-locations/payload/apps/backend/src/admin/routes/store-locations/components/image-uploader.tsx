import { Button, Text, toast } from '@medusajs/ui';
import { Trash } from '@medusajs/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sdk } from '../../../lib/client';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

/**
 * Single-image uploader for a store location. Uploads the picked file to the
 * configured Medusa file storage (S3 when S3_* env vars are set) via
 * `sdk.admin.upload.create` and returns the public URL through `onChange`.
 * Shows a thumbnail preview with a remove button. Mirrors the pattern in
 * `components/common/logo-uploader.tsx`.
 */
export const ImageUploader = ({ value, onChange }: ImageUploaderProps) => {
  const { t } = useTranslation('storeLocations');
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const url = res.files?.[0]?.url;
      if (url) onChange(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'error';
      toast.error(t('FIELD_IMAGE_UPLOAD_ERROR', { msg }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
        {value ? (
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <Text size="xsmall" className="text-ui-fg-muted">
            —
          </Text>
        )}
      </div>
      <div className="flex gap-2">
        <label className="inline-flex">
          <Button variant="secondary" size="small" asChild disabled={uploading}>
            <span>
              {uploading
                ? t('FIELD_IMAGE_UPLOADING')
                : value
                  ? t('FIELD_IMAGE_CHANGE')
                  : t('FIELD_IMAGE_UPLOAD')}
            </span>
          </Button>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.currentTarget.value = '';
            }}
          />
        </label>
        {value ? (
          <Button
            variant="transparent"
            size="small"
            type="button"
            onClick={() => onChange('')}
            aria-label={t('FIELD_IMAGE_REMOVE')}
          >
            <Trash />
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default ImageUploader;
