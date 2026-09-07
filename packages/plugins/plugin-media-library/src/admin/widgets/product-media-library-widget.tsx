/**
 * Widget en el detalle de producto: elegir imágenes de la Biblioteca y
 * agregarlas al producto (merge + dedup, mantiene las actuales).
 *
 * Zona: product.details.after
 */
import { defineWidgetConfig } from '@medusajs/admin-sdk';
import type { AdminProduct, DetailWidgetProps } from '@medusajs/framework/types';
import {
  Button,
  Container,
  FocusModal,
  Heading,
  Input,
  Text,
  toast,
} from '@medusajs/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  MEDIA_PAGE_SIZE,
  useAttachToProduct,
  useMediaAssets,
} from '../hooks/api/media-library';
import {
  type EditorImage,
  ImageEditorModal,
} from '../routes/media-library/components/image-editor';

const ProductMediaLibraryWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const productId = data.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);

  const { data: assetsData, isLoading } = useMediaAssets({ q: q || undefined, page });
  const attach = useAttachToProduct();
  const assets = assetsData?.media_assets ?? [];
  const count = assetsData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / MEDIA_PAGE_SIZE));

  const editorImages: EditorImage[] = assets
    .filter((a) => selected.has(a.id))
    .map((a) => ({
      sourceAssetId: a.id,
      sourceFileId: a.file_id ?? null,
      sourceUrl: a.url,
      filename: a.filename,
    }));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onAttach = async () => {
    if (selected.size === 0) return;
    try {
      const r = await attach.mutateAsync({
        product_id: productId,
        asset_ids: [...selected],
      });
      toast.success(`Agregadas ${r.added} imágenes (${r.total} en total).`);
      setSelected(new Set());
      setOpen(false);
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Biblioteca de imágenes</Heading>
        <FocusModal open={open} onOpenChange={setOpen}>
          <FocusModal.Trigger asChild>
            <Button size="small" variant="secondary">
              Agregar desde Biblioteca
            </Button>
          </FocusModal.Trigger>
          <FocusModal.Content>
            <FocusModal.Header>
              <div className="flex w-full items-center justify-between gap-4">
                <Input
                  placeholder="Buscar por nombre…"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  className="w-[260px]"
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={selected.size === 0}
                    onClick={() => {
                      setOpen(false);
                      setEditorOpen(true);
                    }}
                  >
                    Editar {selected.size > 0 ? `(${selected.size})` : ''}
                  </Button>
                  <Button
                    onClick={onAttach}
                    isLoading={attach.isPending}
                    disabled={selected.size === 0}
                  >
                    Agregar {selected.size > 0 ? `(${selected.size})` : ''}
                  </Button>
                </div>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="overflow-y-auto p-6">
              {isLoading ? (
                <Text className="text-ui-fg-subtle">Cargando…</Text>
              ) : assets.length === 0 ? (
                <Text className="text-ui-fg-subtle">
                  No hay imágenes en la Biblioteca. Subí o importá desde la sección Biblioteca.
                </Text>
              ) : (
                <div className="grid grid-cols-3 gap-3 md:grid-cols-5 lg:grid-cols-6">
                  {assets.map((a) => {
                    const isSel = selected.has(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggle(a.id)}
                        className={`relative flex flex-col overflow-hidden rounded-lg border-2 text-left ${
                          isSel ? 'border-ui-fg-interactive' : 'border-ui-border-base'
                        }`}
                      >
                        <div className="aspect-square w-full bg-ui-bg-subtle">
                          <img src={a.url} className="h-full w-full object-cover" loading="lazy" />
                        </div>
                        {isSel ? (
                          <span className="absolute right-1 top-1 rounded-full bg-ui-fg-interactive px-1.5 text-white text-xs">
                            ✓
                          </span>
                        ) : null}
                        <Text size="xsmall" className="truncate p-1" title={a.filename}>
                          {a.filename}
                        </Text>
                      </button>
                    );
                  })}
                </div>
              )}
              {count > MEDIA_PAGE_SIZE ? (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={page <= 1 || isLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Text size="small" className="text-ui-fg-subtle">
                    {page} / {totalPages}
                  </Text>
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={page >= totalPages || isLoading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              ) : null}
            </FocusModal.Body>
          </FocusModal.Content>
        </FocusModal>
      </div>
      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Reutilizá imágenes ya subidas: se agregan a las actuales sin duplicar.
        </Text>
      </div>
      {editorOpen ? (
        <ImageEditorModal
          open={editorOpen}
          images={editorImages}
          productId={productId}
          onClose={() => {
            setEditorOpen(false);
            setSelected(new Set());
          }}
        />
      ) : null}
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: 'product.details.after',
});

export default ProductMediaLibraryWidget;
