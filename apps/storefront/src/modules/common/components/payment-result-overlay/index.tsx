"use client";

import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { useEffect, useRef, useState } from "react";

/**
 * Full-screen animated overlay shown when the shopper comes back from the
 * payment gateway (MercadoPago). Ported from the original Saphirus theme:
 * a colored gradient screen (green / amber / red) with a staggered check
 * animation and — for the terminal success/error states — a short sound.
 *
 * One component, three variants:
 * - success  → green,  plays /sounds/success.mp3
 * - pending  → amber,  silent
 * - error    → red,    plays /sounds/error.wav (different from success)
 *
 * Sound only plays for success and error (pending is silent by design).
 *
 * Each variant ships sensible defaults (title, subtitle, buttons) that the
 * caller can override per placement.
 *
 * ESTAS TRES SON LAS ÚNICAS pantallas de retorno de pago del storefront:
 * /checkout/success (verde), /checkout/pending (amarilla) y /checkout/failure
 * (roja) no renderizan nada más. Las tarjetas blancas genéricas que antes
 * vivían detrás se eliminaron: repetían el mismo mensaje con otro estilo, y en
 * el caso de success afirmaban que el pago estaba listo antes de que el webhook
 * hubiera creado la orden.
 */

export type PaymentResultVariant = "success" | "pending" | "error";

const GRADIENT: Record<PaymentResultVariant, string> = {
  success: "linear-gradient(160deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)",
  pending: "linear-gradient(160deg, #FCD34D 0%, #F59E0B 50%, #D97706 100%)",
  error: "linear-gradient(160deg, #f87171 0%, #ef4444 50%, #dc2626 100%)",
};

type OverlayAction =
  | { label: string; kind: "dismiss" }
  | { label: string; kind: "link"; href: string };

type PaymentResultOverlayProps = {
  variant: PaymentResultVariant;
  title?: string;
  subtitle?: React.ReactNode;
  /** Primary white button (null hides it — usado mientras se espera al webhook). */
  primary?: OverlayAction | null;
  /** Secondary text link below the button (null hides it). */
  secondary?: { label: string; href: string } | null;
  /**
   * Spinner en lugar de los botones. Las pantallas de retorno de MercadoPago lo
   * usan mientras poolean la orden que crea el webhook: la animación ya se ve,
   * pero todavía no hay a dónde mandar al comprador.
   */
  busy?: boolean;
};

type VariantConfig = {
  gradient: string;
  glyph: string;
  glyphColor: string;
  accent: string;
  title: string;
  subtitle: React.ReactNode;
  sound: string | null;
  primary: OverlayAction;
  secondary: { label: string; href: string } | null;
};

const CONFIG: Record<PaymentResultVariant, VariantConfig> = {
  success: {
    gradient: GRADIENT.success,
    glyph: "✓",
    glyphColor: "text-green-500",
    accent: "text-green-600",
    title: "¡Pedido confirmado!",
    subtitle: (
      <>
        Tu pedido fue realizado con éxito.
        <br />
        Te avisaremos cuando esté en camino.
      </>
    ),
    sound: "/sounds/success.mp3",
    primary: { label: "VER MI PEDIDO", kind: "dismiss" },
    secondary: { label: "Volver al inicio", href: "/store" },
  },
  pending: {
    gradient: GRADIENT.pending,
    glyph: "⏳",
    glyphColor: "text-[#D97706]",
    accent: "text-[#D97706]",
    title: "¡Pago pendiente!",
    subtitle: (
      <>
        Recibimos tu pedido y estamos esperando la confirmación
        <br />
        del pago. Te avisaremos por correo electrónico cuando se acredite.
      </>
    ),
    sound: null,
    primary: { label: "VER MI PEDIDO", kind: "dismiss" },
    secondary: { label: "Volver al inicio", href: "/store" },
  },
  error: {
    gradient: GRADIENT.error,
    glyph: "✕",
    glyphColor: "text-red-500",
    accent: "text-red-600",
    title: "Pago rechazado",
    subtitle: (
      <>
        No pudimos procesar tu pago.
        <br />
        Probá nuevamente o usá otro medio de pago.
      </>
    ),
    sound: "/sounds/error.wav",
    primary: { label: "INTENTAR NUEVAMENTE", kind: "link", href: "/checkout" },
    secondary: { label: "Volver al inicio", href: "/store" },
  },
};

