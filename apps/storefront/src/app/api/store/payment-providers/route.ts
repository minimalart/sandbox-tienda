import { listCartPaymentMethods } from "@lib/data/payment";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import { NextResponse } from "next/server";

const MP_EXPRESS_PROVIDER_ID = "pp_mercadopago_mercadopago";
const MP_API_PROVIDER_ID = "pp_mercadopagoapi_mercadopagoapi";
// Medio exclusivo del portal B2B; nunca se ofrece en el checkout B2C.
const CUENTA_CORRIENTE_PROVIDER_ID = "pp_cuenta_corriente_cuenta_corriente";

/**
 * Hides the MercadoPago provider variant(s) a demo doesn't offer, based on its
 * `mercadopagoCheckoutMode` ('express' default | 'api' | 'both'). Providers not
 * linked to the region simply aren't in the list, so this only ever removes.
 */
function filterMercadoPagoByMode<T extends { id: string }>(
  methods: T[],
  mode: "api" | "express" | "both",
): T[] {
  return methods.filter((m) => {
    if (m.id === MP_API_PROVIDER_ID) return mode === "api" || mode === "both";
    if (m.id === MP_EXPRESS_PROVIDER_ID) return mode === "express" || mode === "both";
    return true;
  });
}

const MANUAL_PAYMENT_PROVIDER_IDS = new Set([
  "manual_payment",
  "pp_system_manual",
  "pp_system_default",
]);

function shouldExposeManualPaymentProvider() {
  if (process.env.SHOW_MANUAL_PAYMENT === "true") {
    return true;
  }

  const gitBranch =
    process.env.VERCEL_GIT_COMMIT_REF ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ??
    "";

  if (gitBranch === "develop") {
    return true;
  }

  return process.env.NODE_ENV !== "production";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const regionId = url.searchParams.get("region_id") || "";
    const paymentMethods = await listCartPaymentMethods(regionId);
    const exposeManualPaymentProvider = shouldExposeManualPaymentProvider();
    const safePaymentMethods = (paymentMethods || []).filter((provider) => {
      // "Cuenta Corriente" es un medio exclusivo del portal B2B: nunca se ofrece
      // en el checkout B2C, aunque esté habilitado en la región (el listado B2B
      // lo trae por su cuenta vía listB2BPaymentProviders).
      if (provider.id === CUENTA_CORRIENTE_PROVIDER_ID) {
        return false;
      }
      if (exposeManualPaymentProvider) {
        return true;
      }

      return !MANUAL_PAYMENT_PROVIDER_IDS.has(provider.id);
    });

    // Muestra solo la(s) variante(s) de MercadoPago que el demo ofrece.
    const tenant = await getActiveTenant();
    const mpMode = tenant.assets.mercadopago?.checkoutMode ?? "express";
    const finalMethods = filterMercadoPagoByMode(safePaymentMethods, mpMode);

    return NextResponse.json({
      payment_providers: finalMethods,
      // The embedded Checkout API Brick needs the tenant's MP public key.
      mercadopago: {
        checkoutMode: mpMode,
        publicKey: tenant.assets.mercadopago?.publicKey ?? null,
      },
    });
  } catch (error) {
    console.error("[API] Failed to fetch payment providers:", error);
    return NextResponse.json(
      { message: "Unable to fetch payment providers", payment_providers: [] },
      { status: 500 }
    );
  }
}

