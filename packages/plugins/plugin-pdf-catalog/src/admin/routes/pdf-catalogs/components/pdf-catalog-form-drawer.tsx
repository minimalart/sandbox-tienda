import {
  Badge,
  Button,
  Checkbox,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  Switch,
  Text,
  Tooltip,
  toast,
} from '@medusajs/ui';
import { ChevronLeft, ChevronRight, DocumentText, Photo, PlaySolid, Trash } from '@medusajs/icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  PdfCatalog,
  PdfHotspotType,
  useCreatePdfCatalog,
  usePdfCatalog,
  useUpdatePdfCatalog,
} from '../../../hooks/api';
import { sdk } from '../../../lib/client';
import { PdfPageCanvas } from './pdf-page-canvas';
import { HotspotConfigDialog, HotspotDraft } from './hotspot-config-dialog';

const PRODUCT_FIELDS = 'id,title,handle,thumbnail,variants.id,variants.title';

type LocalHotspot = {
  key: string;
  type: PdfHotspotType;
  page_index: number;
  pos_x: number;
  pos_y: number;
  product_id: string | null;
  variant_id: string | null;
  data: Record<string, unknown> | null;
  product_title?: string | null;
  product_thumbnail?: string | null;
  product_variants?: { id: string; title?: string }[];
};

