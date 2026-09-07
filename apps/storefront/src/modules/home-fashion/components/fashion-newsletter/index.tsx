"use client";

import type { FashionNewsletterConfig } from "@lib/site-config/types";
import { useState } from "react";

/**
 * Newsletter del template Moda — captación de leads elegante y minimalista.
 * Sin popups agresivos: un bloque sereno, centrado, con un input fino y un CTA
 * sobrio. Demo: valida y confirma en cliente (sin backend real).
 */
export default function FashionNewsletter({
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
    <section className="fashion-home border-t border-[--f-hairline] bg-[--f-canvas] py-20 sm:py-28">
      <div className="mx-auto max-w-xl px-6 text-center">
        <h2 className="f-display text-[clamp(1.75rem,1.3rem+1.8vw,2.5rem)]">
          {config.title ?? "Sumate a la lista"}
        </h2>
        {config.description && (
          <p className="mx-auto mt-4 max-w-md text-base font-light leading-relaxed text-[--f-muted]">
            {config.description}
          </p>
        )}

        {done ? (
          <p className="mt-10 text-[13px] font-medium uppercase tracking-[0.16em] text-[--f-ink]">
            Gracias por sumarte.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mx-auto mt-10 max-w-md">
            <div className="flex items-center gap-3 border-b border-[--f-ink] pb-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={config.placeholder ?? "Tu email"}
                aria-label="Email"
                className="h-9 flex-1 border-0 bg-transparent text-[15px] text-[--f-ink] outline-none placeholder:text-[--f-subtle]"
              />
              <button
                type="submit"
                className="shrink-0 text-[12px] font-medium uppercase tracking-[0.16em] text-[--f-ink] transition hover:opacity-60"
              >
                {config.buttonText ?? "Suscribirme"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
