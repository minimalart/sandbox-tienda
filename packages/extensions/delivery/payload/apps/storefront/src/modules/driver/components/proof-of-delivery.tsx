"use client";

/**
 * ProofOfDelivery — orquestador del flujo de captura de evidencia.
 *
 * Responsabilidades:
 *   1. Mostrar selector Foto / Firma.
 *   2. Abrir el capturador correspondiente (cargado con dynamic/ssr:false).
 *   3. Subir el archivo vía uploadDriverProof.
 *   4. Llamar onConfirm con la URL resultante y el tipo de evidencia.
 *
 * El padre (stop-detail) decide qué hacer con la URL (armar el proof object
 * y llamar postExecutionAction).
 */

import { uploadDriverProof } from "@lib/data/driver/client";
import type { ProofOfDelivery } from "@lib/data/driver/types";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

// ── Carga dinámica de capturadores pesados ────────────────────────────────────

const PhotoCaptureLazy = dynamic(() => import("./photo-capture"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-white border-r-transparent" />
    </div>
  ),
});

const SignaturePadLazy = dynamic(() => import("./signature-pad"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50">
      <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-green-700 border-r-transparent" />
    </div>
  ),
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type PodMethod = "photo" | "signature";

type FlowStep =
  | "select"        // elegir método
  | "capture-photo" // PhotoCapture abierto
  | "capture-sig"   // SignaturePad abierto
  | "uploading"     // subiendo al backend
  | "done";         // completado

interface ProofOfDeliveryProps {
  /** Llamado con el proof completo al terminar el upload exitosamente */
  onConfirm: (proof: ProofOfDelivery) => void;
  /** Cancelar todo el flujo */
  onClose: () => void;
  /** Geolocalización ya capturada por stop-detail */
  location?: { lat: number; lng: number } | null;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function ProofOfDelivery({ onConfirm, onClose, location }: ProofOfDeliveryProps) {
  const [step, setStep] = useState<FlowStep>("select");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Recibe blob de PhotoCapture ─────────────────────────────────────────────
  const handlePhotoBlob = useCallback(
    async (blob: Blob) => {
      setStep("uploading");
      setUploadError(null);
      try {
        const filename = `pod-photo-${Date.now()}.jpg`;
        const { url } = await uploadDriverProof(blob, filename);

        const proof: ProofOfDelivery = {
          type: "photo",
          file_url: url,
          ...(location ? { lat: location.lat, lng: location.lng } : {}),
        };
        setStep("done");
        onConfirm(proof);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "UPLOAD_ERROR";
        setUploadError(
          msg === "UNAUTHORIZED" || msg === "NO_TOKEN"
            ? "Tu sesión expiró. Recargá la app."
            : "No se pudo subir la foto. Intentá de nuevo.",
        );
        setStep("capture-photo");
      }
    },
    [location, onConfirm],
  );

  // ── Recibe blob de SignaturePad ─────────────────────────────────────────────
  const handleSignatureBlob = useCallback(
    async (blob: Blob) => {
      setStep("uploading");
      setUploadError(null);
      try {
        const filename = `pod-signature-${Date.now()}.png`;
        const { url } = await uploadDriverProof(blob, filename);

        const proof: ProofOfDelivery = {
          type: "signature",
          signature_url: url,
          ...(location ? { lat: location.lat, lng: location.lng } : {}),
        };
        setStep("done");
        onConfirm(proof);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "UPLOAD_ERROR";
        setUploadError(
          msg === "UNAUTHORIZED" || msg === "NO_TOKEN"
            ? "Tu sesión expiró. Recargá la app."
            : "No se pudo subir la firma. Intentá de nuevo.",
        );
        setStep("capture-sig");
      }
    },
    [location, onConfirm],
  );

  // ── Uploading overlay ───────────────────────────────────────────────────────
  if (step === "uploading") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/70">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-white border-r-transparent" />
        <p className="text-white text-sm">Subiendo evidencia...</p>
      </div>
    );
  }

  // ── Capturadores ────────────────────────────────────────────────────────────
  if (step === "capture-photo") {
    return (
      <>
        <PhotoCaptureLazy
          onCapture={handlePhotoBlob}
          onClose={() => setStep("select")}
        />
        {uploadError && (
          <div className="fixed bottom-24 left-4 right-4 z-[60] rounded-xl bg-red-600 px-4 py-3 text-center text-sm text-white shadow-lg">
            {uploadError}
          </div>
        )}
      </>
    );
  }

  if (step === "capture-sig") {
    return (
      <>
        <SignaturePadLazy
          onCapture={handleSignatureBlob}
          onClose={() => setStep("select")}
        />
        {uploadError && (
          <div className="fixed bottom-24 left-4 right-4 z-[60] rounded-xl bg-red-600 px-4 py-3 text-center text-sm text-white shadow-lg">
            {uploadError}
          </div>
        )}
      </>
    );
  }

  // ── Selector de método ──────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm">
        <h2 className="font-semibold text-gray-900">Comprobante de entrega</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 gap-5">
        <p className="text-center text-gray-600 text-sm">
          Para confirmar la entrega necesitás registrar una evidencia.
          Elegí el tipo:
        </p>

        {/* Opción Foto */}
        <button
          type="button"
          onClick={() => { setUploadError(null); setStep("capture-photo"); }}
          className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 shadow-sm border border-gray-100 active:bg-gray-50"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg className="h-7 w-7 text-green-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900">Foto</p>
            <p className="mt-0.5 text-gray-500 text-xs">Tomá una foto del paquete entregado</p>
          </div>
        </button>

        {/* Opción Firma */}
        <button
          type="button"
          onClick={() => { setUploadError(null); setStep("capture-sig"); }}
          className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 shadow-sm border border-gray-100 active:bg-gray-50"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-7 w-7 text-blue-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900">Firma</p>
            <p className="mt-0.5 text-gray-500 text-xs">El cliente firma en tu pantalla</p>
          </div>
        </button>

        {uploadError && (
          <p className="text-center text-red-600 text-sm">{uploadError}</p>
        )}
      </div>
    </div>
  );
}
