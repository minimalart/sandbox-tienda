import { Button, Drawer, Text, toast } from '@medusajs/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogingAssetProposal, EditableComposition } from '../../hooks/api';

/**
 * Editor simple del lifestyle editable (PRD §6.4/§12). Deliberadamente NO usa un
 * motor de canvas general (fabric/konva): fondo + producto posicionados con
 * elementos HTML absolutos y eventos de puntero. Sólo permite mover y escalar
 * (proporciones bloqueadas). Guardar persiste la composición en metadata (no
 * llama a IA). Cancelar no modifica nada.
 */

// Límites (PRD §13): constantes, espejo de las del backend.
const MIN_SCALE = 0.08;
const MAX_SCALE = 0.7;

export type EditableLifestyleMeta = {
  background?: { url?: string };
  product_layer?: { url?: string };
  composition?: Partial<EditableComposition>;
  initial_composition?: Partial<EditableComposition>;
};

const clamp = (n: number, min: number, max: number) => (Number.isNaN(n) ? min : Math.min(Math.max(n, min), max));

function normalize(c: Partial<EditableComposition> | undefined, fallback: EditableComposition): EditableComposition {
  return {
    x: clamp(typeof c?.x === 'number' ? c.x : fallback.x, 0, 1),
    y: clamp(typeof c?.y === 'number' ? c.y : fallback.y, 0, 1),
    scale: clamp(typeof c?.scale === 'number' ? c.scale : fallback.scale, MIN_SCALE, MAX_SCALE),
  };
}

export function readEditableMeta(proposal: CatalogingAssetProposal): EditableLifestyleMeta {
  return (proposal.metadata ?? {}) as EditableLifestyleMeta;
}

/**
 * Preview compuesto (fondo + producto) reconstruido desde metadata (PRD §9.2).
 * Se usa tanto en la card de revisión como dentro del editor, para que el
 * resultado guardado se vea sin re-renderizar en el backend.
 */
export const CompositionPreview = ({
  background,
  product,
  composition,
  className,
}: {
  background?: string;
  product?: string;
  composition: EditableComposition;
  className?: string;
}) => (
  <div className={`relative w-full overflow-hidden ${className ?? ''}`}>
    {background ? (
      <img src={background} alt="" className="block h-auto w-full" draggable={false} />
    ) : (
      <div className="aspect-square w-full bg-ui-bg-subtle" />
    )}
    {product ? (
      <div
        className="absolute"
        style={{
          left: `${composition.x * 100}%`,
          top: `${composition.y * 100}%`,
          width: `${composition.scale * 100}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <img src={product} alt="" className="block h-auto w-full" draggable={false} />
      </div>
    ) : null}
  </div>
);

type Gesture =
  | { kind: 'move'; startX: number; startY: number; baseX: number; baseY: number; rect: DOMRect }
  | { kind: 'resize'; centerX: number; centerY: number; rect: DOMRect };

export const EditableLifestyleEditor = ({
  proposal,
  open,
  saving,
  onClose,
  onSave,
}: {
  proposal: CatalogingAssetProposal;
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (composition: EditableComposition) => Promise<unknown> | void;
}) => {
  const meta = readEditableMeta(proposal);
  const backgroundUrl = meta.background?.url;
  const productUrl = meta.product_layer?.url;
  const initial = useMemo(
    () => normalize(meta.initial_composition ?? meta.composition, { x: 0.7, y: 0.75, scale: 0.25 }),
    [proposal.id]
  );
  const saved = useMemo(() => normalize(meta.composition, initial), [proposal.id]);

  const [comp, setComp] = useState<EditableComposition>(saved);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<Gesture | null>(null);

  // Reinicia al abrir/cambiar de propuesta.
  useEffect(() => {
    setComp(saved);
  }, [proposal.id, open]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      if (g.kind === 'move') {
        const dx = (e.clientX - g.startX) / g.rect.width;
        const dy = (e.clientY - g.startY) / g.rect.height;
        setComp((c) => ({ ...c, x: clamp(g.baseX + dx, 0, 1), y: clamp(g.baseY + dy, 0, 1) }));
      } else {
        // Escala desde el centro: el ancho es 2× la distancia horizontal al centro.
        const halfW = Math.abs(e.clientX - g.centerX);
        const scale = clamp((2 * halfW) / g.rect.width, MIN_SCALE, MAX_SCALE);
        setComp((c) => ({ ...c, scale }));
      }
    };
    const onUp = () => {
      gestureRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const startMove = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    gestureRef.current = { kind: 'move', startX: e.clientX, startY: e.clientY, baseX: comp.x, baseY: comp.y, rect };
  };

  const startResize = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    gestureRef.current = {
      kind: 'resize',
      centerX: rect.left + comp.x * rect.width,
      centerY: rect.top + comp.y * rect.height,
      rect,
    };
  };

  const dirty = comp.x !== saved.x || comp.y !== saved.y || comp.scale !== saved.scale;

  const handleSave = async () => {
    try {
      await onSave({ x: comp.x, y: comp.y, scale: comp.scale });
      toast.success('Composición guardada');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Ajustar lifestyle editable</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto">
          {!backgroundUrl || !productUrl ? (
            <Text className="text-ui-fg-subtle">
              Esta propuesta no tiene fondo o producto para ajustar.
            </Text>
          ) : (
            <div className="flex flex-col gap-3">
              <Text size="small" className="text-ui-fg-subtle">
                Arrastrá el producto para moverlo y usá el tirador de la esquina para cambiar el tamaño.
                Las proporciones se mantienen.
              </Text>
              <div
                ref={containerRef}
                className="relative w-full touch-none select-none overflow-hidden rounded-lg border bg-ui-bg-subtle"
              >
                <img src={backgroundUrl} alt="" className="block h-auto w-full" draggable={false} />
                <div
                  className="absolute"
                  style={{
                    left: `${comp.x * 100}%`,
                    top: `${comp.y * 100}%`,
                    width: `${comp.scale * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="pointer-events-none absolute inset-0 rounded-sm outline-dashed outline-1 outline-ui-fg-interactive" />
                  <img
                    src={productUrl}
                    alt=""
                    className="block h-auto w-full cursor-move"
                    draggable={false}
                    onPointerDown={startMove}
                  />
                  <div
                    role="button"
                    aria-label="Cambiar tamaño"
                    onPointerDown={startResize}
                    className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-ui-bg-base bg-ui-fg-interactive"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 text-ui-fg-muted text-xs">
                <span>Escala: {Math.round(comp.scale * 100)}%</span>
                <span>
                  Posición: {Math.round(comp.x * 100)}% / {Math.round(comp.y * 100)}%
                </span>
              </div>
            </div>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={!dirty && comp.x === initial.x && comp.y === initial.y && comp.scale === initial.scale}
              onClick={() => setComp(initial)}
            >
              Restaurar
            </Button>
            <div className="flex items-center gap-2">
              <Button size="small" variant="transparent" onClick={onClose}>
                Cancelar
              </Button>
              <Button size="small" isLoading={saving} disabled={!backgroundUrl || !productUrl} onClick={handleSave}>
                Guardar
              </Button>
            </div>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

export default EditableLifestyleEditor;
