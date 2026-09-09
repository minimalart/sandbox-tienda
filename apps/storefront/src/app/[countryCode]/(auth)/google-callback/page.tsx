"use client";

import { useAuth } from "@lib/hooks/use-auth";
import { useDemoHref, useTenantBrand } from "@lib/site-config/context";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { useEffect, useRef, useState } from "react";

type CallbackStatus = "loading" | "error" | "mismatch";

// Nombres amigables de tenants para el mensaje de "cuenta en otra tienda".
const TENANT_NAMES: Record<string, string> = {
  sheru: "Sheru",
  freshpop: "Freshpop",
  aromapop: "Aromapop",
};

export default function GoogleCallbackPage() {
  const { completeGoogleLogin } = useAuth();
  const demoHref = useDemoHref();
  // Logo del sitio activo. `<img>` y no `next/image`: el logo del tenant suele
  // ser una URL remota (S3) y acá no aporta la optimización — es el mismo
  // criterio que ResetPasswordTemplate y SiteGateScreen.
  const { logos, name: brandName } = useTenantBrand();
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [message, setMessage] = useState<string>("");
  // Evita que el efecto consuma el código OAuth dos veces (StrictMode en dev).
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) {
      return;
    }
    processed.current = true;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);

      // El usuario canceló o Google devolvió un error en la pantalla de consentimiento
      if (params.get("error")) {
        setStatus("error");
        setMessage(
          "Cancelaste el inicio de sesión con Google o no se otorgaron los permisos.",
        );
        return;
      }

      if (!params.get("code")) {
        setStatus("error");
        setMessage("Faltan datos en la respuesta de Google. Intentá de nuevo.");
        return;
      }

      try {
        // Reenviar los query params (code/state) al API route, que server-side
        // los intercambia por token y aplica la validación multi-tenant.
        const result = await completeGoogleLogin(
          Object.fromEntries(params.entries()),
        );

        if (result.success) {
          // URL limpia sin prefijo de país (el middleware resuelve el resto);
          // el prefijo /demo/{slug} sí se conserva para no salir del demo.
          window.location.href = result.redirectTo || demoHref("/store");
          return;
        }

        if (result.tenantMismatch) {
          const tenantName =
            TENANT_NAMES[result.originalTenant ?? ""] ||
            result.originalTenant ||
            "otra tienda";
          setStatus("mismatch");
          setMessage(
            `Esta cuenta de Google está registrada en ${tenantName}. Usá una cuenta diferente o ingresá en la tienda correcta.`,
          );
          return;
        }

        setStatus("error");
        setMessage(
          result.message ||
            "No pudimos completar el inicio de sesión con Google.",
        );
      } catch {
        setStatus("error");
        setMessage(
          "No pudimos validar la respuesta de Google. Intentá de nuevo.",
        );
      }
    };

    run();
  }, [completeGoogleLogin]);

  return (
    <section className="fixed inset-0 z-[60] flex min-h-screen w-full flex-col overflow-auto bg-gradient-to-b from-[var(--auth-gradient-from)] to-[var(--auth-gradient-to)]">
      <div className="px-6 pt-6">
        <LocalizedClientLink
          className="inline-flex items-center gap-1.5 font-medium text-sm text-white transition-opacity hover:opacity-80"
          href="/account"
        >
          ← Volver a iniciar sesión
        </LocalizedClientLink>
      </div>
      <div className="mt-4 flex justify-center">
        {/* biome-ignore lint/a11y/useAltText: alt provisto */}
        <img
          alt={brandName}
          className="h-12 w-auto object-contain sm:h-16"
          src={logos.main}
        />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-[480px]">
          <div className="animate-fade-in-up rounded-2xl bg-white px-5 py-8 shadow-lg sm:px-8 sm:py-10">
            <div className="flex flex-col items-center text-center">
              {status === "loading" ? (
                <>
                  <div
                    aria-label="Cargando"
                    className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--primary-color)]"
                    role="status"
                  />
                  <h1 className="mb-2 font-semibold text-gray-900 text-xl">
                    Iniciando sesión…
                  </h1>
                  <p className="text-gray-600 text-sm">
                    Estamos validando tu cuenta de Google.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="mb-2 font-semibold text-gray-900 text-xl">
                    {status === "mismatch"
                      ? "Cuenta registrada en otra tienda"
                      : "No pudimos iniciar sesión"}
                  </h1>
                  <p className="mb-6 text-gray-600 text-sm">{message}</p>
                  <LocalizedClientLink
                    className="w-full rounded-xl bg-[var(--primary-color)] px-4 py-3 text-center font-semibold text-base text-white transition-colors hover:bg-[var(--primary-color-dark)]"
                    href="/account"
                  >
                    Volver a iniciar sesión
                  </LocalizedClientLink>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
