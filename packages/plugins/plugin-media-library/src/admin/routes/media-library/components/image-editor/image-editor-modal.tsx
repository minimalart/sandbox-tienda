import {
  Button,
  FocusModal,
  Input,
  Label,
  Prompt,
  Select,
  Text,
  toast,
} from '@medusajs/ui';
import { useQueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
// react-easy-crop's default export type is not a valid JSX signature under
// strict tsc (works fine at runtime with esbuild). Cast to a component type.
import CropperImport, { type Area } from 'react-easy-crop';
const Cropper = CropperImport as unknown as React.ComponentType<any>;
import { sdk } from '../../../../lib/client';
import { MEDIA_QK } from '../../../../hooks/api/media-library';
import { DEFAULT_PRESET, PRESETS } from './presets';
import type { EditorImage, ExportFormat, SmoothingQuality } from './types';
import {
  centerCrop,
  exportImage,
  loadDisplayImage,
  loadExportImage,
  smartCrop,
} from './image-utils';

type Props = {
  open: boolean;
  onClose: () => void;
  images: EditorImage[];
  productId?: string;
  onSaved?: (assetIds: string[]) => void;
};

export default function ImageEditorModal({ open, onClose, images, productId, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [imgs, setImgs] = useState<EditorImage[]>(images);
  const [idx, setIdx] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [presetKey, setPresetKey] = useState(DEFAULT_PRESET.key);
  const [format, setFormat] = useState<ExportFormat>('webp');
  const [quality, setQuality] = useState(0.9);
  const [smoothing, setSmoothing] = useState<SmoothingQuality>('high');
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState<string[] | null>(null);

  useEffect(() => {
    setImgs(images);
    setIdx(0);
  }, [images]);

  const preset = useMemo(
    () => PRESETS.find((p) => p.key === presetKey) ?? DEFAULT_PRESET,
    [presetKey],
  );
  const current = imgs[idx];

  const onCropComplete = useCallback(
    (_area: Area, areaPixels: Area) => {
      setImgs((prev) =>
        prev.map((im, i) =>
          i === idx
            ? { ...im, manualPixels: areaPixels, useSmart: false }
            : im,
        ),
      );
    },
    [idx],
  );

  const applySmartCrop = async () => {
    if (!current) return;
    try {
      const img = await loadDisplayImage(current.sourceUrl);
      const rect = await smartCrop(img, preset.aspect);
      setImgs((prev) =>
        prev.map((im, i) => (i === idx ? { ...im, smartPixels: rect, useSmart: true } : im)),
      );
      toast.success('Smart crop aplicado a esta imagen');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const save = async () => {
    setSaving(true);
    const ids: string[] = [];
    try {
      for (const im of imgs) {
        const exportImg = await loadExportImage(im.sourceUrl);
        const rect =
          im.useSmart && im.smartPixels
            ? im.smartPixels
            : im.manualPixels ?? centerCrop(exportImg, preset.aspect);
        const result = await exportImage({
          exportImg,
          rect,
          preset,
          format,
          quality,
          smoothing,
          baseName: im.filename,
        });
        const up = await sdk.admin.upload.create({ files: [result.file] });
        const f = up.files?.[0] as { url?: string; id?: string } | undefined;
        if (!f?.url) continue;
        const { media_asset } = await sdk.client.fetch<{ media_asset: { id: string } }>(
          '/admin/media-library',
          {
            method: 'POST',
            body: {
              url: f.url,
              file_id: f.id,
              filename: result.file.name,
              mime_type: result.file.type,
              size: result.bytes,
              source: 'edited',
              metadata: {
                source_file_id: im.sourceFileId ?? null,
                source_url: im.sourceUrl,
                edited: true,
                transformations: {
                  crop: rect,
                  resize: { width: result.width, height: result.height },
                  format,
                  quality,
                  smoothing_quality: smoothing,
                  preset: preset.key,
                },
              },
            },
          },
        );
        if (media_asset?.id) ids.push(media_asset.id);
      }
      await queryClient.invalidateQueries({ queryKey: MEDIA_QK });
      onSaved?.(ids);
      setSavedIds(ids);
      toast.success(`Guardadas ${ids.length} imágenes editadas en la galería`);
      if (!productId) {
        onClose();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const associate = async () => {
    if (!productId || !savedIds?.length) return;
    try {
      await sdk.client.fetch('/admin/media-library/attach', {
        method: 'POST',
        body: { product_id: productId, asset_ids: savedIds },
      });
      toast.success('Imágenes asociadas al producto');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavedIds(null);
      onClose();
    }
  };

  return (
    <FocusModal open={open} onOpenChange={(v) => !v && onClose()}>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex w-full items-center justify-between gap-3">
            <Text weight="plus">Editor de imágenes ({imgs.length})</Text>
            <Button onClick={save} isLoading={saving}>
              Editar y guardar copia{imgs.length > 1 ? 's' : ''}
            </Button>
          </div>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col gap-4 overflow-y-auto p-6 lg:flex-row">
          {/* Crop area */}
          <div className="flex-1">
            <div className="relative h-[360px] w-full overflow-hidden rounded-lg bg-ui-bg-subtle">
              {current ? (
                <Cropper
                  image={current.sourceUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={preset.aspect ?? undefined}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              ) : null}
            </div>
            {current?.useSmart ? (
              <Text size="xsmall" className="mt-1 text-ui-fg-interactive">
                Smart crop aplicado a esta imagen (movés el recuadro para volver a manual).
              </Text>
            ) : null}
            {imgs.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {imgs.map((im, i) => (
                  <button
                    key={`${im.sourceUrl}-${i}`}
                    type="button"
                    onClick={() => setIdx(i)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded border-2 ${
                      i === idx ? 'border-ui-fg-interactive' : 'border-ui-border-base'
                    }`}
                  >
                    <img src={im.sourceUrl} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Toolbar */}
          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[280px]">
            <div className="flex flex-col gap-1">
              <Label size="xsmall">Preset</Label>
              <Select value={presetKey} onValueChange={setPresetKey}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {PRESETS.map((p) => (
                    <Select.Item key={p.key} value={p.key}>
                      {p.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>

            <Button size="small" variant="secondary" onClick={applySmartCrop}>
              Smart crop (esta imagen)
            </Button>

            <div className="flex flex-col gap-1">
              <Label size="xsmall">Formato</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="webp">WebP (recomendado)</Select.Item>
                  <Select.Item value="jpeg">JPG</Select.Item>
                </Select.Content>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label size="xsmall">Calidad ({Math.round(quality * 100)}%)</Label>
              <input
                type="range"
                min={0.4}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label size="xsmall">Suavizado</Label>
              <Select value={smoothing} onValueChange={(v) => setSmoothing(v as SmoothingQuality)}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="low">Bajo</Select.Item>
                  <Select.Item value="medium">Medio</Select.Item>
                  <Select.Item value="high">Alto</Select.Item>
                </Select.Content>
              </Select>
            </div>

            {current ? (
              <div className="flex flex-col gap-1">
                <Label size="xsmall">Zoom</Label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </div>
            ) : null}

            <Text size="xsmall" className="text-ui-fg-subtle">
              Se guarda como copia nueva (no pisa el original).
            </Text>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>

      {/* Asociar al producto */}
      <Prompt open={!!productId && !!savedIds} onOpenChange={(v) => !v && setSavedIds(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Imagen editada guardada</Prompt.Title>
            <Prompt.Description>
              ¿Querés asociar {savedIds?.length ?? 0} imagen(es) a este producto?
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Button
              variant="secondary"
              onClick={() => {
                setSavedIds(null);
                onClose();
              }}
            >
              Solo guardar
            </Button>
            <Button onClick={associate}>Asociar</Button>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </FocusModal>
  );
}
