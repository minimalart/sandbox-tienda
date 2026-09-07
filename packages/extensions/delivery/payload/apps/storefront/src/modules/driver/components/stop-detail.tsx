"use client";

import { fetchDriverStops, postExecutionAction } from "@lib/data/driver/client";
import type { DeliveryAction, DeliveryExecution, ProofOfDelivery } from "@lib/data/driver/types";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";
import StatusBadge from "./status-badge";

// ============================================================================
// CONSTANTES
// ============================================================================

/** Acciones disponibles por estado actual */
const AVAILABLE_ACTIONS: Record<string, DeliveryAction[]> = {
  pending: ["pickup"],
  pickup: ["in_transit"],
  in_transit: ["delivered", "failed_attempt"],
  delivered: [],
  failed_attempt: [],
};

const ACTION_LABELS: Record<DeliveryAction, string> = {
  pickup: "Retirar paquete",
  in_transit: "Salir a entregar",
  delivered: "Marcar como entregado",
  failed_attempt: "Registrar intento fallido",
};

const ACTION_COLORS: Record<DeliveryAction, string> = {
  pickup: "bg-amber-600 hover:bg-amber-700",
  in_transit: "bg-blue-600 hover:bg-blue-700",
  delivered: "bg-green-700 hover:bg-green-800",
  failed_attempt: "bg-red-600 hover:bg-red-700",
};

// ============================================================================
// SUPUESTO: provider_type
//
// El backend no devuelve provider_type en me/stops en este momento.
// Asumimos own_fleet para todos los stops del driver, ya que el sistema solo
// asigna entregas de flota propia a los drivers de la PWA.
// TODO: cuando el backend incluya provider_type en me/stops, usar ese campo
//       para condicionar el POD.
// ============================================================================

function requiresProofOfDelivery(_exec: DeliveryExecution): boolean {
  // Si en el futuro el backend expone provider_type en el execution:
  // return exec.metadata?.provider_type === "own_fleet" o similar.
  return true;
}

// ============================================================================
// GEOLOCATION HELPER
// ============================================================================

