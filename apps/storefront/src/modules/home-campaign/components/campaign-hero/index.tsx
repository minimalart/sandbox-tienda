import type { CampaignHeroConfig } from "@lib/site-config/types";
import Image from "next/image";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import CampaignTrustBadges from "../campaign-trust-badges";

/**
 * Hero de la landing institucional. Layout dos columnas: copy a la izquierda,
 * imagen protagonista a la derecha (colapsa en mobile).
 */
export default function CampaignHero({ hero }: { hero: CampaignHeroConfig }) {
  return (
    <section id="inicio" className="bg-[color:var(--campaign-bg,#0f1114)] text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="flex flex-col gap-6">
          {hero.eyebrow ? (
            <span className="campaign-badge w-fit">{hero.eyebrow}</span>
          ) : null}
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            {hero.title}
          </h1>
          {hero.subtitle ? (
            <p className="max-w-xl text-base text-white/70 sm:text-lg">
              {hero.subtitle}
            </p>
          ) : null}
          {hero.primaryCta ? (
            <div>
              <LocalizedClientLink
                href={hero.primaryCta.href}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[color:var(--campaign-bg,#0f1114)] transition hover:bg-white/90"
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
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white/5">
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
