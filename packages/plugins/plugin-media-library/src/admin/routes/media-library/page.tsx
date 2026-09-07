import { defineRouteConfig } from '@medusajs/admin-sdk';
import { FolderOpen } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Text,
  toast,
  Toaster,
  usePrompt,
} from '@medusajs/ui';
import { SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';
import { useRef, useState } from 'react';
import { sdk } from '../../lib/client';
import {
  MEDIA_PAGE_SIZE,
  type MediaAsset,
  useBackfill,
  useDeleteAsset,
  useMediaAssets,
  useRegisterAsset,
  useUpdateAsset,
} from '../../hooks/api/media-library';
import { type EditorImage, ImageEditorModal } from './components/image-editor';

const MediaLibraryPage = () => {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMediaAssets({ q: q || undefined, page });
  const register = useRegisterAsset();
  const del = useDeleteAsset();
  const update = useUpdateAsset();
  const backfill = useBackfill();
  const prompt = usePrompt();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [detailAsset, setDetailAsset] = useState<MediaAsset | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);

  const assets = data?.media_assets ?? [];
  const count = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / MEDIA_PAGE_SIZE));
  const rangeStart = count === 0 ? 0 : (page - 1) * MEDIA_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * MEDIA_PAGE_SIZE, count);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const editorImages: EditorImage[] = assets
    .filter((a) => selected.has(a.id))
    .map((a) => ({
      sourceAssetId: a.id,
      sourceFileId: a.file_id ?? null,
      sourceUrl: a.url,
      filename: a.filename,
    }));

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: Array.from(files) });
      for (const f of res.files ?? []) {
        const url = (f as { url?: string }).url;
        const id = (f as { id?: string }).id;
        if (!url) continue;
        const filename = decodeURIComponent(url.split('/').pop() || url);
        await register.mutateAsync({ url, file_id: id, filename });
      }
      toast.success('Imágenes subidas a la Biblioteca');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onBackfill = async () => {
    try {
      const r = await backfill.mutateAsync();
      toast.success(`Importadas ${r.imported} imágenes de productos (${r.skipped} ya estaban).`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (a: MediaAsset) => {
    const ok = await prompt({
      title: 'Eliminar de la Biblioteca',
      description: `¿Eliminar "${a.filename}" del catálogo? El archivo NO se borra de S3.`,
      variant: 'danger',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    try {
      await del.mutateAsync(a.id);
      toast.success('Eliminado del catálogo');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveRename = async () => {
    if (!editing) return;
    try {
      await update.mutateAsync({ id: editing.id, filename: editing.name });
      setEditing(null);
      toast.success('Renombrado');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const copyPublicUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('URL copiada');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo copiar la URL');
    }
  };

  return (
    <>
      <Container className="p-0">
        <SiteScopeBar screen="media-library" />
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
          <div className="flex items-center gap-x-2">
            <Heading>Biblioteca</Heading>
            <Badge size="2xsmall">v1.1.3</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por nombre…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="w-[200px]"
            />
            <Button size="small" variant="secondary" onClick={onBackfill} isLoading={backfill.isPending}>
              Importar de productos
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={selected.size === 0}
              onClick={() => setEditorOpen(true)}
            >
              Editar{selected.size > 0 ? ` (${selected.size})` : ''}
            </Button>
            <Button size="small" onClick={() => fileRef.current?.click()} isLoading={uploading}>
              Subir
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onUpload(e.target.files)}
            />
          </div>
        </div>

        <div className="px-6 py-4">
          {isLoading ? (
            <Text className="text-ui-fg-subtle">Cargando…</Text>
          ) : assets.length === 0 ? (
            <Text className="text-ui-fg-subtle">
              No hay assets. Subí imágenes o importá las de productos.
            </Text>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {assets.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-ui-border-base"
                >
                  <div className="relative aspect-square w-full bg-ui-bg-subtle">
                    <img src={a.url} className="h-full w-full object-cover" loading="lazy" />
                    <label className="absolute left-1.5 top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded bg-white/90 shadow">
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                        className="h-3.5 w-3.5"
                      />
                    </label>
                  </div>
                  <div className="flex flex-col gap-1 p-2">
                    {editing?.id === a.id ? (
                      <div className="flex flex-col gap-1">
                        <Input
                          size="small"
                          value={editing.name}
                          onChange={(e) => setEditing({ id: a.id, name: e.target.value })}
                        />
                        <div className="flex gap-1">
                          <Button size="small" onClick={saveRename}>
                            Guardar
                          </Button>
                          <Button size="small" variant="transparent" onClick={() => setEditing(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Text size="xsmall" className="truncate" title={a.filename}>
                          {a.filename}
                        </Text>
                        <div className="flex flex-wrap justify-between gap-1">
                          <Button
                            size="small"
                            variant="transparent"
                            onClick={() => setDetailAsset(a)}
                          >
                            Ver detalle
                          </Button>
                          <Button
                            size="small"
                            variant="transparent"
                            onClick={() => setEditing({ id: a.id, name: a.filename })}
                          >
                            Renombrar
                          </Button>
                          <Button
                            size="small"
                            variant="transparent"
                            className="text-red-600"
                            onClick={() => onDelete(a)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {count > 0 ? (
            <div className="mt-4 flex items-center justify-between border-ui-border-base border-t pt-3">
              <Text size="small" className="text-ui-fg-subtle">
                {rangeStart}–{rangeEnd} de {count}
              </Text>
              <div className="flex items-center gap-2">
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
            </div>
          ) : null}
        </div>
      </Container>

      {/*
        Card informativa. La configuración de S3 son opciones del provider de
        archivos del core y se evalúan al arrancar el backend: no hay un panel
        editable por diseño. Se muestra para que el almacenamiento deje de ser
        invisible y quede claro dónde vive cada variable.
      */}
      <Container className="mt-4 p-0">
        <div className="flex flex-col gap-2 px-6 py-4">
          <Heading level="h2">Almacenamiento (S3)</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Los archivos los sube y los sirve el módulo File del core. Su
            configuración se evalúa al arrancar el backend, así que se administra
            por variables de entorno: <code>S3_BUCKET</code>, <code>S3_REGION</code>,
            <code>S3_ACCESS_KEY_ID</code>, <code>S3_SECRET_ACCESS_KEY</code>,
            <code>S3_ENDPOINT</code> (alias <code>S3_URL</code>),
            <code>S3_FILE_URL</code> (alias <code>S3_PUBLIC_URL</code>),
            <code>S3_PREFIX</code>, <code>S3_FORCE_PATH_STYLE</code>.
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Si <code>S3_BUCKET</code> está vacío se registra el provider LOCAL
            (efímero en contenedores). Cambiar <code>S3_PREFIX</code> con assets
            ya subidos los deja huérfanos: las filas del catálogo guardan la URL
            completa y no se reescriben.
          </Text>
        </div>
      </Container>

      {editorOpen ? (
        <ImageEditorModal
          open={editorOpen}
          images={editorImages}
          onClose={() => setEditorOpen(false)}
          onSaved={() => setSelected(new Set())}
        />
      ) : null}
      <Drawer open={!!detailAsset} onOpenChange={(open) => !open && setDetailAsset(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Detalle de imagen</Drawer.Title>
          </Drawer.Header>
          {detailAsset ? (
            <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
              <div className="overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
                <img src={detailAsset.url} className="max-h-[360px] w-full object-contain" />
              </div>

              <div className="flex flex-col gap-1">
                <Text size="small" weight="plus">
                  Archivo
                </Text>
                <Text size="small" className="break-all text-ui-fg-subtle">
                  {detailAsset.filename}
                </Text>
              </div>

              <div className="flex flex-col gap-2">
                <Text size="small" weight="plus">
                  URL pública
                </Text>
                <div className="flex items-center gap-2">
                  <Input readOnly value={detailAsset.url} className="min-w-0 flex-1" />
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => copyPublicUrl(detailAsset.url)}
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              {detailAsset.mime_type || detailAsset.size || detailAsset.created_at ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {detailAsset.mime_type ? (
                    <div className="flex flex-col gap-1">
                      <Text size="small" weight="plus">
                        Tipo
                      </Text>
                      <Text size="small" className="text-ui-fg-subtle">
                        {detailAsset.mime_type}
                      </Text>
                    </div>
                  ) : null}
                  {detailAsset.size ? (
                    <div className="flex flex-col gap-1">
                      <Text size="small" weight="plus">
                        Tamaño
                      </Text>
                      <Text size="small" className="text-ui-fg-subtle">
                        {Math.round(detailAsset.size / 1024).toLocaleString('es-AR')} KB
                      </Text>
                    </div>
                  ) : null}
                  {detailAsset.created_at ? (
                    <div className="flex flex-col gap-1">
                      <Text size="small" weight="plus">
                        Creada
                      </Text>
                      <Text size="small" className="text-ui-fg-subtle">
                        {new Date(detailAsset.created_at).toLocaleString('es-AR')}
                      </Text>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Drawer.Body>
          ) : null}
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Cerrar</Button>
            </Drawer.Close>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
      <Toaster />
    </>
  );
};

const MediaLibraryIcon = () => <FolderOpen style={{ color: '#9333EA' }} />;

export const config = defineRouteConfig({
  label: 'Biblioteca',
  icon: MediaLibraryIcon,
  rank: 35,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Biblioteca',
};

export default MediaLibraryPage;
