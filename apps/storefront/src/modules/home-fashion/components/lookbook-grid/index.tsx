import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { FashionLookbookConfig } from "@lib/site-config/types";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

/**
 * Lookbook — sección diferencial del template Moda.
 *
 * Grid de fotografías editoriales de distinto tamaño (`span`) que rompen la
 * grilla con ritmo. Cada foto enlaza a una colección / categoría / producto
 * (Zara / Nike). En mobile es un mosaico de dos columnas.
 */
export default function LookbookGrid({
  config,
}: {
  config?: FashionLookbookConfig;
}) {
  const items = config?.items ?? [];
  if (items.length === 0) return null;

  const spanClass = (span?: string) => {
    if (span === "wide") return "col-span-2 lg:col-span-2";
    if (span === "tall") return "row-span-2 lg:row-span-2";
    return "";
  };

  return (
    <section className="fashion-home bg-[--f-canvas] py-14 sm:py-20">
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

        <div className="grid auto-rows-[42vw] grid-cols-2 gap-3 sm:auto-rows-[26vw] sm:gap-4 lg:auto-rows-[22vw] lg:grid-cols-4">
          {items.map((item) => (
            <LocalizedClientLink
              key={item.id}
              href={item.href}
              className={`group relative overflow-hidden ${spanClass(item.span)}`}
            >
              <Image
                src={item.image}
                alt={item.label ?? "Lookbook"}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
                unoptimized={/^https?:\/\//i.test(item.image)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
              {item.label && (
                <div className="absolute bottom-0 left-0 z-10 flex items-center gap-1.5 p-4 text-[--f-on-dark] opacity-0 transition group-hover:opacity-100">
                  <span className="text-[12px] font-medium uppercase tracking-[0.16em]">
                    {item.label}
                  </span>
                  <ArrowUpRight className="size-4" strokeWidth={1.5} />
                </div>
              )}
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  );
}
