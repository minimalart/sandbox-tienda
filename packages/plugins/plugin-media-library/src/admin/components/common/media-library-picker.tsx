import { FocusModal, Input, Text } from '@medusajs/ui';
import { useState } from 'react';
import { useMediaAssets } from '../../hooks/api/media-library';

/**
 * Reusable picker backed by the Biblioteca (media-library) module. Lets the user
 * reuse an already-uploaded S3 asset (its public `url`) instead of re-uploading.
 * Used by the email branding card and the Puck Logo/Image blocks.
 */
export function MediaLibraryPickerModal({
  open,
  onOpenChange,
  onPick,
  title = 'Elegir de la biblioteca',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (url: string) => void;
  title?: string;
}) {
  const [query, setQuery] = useState('');
  // Only hit the endpoint while the modal is open. The list searches by filename.
  const { data, isPending } = useMediaAssets(
    open ? { q: query || undefined, limit: 60 } : { limit: 0 },
  );
  const assets = open ? (data?.media_assets ?? []) : [];

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>{title}</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col gap-4 overflow-y-auto p-6">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre de archivo…"
            autoComplete="off"
          />
          {isPending ? (
            <Text size="small" className="text-ui-fg-subtle">
              Cargando…
            </Text>
          ) : assets.length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">
              No hay imágenes en la biblioteca que coincidan.
            </Text>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onPick(a.url);
                    onOpenChange(false);
                  }}
                  title={a.filename}
                  className="flex flex-col gap-1 rounded-lg border border-ui-border-base p-2 text-left transition-colors hover:border-ui-border-interactive hover:bg-ui-bg-base-hover"
                >
                  <div className="grid aspect-square place-items-center overflow-hidden rounded bg-ui-bg-subtle">
                    <img
                      src={a.url}
                      alt={a.alt ?? a.filename}
                      className="size-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <Text size="xsmall" className="truncate text-ui-fg-muted">
                    {a.filename}
                  </Text>
                </button>
              ))}
            </div>
          )}
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  );
}

export default MediaLibraryPickerModal;
