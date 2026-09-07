"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

type SportsFooterNewsletterProps = {
  title?: string;
  description?: string;
  placeholder?: string;
  buttonText?: string;
};

/**
 * Alta al newsletter dentro del footer deportivo (reemplaza la sección
 * "Sumate al equipo" de la home). Demo: valida y confirma en cliente.
 */
export default function SportsFooterNewsletter({
  title = "Sumate al equipo",
  description = "Recibí lanzamientos y novedades antes que nadie.",
  placeholder = "tucorreo@ejemplo.com",
  buttonText = "Suscribirme",
}: SportsFooterNewsletterProps) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setDone(true);
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="sp-eyebrow text-white/90">{title}</p>
        {description && (
          <p className="mt-1 max-w-md text-[13px] text-white/65">{description}</p>
        )}
      </div>

      {done ? (
        <p className="inline-flex items-center gap-2 text-[14px] font-bold uppercase tracking-wide text-white">
          <CheckCircle2 className="size-5" /> ¡Listo! Te suscribiste.
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex w-full flex-col gap-3 sm:max-w-md sm:flex-row"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            aria-label="Correo electrónico"
            className="h-16 w-full flex-1 border-2 border-white/25 bg-transparent px-4 text-[15px] text-white outline-none placeholder:text-white/50 focus:border-white sm:h-12"
          />
          <button
            type="submit"
            className="inline-flex h-16 shrink-0 items-center justify-center border-2 border-white bg-white px-6 text-[12px] font-bold uppercase tracking-[0.1em] text-[--sp-ink] transition hover:bg-transparent hover:text-white sm:h-12"
          >
            {buttonText}
          </button>
        </form>
      )}
    </div>
  );
}
