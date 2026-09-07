import type { FashionCampaignConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Image from "next/image";

/**
 * Campaña deportiva (CampaignBanner) — bloque muy visual.
 *
 * Fotografía protagonista a un lado, copy de campaña en mayúsculas al otro
 * (Adidas / Nike). Sobre fondo oscuro para máximo contraste y energía.
 */
export default function CampaignBanner({
  config,
}: {
  config?: FashionCampaignConfig;
}) {
  if (!config?.title || !config.image) return null;

  const imageRight = config.imageSide === "right";
  // El panel de texto va siempre en oscuro con tipografía blanca para garantizar
  // contraste (sobre fondo claro el título no se leía).

  return (
    <section className="sports-home sp-on-dark">
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
          className={`flex items-center justify-start bg-[--sp-ink] px-6 py-14 text-left text-[--sp-on-dark] sm:px-12 lg:px-20 ${imageRight ? "lg:order-1" : "lg:order-2"}`}
        >
          <div className="max-w-md">
            {config.eyebrow && <p className="sp-eyebrow mb-5">{config.eyebrow}</p>}
            <h2 className="sp-display text-[clamp(2.25rem,1.6rem+3vw,4rem)]">
              {config.title}
            </h2>
            {config.body && (
              <p className="mt-6 text-base font-medium leading-relaxed text-white/80">
                {config.body}
              </p>
            )}
            {config.cta && (
              <div className="mt-8">
                <LocalizedClientLink href={config.cta.href} className="sp-btn-solid">
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
