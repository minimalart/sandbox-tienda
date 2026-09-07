"use client";

import type { FashionNewsletterConfig } from "@lib/site-config/types";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

/**
 * Newsletter — bloque final para captar leads (inspirado en Adidas).
 * Demo: valida y muestra confirmación en cliente (sin backend real).
 */
export default function SportsNewsletter({
  config,
}: {
  config?: FashionNewsletterConfig;
}) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  if (!config) return null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setDone(true);
  };

  return (
    <section className="sports-home sp-on-dark bg-[--sp-ink] py-14 text-[--sp-on-dark] sm:py-20">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <h2 className="sp-display text-[clamp(1.75rem,1.3rem+2vw,2.75rem)]">
          {config.title ?? "Sumate al equipo"}
        </h2>
        {config.description && (
          <p className="mt-3 text-base text-white/75">{config.description}</p>
        )}

        {done ? (
          <p className="mt-8 inline-flex items-center gap-2 text-[15px] font-bold uppercase tracking-wide">
            <CheckCircle2 className="size-5" /> ¡Listo! Te suscribiste.
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={config.placeholder ?? "tucorreo@ejemplo.com"}
              aria-label="Correo electrónico"
              className="h-12 flex-1 border-2 border-white/20 bg-transparent px-5 text-[15px] text-white placeholder:text-white/50 outline-none focus:border-white"
            />
            <button type="submit" className="sp-btn-solid h-12 px-7">
              {config.buttonText ?? "Suscribirme"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
