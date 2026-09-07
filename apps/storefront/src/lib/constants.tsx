import { CreditCard } from "@medusajs/icons";
import Bancontact from "@modules/common/icons/bancontact";

import Ideal from "@modules/common/icons/ideal";
import MercadoPago from "@modules/common/icons/mercadopago";
import PayPal from "@modules/common/icons/paypal";
import type React from "react";

/* Map of payment provider_id to their title and icon. Add in any payment providers you want to use. */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  pp_stripe_stripe: {
    title: "Tarjeta de crédito",
    icon: <CreditCard />,
  },
  "pp_stripe-ideal_stripe": {
    title: "iDeal",
    icon: <Ideal />,
  },
  "pp_stripe-bancontact_stripe": {
    title: "Bancontact",
    icon: <Bancontact />,
  },
  pp_paypal_paypal: {
    title: "PayPal",
    icon: <PayPal />,
  },
  pp_mercadopago_mercadopago: {
    title: "Mercado Pago",
    icon: <MercadoPago />,
  },
  pp_mercadopagoapi_mercadopagoapi: {
    title: "Tarjeta / efectivo (Mercado Pago)",
    icon: <MercadoPago />,
  },
  pp_system_default: {
    title: "Pago manual",
    icon: <CreditCard />,
  },
  pp_cuenta_corriente_cuenta_corriente: {
    title: "Cuenta Corriente",
    icon: <CreditCard />,
  },
  // Add more payment providers here
};

// This only checks if it is native stripe for card payments, it ignores the other stripe-based providers
export const isStripe = (providerId?: string) =>
  providerId?.startsWith("pp_stripe_");
export const isPaypal = (providerId?: string) =>
  providerId?.startsWith("pp_paypal");
export const isManual = (providerId?: string) =>
  providerId?.startsWith("pp_system_default");
export const isMercadoPago = (providerId?: string) =>
  providerId?.startsWith("pp_mercadopago_") || providerId === "mercadopago";
// MercadoPago Checkout API (embedded Payment Brick). Distinct from Express above
// (pp_mercadopagoapi_* vs pp_mercadopago_*).
export const isMercadoPagoApi = (providerId?: string) =>
  providerId?.startsWith("pp_mercadopagoapi_") || providerId === "mercadopagoapi";
export const isCuentaCorriente = (providerId?: string) =>
  providerId?.startsWith("pp_cuenta_corriente_") ||
  providerId === "cuenta_corriente";

// Add currencies that don't need to be divided by 100
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "xaf",
  "xof",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "rwf",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xau",
];

// ============================================================================
// CARRIER REGISTRY
// ============================================================================
// Única fuente de verdad para identificar shipping carriers. Reemplaza los
// checks ad-hoc de substrings ("andreani" en el nombre/provider_id) que antes
// vivían desperdigados en el checkout, más el `getShippingIcon` viejo (sin
// consumidores) que era un segundo mecanismo de branding paralelo al
// `ShippingProviderBadge` del checkout. Sumar un carrier nuevo es agregar una
// entrada acá — nada más debería hacer string matching de carrier por su cuenta.

/** Arte de una sub-red de retiro dentro de un carrier (ej. los puntos HOP de
 * terceros dentro de la red de Andreani) que necesita su propio badge. */
export type CarrierNetworkBadge = {
  label: string;
  logoSrc: string;
  badgeWidth: number;
  badgeScale: number;
};

export type CarrierMatcher = (
  name?: string | null,
  providerId?: string | null,
) => boolean;

export type CarrierDefinition = {
  id: string;
  label: string;
  logoSrc: string;
  badgeWidth: number;
  badgeScale: number;
  /** URL pública de tracking para un tracking number de este carrier. */
  trackingUrlTemplate: (trackingNumber: string) => string;
  /** Identifica si una shipping option pertenece a este carrier, por nombre o provider_id. */
  matcher: CarrierMatcher;
  /** Sub-redes de retiro con arte propio, keyed por id de red (ver CarrierNetworkBadge). */
  networkBadges?: Record<string, CarrierNetworkBadge>;
};

