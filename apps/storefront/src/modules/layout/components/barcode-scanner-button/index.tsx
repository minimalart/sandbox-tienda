"use client";

import { useStoreSettings } from "@lib/hooks/use-store-settings";
import { useCartStore } from "@lib/stores/cart.store";
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from "@lib/util/placeholder-image";
import { toast } from "@medusajs/ui";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Barcode, Camera, Keyboard, Loader2, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type BarcodeLookupProduct = {
  product_id: string;
  product_title: string | null;
  product_handle: string | null;
  product_thumbnail: string | null;
  variant_id: string;
  variant_title: string | null;
  sku: string | null;
  barcode: string;
};

// Beep de feedback con Web Audio API (sin assets): agudo = OK, grave = error
let audioCtx: AudioContext | null = null;
const primeBeepAudio = () => {
  try {
    if (typeof window === "undefined") return;
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    void audioCtx.resume();
  } catch {
    // silenciar si el audio context falla
  }
};
const playBeep = (frequency = 880, durationMs = 120) => {
  try {
    if (typeof window === "undefined") return;
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    void audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = frequency;
    osc.type = "square";
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  } catch {
    // silenciar si el audio context falla
  }
};

const lookupBarcode = async (code: string): Promise<BarcodeLookupProduct> => {
  const res = await fetch(
    `/api/store/barcode-scanner/lookup?code=${encodeURIComponent(code)}`,
    { cache: "no-store" },
  );
  const data = (await res.json().catch(() => ({}))) as {
    product?: BarcodeLookupProduct;
    message?: string;
  };

  if (!res.ok || !data.product) {
    throw new Error(data.message || "Producto no encontrado");
  }

  return data.product;
};

