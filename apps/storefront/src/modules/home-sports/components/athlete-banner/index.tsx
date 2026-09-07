import type { SportsAthletesConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

/**
 * Atletas / embajadores (AthleteBanner) — bloque opcional.
 *
 * Retratos editoriales de atletas con su nombre, deporte y una cita. Construye
 * marca y aspiración (Adidas / Nike). En mobile se apila; en desktop, columnas.
 */
export default function AthleteBanner({
  config,
}: {
  config?: SportsAthletesConfig;
}) {
  const athletes = config?.athletes ?? [];
  if (athletes.length === 0) return null;

  return (
    <section className="sports-home bg-[--sp-ink] py-12 text-[--sp-on-dark] sm:py-16">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
        <div className="mb-7">
          <h2 className="sp-section-title text-[--sp-on-dark]">
            {config?.title ?? "Atletas"}
          </h2>
          {config?.subtitle && (
            <p className="mt-2 text-[0.95rem] text-white/70">{config.subtitle}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {athletes.map((athlete) => (
            <LocalizedClientLink
              key={athlete.id}
              href={athlete.href}
              className="group relative flex aspect-[16/10] overflow-hidden sm:aspect-[16/9]"
            >
              <Image
                src={athlete.image}
                alt={athlete.name}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition duration-700 ease-out group-hover:scale-[1.05]"
                unoptimized={/^https?:\/\//i.test(athlete.image)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="relative z-10 mt-auto w-full p-6">
                {athlete.sport && (
                  <p className="sp-eyebrow mb-1 text-white/80">{athlete.sport}</p>
                )}
                <h3 className="sp-display text-2xl sm:text-3xl">{athlete.name}</h3>
                {athlete.quote && (
                  <p className="mt-2 max-w-md text-[14px] font-medium italic text-white/85">
                    “{athlete.quote}”
                  </p>
                )}
                <span className="sp-cta mt-4 inline-flex text-[--sp-on-dark]">
                  Ver más <ArrowRight className="size-4" strokeWidth={2} />
                </span>
              </div>
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  );
}
