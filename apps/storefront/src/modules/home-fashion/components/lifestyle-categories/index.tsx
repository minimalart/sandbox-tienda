import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { FashionLifestyleConfig } from "@lib/site-config/types";
import Image from "next/image";

/**
 * Categorías lifestyle — navegación inspiracional.
 *
 * Workwear, Casual, Outdoor, Running, Essentials. Rail horizontal de retratos
 * editoriales con el nombre debajo; la navegación se siente más como una
 * inspiración que como un menú técnico.
 */
export default function LifestyleCategories({
  config,
}: {
  config?: FashionLifestyleConfig;
}) {
  const items = config?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="fashion-home bg-[--f-paper] py-14 sm:py-20">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
        {(config?.title || config?.subtitle) && (
          <div className="mb-8 sm:mb-10">
            {config?.title && (
              <h2 className="f-section-title">{config.title}</h2>
            )}
            {config?.subtitle && (
              <p className="f-section-subtitle">{config.subtitle}</p>
            )}
          </div>
        )}

        <div className="f-no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-5">
          {items.map((item) => (
            <LocalizedClientLink
              key={item.id}
              href={item.href}
              className="group flex min-w-[44%] shrink-0 snap-start flex-col sm:min-w-0"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-[--f-divider]">
                {item.image && (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 44vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
                    unoptimized={/^https?:\/\//i.test(item.image)}
                  />
                )}
              </div>
              <p className="mt-3 text-center text-[12px] font-medium uppercase tracking-[0.18em] text-[--f-ink] transition group-hover:opacity-60">
                {item.name}
              </p>
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  );
}