export const BarcodeScannerButton = ({ countryCode }: { countryCode: string }) => {
  const { barcode_scanner_enabled: enabled } = useStoreSettings();
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  // Código que se está buscando ahora mismo (para mostrar feedback "buscando…").
  const [processingCode, setProcessingCode] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastProduct, setLastProduct] = useState<BarcodeLookupProduct | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanControlsRef = useRef<IScannerControls | null>(null);
  const lastCodeRef = useRef<string | null>(null);
  const isAddingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stopCamera = useCallback(() => {
    scanControlsRef.current?.stop();
    scanControlsRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  const addBarcode = useCallback(
    async (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode || isAddingRef.current) return;

      isAddingRef.current = true;
      setIsAdding(true);
      setProcessingCode(cleanCode);
      try {
        const product = await lookupBarcode(cleanCode);
        const added = await addItem(
          product.variant_id,
          1,
          countryCode,
          product.product_id,
          { source: "barcode_scanner", barcode: product.barcode },
          {
            title: product.product_title,
            handle: product.product_handle,
            thumbnail: product.product_thumbnail,
          },
        );

        if (!added) {
          throw new Error("No se pudo agregar el producto");
        }

        setLastProduct(product);
        setManualCode("");
        playBeep();
        toast.success("Producto agregado", {
          description: product.product_title ?? product.sku ?? product.barcode,
        });
      } catch (error) {
        playBeep(300, 200);
        toast.error("No se pudo agregar", {
          description:
            error instanceof Error
              ? error.message
              : "Revisá el código e intentá de nuevo.",
        });
      } finally {
        isAddingRef.current = false;
        setIsAdding(false);
        setProcessingCode(null);
        // Cooldown: liberamos este código tras 1.5s para poder reintentarlo
        // (ej. lectura fallida) o volver a sumar la misma unidad, sin que la
        // cámara lo re-dispare en loop mientras sigue apuntando al producto.
        window.setTimeout(() => {
          if (lastCodeRef.current === cleanCode) lastCodeRef.current = null;
        }, 1500);
      }
    },
    [addItem, countryCode],
  );

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("La cámara no está disponible en este navegador.");
      toast.error("Scanner no disponible", {
        description: "Ingresá el código manualmente.",
      });
      return;
    }

    try {
      stopCamera();
      setCameraError(null);
      setIsScanning(true);
      readerRef.current = readerRef.current ?? new BrowserMultiFormatReader();
      scanControlsRef.current = await readerRef.current.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        videoRef.current ?? undefined,
        (result) => {
          const code = result?.getText().trim();
          // Ignoramos si no hay código, si es el último ya procesado, o si hay
          // una búsqueda en curso (evita apilar lecturas mientras buscamos).
          if (!code || code === lastCodeRef.current || isAddingRef.current) return;
          lastCodeRef.current = code;
          // Feedback táctil inmediato al detectar (donde el navegador lo soporte).
          try {
            navigator.vibrate?.(40);
          } catch {
            // no-op
          }
          void addBarcode(code);
        },
      );
    } catch (error) {
      setIsScanning(false);
      setCameraError("No se pudo abrir la cámara. Revisá el permiso del navegador.");
      toast.error("No se pudo abrir la cámara", {
        description:
          error instanceof Error
            ? error.message
            : "Revisá el permiso o ingresá el código manualmente.",
      });
    }
  }, [addBarcode, stopCamera]);

  useEffect(() => {
    if (open) {
      lastCodeRef.current = null;
      // desbloquea el AudioContext con el gesto de abrir (politica de autoplay)
      primeBeepAudio();
      void startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  if (!enabled || !mounted) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        className="fixed top-1/2 right-0 z-[10000] inline-flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl bg-[--primary-color] px-2 py-4 font-medium text-sm text-white shadow-lg md:hidden"
        onClick={() => setOpen(true)}
      >
        <Barcode className="h-5 w-5" />
        <span className="[writing-mode:vertical-rl] rotate-180 tracking-wide">
          Escanear
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[10001] flex flex-col bg-gray-950 text-white md:hidden">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
            />
            <style>{`@keyframes barcodeScanLine{0%{top:6%}50%{top:94%}100%{top:6%}}`}</style>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/70" />

            {/* Recuadro guía. Cambia de color/estado: blanco = escaneando,
                color de marca = buscando. La línea animada indica que la cámara
                está activa (sin ella el usuario no sabe si "está escaneando"). */}
            <div
              className={`pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 overflow-hidden rounded-lg border-2 shadow-[0_0_0_999px_rgba(0,0,0,0.25)] transition-colors ${
                isAdding
                  ? "border-[--primary-color]"
                  : isScanning
                    ? "border-white/80"
                    : "border-white/40"
              }`}
            >
              {isScanning && !isAdding ? (
                <div
                  className="absolute inset-x-0 h-0.5 bg-[--primary-color] shadow-[0_0_8px_2px_var(--primary-color)]"
                  style={{ animation: "barcodeScanLine 2s ease-in-out infinite" }}
                />
              ) : null}
            </div>

            {/* Overlay de estado: activando cámara o buscando producto. Es el
                feedback clave que faltaba cuando arranca la búsqueda. */}
            {isAdding || (!isScanning && !cameraError) ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-white" />
                <p className="font-medium text-white">
                  {isAdding ? "Buscando producto…" : "Activando cámara…"}
                </p>
                {isAdding && processingCode ? (
                  <p className="font-mono text-sm text-white/70">{processingCode}</p>
                ) : null}
              </div>
            ) : null}

            <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 py-5">
              <div>
                <h2 className="font-semibold text-lg">Scanner</h2>
                <p className="text-sm text-white/75">
                  {cameraError
                    ? "Cámara no disponible"
                    : isAdding
                      ? "Código detectado, buscando…"
                      : isScanning
                        ? "Apuntá al código de barras"
                        : "Activando cámara…"}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Cerrar</span>
              </button>
            </div>

            <div className="absolute inset-x-4 bottom-4 rounded-lg bg-white p-3 text-gray-900 shadow-xl">
              {cameraError ? (
                <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm">
                  {cameraError}
                </div>
              ) : null}

              {lastProduct ? (
                <div className="mb-3 flex items-center gap-3 rounded-md border border-gray-200 p-3">
                  <img
                    src={lastProduct.product_thumbnail || PLACEHOLDER_IMAGE}
                    onError={handleImageError}
                    alt={lastProduct.product_title ?? "Producto"}
                    className="h-12 w-12 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900 text-sm">
                      {lastProduct.product_title ?? "Producto agregado"}
                    </p>
                    <p className="truncate text-gray-500 text-xs">
                      {lastProduct.sku ?? lastProduct.barcode}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700"
                    onClick={openCart}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span className="sr-only">Ver carrito</span>
                  </button>
                </div>
              ) : null}

              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addBarcode(manualCode);
                }}
              >
                <div className="relative min-w-0 flex-1">
                  <Keyboard className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
                  <input
                    className="h-11 w-full rounded-md border border-gray-200 pl-9 text-sm outline-none focus:border-[--primary-color]"
                    inputMode="numeric"
                    placeholder="Código"
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="h-11 rounded-md bg-[--primary-color] px-4 font-medium text-sm text-white disabled:opacity-60"
                  disabled={isAdding || manualCode.trim().length === 0}
                >
                  Agregar
                </button>
              </form>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gray-900 px-3 font-medium text-sm text-white disabled:opacity-60"
                  onClick={startCamera}
                  disabled={isScanning || isAdding}
                >
                  {isAdding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {isAdding ? "Buscando…" : isScanning ? "Escaneando" : "Cámara"}
                </button>
                <Link
                  href={`/${countryCode}/checkout`}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-gray-900 font-medium text-gray-900 text-sm"
                  onClick={() => setOpen(false)}
                >
                  Checkout
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
};
