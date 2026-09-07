import { getActiveTenant } from "@lib/site-config/active-tenant";
import type { PromoBannerConfig } from "@lib/site-config/types";
import { Button } from "@/components/ui/button";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Reveal from "@modules/common/components/reveal";
import Image from "next/image";

/**
 * Banner promocional del home: tarjeta con fondo de color, textos + botón a un
 * lado e imagen al otro (en mobile los textos arriba y la imagen abajo).
 *
 * Contenido por tenant (`assets.promoBanner`) o inyectado por el editor del home
 * (bloque "Banner con imagen"), igual que el resto de las secciones
 * config-driven. Sin título no se renderiza nada, así el home sigue funcionando
 * en los tenants que no lo configuran.
 */

const DEFAULT_BACKGROUND = "#EAF0E8";

export default async function PromoBanner({
  config,
}: {
  config?: PromoBannerConfig;
}) {
  const tenant = await getActiveTenant();
  const banner = config ?? tenant.assets.promoBanner;

  if (!banner?.title) {
    return null;
  }

  const imageFirst = banner.imagePosition === "left";
  const textStyle = banner.textColor ? { color: banner.textColor } : undefined;

  return (
    <Reveal as="section" className="bg-white py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="grid overflow-hidden rounded-3xl md:grid-cols-2"
          style={{ backgroundColor: banner.backgroundColor || DEFAULT_BACKGROUND }}
        >
          <div
            className={`flex flex-col justify-center gap-3 px-6 py-8 sm:px-10 sm:py-12 ${
              imageFirst ? "md:order-2" : ""
            }`}
          >
            <h2
              className="font-bold text-2xl text-gray-900 sm:text-3xl"
              style={textStyle}
            >
              {banner.title}
            </h2>
            {banner.subtitle && (
              <p className="max-w-md text-gray-600 text-sm sm:text-base" style={textStyle}>
                {banner.subtitle}
              </p>
            )}
            {banner.cta?.text && banner.cta.href && (
              <div className="mt-2">
                <Button asChild size="storefront" variant="storefront">
                  <LocalizedClientLink
                    href={banner.cta.href}
                    style={
                      banner.accentColor
                        ? { backgroundColor: banner.accentColor }
                        : undefined
                    }
                  >
                    {banner.cta.text}
                  </LocalizedClientLink>
                </Button>
              </div>
            )}
          </div>

          {banner.image && (
            <div
              className={`relative min-h-52 sm:min-h-64 ${imageFirst ? "md:order-1" : ""}`}
            >
              <Image
                alt={banner.title}
                className="object-cover"
                fill
                sizes="(max-width: 768px) 100vw, 640px"
                src={banner.image}
                unoptimized={/^https?:\/\//i.test(banner.image)}
              />
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}
