import { Button, Drawer, Input, Label, Select, Text, Textarea } from '@medusajs/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { sdk } from '../../../lib/client';
import type { PdfHotspotType } from '../../../hooks/api';

const VARIANT_ANY = '__any__';
const PRODUCT_FIELDS = 'id,title,handle,thumbnail,variants.id,variants.title';

export type HotspotDraft = {
  type: PdfHotspotType;
  product_id: string | null;
  variant_id: string | null;
  // Datos de display para el producto elegido (no se persiste, se recalcula).
  product_title?: string | null;
  product_thumbnail?: string | null;
  product_variants?: { id: string; title?: string }[];
  data: Record<string, unknown> | null;
};

type ProductResult = {
  id: string;
  title: string;
  thumbnail?: string | null;
  variants?: { id: string; title?: string }[];
};

interface Props {
  open: boolean;
  draft: HotspotDraft;
  onCancel: () => void;
  onSave: (draft: HotspotDraft) => void;
}

/** Configura el contenido de un hotspot antes de guardarlo en el catálogo. */
export function HotspotConfigDialog({ open, draft, onCancel, onSave }: Props) {
  const [local, setLocal] = useState<HotspotDraft>(draft);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    setLocal(draft);
    setSearch('');
    setDebounced('');
  }, [draft, open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data: searchData } = useQuery({
    queryKey: ['pdfcat-product-search', debounced],
    queryFn: () => sdk.admin.product.list({ q: debounced, limit: 8, fields: PRODUCT_FIELDS }),
    enabled: open && local.type === 'product' && debounced.length >= 2,
  });
  const results = (searchData?.products ?? []) as ProductResult[];

  const setData = (patch: Record<string, unknown>) =>
    setLocal((p) => ({ ...p, data: { ...(p.data ?? {}), ...patch } }));

  const pickProduct = (p: ProductResult) => {
    setLocal((prev) => ({
      ...prev,
      product_id: p.id,
      variant_id: null,
      product_title: p.title,
      product_thumbnail: p.thumbnail ?? null,
      product_variants: p.variants ?? [],
    }));
    setSearch('');
    setDebounced('');
  };

  const youtubeId = extractYoutubeId(String((local.data as any)?.youtubeUrl ?? ''));

  const canSave =
    (local.type === 'product' && !!local.product_id) ||
    (local.type === 'video' && !!youtubeId) ||
    (local.type === 'text' && !!String((local.data as any)?.title ?? '').trim());

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onCancel()}>
      <Drawer.Content className="z-[60]">
        <Drawer.Header>
          <Drawer.Title>
            {local.type === 'product'
              ? 'Producto'
              : local.type === 'video'
                ? 'Video'
                : 'Texto'}
          </Drawer.Title>
          <Drawer.Description className="sr-only">
            Configurá el contenido del hotspot antes de guardarlo.
          </Drawer.Description>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          {local.type === 'product' && (
            <>
              {local.product_id ? (
                <div className="flex items-center gap-3 rounded-lg border border-ui-border-base p-3">
                  <Thumb src={local.product_thumbnail} />
                  <div className="flex-1">
                    <Text size="small" className="font-medium">
                      {local.product_title ?? local.product_id}
                    </Text>
                  </div>
                  <Button
                    variant="transparent"
                    size="small"
                    onClick={() =>
                      setLocal((p) => ({
                        ...p,
                        product_id: null,
                        variant_id: null,
                        product_title: null,
                        product_thumbnail: null,
                        product_variants: [],
                      }))
                    }
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Label size="xsmall">Buscar producto</Label>
                  <Input
                    placeholder="Escribí para buscar…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {debounced.length >= 2 && results.length > 0 && (
                    <div className="mt-1 max-h-60 overflow-y-auto rounded-lg border border-ui-border-base">
                      {results.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pickProduct(p)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ui-bg-base-hover"
                        >
                          <Thumb src={p.thumbnail} />
                          <Text size="small">{p.title}</Text>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {local.product_id && (local.product_variants?.length ?? 0) > 1 && (
                <div className="flex flex-col gap-1">
                  <Label size="xsmall">Variante</Label>
                  <Select
                    value={local.variant_id ?? VARIANT_ANY}
                    onValueChange={(v) =>
                      setLocal((p) => ({ ...p, variant_id: v === VARIANT_ANY ? null : v }))
                    }
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="El cliente elige" />
                    </Select.Trigger>
                    <Select.Content className="z-[70]">
                      <Select.Item value={VARIANT_ANY}>El cliente elige</Select.Item>
                      {(local.product_variants ?? []).map((v) => (
                        <Select.Item key={v.id} value={v.id}>
                          {v.title || v.id}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              )}
            </>
          )}

          {local.type === 'video' && (
            <>
              <div className="flex flex-col gap-1">
                <Label size="xsmall">URL de YouTube</Label>
                <Input
                  placeholder="https://youtube.com/watch?v=…"
                  value={String((local.data as any)?.youtubeUrl ?? '')}
                  onChange={(e) => setData({ youtubeUrl: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="xsmall">Título (opcional)</Label>
                <Input
                  value={String((local.data as any)?.title ?? '')}
                  onChange={(e) => setData({ title: e.target.value })}
                />
              </div>
              {youtubeId && (
                <div className="aspect-video overflow-hidden rounded-lg">
                  <iframe
                    className="h-full w-full"
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    allowFullScreen
                  />
                </div>
              )}
            </>
          )}

          {local.type === 'text' && (
            <>
              <div className="flex flex-col gap-1">
                <Label size="xsmall">Título</Label>
                <Input
                  value={String((local.data as any)?.title ?? '')}
                  onChange={(e) => setData({ title: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="xsmall">Contenido</Label>
                <Textarea
                  rows={5}
                  value={String((local.data as any)?.content ?? '')}
                  onChange={(e) => setData({ content: e.target.value })}
                />
              </div>
            </>
          )}
        </Drawer.Body>

        <Drawer.Footer>
          <Button variant="secondary" size="small" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="small" disabled={!canSave} onClick={() => onSave(local)}>
            Guardar
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

function Thumb({ src }: { src?: string | null }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-ui-bg-component">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
    </span>
  );
}

/** Extrae el id de 11 chars de una URL de YouTube (watch/embed/shorts/youtu.be). */
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}