interface Props {
  catalog: PdfCatalog | null; // null = crear
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

let keyCounter = 0;
const nextKey = () => `hs_${Date.now()}_${keyCounter++}`;

const TYPE_META: Record<PdfHotspotType, { label: string; Icon: any; color: string }> = {
  product: { label: 'Producto', Icon: Photo, color: '#2563eb' },
  video: { label: 'Video', Icon: PlaySolid, color: '#dc2626' },
  text: { label: 'Texto', Icon: DocumentText, color: '#7c3aed' },
};

export const PdfCatalogFormDrawer = ({ catalog, open, onOpenChange }: Props) => {
  const isEdit = !!catalog;

  const [name, setName] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfFileId, setPdfFileId] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [published, setPublished] = useState(false);
  const [salesChannelIds, setSalesChannelIds] = useState<string[]>([]);
  const [hotspots, setHotspots] = useState<LocalHotspot[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [placingType, setPlacingType] = useState<PdfHotspotType | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [config, setConfig] = useState<{
    open: boolean;
    key: string | null; // null = nuevo
    draft: HotspotDraft;
    page: number;
    x: number;
    y: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const { data: detail } = usePdfCatalog(catalog?.id ?? '', { enabled: isEdit && open });
  const full = detail?.pdf_catalog;

  const { data: channelsData } = useQuery({
    queryKey: ['pdfcat-sales-channels'],
    queryFn: () => sdk.admin.salesChannel.list({ limit: 200, fields: 'id,name' }),
    enabled: open,
  });
  const channels = (channelsData?.sales_channels ?? []) as { id: string; name: string }[];

  // Ids de productos de hotspots del catálogo en edición (para traer título/thumb).
  const productIds = (full?.hotspots ?? [])
    .filter((h) => h.type === 'product' && h.product_id)
    .map((h) => h.product_id as string);
  const { data: linkedProducts } = useQuery({
    queryKey: ['pdfcat-linked-products', productIds],
    queryFn: () => sdk.admin.product.list({ id: productIds, limit: 100, fields: PRODUCT_FIELDS }),
    enabled: open && productIds.length > 0,
  });

  const reset = () => {
    setName('');
    setPdfUrl('');
    setPdfFileId(null);
    setPages(0);
    setPublished(false);
    setSalesChannelIds([]);
    setHotspots([]);
    setCurrentPage(0);
    setPlacingType(null);
    setConfig(null);
  };

  // Cargar/limpiar al abrir.
  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      reset();
      return;
    }
    const src = full ?? catalog;
    if (!src) return;
    setName(src.name ?? '');
    setPdfUrl(src.pdf_url ?? '');
    setPdfFileId(src.pdf_file_id ?? null);
    setPages(src.pages ?? 0);
    setPublished(src.published ?? false);
    setSalesChannelIds(src.sales_channel_ids ?? []);
  }, [open, isEdit, full]);

  // Reconstruir hotspots locales cuando llega el detalle + productos.
  useEffect(() => {
    if (!isEdit || !full?.hotspots) return;
    const byId = new Map(
      ((linkedProducts?.products ?? []) as any[]).map((p) => [p.id, p])
    );
    const built: LocalHotspot[] = [...full.hotspots]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((h) => {
        const p = h.product_id ? byId.get(h.product_id) : null;
        return {
          key: nextKey(),
          type: h.type,
          page_index: h.page_index ?? 0,
          pos_x: h.pos_x ?? 50,
          pos_y: h.pos_y ?? 50,
          product_id: h.product_id ?? null,
          variant_id: h.variant_id ?? null,
          data: (h.data as Record<string, unknown> | null) ?? null,
          product_title: p?.title ?? h.product_id ?? null,
          product_thumbnail: p?.thumbnail ?? null,
          product_variants: p?.variants ?? [],
        };
      });
    setHotspots(built);
  }, [full?.id, linkedProducts]);

  const createMutation = useCreatePdfCatalog({
    onSuccess: () => {
      toast.success('Catálogo creado');
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = useUpdatePdfCatalog(catalog?.id ?? '', {
    onSuccess: () => {
      toast.success('Catálogo actualizado');
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('El archivo debe ser un PDF');
      return;
    }
    setIsUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const uploaded = res.files?.[0];
      if (uploaded?.url) {
        setPdfUrl(uploaded.url);
        setPdfFileId(uploaded.id ?? null);
        setCurrentPage(0);
        if (!name) setName(file.name.replace(/\.pdf$/i, ''));
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  // ── Colocación / edición de hotspots ───────────────────────────────────────
  const handlePageClick = (x: number, y: number) => {
    if (!placingType) return;
    setConfig({
      open: true,
      key: null,
      draft: {
        type: placingType,
        product_id: null,
        variant_id: null,
        data: placingType === 'product' ? null : {},
      },
      page: currentPage,
      x,
      y,
    });
  };

  const saveConfig = (draft: HotspotDraft) => {
    if (!config) return;
    if (config.key === null) {
      // nuevo
      setHotspots((prev) => [
        ...prev,
        {
          key: nextKey(),
          type: draft.type,
          page_index: config.page,
          pos_x: config.x,
          pos_y: config.y,
          product_id: draft.product_id,
          variant_id: draft.variant_id,
          data: draft.data,
          product_title: draft.product_title,
          product_thumbnail: draft.product_thumbnail,
          product_variants: draft.product_variants,
        },
      ]);
    } else {
      const k = config.key;
      setHotspots((prev) =>
        prev.map((h) =>
          h.key === k
            ? {
                ...h,
                product_id: draft.product_id,
                variant_id: draft.variant_id,
                data: draft.data,
                product_title: draft.product_title,
                product_thumbnail: draft.product_thumbnail,
                product_variants: draft.product_variants,
              }
            : h
        )
      );
    }
    setPlacingType(null);
    setConfig(null);
  };

  const editHotspot = (h: LocalHotspot) => {
    setConfig({
      open: true,
      key: h.key,
      draft: {
        type: h.type,
        product_id: h.product_id,
        variant_id: h.variant_id,
        product_title: h.product_title,
        product_thumbnail: h.product_thumbnail,
        product_variants: h.product_variants,
        data: h.data,
      },
      page: h.page_index,
      x: h.pos_x,
      y: h.pos_y,
    });
  };

  const removeHotspot = (key: string) =>
    setHotspots((prev) => prev.filter((h) => h.key !== key));

  const posFromEvent = (e: { clientX: number; clientY: number }) => {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(100, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 100))),
      y: Math.min(100, Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * 100))),
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingKey) return;
    const p = posFromEvent(e);
    if (p) setHotspots((prev) => prev.map((h) => (h.key === draggingKey ? { ...h, ...{ pos_x: p.x, pos_y: p.y } } : h)));
  };

  const toggleChannel = (id: string) =>
    setSalesChannelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = async () => {
    if (!name || !pdfUrl) {
      toast.error('Nombre y PDF son obligatorios');
      return;
    }
    const payload = {
      name,
      pdf_url: pdfUrl,
      pdf_file_id: pdfFileId,
      pages,
      published,
      sales_channel_ids: salesChannelIds,
      hotspots: hotspots.map((h, i) => ({
        type: h.type,
        page_index: h.page_index,
        pos_x: h.pos_x,
        pos_y: h.pos_y,
        product_id: h.product_id,
        variant_id: h.variant_id,
        data: h.data,
        sort_order: i,
      })),
    };
    if (isEdit) await updateMutation.mutateAsync(payload);
    else await createMutation.mutateAsync(payload);
  };

  const pageHotspots = hotspots.filter((h) => h.page_index === currentPage);

  // El bucket S3 no manda CORS: la vista previa lee el PDF por el proxy
  // same-origin del backend cuando hay file id; si no, cae a la URL pública.
  const previewUrl = pdfFileId
    ? `/admin/pdf-catalogs/file?id=${encodeURIComponent(pdfFileId)}`
    : pdfUrl;

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title asChild>
            <span className="sr-only">{isEdit ? 'Editar catálogo' : 'Nuevo catálogo'}</span>
          </FocusModal.Title>
          <FocusModal.Description className="sr-only">
            Formulario para {isEdit ? 'editar' : 'crear'} un catálogo PDF con hotspots.
          </FocusModal.Description>
          <div className="flex w-full items-center justify-end gap-x-2">
            <Button variant="secondary" size="small" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="small" onClick={handleSubmit} isLoading={isPending}>
              {isEdit ? 'Guardar cambios' : 'Crear'}
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 overflow-hidden">
          {/* Izquierda: formulario */}
          <div className="flex-1 overflow-y-auto px-8 py-10">
            <div className="mx-auto flex w-full max-w-[560px] flex-col gap-8">
              <Heading>{isEdit ? 'Editar catálogo' : 'Nuevo catálogo'}</Heading>

              <div className="flex flex-col gap-1">
                <Label size="xsmall">Nombre *</Label>
                <Input
                  placeholder="Catálogo primavera 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* PDF */}
              <div className="flex flex-col gap-2 border-t pt-6">
                <Label size="xsmall">Archivo PDF *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="small"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    isLoading={isUploading}
                  >
                    {pdfUrl ? 'Reemplazar PDF' : 'Subir PDF'}
                  </Button>
                  {pdfUrl && (
                    <Text size="small" className="text-ui-fg-subtle">
                      {pages > 0 ? `${pages} páginas` : 'Cargado'}
                    </Text>
                  )}
                </div>
              </div>

              {/* Paleta de hotspots */}
              {pdfUrl && (
                <div className="flex flex-col gap-3 border-t pt-6">
                  <div>
                    <Heading level="h3">Hotspots</Heading>
                    <Text size="small" className="text-ui-fg-subtle">
                      Elegí un tipo y hacé click sobre la página para colocarlo. Podés arrastrarlos
                      para reposicionar.
                    </Text>
                  </div>
                  <div className="flex gap-2">
                    {(Object.keys(TYPE_META) as PdfHotspotType[]).map((t) => {
                      const { label, Icon } = TYPE_META[t];
                      const active = placingType === t;
                      return (
                        <Button
                          key={t}
                          type="button"
                          size="small"
                          variant={active ? 'primary' : 'secondary'}
                          onClick={() => setPlacingType(active ? null : t)}
                        >
                          <Icon /> {label}
                        </Button>
                      );
                    })}
                  </div>
                  {placingType && (
                    <Badge size="2xsmall" color="blue">
                      Click en la página para colocar: {TYPE_META[placingType].label}
                    </Badge>
                  )}

                  {hotspots.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {hotspots.map((h, i) => {
                        const { label, Icon, color } = TYPE_META[h.type];
                        const title =
                          h.type === 'product'
                            ? h.product_title ?? h.product_id ?? label
                            : String((h.data as any)?.title ?? '') || label;
                        return (
                          <li
                            key={h.key}
                            className="flex items-center gap-2 rounded-lg border border-ui-border-base px-3 py-2"
                          >
                            <span
                              className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                              style={{ backgroundColor: color }}
                            >
                              <Icon className="h-3 w-3" />
                            </span>
                            <button
                              type="button"
                              className="flex-1 truncate text-left"
                              onClick={() => {
                                setCurrentPage(h.page_index);
                                editHotspot(h);
                              }}
                            >
                              <Text size="small" className="truncate">
                                {title}
                              </Text>
                            </button>
                            <Text size="xsmall" className="text-ui-fg-muted">
                              pág. {h.page_index + 1}
                            </Text>
                            <IconButton
                              size="small"
                              variant="transparent"
                              onClick={() => removeHotspot(h.key)}
                            >
                              <Trash className="text-ui-fg-muted" />
                            </IconButton>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* Publicación + activación por canal */}
              <div className="flex flex-col gap-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label size="xsmall">Publicado</Label>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Un catálogo debe estar publicado y activo en un canal para verse.
                    </Text>
                  </div>
                  <Switch checked={published} onCheckedChange={setPublished} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label size="xsmall">Activo en estos sales channels</Label>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Solo puede haber un catálogo activo por canal: activar un canal ya usado por otro
                    catálogo se lo quita a ese.
                  </Text>
                  <div className="flex flex-col gap-2">
                    {channels.map((c) => (
                      <label key={c.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={salesChannelIds.includes(c.id)}
                          onCheckedChange={() => toggleChannel(c.id)}
                        />
                        <Text size="small">{c.name}</Text>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Derecha: preview del PDF con hotspots */}
          <aside className="hidden w-[620px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-ui-border-base bg-ui-bg-subtle px-6 py-6 lg:flex">
            <Label className="font-semibold text-ui-fg-base">Vista previa</Label>
            {pdfUrl ? (
              <>
                <div className="flex items-center justify-center gap-3">
                  <IconButton
                    size="small"
                    variant="transparent"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft />
                  </IconButton>
                  <Text size="small" className="tabular-nums">
                    {currentPage + 1} / {pages || '…'}
                  </Text>
                  <IconButton
                    size="small"
                    variant="transparent"
                    disabled={pages > 0 && currentPage >= pages - 1}
                    onClick={() => setCurrentPage((p) => (pages ? Math.min(pages - 1, p + 1) : p + 1))}
                  >
                    <ChevronRight />
                  </IconButton>
                </div>
                <div className="flex justify-center">
                  <PdfPageCanvas
                    fileUrl={previewUrl}
                    pageIndex={currentPage}
                    width={560}
                    onNumPages={setPages}
                    onPageClick={handlePageClick}
                    placing={!!placingType}
                    wrapRef={wrapRef}
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => setDraggingKey(null)}
                  >
                    {pageHotspots.map((h) => {
                      const { Icon, color, label } = TYPE_META[h.type];
                      const title =
                        h.type === 'product'
                          ? h.product_title ?? label
                          : String((h.data as any)?.title ?? '') || label;
                      return (
                        <Tooltip key={h.key} content={title}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              editHotspot(h);
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setDraggingKey(h.key);
                            }}
                            style={{
                              left: `${h.pos_x}%`,
                              top: `${h.pos_y}%`,
                              backgroundColor: color,
                            }}
                            className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full text-white shadow-md ring-2 ring-white"
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      );
                    })}
                  </PdfPageCanvas>
                </div>
              </>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-ui-border-base">
                <Text size="small" className="text-ui-fg-muted">
                  Subí un PDF para previsualizarlo
                </Text>
              </div>
            )}
          </aside>
        </FocusModal.Body>
      </FocusModal.Content>

      {config && (
        <HotspotConfigDialog
          open={config.open}
          draft={config.draft}
          onCancel={() => {
            setConfig(null);
            setPlacingType(null);
          }}
          onSave={saveConfig}
        />
      )}
    </FocusModal>
  );
};
