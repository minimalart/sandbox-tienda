import { MediaLibraryPickerModal } from '@minimalart/mercatto-plugin-media-library/admin/components/media-library-picker';
import { useRef, useState } from 'react';
import { sdk } from '../../client';

/**
 * Custom field de Puck para URLs de imagen respaldadas por S3. Combina tres
 * fuentes en un solo campo:
 *  - Input de texto (pegar URL directa).
 *  - Botón "Subir imagen": abre el file picker y sube a S3 vía admin.upload.
 *  - Botón "Biblioteca": abre `MediaLibraryPickerModal` del plugin
 *    `@minimalart/mercatto-plugin-media-library`.
 *
 * En los tres casos `onChange` recibe la URL final. Preferimos este field
 * sobre `type: 'text'` para cualquier campo de imagen del editor de home o
 * de emails, así el operador no tiene que copiar URLs a mano.
 */
export function S3ImageFieldRender({
  value,
  onChange,
  label = 'URL de imagen',
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const url = res.files?.[0]?.url;
      if (url) onChange(url);
    } catch {
      // Silent — errores de upload se ven en la network tab; el user puede pegar la URL a mano.
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <input
        type="text"
        value={value}
        placeholder={label}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '4px 8px',
          borderRadius: 4,
          border: '1px solid #d1d5db',
          fontSize: 13,
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <span
            style={{
              fontSize: 12,
              padding: '3px 10px',
              borderRadius: 4,
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              whiteSpace: 'nowrap',
            }}
          >
            {uploading ? 'Subiendo…' : 'Subir imagen'}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.currentTarget.value = '';
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          style={{
            fontSize: 12,
            padding: '3px 10px',
            borderRadius: 4,
            border: '1px solid #d1d5db',
            background: '#f9fafb',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          Biblioteca
        </button>
        {value && (
          <span
            style={{
              fontSize: 11,
              color: '#9ca3af',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 120,
            }}
            title={value}
          >
            {value}
          </span>
        )}
      </div>
      <MediaLibraryPickerModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={onChange}
        title="Elegir imagen de la biblioteca"
      />
    </div>
  );
}

/** Puck custom field definition for S3-backed image URLs. */
export const s3ImageField = (fieldLabel: string) => ({
  type: 'custom' as const,
  label: fieldLabel,
  render: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <S3ImageFieldRender value={value ?? ''} onChange={onChange} label={fieldLabel} />
  ),
});
