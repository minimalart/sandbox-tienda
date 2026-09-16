"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

// ============================================================================
// TIPOS
// ============================================================================

type LoginStatus = "idle" | "loading" | "error";

// ============================================================================
// HELPERS
// ============================================================================

async function loginDriver(
  email: string,
  password: string,
): Promise<{ success: boolean; message?: string }> {
  const res = await fetch("/api/driver/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", email, password }),
  });
  return res.json() as Promise<{ success: boolean; message?: string }>;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Formulario de login del repartidor.
 *
 * Vive acá y no en `app/driver/login/page.tsx` porque el título lleva el nombre de la
 * TIENDA: la page pasó a ser un Server Component que resuelve el tenant y le pasa la
 * marca a este componente. Antes decía "Mercatto Repartidores" escrito a mano, y lo
 * leía el repartidor de cualquier tienda.
 *
 * Los verdes fijos también salieron: los tokens `primary` los alimenta el tema del
 * tenant (`lib/site-config/theme/inject-theme.ts`), igual que en el storefront.
 */
export default function DriverLoginForm({ brand }: { brand: string }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!email.trim() || !password) return;

      setStatus("loading");
      setErrorMsg(null);

      const result = await loginDriver(email.trim(), password);

      if (result.success) {
        router.replace("/driver");
      } else {
        setStatus("error");
        setErrorMsg(result.message ?? "Credenciales incorrectas. Intentá de nuevo.");
      }
    },
    [email, password, router],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <svg
              className="h-8 w-8 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
              />
            </svg>
          </div>
          <h1 className="font-bold text-gray-900 text-2xl">{brand} Repartidores</h1>
          <p className="mt-1 text-gray-500 text-sm">Iniciá sesión para ver tus paradas</p>
        </div>

        {/* Form */}
        <form
          className="rounded-2xl bg-white p-6 shadow-sm"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block font-medium text-gray-700 text-sm"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="off"
                required
                disabled={status === "loading"}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 text-sm placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="repartidor@ejemplo.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block font-medium text-gray-700 text-sm"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={status === "loading"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 text-sm placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Error */}
          {status === "error" && errorMsg && (
            <p className="mt-3 flex items-start gap-1.5 text-red-600 text-sm">
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={!email.trim() || !password || status === "loading"}
            className="mt-5 w-full rounded-xl bg-primary py-3 font-semibold text-base text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                Ingresando...
              </span>
            ) : (
              "Ingresar"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