async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000, maximumAge: 30000 },
    );
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function buildMapsUrl(exec: DeliveryExecution): string | null {
  const a = exec.address;
  if (!a) return null;
  if (a.lat && a.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`;
  }
  const q = [a.line1, a.line2, a.city, a.state, a.country]
    .filter(Boolean)
    .join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

function formatAddress(exec: DeliveryExecution): string {
  const a = exec.address;
  if (!a) return "Sin dirección";
  const parts = [a.line1, a.line2, a.city, a.state, a.postal_code].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Sin dirección";
}

// ============================================================================
// COMPONENT
// ============================================================================

interface StopDetailProps {
  executionId: string;
}

export default function StopDetail({ executionId }: StopDetailProps) {
  const router = useRouter();

  const [execution, setExecution] = useState<DeliveryExecution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeAction, setActiveAction] = useState<DeliveryAction | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  // Estado del flujo POD
  const [podOpen, setPodOpen] = useState(false);
  // Geolocalización capturada antes de abrir el POD, para pasarla al flujo
  const [podLocation, setPodLocation] = useState<{ lat: number; lng: number } | null>(null);

  // ── Load execution ─────────────────────────────────────────────────────────
  const loadExecution = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stops = await fetchDriverStops();
      const found = stops.find((s) => s.id === executionId);
      if (!found) {
        setError("No se encontró la parada.");
        return;
      }
      setExecution(found);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ERROR";
      if (msg === "UNAUTHORIZED" || msg === "NO_TOKEN") {
        router.replace("/driver/login");
        return;
      }
      setError("No se pudo cargar la parada.");
    } finally {
      setIsLoading(false);
    }
  }, [executionId, router]);

  useEffect(() => {
    loadExecution();
  }, [loadExecution]);

  // ── Handle action ──────────────────────────────────────────────────────────
  const handleAction = useCallback(
    async (action: DeliveryAction, proof?: ProofOfDelivery) => {
      if (!execution) return;

      setIsSubmitting(true);
      setActionError(null);

      // Capturar geolocalización para delivered/failed_attempt
      let location: { lat: number; lng: number } | undefined;
      if (action === "delivered" || action === "failed_attempt") {
        const pos = await getCurrentPosition();
        if (pos) location = pos;
      }

      try {
        const updated = await postExecutionAction(execution.id, {
          action,
          location,
          note: action === "failed_attempt" && note.trim() ? note.trim() : undefined,
          proof,
        });
        setExecution(updated);
        setActiveAction(null);
        setNote("");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "ERROR";
        if (msg === "UNAUTHORIZED" || msg === "NO_TOKEN") {
          router.replace("/driver/login");
          return;
        }
        // El backend puede devolver NOT_ALLOWED si se manda delivered sin proof
        if (msg === "NOT_ALLOWED") {
          setActionError("Esta entrega requiere un comprobante (foto o firma) para ser confirmada.");
        } else {
          setActionError("No se pudo actualizar el estado. Intentá de nuevo.");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [execution, note, router],
  );

  // ── Iniciar flujo POD para "Entregado" ─────────────────────────────────────
  const handleDeliveredClick = useCallback(async () => {
    if (!execution) return;

    if (requiresProofOfDelivery(execution)) {
      // Precapturar geolocalización antes de abrir el flujo visual
      const pos = await getCurrentPosition();
      setPodLocation(pos);
      setPodOpen(true);
      return;
    }

    // Si no requiere POD (rama futura), confirmar directo
    handleAction("delivered");
  }, [execution, handleAction]);

  // ── Callback cuando el flujo POD termina con evidencia lista ──────────────
  const handlePodConfirm = useCallback(
    async (proof: ProofOfDelivery) => {
      setPodOpen(false);
      await handleAction("delivered", proof);
    },
    [handleAction],
  );

  // ── Scanner ────────────────────────────────────────────────────────────────
  const handleScan = useCallback((result: string) => {
    setScannerOpen(false);
    setScannedCode(result);
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-green-700 border-r-transparent" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !execution) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-gray-600">{error ?? "Parada no encontrada."}</p>
        <Link
          href="/driver/stops"
          className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-sm text-white"
        >
          Volver a paradas
        </Link>
      </div>
    );
  }

  const availableActions = AVAILABLE_ACTIONS[execution.status] ?? [];
  const mapsUrl = buildMapsUrl(execution);
  const address = formatAddress(execution);

  return (
    <>
      {/* Scanner overlay — lazy loaded */}
      {scannerOpen && (
        <ScannerLazy onScan={handleScan} onClose={() => setScannerOpen(false)} />
      )}

      {/* POD overlay — lazy loaded */}
      {podOpen && (
        <PodLazy
          onConfirm={handlePodConfirm}
          onClose={() => setPodOpen(false)}
          location={podLocation}
        />
      )}

      <div className="mx-auto max-w-lg px-4 pb-8">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-50 pb-2 pt-6">
          <div className="flex items-center gap-3">
            <Link
              href="/driver/stops"
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Volver"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-tight">
                Pedido{" "}
                {execution.order_display_id
                  ? `#${execution.order_display_id}`
                  : execution.id.slice(-8).toUpperCase()}
              </h1>
              <StatusBadge status={execution.status} />
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          {execution.customer_name && (
            <div className="mb-3 border-b border-gray-100 pb-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide">Cliente</p>
              <p className="mt-0.5 font-medium text-gray-900">{execution.customer_name}</p>
              {execution.customer_phone && (
                <a
                  href={`tel:${execution.customer_phone}`}
                  className="mt-1 flex items-center gap-1 text-blue-600 text-sm"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  {execution.customer_phone}
                </a>
              )}
            </div>
          )}

          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide">Dirección</p>
            <p className="mt-0.5 text-gray-900 text-sm">{address}</p>

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1.5 text-blue-600 text-sm font-medium"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
                Abrir en Google Maps
              </a>
            )}
          </div>

          {execution.tracking_number && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide">Tracking</p>
              <p className="mt-0.5 font-mono text-gray-700 text-sm">{execution.tracking_number}</p>
            </div>
          )}
        </div>

        {/* Scanned code result */}
        {scannedCode && (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
            <p className="text-green-700 text-xs font-medium">Código escaneado</p>
            <p className="mt-0.5 font-mono text-green-900 text-sm break-all">{scannedCode}</p>
          </div>
        )}

        {/* Scanner button */}
        {execution.status !== "delivered" && execution.status !== "failed_attempt" && (
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 font-medium text-gray-700 text-sm shadow-sm"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
            </svg>
            Escanear código
          </button>
        )}

        {/* Actions */}
        {availableActions.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="font-medium text-gray-700 text-sm">Acciones disponibles</p>

            {availableActions.map((action) => (
              <div key={action}>
                {/* Note field for failed_attempt */}
                {action === "failed_attempt" && activeAction === "failed_attempt" && (
                  <textarea
                    className="mb-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/20"
                    placeholder="Motivo del intento fallido (opcional)"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                )}

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    if (action === "delivered") {
                      handleDeliveredClick();
                      return;
                    }
                    if (action === "failed_attempt" && activeAction !== "failed_attempt") {
                      setActiveAction("failed_attempt");
                      return;
                    }
                    handleAction(action);
                  }}
                  className={`w-full rounded-xl py-3 font-semibold text-base text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${ACTION_COLORS[action]}`}
                >
                  {isSubmitting && (activeAction === action || action !== "failed_attempt") ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                      Guardando...
                    </span>
                  ) : (
                    ACTION_LABELS[action]
                  )}
                </button>
              </div>
            ))}

            {activeAction === "failed_attempt" && (
              <button
                type="button"
                onClick={() => { setActiveAction(null); setNote(""); }}
                className="w-full rounded-xl border border-gray-200 py-2.5 text-gray-600 text-sm"
              >
                Cancelar
              </button>
            )}

            {actionError && (
              <p className="text-center text-red-600 text-sm">{actionError}</p>
            )}
          </div>
        )}

        {/* Terminal states */}
        {(execution.status === "delivered" || execution.status === "failed_attempt") && (
          <div className={`mt-4 rounded-2xl p-4 text-center ${execution.status === "delivered" ? "bg-green-50" : "bg-red-50"}`}>
            <p className={`font-semibold ${execution.status === "delivered" ? "text-green-700" : "text-red-700"}`}>
              {execution.status === "delivered"
                ? "Entrega completada"
                : "Intento fallido registrado"}
            </p>
            {execution.note && (
              <p className="mt-1 text-gray-600 text-sm">{execution.note}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Lazy scanner ──────────────────────────────────────────────────────────────

type ScannerProps = ComponentProps<typeof import("./barcode-scanner").default>;

const ScannerLazy = dynamic(() => import("./barcode-scanner"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-white border-r-transparent" />
    </div>
  ),
}) as React.ComponentType<ScannerProps>;

// ── Lazy POD ──────────────────────────────────────────────────────────────────

type PodProps = ComponentProps<typeof import("./proof-of-delivery").default>;

const PodLazy = dynamic(() => import("./proof-of-delivery"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50">
      <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-green-700 border-r-transparent" />
    </div>
  ),
}) as React.ComponentType<PodProps>;
