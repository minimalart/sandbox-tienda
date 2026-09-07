"use client";

import type { TrHeroConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

/**
 * Hero promocional del template Tecnología Retail.
 *
 * Carrusel de campañas (TVs, notebooks, gaming, A/C…) con auto-rotación,
 * controles y dots. Cada slide comunica una promo con foto, copy comercial,
 * cuotas destacadas y dos CTAs. Inspirado en Frávega / Best Buy.
 */
export default function TrHero({ config }: { config?: TrHeroConfig }) {
  const slides = config?.slides ?? [];
  const interval = config?.rotationInterval ?? 6000;
  const [index, setIndex] = useState(0);

  const count = slides.length;
  const go = useCallback(
    (next: number) => setIndex((prev) => (next + count) % count),
    [count],
  );

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => setIndex((p) => (p + 1) % count), interval);
    return () => clearInterval(id);
  }, [count, interval]);

  if (count === 0) return null;

  return (
    <section className="tech-retail-home bg-[--tr-surface]">
      <div className="relative mx-auto max-w-[1440px] px-0 sm:px-6 sm:py-6 lg:px-8">
        <div className="relative overflow-hidden sm:rounded-2xl">
          {slides.map((slide, i) => {
            const isDark = slide.theme !== "light";
            const active = i === index;
            return (
              <div
                key={slide.id}
                className={`${active ? "relative" : "pointer-events-none absolute inset-0"} transition-opacity duration-500 ${active ? "opacity-100" : "opacity-0"}`}
                aria-hidden={!active}
              >
                <div
                  className={`relative grid min-h-[360px] grid-cols-1 items-center gap-6 px-6 py-10 sm:min-h-[420px] md:grid-cols-2 md:px-12 ${isDark ? "text-white" : "text-[--tr-ink]"}`}
                  style={{
                    backgroundColor:
                      slide.backgroundColor ?? (isDark ? "var(--tr-dark)" : "#fff"),
                  }}
                >
                  {/* Copy */}
                  <div className="order-2 max-w-lg md:order-1">
                    {slide.eyebrow && (
                      <p className="mb-2 text-sm font-bold uppercase tracking-[0.12em] text-[--tr-red]">
                        {slide.eyebrow}
                      </p>
                    )}
                    <h2 className="text-[clamp(1.75rem,1.3rem+2.4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em]">
                      {slide.title}
                    </h2>
                    {slide.subtitle && (
                      <p
                        className={`mt-3 text-base ${isDark ? "text-white/80" : "text-[--tr-muted]"}`}
                      >
                        {slide.subtitle}
                      </p>
                    )}
                    {slide.highlight && (
                      <p className="mt-4 inline-flex items-center rounded-lg bg-[--tr-red] px-3 py-1.5 text-sm font-bold text-white">
                        {slide.highlight}
                      </p>
                    )}
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      {slide.primaryCta && (
                        <LocalizedClientLink
                          href={slide.primaryCta.href}
                          className="tr-btn-primary"
                        >
                          {slide.primaryCta.text}
                        </LocalizedClientLink>
                      )}
                      {slide.secondaryCta && (
                        <LocalizedClientLink
                          href={slide.secondaryCta.href}
                          className="tr-btn-ghost"
                        >
                          {slide.secondaryCta.text}
                        </LocalizedClientLink>
                      )}
                    </div>
                  </div>

                  {/* Imagen */}
                  <div className="order-1 md:order-2">
                    <div className="relative mx-auto aspect-[4/3] w-full max-w-md">
                      <Image
                        src={slide.image}
                        alt={slide.title}
                        fill
                        priority={i === 0}
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-contain drop-shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
                        unoptimized={/^https?:\/\//i.test(slide.image)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Controles */}
          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => go(index - 1)}
                className="absolute left-2 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[--tr-ink] shadow-md transition hover:bg-white sm:left-4"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => go(index + 1)}
                className="absolute right-2 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[--tr-ink] shadow-md transition hover:bg-white sm:right-4"
              >
                <ChevronRight className="size-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`Ir al slide ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-[--tr-red]" : "w-2 bg-black/25"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
