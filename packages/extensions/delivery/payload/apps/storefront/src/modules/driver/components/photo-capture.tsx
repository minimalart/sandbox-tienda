"use client";

/**
 * PhotoCapture — captura una foto como evidencia de entrega (POD).
 *
 * Estrategia dual:
 *   1. getUserMedia (cámara trasera vía MediaDevices API) cuando está disponible.
 *   2. <input type="file" capture="environment"> como fallback confiable en móviles
 *      donde getUserMedia está bloqueado por permisos o por el entorno (WebView).
 *
 * El componente devuelve un Blob (JPEG) al confirmar.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface PhotoCaptureProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

type CaptureMode = "detecting" | "camera" | "input";

export default function PhotoCapture({ onCapture, onClose }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<CaptureMode>("detecting");
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // ── Iniciar cámara ──────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMode("input");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setMode("camera");
      } catch {
        // Permisos denegados o no disponible → fallback al input file
        setMode("input");
      }
    }

    startCamera();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Tomar foto desde el stream ──────────────────────────────────────────────
  const takePicture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setPreview(url);
        setCapturedBlob(blob);
        // Parar el stream para liberar la cámara
        streamRef.current?.getTracks().forEach((t) => t.stop());
      },
      "image/jpeg",
      0.88,
    );
  }, []);

  // ── Retomar foto (volver al stream) ────────────────────────────────────────
  const retake = useCallback(async () => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    setCapturedBlob(null);
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("No se pudo reactivar la cámara.");
      setMode("input");
    }
  }, [preview]);

  // ── Confirmar foto capturada ────────────────────────────────────────────────
  const confirmPhoto = useCallback(() => {
    if (capturedBlob) onCapture(capturedBlob);
  }, [capturedBlob, onCapture]);

  // ── Fallback: selección desde archivo / cámara nativa ──────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setPreview(url);
      setCapturedBlob(file);
    },
    [],
  );

  // ── Cleanup al desmontar ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // ── Render ──────────────────────────────────────────────────────────────────

  // Preview — igual en camera e input mode
  if (preview && capturedBlob) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <div className="relative flex-1 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview foto" className="h-full w-full object-contain" />
        </div>
        <div className="bg-black px-4 pb-safe-bottom pb-8 pt-4 space-y-3">
          <button
            type="button"
            onClick={confirmPhoto}
            className="w-full rounded-xl bg-green-700 py-3 font-semibold text-white"
          >
            Usar esta foto
          </button>
          <button
            type="button"
            onClick={mode === "input" ? () => { setPreview(null); setCapturedBlob(null); fileInputRef.current?.click(); } : retake}
            className="w-full rounded-xl border border-white/20 py-3 font-semibold text-white"
          >
            Retomar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-white/20 py-2.5 text-sm text-white/70"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // Fallback input file
  if (mode === "input") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black px-6">
        {cameraError && (
          <p className="text-center text-red-400 text-sm">{cameraError}</p>
        )}
        <p className="text-center text-white/80 text-sm">
          Tomá una foto de la entrega como comprobante
        </p>

        {/* Input oculto — capture="environment" abre la cámara trasera en móvil */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-xs rounded-xl bg-green-700 py-3 font-semibold text-white"
        >
          Abrir cámara
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full max-w-xs rounded-xl border border-white/20 py-2.5 text-sm text-white/70"
        >
          Cancelar
        </button>
      </div>
    );
  }

  // Detectando / cargando
  if (mode === "detecting") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-white border-r-transparent" />
      </div>
    );
  }

  // Camera mode — stream activo
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Video stream */}
      <div className="relative flex-1 overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <p className="absolute bottom-6 left-0 right-0 text-center text-sm text-white/80">
          Encuadrá el paquete o la puerta
        </p>
      </div>

      {/* Canvas oculto para capturar el frame */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controles */}
      <div className="bg-black px-4 pb-safe-bottom pb-8 pt-4 flex flex-col gap-3">
        {/* Botón obturador */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={takePicture}
            aria-label="Tomar foto"
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/10 active:bg-white/30"
          >
            <span className="h-12 w-12 rounded-full bg-white" />
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border border-white/20 py-2.5 text-sm text-white/70"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
