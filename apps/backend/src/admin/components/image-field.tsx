import { Button, Input, Label, Text, toast } from '@medusajs/ui';
import { useRef, useState } from 'react';
import { sdk } from '../lib/client';

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  help?: string;
  /** accept del input file (default image/*). */
  accept?: string;
};

/**
 * Campo de imagen reutilizable: acepta URL pegada **o** subir un archivo
 * (`sdk.admin.upload.create` → `files[0].url`). Muestra preview y botón para
 * quitar. Todo opcional; `value` vacío = sin imagen.
 */
export const ImageField = ({ label, value, onChange, help, accept = 'image/*' }: Props) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const url = res.files?.[0]?.url;
      if (url) onChange(url);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        {value ? (
          <img
            src={value}
            alt={label}
            className="h-10 w-10 shrink-0 rounded border border-ui-border-base bg-ui-bg-subtle object-contain"
          />
        ) : null}
        <Input
          value={value}
          placeholder="https://… o subí una imagen"
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          size="small"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          isLoading={uploading}
        >
          Subir
        </Button>
        {value ? (
          <Button type="button" size="small" variant="transparent" onClick={() => onChange('')}>
            Quitar
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {help ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {help}
        </Text>
      ) : null}
    </div>
  );
};
