"use client";

import type { FashionHeroConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Image from "next/image";
import { useEffect, useState } from "react";

const AUTOPLAY_MS = 5500;

/**
 * Hero del template Marca Deportiva — carrusel animado a todo el ancho.
 *
 * La imagen es full-bleed (100% del ancho) y cruza con fade entre slides. El
 * texto vive en un contenedor alineado al header (max-w-1600 + su padding), así
 * arranca a la altura del logo. Al cambiar de slide, el contenido (eyebrow,
 * título, subtítulo, CTA) entra escalonado — no todo junto con la imagen.
 */
export default function SportsHero({
  slides,
}: {
  slides?: FashionHeroConfig[];
}) {
  const valid = (slides ?? []).filter((s) => s?.title && s.image);
  const [index, setIndex] = useState(0);
  const count = valid.length;

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [count]);

  if (count === 0) return null;

  const active = valid[index];
  const align = active.align ?? "left";
  const vAlign = active.verticalAlign ?? "bottom";
  const alignItems =
    vAlign === "top"
      ? "items-start"
      : vAlign === "center"
        ? "items-center"
        : "items-end";
  const justify =
    align === "center"
      ? "justify-center"
      : align === "right"
        ? "justify-end"
        : "justify-start";
  const textAlign =
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left";

  return (
    <section className="sports-home relative">
      <div className="relative h-[78vh] min-h-[460px] w-full overflow-hidden sm:h-[88vh]">
        {/* Imágenes full-bleed con cross-fade */}
        {valid.map((hero, i) => (
          <div
            key={hero.title}
            aria-hidden={i !== index}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          >
            {hero.imageMobile ? (
              <>
                <Image
                  src={hero.imageMobile}
                  alt={hero.title ?? ""}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover sm:hidden"
                  unoptimized={/^https?:\/\//i.test(hero.imageMobile)}
                />
                <Image
                  src={hero.image!}
                  alt={hero.title ?? ""}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="hidden object-cover sm:block"
                  unoptimized={/^https?:\/\//i.test(hero.image!)}
                />
              </>
            ) : (
              <Image
                src={hero.image!}
                alt={hero.title ?? ""}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
                unoptimized={/^https?:\/\//i.test(hero.image!)}
              />
            )}
          </div>
        ))}

        {/* Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />

        {/* Texto: alineado al ancho del header. Se remonta por slide (key) para
            que la animación de entrada se reproduzca en cada cambio. */}
        <div className={`absolute inset-0 flex ${alignItems} ${justify}`}>
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-16 sm:px-6 sm:pb-20 lg:px-10">
            <div
              key={index}
              className={`sp-on-dark max-w-xl text-[--sp-on-dark] ${textAlign}`}
            >
              {active.eyebrow && (
                <p
                  className="sp-eyebrow mb-4 animate-fade-in-up"
                  style={{ animationDelay: "0ms" }}
                >
                  {active.eyebrow}
                </p>
              )}
              <h1
                className="sp-display animate-fade-in-up text-[clamp(3rem,2rem+7vw,7rem)]"
                style={{ animationDelay: "90ms" }}
              >
                {active.title}
              </h1>
              {active.subtitle && (
                <p
                  className="mt-4 max-w-md animate-fade-in-up text-base font-medium tracking-wide sm:text-lg"
                  style={{ animationDelay: "180ms" }}
                >
                  {active.subtitle}
                </p>
              )}
              {active.cta && (
                <div
                  className={`mt-8 flex animate-fade-in-up ${justify}`}
                  style={{ animationDelay: "270ms" }}
                >
                  <LocalizedClientLink
                    href={active.cta.href}
                    className="sp-btn-solid"
                  >
                    {active.cta.text}
                  </LocalizedClientLink>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dots */}
        {count > 1 && (
          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
            {valid.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`Ir al slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 transition-all ${
                  i === index ? "w-7 bg-white" : "w-3 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
