import type { CampaignHeroConfig } from "@lib/site-config/types";
import { pickContrastText } from "@lib/util/contrast";
import Image from "next/image";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import CampaignTrustBadges from "../campaign-trust-badges";

/**
 * Hero de la landing institucional. Layout dos columnas: copy a la izquierda,
 * imagen protagonista a la derecha (colapsa en mobile).
 *
 * `hero.backgroundColor` (opcional) pisa el fondo; `hero.ctaBackgroundColor` /
 * `ctaTextColor` pisan el CTA. Todos son escapes para instituciones que
 * necesitan otro tratamiento sin cambiar el primario global; sin config el
 * template usa blanco (preset) + primario del tenant para el CTA.
 */
export default function CampaignHero({ hero }: { hero: CampaignHeroConfig }) {
  const bg = hero.backgroundColor?.trim() || undefined;
  // Texto del hero: si hay bg custom (y es claro), texto oscuro; caso contrario
  // preserva el treatment blanco previo. Sin bg custom cae al CSS var y NO
  // conocemos su claridad → mantenemos white como default seguro.
  const fg = bg ? (pickContrastText(bg) ?? "#0f1114") : "#ffffff";
  const isDarkText = fg !== "#ffffff";
  const heroStyle: React.CSSProperties = bg
    ? { backgroundColor: bg, color: fg }
    : {};

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
    <section
      id="inicio"
      className={
        bg
          ? "text-current"
          : "bg-[color:var(--campaign-bg,#0f1114)] text-white"
      }
      style={heroStyle}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="flex flex-col gap-6">
          {hero.eyebrow ? (
            <span className="campaign-badge w-fit" style={eyebrowStyle}>
              {hero.eyebrow}
            </span>
          ) : null}
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
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
          <div className="pt-2">
            <CampaignTrustBadges items={hero.trustBadges} />
          </div>
        </div>
        {hero.image ? (
          <div
            className={
              isDarkText
                ? "relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-neutral-100"
                : "relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white/5"
            }
          >
            <Image
              src={hero.image}
              alt={hero.imageAlt ?? ""}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
