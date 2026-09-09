"use client";

import { useAuth } from "@lib/hooks/use-auth";
import { MercattoLogo, MinimalartAttribution } from "@modules/b2b/components/b2b-brand";
import FormInput from "@modules/common/components/form-input";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import PasswordInput from "@modules/common/components/password-input";
import { useSiteHref } from "@lib/site-config/context";
import { useParams } from "next/navigation";
import { useState } from "react";

/**
 * Login del portal mayorista. A diferencia del login B2C:
 * - Tras autenticar, redirige al portal (/b2b). El gate server-side del portal
 *   valida que la cuenta pertenezca a una empresa mayorista activa; si no, ahí
 *   se muestra la pantalla informativa con el acceso a registrar la empresa.
 * - No ofrece registro de cuenta; en su lugar, lleva a registrar la empresa
 *   (sección accesible sin login).
 */
export default function B2BLogin({
  storeLogo,
  demoSlug,
}: {
  /** Logo configurado de la tienda activa, incluida la principal. */
  storeLogo?: string;
  /** Slug del demo activo, para preservar el prefijo /demo/{slug} tras el login. */
  demoSlug?: string;
} = {}) {
  // `countryCode` sigue haciendo falta para el login de Medusa (resuelve la
  // región), pero YA NO para armar el href: eso ahora lo hace `siteHref`.
  const { countryCode } = useParams() as { countryCode: string };
  const siteHref = useSiteHref();
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await login(email, password, {
      salesChannelId: process.env.NEXT_PUBLIC_SALES_CHANNEL_ID,
      countryCode,
    });
    if (!result.success) return; // useAuth ya muestra el error de credenciales

    // Navegación full-page al portal. El gate server-side (layout del portal)
    // valida que la cuenta pertenezca a una empresa mayorista activa: es el
    // mismo chequeo que corre al refrescar. Hacerlo acá con un server action
    // (getMyCompany) dejaba el botón colgado en "Procesando…" porque la cookie
    // recién creada todavía no se había propagado al server. Preservamos el
    // prefijo /demo/{slug} para mantener branding + canal del demo.
    // Antes la rama sin sitio metía el countryCode (`/${countryCode}/b2b`), que el
    // proxy tenía que 307ear como URL legacy: un redirect extra evitable. Ahora
    // sale la URL limpia directo, y con prefijo cuando hay sitio.
    window.location.href = siteHref("/b2b");
  };

  const busy = isLoading;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12">
      {storeLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={storeLogo} alt="Tienda" className="mx-auto mb-6 h-9 w-auto object-contain" />
      ) : (
        <MercattoLogo className="mx-auto mb-6 h-9 w-auto" />
      )}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-center font-bold text-2xl text-gray-900">Portal Mayorista</h1>
        <p className="mt-1 mb-6 text-center text-gray-500 text-sm">
          Ingresá con la cuenta de tu empresa para comprar con precios mayoristas.
        </p>
        <form className="flex flex-col gap-3" noValidate onSubmit={onSubmit}>
          <FormInput
            autoComplete="email"
            label="Email"
            placeholder="ejemplo@empresa.com"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordInput
            autoComplete="current-password"
            label="Contraseña"
            placeholder="Tu contraseña"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? (
            <p className="text-red-600 text-sm">{error}</p>
          ) : null}
          <button
            className="mt-1 min-h-[44px] w-full rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-base text-white transition-colors hover:bg-[--primary-color-dark] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !email || password.length < 1}
            type="submit"
          >
            {busy ? "Procesando..." : "Ingresar"}
          </button>
        </form>

        <div className="mt-6 border-gray-100 border-t pt-4 text-center">
          <p className="mb-2 text-gray-500 text-sm">¿Tu empresa todavía no está registrada?</p>
          <LocalizedClientLink
            href="/b2b/register"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[--primary-color] px-4 py-3 font-semibold text-[--primary-color] text-sm transition-colors hover:bg-[--primary-color]/5"
          >
            Registrar empresa
          </LocalizedClientLink>
        </div>
      </div>
      <MinimalartAttribution className="mt-8" />
    </div>
  );
}