export const CARRIER_REGISTRY: Record<string, CarrierDefinition> = {
  andreani: {
    id: "andreani",
    label: "Andreani",
    logoSrc: "/andreani.png",
    badgeWidth: 88,
    badgeScale: 1.06,
    trackingUrlTemplate: (trackingNumber) =>
      `https://www.andreani.com/envio/${trackingNumber}`,
    matcher: (name, providerId) =>
      !!name?.toLowerCase().includes("andreani") ||
      !!providerId?.toLowerCase().includes("andreani"),
    networkBadges: {
      hop: {
        label: "Punto HOP",
        logoSrc: "/hop.webp",
        badgeWidth: 74,
        badgeScale: 1.08,
      },
    },
  },
  // Id snake_case (no kebab) a propósito: el backend usa `correo_argentino`
  // como literal en todos lados (DeliveryProviderType, CORREO_DELIVERY_PROVIDER_TYPE,
  // static identifier del provider, provider_id resultante
  // `correo_argentino_correo_argentino`). Alinear con eso evita una segunda
  // convención de nombre para el mismo carrier — "andreani" no desambigua
  // kebab vs snake porque no tiene separador. `hasCorreoCarrierToken()` en el
  // backend igual tolera `correo-argentino` / `correo_argentino` / `correo`
  // por si este id cambia.
  correo_argentino: {
    id: "correo_argentino",
    label: "Correo Argentino",
    // No hay asset de marca de Correo Argentino en este repo — el negocio
    // tiene que proveerlo (con sus normas de marca). Usamos el ícono
    // genérico de camión que ya existe en vez de inventar un logo. Si
    // `logoSrc` fuera opcional acá, `ShippingProviderBadge` (shipping/index.tsx)
    // rompería: hoy asume `src` siempre string y se lo pasa directo a
    // `next/image` sin fallback a solo-texto.
    logoSrc: "/truck.svg",
    badgeWidth: 40,
    badgeScale: 1,
    // Query param, a diferencia del path param de Andreani — el tipo de
    // trackingUrlTemplate ya es una función, así que soporta las dos formas
    // sin tocar CarrierDefinition.
    trackingUrlTemplate: (trackingNumber) =>
      `https://www.correoargentino.com.ar/formularios/e-commerce?id=${encodeURIComponent(trackingNumber)}`,
    // Límite de palabra a propósito: "correo" es palabra corriente en
    // castellano (equivalente a "mail"/"envío postal") y un `includes`
    // laxo clasificaría mal cualquier shipping option que la mencione al
    // pasar. OJO: esto solo protege el campo `name` (texto libre en
    // castellano, separado por espacios). NO se puede aplicar el mismo
    // `\b` al `provider_id` real (`correo_argentino_correo_argentino`):
    // en regex `_` es un word-char, así que no hay boundary entre
    // "correo" y "_argentino" y `\bcorreo\b` NUNCA matchea ese id. Para
    // provider_id alcanza un `includes` plano porque es un identificador de
    // sistema controlado, no texto libre — no tiene el riesgo de colisión
    // que sí tiene `name`.
    matcher: (name, providerId) =>
      /\bcorreo\b/i.test(name ?? "") ||
      !!providerId?.toLowerCase().includes("correo"),
    // Una sola red de retiro (sus propias sucursales) — a diferencia de
    // Andreani (Sucursal + HOP), no hace falta un networkBadges acá.
  },
};

/** Busca el carrier cuyo matcher acepta este nombre/provider_id de shipping option. */
export function matchCarrier(
  name?: string | null,
  providerId?: string | null,
): CarrierDefinition | null {
  return (
    Object.values(CARRIER_REGISTRY).find((carrier) =>
      carrier.matcher(name, providerId),
    ) ?? null
  );
}

/** Busca un carrier por id (ej. el `carrier` persistido en cart/order metadata). */
export function getCarrier(id?: string | null): CarrierDefinition | null {
  return id ? (CARRIER_REGISTRY[id] ?? null) : null;
}
