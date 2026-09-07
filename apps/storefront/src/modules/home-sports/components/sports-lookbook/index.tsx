import type { FashionLookbookConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

/**
 * Lookbook deportivo (SportsLookbook) — más orientado a actividad que a moda.
 *
 * Mosaico de fotografías en acción de distinto tamaño (`span`) que rompen la
 * grilla con ritmo. Cada foto enlaza a una colección / categoría.
 */
type LookbookCta = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
};

export default function SportsLookbook({
  config,
  cta,
}: {
  config?: FashionLookbookConfig;
  /** Bloque de texto que rellena el hueco libre del mosaico (en vez de quedar
   *  como sección aparte, centrada y debajo). */
  cta?: LookbookCta;
}) {
  const items = config?.items ?? [];
  if (items.length === 0) return null;

  const spanClass = (span?: string) => {
    if (span === "wide") return "col-span-2 lg:col-span-2";
    if (span === "tall") return "row-span-2 lg:row-span-2";
    return "";
  };

  return (
    <section className="sports-home bg-[--sp-paper] py-12 sm:py-16">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
        {(config?.title || config?.subtitle) && (
          <div className="mb-7">
            {config?.title && (
              <h2 className="sp-section-title">{config.title}</h2>
            )}
            {config?.subtitle && (
              <p className="sp-section-subtitle">{config.subtitle}</p>
            )}
          </div>
        )}

        <div className="grid grid-flow-dense auto-rows-[42vw] grid-cols-2 gap-3 sm:auto-rows-[26vw] sm:gap-4 lg:auto-rows-[22vw] lg:grid-cols-4">
          {items.map((item) => (
            <LocalizedClientLink
              key={item.id}
              href={item.href}
              className={`sp-on-dark group relative overflow-hidden ${spanClass(item.span)}`}
            >
              <Image
                src={item.image}
                alt={item.label ?? "Lookbook"}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition duration-700 ease-out group-hover:scale-[1.05]"
                unoptimized={/^https?:\/\//i.test(item.image)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              {item.label && (
                <div className="absolute bottom-0 left-0 z-10 flex items-center gap-1.5 p-4 text-[--sp-on-dark] opacity-0 transition group-hover:opacity-100">
                  <span className="text-[12px] font-bold uppercase tracking-[0.12em]">
                    {item.label}
                  </span>
                  <ArrowUpRight className="size-4" strokeWidth={2} />
                </div>
              )}
            </LocalizedClientLink>
          ))}

          {/* Bloque de texto que ocupa el hueco libre del mosaico (col-span-2).
              grid-flow-dense lo acomoda en el espacio vacío. Alineado a la
              izquierda, sobre el fondo claro del lookbook. */}
          {cta && (
            <div className="col-span-2 row-span-2 flex flex-col justify-center py-4 pr-2 sm:pr-6 lg:row-span-1 lg:pl-2">
              {cta.eyebrow && <p className="sp-eyebrow mb-2">{cta.eyebrow}</p>}
              <h2 className="sp-display text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] text-[--sp-ink]">
                {cta.title}
              </h2>
              {cta.subtitle && (
                <p className="mt-3 max-w-md text-sm leading-relaxed text-[--sp-muted]">
                  {cta.subtitle}
                </p>
              )}
              {cta.ctaText && (
                <div className="mt-5">
                  <LocalizedClientLink
                    href={cta.ctaHref ?? "/store"}
                    className="sp-btn-solid"
                  >
                    {cta.ctaText}
                  </LocalizedClientLink>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
