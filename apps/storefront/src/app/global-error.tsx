"use client";

import { siteHomeFromPathname } from "@lib/site-config/site-path";
import { recoverFromChunkLoadError } from "@lib/util/chunk-error";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Boundary de ÚLTIMO RECURSO: reemplaza el root layout cuando el error ocurrió tan
 * arriba que `(main)/error.tsx` no lo pudo contener (el propio root layout, un provider,
 * un chunk que no bajó durante una navegación client-side).
 *
 * Reemplaza el documento entero, así que tiene que traer su propio `<html>`/`<body>` y
 * NO puede contar con nada del layout: ni providers de tenant, ni las CSS variables del
 * theme que el root layout inyecta inline, ni las fuentes de `next/font`. Por eso todo
 * acá va en estilos inline con el verde de marca hardcodeado y un stack de fuentes del
 * sistema: la alternativa es una pantalla sin estilos.
 *
 * Sin este archivo, Next servía su propio `DefaultGlobalError` — en inglés, sin marca y
 * sin mensaje (en prod React borra el mensaje del error), que es la pantalla
 * "This page couldn't load" que veían los usuarios.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (recoverFromChunkLoadError(error)) return;
    Sentry.captureException(error);
  }, [error]);

  const goHome = () => {
    // `window.location` en el handler, no `usePathname()`: este boundary es el último
    // que queda en pie, así que no se le agrega dependencia del contexto del router.
    window.location.href = siteHomeFromPathname(window.location.pathname);
  };

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#ffffff",
          color: "#111827",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
            maxWidth: "28rem",
            textAlign: "center",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2e7d32"
            strokeWidth="1.6"
            width="56"
            height="56"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
              No pudimos cargar la página
            </h1>
            <p style={{ margin: 0, fontSize: "1rem", color: "#4b5563" }}>
              Algo falló al armar la pantalla. Recargá para volver a intentar; si
              el problema sigue, escribinos.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                minWidth: "160px",
                padding: "12px 24px",
                border: "none",
                borderRadius: "16px",
                backgroundColor: "#2e7d32",
                color: "#ffffff",
                fontSize: "1rem",
                fontWeight: 500,
                cursor: "pointer",
                boxShadow: "0px 4px 8px 0px rgba(46, 125, 50, 0.24)",
              }}
            >
              Recargar
            </button>
            <button
              type="button"
              onClick={goHome}
              style={{
                minWidth: "160px",
                padding: "12px 24px",
                border: "1px solid #d1d5db",
                borderRadius: "16px",
                backgroundColor: "#ffffff",
                color: "#374151",
                fontSize: "1rem",
                fontWeight: 500,
                cursor: "pointer",
                boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.08)",
              }}
            >
              Ir al inicio
            </button>
          </div>

          {error.digest && (
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                color: "#94a3b8",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              Código de error: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
