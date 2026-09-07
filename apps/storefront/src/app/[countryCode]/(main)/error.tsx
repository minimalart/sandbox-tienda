"use client";

import { useSiteHref } from "@lib/site-config/context";
import { recoverFromChunkLoadError } from "@lib/util/chunk-error";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Error boundary del árbol `(main)`.
 *
 * POR QUÉ ESTÁ ACÁ Y NO MÁS ARRIBA: renderiza en lugar de `props.children` del layout
 * de `(main)`, o sea DENTRO de todos los providers (tenant, canal, store). Así una
 * falla en una página se contiene en el área de contenido y el usuario conserva header,
 * footer, carrito y branding, en vez de quedarse con el documento entero reemplazado
 * por la pantalla en inglés de Next ("This page couldn't load").
 *
 * Un error en el layout de `(main)` mismo NO lo agarra esto —por definición, el
 * boundary vive dentro de ese layout—: eso sube hasta `app/global-error.tsx`.
 */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const siteHref = useSiteHref();

  useEffect(() => {
    // Chunk faltante = skew de deploy: se recarga solo y no se reporta, porque no es un
    // bug del código sino un artefacto de haber deployado con pestañas abiertas.
    if (recoverFromChunkLoadError(error)) return;
    // No-op si no hay DSN configurado (ver `instrumentation-client.ts`).
    Sentry.captureException(error);
  }, [error]);

  return (
    <div
      className="flex items-center justify-center px-4 py-16"
      style={{ minHeight: "calc(100vh - 400px)" }}
    >
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="h-14 w-14 text-[--primary-color]"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>

        <div className="flex flex-col gap-2">
          <h1 className="font-semibold text-2xl text-gray-900">
            No pudimos cargar esta sección
          </h1>
          <p className="text-base text-gray-600">
            Hubo un problema al mostrar el contenido. Probá de nuevo; si sigue
            pasando, volvé al inicio y escribinos.
          </p>
        </div>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="min-w-[160px] bg-[--primary-color] px-6 py-3 font-medium text-white transition-colors hover:bg-[--primary-color-dark]"
            style={{
              borderRadius: "16px",
              boxShadow: "0px 4px 8px 0px rgba(46, 125, 50, 0.24)",
            }}
          >
            Reintentar
          </button>
          <Link href={siteHref("/")}>
            <button
              type="button"
              className="min-w-[160px] border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
              style={{
                borderRadius: "16px",
                boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.08)",
              }}
            >
              Ir al inicio
            </button>
          </Link>
        </div>

        {/* El digest es lo ÚNICO que correlaciona esta pantalla con el log del server
            (en prod React borra el mensaje del error). Sin mostrarlo, un reporte de
            soporte no se puede rastrear. */}
        {error.digest && (
          <p className="font-mono text-slate-400 text-xs">
            Código de error: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
