import { MercattoLogo, MinimalartAttribution } from "@modules/b2b/components/b2b-brand";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ArrowRight, Building2, Clock, ShoppingCart } from "lucide-react";

/**
 * Pantalla del gate del portal mayorista para cuentas logueadas (B2C) que aún no
 * pueden operar: sin empresa asociada o con la empresa pendiente de habilitación.
 */
export default function B2BGateScreen({ variant }: { variant: "no-company" | "inactive" }) {
  const inactive = variant === "inactive";

  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center px-4 py-12">
      <MercattoLogo className="mb-8 h-9 w-auto" />

      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-[--primary-color]/10 text-[--primary-color]">
          {inactive ? <Clock className="size-7" /> : <Building2 className="size-7" />}
        </div>

        <h1 className="font-bold text-gray-900 text-xl">
          {inactive ? "Tu empresa está en revisión" : "Sumate al canal mayorista"}
        </h1>
        <p className="mt-2 text-gray-500 text-sm leading-relaxed">
          {inactive
            ? "Tu empresa todavía no fue habilitada. Te avisamos por email apenas puedas operar con precios y condiciones mayoristas."
            : "Tu cuenta no está asociada a ninguna empresa mayorista. Registrá tu empresa para comprar al por mayor, con precios y condiciones especiales."}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {!inactive ? (
            <LocalizedClientLink
              href="/b2b/register"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-sm text-white transition-colors hover:bg-[--primary-color-dark]"
            >
              Registrar mi empresa
              <ArrowRight className="size-4" />
            </LocalizedClientLink>
          ) : null}
          <LocalizedClientLink
            href="/"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 text-sm transition-colors hover:bg-gray-50"
          >
            <ShoppingCart className="size-4" />
            Volver a la tienda
          </LocalizedClientLink>
        </div>

        {!inactive ? (
          <p className="mt-4 text-gray-400 text-xs">
            ¿Ya tenés una cuenta mayorista?{" "}
            <LocalizedClientLink href="/b2b/login" className="text-[--primary-color] underline">
              Ingresá con esa cuenta
            </LocalizedClientLink>
          </p>
        ) : null}
      </div>

      <MinimalartAttribution className="mt-8" />
    </div>
  );
}
