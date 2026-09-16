import type { CampaignHeroConfig } from "@lib/site-config/types";
import { resolveCampaignHeroImage } from "@lib/site-config/campaign";
import { pickContrastText } from "@lib/util/contrast";
import Image from "next/image";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import CampaignTrustBadges from "../campaign-trust-badges";

/**
 * Hero compacto de la landing institucional. En desktop muestra la imagen a la
 * izquierda y el contenido a la derecha; en mobile apila imagen + contenido.
 * Si la campaña no carga una imagen propia, usa la ilustración genérica.
 */
export default function CampaignHero({ hero }: { hero: CampaignHeroConfig }) {
  const bg = hero.backgroundColor?.trim() || "#ffffff";
  const fg = pickContrastText(bg) ?? "#0f1114";
  const isDarkText = fg !== "#ffffff";
  const imageSrc = resolveCampaignHeroImage(hero.image);
  const ctaBg = hero.ctaBackgroundColor?.trim() || undefined;
  const ctaFg = hero.ctaTextColor?.trim() || undefined;
  // CTA sin overrides: fondo primario, texto blanco. Se pasa por style para no
  // acoplar el default a `--campaign-bg` (que puede coincidir con el fondo del
  // hero en el diseño previo).
  const ctaStyle: React.CSSProperties = {
    backgroundColor: ctaBg ?? "var(--primary-color, #0f1114)",
    color: ctaFg ?? "#ffffff",
  };

  // Eyebrow: overrides opcionales via CSS custom props. Sin overrides el CSS
  // (`campaign-badge`) cae a `--secondary-color` bg + white text — defaults
  // seguros aunque el operador no toque nada. Los valores se aplican como
  // `--campaign-eyebrow-*` en el <span> para no persistir en el theme global.
  const eyebrowStyle: React.CSSProperties | undefined =
    hero.eyebrowBackgroundColor || hero.eyebrowTextColor
      ? ({
          ...(hero.eyebrowBackgroundColor && {
            "--campaign-eyebrow-bg": hero.eyebrowBackgroundColor,
          }),
          ...(hero.eyebrowTextColor && {
            "--campaign-eyebrow-fg": hero.eyebrowTextColor,
          }),
        } as React.CSSProperties)
      : undefined;

  return (
    <section id="inicio" style={{ backgroundColor: bg, color: fg }}>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-2 lg:items-center lg:gap-10">
        <div
          className={
            isDarkText
              ? "relative h-[220px] w-full overflow-hidden rounded-2xl bg-neutral-100 sm:h-[280px] lg:h-[300px]"
              : "relative h-[220px] w-full overflow-hidden rounded-2xl bg-white/5 sm:h-[280px] lg:h-[300px]"
          }
        >
          <Image
            src={imageSrc}
            alt={hero.imageAlt?.trim() || ""}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>

        <div className="flex flex-col gap-4">
          {hero.eyebrow ? (
            <span className="campaign-badge w-fit" style={eyebrowStyle}>
              {hero.eyebrow}
            </span>
          ) : null}
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {hero.title}
          </h1>
          {hero.subtitle ? (
            <p
              className={
                isDarkText
                  ? "max-w-xl text-base text-neutral-700 sm:text-lg"
                  : "max-w-xl text-base text-white/70 sm:text-lg"
              }
            >
              {hero.subtitle}
            </p>
          ) : null}
          {hero.primaryCta ? (
            <div>
              <LocalizedClientLink
                href={hero.primaryCta.href}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition hover:opacity-90"
                style={ctaStyle}
              >
                {hero.primaryCta.text}
              </LocalizedClientLink>
            </div>
          ) : null}
          {hero.trustBadges?.length ? (
            <div className="pt-1">
              <CampaignTrustBadges items={hero.trustBadges} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
