"use client";

/**
 * BarcodeScanner — wrapper de @zxing/browser
 *
 * Renderiza un <video> y usa BrowserMultiFormatReader para leer QR o
 * códigos de barra del stream de la cámara trasera.
 * Llama onScan(result) cuando detecta un código; onClose para cerrar.
 */

import { useCallback, useEffect, useRef } from "react";

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Usamos any para evitar importar el tipo completo de @zxing/browser en este scope
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readerRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    async function startScanner() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        if (!videoRef.current || !active) return;

        // Preferir cámara trasera
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const rearCamera = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("trasera") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment"),
        );
        const deviceId = rearCamera?.deviceId ?? devices[0]?.deviceId;

        if (!deviceId) return;

        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, _err) => {
            if (result && active) {
              onScan(result.getText());
            }
          },
        );
      } catch (err) {
        console.warn("[BarcodeScanner] Error al iniciar cámara:", err);
      }
    }

    startScanner();

    return () => {
      active = false;
      try {
        readerRef.current?.reset();
      } catch {
        // ignorar
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Video */}
      <div className="relative flex-1 overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        {/* Viewfinder */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-56 w-56 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
        </div>
        <p className="absolute bottom-6 left-0 right-0 text-center text-sm text-white/80">
          Apuntá al código de barras o QR
        </p>
      </div>

      {/* Close */}
      <div className="bg-black px-4 pb-8 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border border-white/20 py-3 font-semibold text-white"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
