"use client";

/**
 * SignaturePad — canvas táctil para captura de firma del cliente.
 *
 * Usa PointerEvents (mouse + touch + stylus) sobre un <canvas>.
 * Al confirmar, exporta el canvas como PNG Blob.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface SignaturePadProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

interface Point {
  x: number;
  y: number;
}

export default function SignaturePad({ onCapture, onClose }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  // ── Setup canvas ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ajustar al tamaño real del elemento (DPR-aware)
    const dpr = window.devicePixelRatio ?? 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  // ── Helpers de coordenadas ──────────────────────────────────────────────────
  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  // ── Eventos de dibujo ───────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    isDrawingRef.current = true;
    lastPointRef.current = getPoint(e);
    setIsEmpty(false);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawingRef.current || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const current = getPoint(e);
    const last = lastPointRef.current ?? current;

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();

    lastPointRef.current = current;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  // ── Limpiar ─────────────────────────────────────────────────────────────────
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    const rect = canvas.getBoundingClientRect();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width * dpr, rect.height * dpr);
    setIsEmpty(true);
  }, []);

  // ── Confirmar ───────────────────────────────────────────────────────────────
  const confirmSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;

    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/png",
    );
  }, [isEmpty, onCapture]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm">
        <h2 className="font-semibold text-gray-900">Firma del cliente</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 px-4 py-4">
        <p className="mb-2 text-center text-gray-500 text-sm">
          El cliente firma aquí abajo
        </p>
        <div className="relative rounded-2xl border-2 border-dashed border-gray-300 bg-white overflow-hidden" style={{ height: "280px" }}>
          <canvas
            ref={canvasRef}
            className="h-full w-full touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {isEmpty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-gray-300 text-sm select-none">Deslizá para firmar</p>
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="bg-white px-4 pb-safe-bottom pb-8 pt-3 space-y-3 border-t border-gray-100">
        <button
          type="button"
          onClick={confirmSignature}
          disabled={isEmpty}
          className="w-full rounded-xl bg-green-700 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Confirmar firma
        </button>
        <button
          type="button"
          onClick={clearCanvas}
          disabled={isEmpty}
          className="w-full rounded-xl border border-gray-200 py-2.5 text-gray-600 text-sm disabled:opacity-40"
        >
          Borrar y reintentar
        </button>
      </div>
    </div>
  );
}
