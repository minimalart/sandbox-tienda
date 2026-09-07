"use client";

import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div
      className="flex items-center justify-center px-4 py-16"
      style={{ minHeight: "calc(100vh - 400px)" }}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <h1
          className="font-bold leading-none"
          style={{
            fontSize: "150px",
            width: "427px",
            height: "150px",
            opacity: 0.3,
            color: "#2e7d3299",
            letterSpacing: "-0.02em",
          }}
        >
          404
        </h1>

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-gray-900">
            Página no encontrada
          </h2>
          <p className="text-base text-gray-600 max-w-md">
            No pudimos encontrar lo que buscás. Probá volver al inicio o
            explorar nuestra tienda.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <Link href="/">
            <button
              className="min-w-[160px] px-6 py-3 bg-[--primary-color] hover:bg-[--primary-color-dark] text-white font-medium transition-colors"
              style={{
                borderRadius: "16px",
                boxShadow: "0px 4px 8px 0px rgba(46, 125, 50, 0.24)",
              }}
            >
              Ir al inicio
            </button>
          </Link>
          <Link href="/store">
            <button
              className="min-w-[160px] px-6 py-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              style={{
                borderRadius: "16px",
                boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.08)",
              }}
            >
              Explorar tienda
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
