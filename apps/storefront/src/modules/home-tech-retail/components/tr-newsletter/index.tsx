"use client";

import type { TechNewsletterConfig } from "@lib/site-config/types";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

/**
 * Newsletter / novedades — bloque final para captar leads.
 * Demo: valida y muestra confirmación en cliente (sin backend real).
 */
export default function TrNewsletter({
  config,
}: {
  config?: TechNewsletterConfig;
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
    <section className="tech-retail-home bg-[--tr-dark] py-14 text-white sm:py-16">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <h2 className="text-[clamp(1.375rem,1.1rem+1.4vw,2rem)] font-extrabold leading-tight tracking-[-0.02em]">
          {config.title ?? "Recibí ofertas y lanzamientos antes que nadie"}
        </h2>
        {config.description && (
          <p className="mt-3 text-base text-white/75">{config.description}</p>
        )}

        {done ? (
          <p className="mt-8 inline-flex items-center gap-2 text-[15px] font-bold text-white">
            <CheckCircle2 className="size-5" /> ¡Listo! Te suscribiste correctamente.
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
              className="h-12 flex-1 rounded-xl border border-white/15 bg-white/5 px-5 text-[15px] text-white placeholder:text-white/50 outline-none focus:border-white/40"
            />
            <button type="submit" className="tr-btn-accent h-12 px-7">
              {config.buttonText ?? "Suscribirme"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
