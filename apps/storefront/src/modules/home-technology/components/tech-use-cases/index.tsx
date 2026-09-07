import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { TechUseCasesConfig } from "@lib/site-config/types";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

/**
 * Compra por necesidad — sección editorial/comercial.
 *
 * Bloques con imagen full-bleed y overlay (Home Office, Gaming, Estudiantes,
 * Smart Home, Entretenimiento, Cocina) que llevan a una colección/categoría.
 */
export default function TechUseCases({
  config,
}: {
  config?: TechUseCasesConfig;
}) {
  const items = config?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="tech-home bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="tech-section-title">
            {config?.title ?? "Comprá por necesidad"}
          </h2>
          {config?.subtitle && (
            <p className="tech-section-subtitle">{config.subtitle}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const isDark = item.theme !== "light";
            return (
              <LocalizedClientLink
                key={item.id}
                href={item.href}
                className="group relative flex aspect-[16/10] overflow-hidden rounded-3xl"
              >
                {item.image && (
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                    unoptimized={/^https?:\/\//i.test(item.image)}
                  />
                )}
                <div
                  className={`absolute inset-0 ${
                    isDark
                      ? "bg-gradient-to-t from-black/70 via-black/20 to-transparent"
                      : "bg-gradient-to-t from-white/85 via-white/30 to-transparent"
                  }`}
                />
                <div className="relative z-10 mt-auto flex w-full items-end justify-between gap-3 p-5">
                  <div className={isDark ? "text-white" : "text-[--tech-ink]"}>
                    <h3 className="text-[20px] font-semibold leading-tight tracking-tight">
                      {item.title}
                    </h3>
                    {item.subtitle && (
                      <p
                        className={`mt-0.5 text-[13px] ${
                          isDark ? "text-white/80" : "text-[--tech-muted]"
                        }`}
                      >
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full transition group-hover:bg-[--tech-blue] group-hover:text-white ${
                      isDark
                        ? "bg-white/90 text-[--tech-ink]"
                        : "bg-white text-[--tech-ink] shadow-sm"
                    }`}
                  >
                    <ArrowRight className="size-4" />
                  </span>
                </div>
              </LocalizedClientLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
