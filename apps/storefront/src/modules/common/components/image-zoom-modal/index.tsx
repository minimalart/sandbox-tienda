"use client";

import { Dialog, DialogPanel } from "@headlessui/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { handleImageError } from "@lib/util/placeholder-image";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

type ImageItem = { url: string; id?: string | null };

type ImageZoomModalProps = {
  open: boolean;
  onClose: () => void;
  images: ImageItem[];
  initialIndex?: number;
  alt?: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

function getDistance(touches: React.TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const ImageZoomModal = ({
  open,
  onClose,
  images,
  initialIndex = 0,
  alt,
}: ImageZoomModalProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  /**
   * URLs ya descargadas. Sin esto, pasar a la siguiente deja el visor en negro
   * mientras baja la foto —sin ningún indicio de que algo está pasando— y con
   * galerías remotas (las fotos de ambiente del fabricante, los catálogos
   * importados) eso es un segundo largo.
   */
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());
  const markLoaded = useCallback((url: string) => {
    setLoadedUrls((current) =>
      current.has(url) ? current : new Set(current).add(url),
    );
  }, []);

  const touchStateRef = useRef<{
    initialDistance: number;
    initialScale: number;
    isPinching: boolean;
    isPanning: boolean;
    panStartX: number;
    panStartY: number;
    initialTranslateX: number;
    initialTranslateY: number;
    lastTapTime: number;
  }>({
    initialDistance: 0,
    initialScale: 1,
    isPinching: false,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    initialTranslateX: 0,
    initialTranslateY: 0,
    lastTapTime: 0,
  });

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // Reset state when modal opens or current image changes
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      resetZoom();
    }
  }, [open, initialIndex, resetZoom]);

  useEffect(() => {
    resetZoom();
  }, [currentIndex, resetZoom]);

  const goToPrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goToNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  // Precarga de las vecinas: la navegación es secuencial, así que la siguiente
  // ya está en caché cuando se la pide. Sólo ±1 para no bajar la galería entera.
  useEffect(() => {
    if (!open || images.length <= 1) return;
    for (const delta of [1, -1]) {
      const neighbour = images[(currentIndex + delta + images.length) % images.length];
      if (!neighbour?.url) continue;
      const preload = new window.Image();
      preload.src = neighbour.url;
    }
  }, [open, currentIndex, images]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrev();
      else if (e.key === "ArrowRight") goToNext();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goToPrev, goToNext, onClose]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(DOUBLE_TAP_SCALE);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const state = touchStateRef.current;
    if (e.touches.length === 2) {
      state.isPinching = true;
      state.isPanning = false;
      state.initialDistance = getDistance(e.touches);
      state.initialScale = scale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - state.lastTapTime < 300) {
        // Double tap → toggle zoom
        if (scale > 1) {
          resetZoom();
        } else {
          setScale(DOUBLE_TAP_SCALE);
        }
        state.lastTapTime = 0;
      } else {
        state.lastTapTime = now;
      }
      if (scale > 1) {
        state.isPanning = true;
        state.isPinching = false;
        state.panStartX = e.touches[0].clientX;
        state.panStartY = e.touches[0].clientY;
        state.initialTranslateX = translate.x;
        state.initialTranslateY = translate.y;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const state = touchStateRef.current;
    if (state.isPinching && e.touches.length === 2) {
      const newDistance = getDistance(e.touches);
      const ratio = newDistance / state.initialDistance;
      const newScale = clamp(
        state.initialScale * ratio,
        MIN_SCALE,
        MAX_SCALE,
      );
      setScale(newScale);
      if (newScale === 1) setTranslate({ x: 0, y: 0 });
    } else if (state.isPanning && e.touches.length === 1 && scale > 1) {
      const dx = e.touches[0].clientX - state.panStartX;
      const dy = e.touches[0].clientY - state.panStartY;
      setTranslate({
        x: state.initialTranslateX + dx,
        y: state.initialTranslateY + dy,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const state = touchStateRef.current;
    if (e.touches.length === 0) {
      state.isPinching = false;
      state.isPanning = false;
    }
  };

  // Mouse drag for panning when zoomed (desktop)
  const mouseDownRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initialTranslateX: number;
    initialTranslateY: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialTranslateX: 0,
    initialTranslateY: 0,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    mouseDownRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialTranslateX: translate.x,
      initialTranslateY: translate.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseDownRef.current.isDragging) return;
    const dx = e.clientX - mouseDownRef.current.startX;
    const dy = e.clientY - mouseDownRef.current.startY;
    setTranslate({
      x: mouseDownRef.current.initialTranslateX + dx,
      y: mouseDownRef.current.initialTranslateY + dy,
    });
  };

  const handleMouseUp = () => {
    mouseDownRef.current.isDragging = false;
  };

  if (images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <AnimatePresence>
      {open && (
        <Dialog
          className="relative z-[10001]"
          onClose={onClose}
          open={open}
        >
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/90"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <div className="fixed inset-0 z-[10001] flex items-center justify-center">
            <DialogPanel
              as="div"
              className="relative h-full w-full overflow-hidden"
            >
              {/* Close button */}
              <button
                aria-label="Cerrar"
                className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
                onClick={onClose}
                type="button"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>

              {/* Counter */}
              {images.length > 1 && (
                <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white backdrop-blur">
                  {currentIndex + 1} / {images.length}
                </div>
              )}

              {/* Prev button */}
              {images.length > 1 && (
                <button
                  aria-label="Imagen anterior"
                  className="absolute top-1/2 left-2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:flex"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrev();
                  }}
                  type="button"
                >
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>
              )}

              {/* Next button */}
              {images.length > 1 && (
                <button
                  aria-label="Imagen siguiente"
                  className="absolute top-1/2 right-2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:flex"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  type="button"
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </button>
              )}

              {/* Image */}
              <div
                className="flex h-full w-full select-none items-center justify-center overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  cursor: scale > 1 ? "grab" : "default",
                  touchAction: "none",
                }}
              >
                {!loadedUrls.has(currentImage.url) && (
                  <div
                    aria-label="Cargando imagen"
                    className="absolute inset-0 flex items-center justify-center"
                    role="status"
                  >
                    <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                  </div>
                )}
                <img
                  alt={alt ?? "Imagen"}
                  className={`max-h-full max-w-full object-contain transition-opacity duration-200 ${
                    loadedUrls.has(currentImage.url) ? "opacity-100" : "opacity-0"
                  }`}
                  draggable={false}
                  // `key` por URL para que el browser no deje la foto anterior
                  // en pantalla mientras baja la nueva: sin esto React reusa el
                  // nodo y `onLoad` no vuelve a dispararse de forma confiable.
                  key={currentImage.url}
                  onDoubleClick={handleDoubleClick}
                  onError={(event) => {
                    markLoaded(currentImage.url);
                    handleImageError(event);
                  }}
                  onLoad={() => markLoaded(currentImage.url)}
                  // Una imagen ya cacheada puede resolverse antes de que React
                  // ate el `onLoad`: sin este chequeo se quedaría en opacity-0.
                  ref={(node) => {
                    if (node?.complete) markLoaded(currentImage.url);
                  }}
                  src={currentImage.url}
                  style={{
                    transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                    transition:
                      mouseDownRef.current.isDragging ||
                      touchStateRef.current.isPinching ||
                      touchStateRef.current.isPanning
                        ? "none"
                        : "transform 0.2s ease-out",
                    transformOrigin: "center center",
                  }}
                />
              </div>

              {/* Hint */}
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur sm:text-sm">
                <span className="hidden sm:inline">
                  Doble clic para hacer zoom
                </span>
                <span className="sm:hidden">
                  Doble tap o pinch para hacer zoom
                </span>
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default ImageZoomModal;
