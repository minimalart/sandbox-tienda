import { Button, Text } from '@medusajs/ui';
import { useState } from 'react';
import { sdk } from '../../lib/client';

/** Sube un logo de empresa al storage de Medusa y devuelve la URL via onChange. */
export function LogoUploader({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const url = res.files?.[0]?.url;
      if (url) onChange(url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
        {value ? (
          <img src={value} alt="" className="size-full object-contain" />
        ) : (
          <Text size="xsmall" className="text-ui-fg-muted">
            Sin logo
          </Text>
        )}
      </div>
      <div className="flex gap-2">
        <label className="inline-flex">
          <Button variant="secondary" size="small" asChild>
            <span>{uploading ? 'Subiendo…' : value ? 'Cambiar' : 'Subir logo'}</span>
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
          <Button variant="transparent" size="small" onClick={() => onChange(null)}>
            Quitar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default LogoUploader;
