"use client";

import { useAuth } from "@lib/hooks/use-auth";
import { useTenantBrand } from "@lib/site-config/context";
import ResetPasswordTemplate from "@modules/account/templates/reset-password-template";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token"), [searchParams]);
  const email = useMemo(() => searchParams.get("email"), [searchParams]);
  const [success, setSuccess] = useState(false);
  const { resetPassword, isLoading, error } = useAuth();
  // Logo del sitio activo. `<img>` y no `next/image`: el logo del tenant suele
  // ser una URL remota (S3) y acá no aporta la optimización — es el mismo
  // criterio que ResetPasswordTemplate y SiteGateScreen.
  const { logos, name: brandName } = useTenantBrand();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!(token && email)) {
      return;
    }
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const result = await resetPassword(email, password, token);
    if (result.success) {
      setSuccess(true);
    }
  };

  if (!(token && email)) {
    return (
      <section className="fixed inset-0 z-[60] flex min-h-screen w-full flex-col overflow-auto bg-gradient-to-b from-[var(--auth-gradient-from)] to-[var(--auth-gradient-to)]">
        <div className="px-6 pt-6">
          <LocalizedClientLink
            className="inline-flex items-center gap-1.5 font-medium text-sm text-white transition-opacity hover:opacity-80"
            href="/"
          >
            ← Volver
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
                <h1 className="mb-2 font-semibold text-gray-900 text-xl">
                  Enlace inválido
                </h1>
                <p className="mb-6 text-gray-600 text-sm">
                  Este enlace para restablecer la contraseña no es válido o
                  expiró. Solicitá uno nuevo desde la página de inicio de
                  sesión.
                </p>
                <LocalizedClientLink
                  className="w-full min-h-[44px] rounded-xl bg-[--primary-color] px-4 py-3 text-center font-semibold text-base text-white transition-colors hover:bg-[--primary-color-dark]"
                  href="/account"
                >
                  Ir a iniciar sesión
                </LocalizedClientLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <ResetPasswordTemplate
      email={email}
      error={error}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      success={success}
    />
  );
}
