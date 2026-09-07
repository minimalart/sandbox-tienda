"use client";

import { fetchDriverStops } from "@lib/data/driver/client";
import type { DeliveryExecution } from "@lib/data/driver/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import StatusBadge from "./status-badge";

// ============================================================================
// HELPERS
// ============================================================================

function formatAddress(exec: DeliveryExecution): string {
  const a = exec.address;
  if (!a) return "Sin dirección";
  const parts = [a.line1, a.line2, a.city].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Sin dirección";
}

async function logoutDriver(): Promise<void> {
  await fetch("/api/driver/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "logout" }),
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function StopsList() {
  const router = useRouter();

  const [executions, setExecutions] = useState<DeliveryExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStops = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDriverStops();
      setExecutions(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ERROR";
      if (msg === "UNAUTHORIZED" || msg === "NO_TOKEN") {
        router.replace("/driver/login");
        return;
      }
      setError("No se pudieron cargar las paradas. Tirá para refrescar.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadStops();
  }, [loadStops]);

  const handleLogout = useCallback(async () => {
    await logoutDriver();
    router.replace("/driver/login");
  }, [router]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-green-700 border-r-transparent" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-gray-600">{error}</p>
        <button
          type="button"
          onClick={loadStops}
          className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-sm text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg px-4 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50 pb-2 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900 text-xl">Mis paradas</h1>
            <p className="text-gray-500 text-sm">
              {executions.length === 0
                ? "Sin paradas asignadas"
                : `${executions.length} parada${executions.length !== 1 ? "s" : ""} hoy`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadStops}
              aria-label="Refrescar paradas"
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-50"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {executions.length === 0 && (
        <div className="mt-12 text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-300"
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
            />
          </svg>
          <p className="mt-4 font-medium text-gray-500">No tenés paradas asignadas</p>
        </div>
      )}

      {/* Stops list */}
      {executions.length > 0 && (
        <ul className="mt-4 space-y-3">
          {executions.map((exec) => (
            <li key={exec.id}>
              <Link
                href={`/driver/stops/${exec.id}`}
                className="block rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">
                        Pedido{" "}
                        {exec.order_display_id
                          ? `#${exec.order_display_id}`
                          : exec.id.slice(-8).toUpperCase()}
                      </p>
                    </div>
                    {exec.customer_name && (
                      <p className="mt-0.5 truncate text-gray-600 text-sm">
                        {exec.customer_name}
                      </p>
                    )}
                    <p className="mt-1 truncate text-gray-500 text-xs">
                      {formatAddress(exec)}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    <StatusBadge status={exec.status} />
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