export default function PaymentResultOverlay({
  variant,
  title,
  subtitle,
  primary,
  secondary,
  busy = false,
}: PaymentResultOverlayProps) {
  const config = CONFIG[variant];
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const resolvedPrimary = primary === undefined ? config.primary : primary;
  const resolvedSecondary =
    secondary === undefined ? config.secondary : secondary;

  useEffect(() => {
    if (config.sound) {
      try {
        const audio = new Audio(config.sound);
        audio.volume = 0.6;
        audio.play().catch(() => {
          /* autoplay may be blocked */
        });
        audioRef.current = audio;
      } catch (_) {
        // silent fail — sound file might not be available
      }
    }

    // Staggered animation steps
    const t1 = setTimeout(() => setStep(1), 100);
    const t2 = setTimeout(() => setStep(2), 500);
    const t3 = setTimeout(() => setStep(3), 800);
    const t4 = setTimeout(() => setStep(4), 1000);
    const t5 = setTimeout(() => setStep(5), 1300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      audioRef.current?.pause();
    };
  }, [config.sound]);

  // Once dismissed, remove from DOM (reveals the page behind).
  if (dismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-out"
        style={{
          background: config.gradient,
          opacity: step >= 1 ? 1 : 0,
        }}
      />

      {/* Decorative light stripes */}
      <div
        className="absolute h-[130%] w-[50%] rotate-[25deg] transition-opacity duration-1000"
        style={{
          top: "-10%",
          left: "-20%",
          backgroundColor: "rgba(255,255,255,0.08)",
          opacity: step >= 1 ? 1 : 0,
        }}
      />
      <div
        className="absolute h-[130%] w-[35%] rotate-[25deg] transition-opacity duration-1000"
        style={{
          top: "-10%",
          left: "15%",
          backgroundColor: "rgba(255,255,255,0.05)",
          opacity: step >= 1 ? 1 : 0,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-8">
        {/* Circle with glyph */}
        <div
          className="flex h-[120px] w-[120px] items-center justify-center rounded-full transition-all duration-500 ease-out"
          style={{
            backgroundColor: "rgba(255,255,255,0.2)",
            transform: step >= 1 ? "scale(1)" : "scale(0)",
            opacity: step >= 1 ? 1 : 0,
          }}
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white">
            <span
              className={`font-extrabold text-5xl transition-all duration-300 ease-out ${config.glyphColor}`}
              style={{
                transform: step >= 2 ? "scale(1)" : "scale(0)",
                opacity: step >= 2 ? 1 : 0,
              }}
            >
              {config.glyph}
            </span>
          </div>
        </div>

        {/* Title */}
        <h1
          className="text-center font-extrabold text-3xl text-white transition-all duration-500 ease-out sm:text-4xl"
          style={{
            opacity: step >= 3 ? 1 : 0,
            transform: step >= 3 ? "translateY(0)" : "translateY(24px)",
          }}
        >
          {title ?? config.title}
        </h1>

        {/* Subtitle */}
        <p
          className="text-center text-base text-white/85 leading-relaxed transition-all duration-500 ease-out sm:text-lg"
          style={{
            opacity: step >= 4 ? 1 : 0,
          }}
        >
          {subtitle ?? config.subtitle}
        </p>
      </div>

      {/* Bottom buttons */}
      <div
        className="absolute inset-x-8 bottom-12 flex flex-col items-center gap-4 transition-all duration-500 ease-out sm:bottom-16"
        style={{
          opacity: step >= 5 ? 1 : 0,
          transform: step >= 5 ? "translateY(0)" : "translateY(32px)",
        }}
      >
        {busy && (
          <span
            aria-label="Procesando"
            className="inline-block h-9 w-9 animate-spin rounded-full border-4 border-white/40 border-r-transparent"
            role="status"
          />
        )}

        {!busy && resolvedPrimary && (
          resolvedPrimary.kind === "dismiss" ? (
            <button
              className={`w-full max-w-sm rounded-2xl bg-white px-12 py-4 text-center font-extrabold text-base tracking-wide shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] ${config.accent}`}
              onClick={() => setDismissed(true)}
              type="button"
            >
              {resolvedPrimary.label}
            </button>
          ) : (
            <LocalizedClientLink
              className={`w-full max-w-sm rounded-2xl bg-white px-12 py-4 text-center font-extrabold text-base tracking-wide shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] ${config.accent}`}
              href={resolvedPrimary.href}
            >
              {resolvedPrimary.label}
            </LocalizedClientLink>
          )
        )}

        {!busy && resolvedSecondary && (
          <LocalizedClientLink
            className="py-2 font-semibold text-sm text-white/80 transition-colors hover:text-white"
            href={resolvedSecondary.href}
          >
            {resolvedSecondary.label}
          </LocalizedClientLink>
        )}
      </div>
    </div>
  );
}
