"use client";

import { getBannersForPlacement } from "@lib/banners";
import { useBannersByPlacement } from "@lib/context/banners-context";
import { useDemoSlug, useTenantBrand } from "@lib/site-config/context";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Reveal from "@modules/common/components/reveal";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import type { Swiper as SwiperClass } from "swiper";
import "swiper/css";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

type Banner = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  cardColor?: string;
  /**
   * Color del texto del banner: título + subtítulo (van sobre la imagen).
   * Ausente = default previo (blanco). Se setea desde el form del plugin
   * banners (metadata.color_font).
   */
  textColor?: string;
  /**
   * Color del texto DEL BOTÓN CTA, separado del `textColor` general porque
   * el CTA va sobre `cardColor` (posiblemente claro) mientras el título va
   * sobre la imagen (fondo oscuro/reservado). Un único color acoplaba los
   * dos y dejaba a uno invisible cuando los fondos difieren.
   */
  ctaTextColor?: string;
  cta: {
    text: string;
    href: string;
  };
};

const banners: Banner[] = [
  {
    id: "default-1",
    title: "Nuestras verduras",
    subtitle: "Descubrí lo nuevo",
    image:
      "https://mercatto.nyc3.digitaloceanspaces.com/new_banner2-01KV644F10E5545WDD535ST6SE.webp",
    cta: { text: "Ver colección", href: "/store" },
  },
  {
    id: "default-2",
    title: "Promo TV",
    subtitle: "Viví el mundial en HD",
    image:
      "https://mercatto.nyc3.digitaloceanspaces.com/new_banner4-01KV644YRS1D8Y9VXXVJE2MQX9.webp",
    cta: { text: "Lo quiero!", href: "/store?q=tv" },
  },
];

const isRenderableHeroBanner = (banner: {
  image?: string;
  title?: string;
  cta?: { href?: string; text?: string };
}) =>
  Boolean(banner.image && banner.title && banner.cta?.href && banner.cta?.text);

// Alturas responsivas del hero — replican el comportamiento de aec-chile-frontend.
const HERO_BREAKPOINT_HEIGHTS = {
  base: "h-[250px]",
  sm: "sm:h-[500px]",
  md: "md:h-[600px]",
  lg: "lg:min-h-[350px] lg:h-[350px]",
  xl: "xl:min-h-[420px] xl:h-[420px]",
  "2xl": "2xl:min-h-[450px] 2xl:h-[450px]",
} as const;

const heroHeightClasses = Object.values(HERO_BREAKPOINT_HEIGHTS).join(" ");

const slideStyle = `
  .hero-api-slide .hero-fade-item {
    transform: translateY(100px);
    opacity: 0;
    visibility: hidden;
    transition: transform 0.4s ease, opacity 0.4s ease, visibility 0.4s ease;
  }
  .hero-api-slide .hero-fade-item-1 { transition-delay: 0.5s; }
  .hero-api-slide .hero-fade-item-2 { transition-delay: 0.6s; }
  .hero-api-slide .hero-fade-item-3 { transition-delay: 0.7s; }
  .hero-api-slide.swiper-slide-active .hero-fade-item {
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
  }
  .shpd1-api { display: flex; gap: 8px; justify-content: flex-start; }
  .shpd1-api .swiper-pagination-bullet {
    width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center;
    background-color: transparent; opacity: 1;
    border: 2px solid transparent; cursor: pointer;
    transition: all 0.3s ease;
  }
  .shpd1-api .swiper-pagination-bullet::before {
    content: ""; display: inline-block;
    width: 6px; height: 6px;
    border-radius: 999px; background-color: #022150;
    transition: 0.3s;
  }
  .shpd1-api .swiper-pagination-bullet-active {
    border-color: #022150 !important;
    border-radius: 999px;
  }
  .shpd1-api .swiper-pagination-bullet-active::before { background-color: transparent; }
  .shpd1-api.white .swiper-pagination-bullet::before { background-color: white; }
  .shpd1-api.white .swiper-pagination-bullet-active { border-color: white !important; }
  .shpd1-api.white .swiper-pagination-bullet-active::before { background-color: white; }
`;

type HeroSlide = Banner & {
  isExternal: boolean;
  titleColor: string;
  textColor: string;
  ctaTextColor: string;
  dotColor: "dark" | "white";
};

