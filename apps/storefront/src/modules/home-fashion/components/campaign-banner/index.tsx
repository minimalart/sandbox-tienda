import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { FashionCampaignConfig } from "@lib/site-config/types";
import Image from "next/image";

/**
 * Campaña editorial — bloque de storytelling (COS / Aime Leon Dore).
 *
 * Fotografía a un lado, texto sobrio al otro. Sin precios ni descuentos: una
 * frase de campaña ("Designed for everyday movement.") y un CTA discreto.
 */
export default function CampaignBanner({
  config,
}: {
  config?: FashionCampaignConfig;
}) {
  if (!config?.title || !config.image) return null;

  const imageRight = config.imageSide === "right";

  return (
    <section className="fashion-home bg-[--f-paper] py-0">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Imagen */}
        <div
          className={`relative aspect-[4/5] w-full sm:aspect-[16/10] lg:aspect-auto lg:min-h-[640px] ${imageRight ? "lg:order-2" : "lg:order-1"}`}
        >
          <Image
            src={config.image}
            alt={config.title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            unoptimized={/^https?:\/\//i.test(config.image)}
          />
        </div>

        {/* Texto */}
        <div
          className={`flex items-center justify-center bg-[--f-canvas] px-6 py-14 sm:px-12 lg:px-20 ${imageRight ? "lg:order-1" : "lg:order-2"}`}
        >
          <div className="max-w-md">
            {config.eyebrow && (
              <p className="f-eyebrow mb-5">{config.eyebrow}</p>
            )}
            <h2 className="f-display text-[clamp(2rem,1.4rem+2.6vw,3.25rem)]">
              {config.title}
            </h2>
            {config.body && (
              <p className="mt-6 text-base font-light leading-relaxed text-[--f-muted]">
                {config.body}
              </p>
            )}
            {config.cta && (
              <div className="mt-8">
                <LocalizedClientLink href={config.cta.href} className="f-cta">
                  {config.cta.text}
                </LocalizedClientLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