const toHeroSlide = (banner: Banner): HeroSlide => {
  const href = banner.cta.href;
  // Título / subtítulo van sobre la imagen (fondo oscuro/reservado). Default
  // blanco preserva el treatment histórico. El operador puede pisarlo con
  // `metadata.color_font` del plugin banners.
  const textColor = banner.textColor?.trim() || "#FFFFFF";
  // CTA va sobre `cardColor` (el fondo del botón, ver style en el JSX). Si
  // el operador seteó `cta_color_font` gana; sino cae al `textColor` general
  // (cuando ambos son el mismo la UX previa no cambia). Antes usaba
  // `textColor` directo y quedaba acoplado al color del título.
  const ctaTextColor =
    banner.ctaTextColor?.trim() || banner.textColor?.trim() || "#FFFFFF";
  return {
    ...banner,
    isExternal: href.startsWith("http://") || href.startsWith("https://"),
    titleColor: textColor,
    textColor,
    ctaTextColor,
    // Dots del carrusel: cuando el texto del hero es oscuro (bg claro), los
    // dots blancos desaparecen; usamos dark en ese caso.
    dotColor: textColor.toLowerCase() === "#ffffff" ? "white" : "dark",
  };
};

const HeroCarousel = () => {
  const { heroBanners } = useTenantBrand();
  const demoSlug = useDemoSlug();
  const { banners: apiBanners, isLoading } = useBannersByPlacement("banner_1");

  const availableBanners = useMemo<Banner[]>(() => {
    if (!isLoading && apiBanners.length > 0) {
      const mapped = getBannersForPlacement(apiBanners, "banner_1")
        .filter((b) => !!b.image)
        .map((b) => ({
          id: b.id,
          title: b.title ?? "",
          subtitle: b.subtitle ?? "",
          image: b.image as string,
          cardColor: b.card_color,
          textColor: b.color_font,
          ctaTextColor: b.cta_color_font,
          cta: { text: b.cta_text ?? "", href: b.cta_href ?? "" },
        }));
      const validMapped = mapped.filter(isRenderableHeroBanner);

      if (validMapped.length > 0) return validMapped;
    }
    // En una demo, el hero muestra SOLO los banners del canal de la demo (por
    // API). Sin banners propios no caemos a los fallbacks hardcodeados: la
    // sección se oculta (slides vacíos → null). Fuera de demo, sin cambios.
    if (demoSlug) return [];
    if (heroBanners?.carousel && heroBanners.carousel.length > 0) {
      return heroBanners.carousel;
    }
    return banners;
  }, [apiBanners, isLoading, heroBanners, demoSlug]);

  const slides = useMemo(
    () => availableBanners.map(toHeroSlide),
    [availableBanners],
  );

  const [dotColor, setDotColor] = useState<"dark" | "white">(
    slides[0]?.dotColor ?? "white",
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const swiperRef = useRef<SwiperClass | null>(null);
  // El anillo de progreso se actualiza por una CSS var vía ref (no estado) para
  // no re-renderizar el carrusel en cada frame del autoplay.
  const dotsRef = useRef<HTMLDivElement | null>(null);

  if (!slides.length) return null;

  const handleSlideChange = (swiper: { realIndex: number }) => {
    setActiveIndex(swiper.realIndex);
    setDotColor(slides[swiper.realIndex]?.dotColor ?? "white");
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gray-100">
      <style>{slideStyle}</style>
      <Swiper
        autoplay={{
          delay: 6000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        className="h-full w-full"
        dir="ltr"
        loop={slides.length > 1}
        modules={[Autoplay]}
        onSwiper={(s) => {
          swiperRef.current = s;
        }}
        onSlideChange={handleSlideChange}
        onAutoplayTimeLeft={(_s, _time, p) => {
          dotsRef.current?.style.setProperty(
            "--ring-offset",
            (62.83 * p).toFixed(2),
          );
        }}
        slidesPerView={1}
        spaceBetween={0}
        speed={500}
      >
        {slides.map((slide, index) => {
          const slideClass = "block h-full w-full";
          const slideStyleProp = slide.cardColor
            ? { background: slide.cardColor }
            : undefined;

          const content = (
            <div className="relative h-full w-full">
              <Image
                alt={slide.title}
                className="h-full w-full object-cover"
                fill
                loading={index === 0 ? "eager" : "lazy"}
                priority={index === 0}
                sizes="(max-width: 1023px) 100vw, (max-width: 1280px) 66vw, 800px"
                src={slide.image}
                // El banner desde el backoffice acepta cualquier URL externa
                // pegada a mano. `next/image` exige que el host esté en
                // `remotePatterns` o devuelve 400 (imagen rota). Para URLs
                // remotas saltamos el optimizador (`unoptimized`) y servimos el
                // asset directo, así "pegar una URL" siempre funciona sin tener
                // que whitelistear el dominio. Los assets locales (/hero/*)
                // siguen optimizados.
                unoptimized={/^https?:\/\//i.test(slide.image)}
              />

              {/* Overlay oscuro (siempre): asegura contraste del texto —alineado
                  a la izquierda— sobre cualquier imagen, más fuerte a la izquierda
                  y transparente a la derecha (donde va el producto). */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />

              <div className="absolute inset-0 flex items-center pr-[15px] pl-[50px] max-[768px]:pl-[15px] lg:pr-0">
                <div className="flex w-1/2 flex-col gap-[18px] overflow-hidden lg:w-1/2 lg:gap-[8px]">
                  <h2
                    className="hero-fade-item hero-fade-item-2 m-0 hidden whitespace-pre-line font-extrabold text-[68px] leading-[81.6px] lg:block"
                    style={{ color: slide.titleColor }}
                  >
                    {slide.title}
                  </h2>
                  <h2
                    className="hero-fade-item hero-fade-item-2 m-0 block whitespace-pre-line break-words font-extrabold text-[30px] leading-[32.4px] lg:hidden"
                    style={{ color: slide.titleColor }}
                  >
                    {slide.title}
                  </h2>
                  {slide.subtitle && (
                    <>
                      <p
                        className="hero-fade-item hero-fade-item-1 m-0 hidden max-w-[593px] whitespace-pre-line text-balance font-semibold text-[20px] leading-[24px] lg:block"
                        style={{ color: slide.textColor }}
                      >
                        {slide.subtitle}
                      </p>
                      <p
                        className="hero-fade-item hero-fade-item-1 m-0 block whitespace-pre-line break-words text-balance font-semibold text-[12px] leading-[14px] lg:hidden"
                        style={{ color: slide.textColor }}
                      >
                        {slide.subtitle}
                      </p>
                    </>
                  )}
                  {slide.cta.text && (
                    <div className="hero-fade-item hero-fade-item-3 mt-[16px] hidden lg:block">
                      <Button
                        asChild
                        className="cursor-pointer overflow-hidden border-0 px-[14px] py-[12px] text-base leading-none no-underline"
                        size="storefront"
                        variant="storefront"
                        style={{
                          ...(slide.cardColor
                            ? { backgroundColor: slide.cardColor }
                            : {}),
                          // El variant 'storefront' del Button viene con
                          // `text-white` hardcoded; si el operador puso un
                          // cardColor claro, el CTA quedaba blanco sobre
                          // blanco. Usa `ctaTextColor` (dedicado al CTA) y
                          // no `textColor` (que gobierna título/subtítulo)
                          // para poder ajustar cada uno independiente.
                          color: slide.ctaTextColor,
                        }}
                      >
                        <span>{slide.cta.text}</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );

          return (
            <SwiperSlide className="hero-api-slide" key={`${index}-${slide.id}`}>
              {slide.isExternal ? (
                <a
                  aria-label={slide.title}
                  className={slideClass}
                  href={slide.cta.href}
                  rel="noopener noreferrer"
                  style={slideStyleProp}
                  target="_blank"
                >
                  {content}
                </a>
              ) : (
                <LocalizedClientLink
                  aria-label={slide.title}
                  className={slideClass}
                  href={slide.cta.href}
                  style={slideStyleProp}
                >
                  {content}
                </LocalizedClientLink>
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>

      {/* Indicadores: un anillo por banner; el del banner activo se va llenando
          mostrando cuánto le queda. Click salta a ese banner. */}
      <div
        className="pointer-events-none absolute right-0 bottom-5 left-0 z-10 flex justify-start gap-2 pl-[50px] max-[768px]:bottom-2 max-[768px]:justify-center max-[768px]:pl-0"
        ref={dotsRef}
        style={{ "--ring-offset": "62.83" } as React.CSSProperties}
      >
        {slides.map((slide, i) => {
          const isActive = i === activeIndex;
          const color = dotColor === "white" ? "#FFFFFF" : "#022150";
          return (
            <button
              aria-label={`Ir al banner ${i + 1}`}
              className="pointer-events-auto relative flex h-[22px] w-[22px] items-center justify-center"
              key={`dot-${i}-${slide.id}`}
              onClick={() => swiperRef.current?.slideToLoop(i)}
              type="button"
            >
              {isActive && (
                <svg
                  aria-hidden="true"
                  className="-rotate-90 absolute inset-0 h-full w-full"
                  viewBox="0 0 24 24"
                >
                  <circle
                    cx="12"
                    cy="12"
                    fill="none"
                    r="10"
                    stroke={color}
                    strokeDasharray="62.83"
                    strokeWidth="2"
                    style={{
                      strokeDashoffset: "var(--ring-offset, 62.83)",
                      transition: "stroke-dashoffset 0.12s linear",
                    }}
                  />
                </svg>
              )}
              <span
                className="block h-[6px] w-[6px] rounded-full"
                style={{ backgroundColor: color, opacity: isActive ? 1 : 0.5 }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

const HeroBanners = () => {
  return (
    <Reveal
      as="section"
      className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8"
    >
      <div className={heroHeightClasses}>
        <HeroCarousel />
      </div>
    </Reveal>
  );
};

export default HeroBanners;
