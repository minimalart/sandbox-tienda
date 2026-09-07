import { getStoreBrands } from "@lib/data/brands";
import LocalizedClientLink from "@modules/common/components/localized-client-link";

/**
 * Tira de logos de marcas para la home deportiva.
 *
 * Fondo negro, baja (≤100px), carrusel que se desplaza solo (marquee CSS, sin
 * JS). Solo se muestran las marcas que tienen imagen adjunta — `getStoreBrands`
 * ya filtra las que no tienen logo. Los logos se renderizan en blanco para que
 * se vean sobre el fondo negro sin importar su color original.
 */
export default async function SportsBrandStrip() {
  const brands = await getStoreBrands();
  if (brands.length === 0) return null;

  // Dos grupos idénticos: la pista se traslada -50% (un grupo exacto) para que
  // el loop sea continuo, sin saltos.
  const Group = ({ hidden }: { hidden?: boolean }) => (
    <ul
      aria-hidden={hidden}
      className="flex shrink-0 items-center gap-12 px-6"
    >
      {brands.map((brand) => (
        <li key={brand.id} className="flex shrink-0 items-center">
          <LocalizedClientLink
            href={`/store?brand=${encodeURIComponent(brand.name)}`}
            aria-label={brand.name}
            className="flex items-center"
          >
            {/* Logos externos (S3/backend): <img> directo para no depender de
                remotePatterns de next/image. Filtro a blanco para que se vean
                sobre el fondo negro sin importar su color original. */}
            <img
              src={brand.image}
              alt={brand.name}
              className="h-8 w-auto max-w-[140px] object-contain opacity-70 transition hover:opacity-100 [filter:brightness(0)_invert(1)]"
              loading="lazy"
            />
          </LocalizedClientLink>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="sports-home bg-black">
      <div className="sp-marquee relative flex h-[88px] items-center overflow-hidden">
        <div className="sp-marquee-track flex w-max shrink-0 items-center">
          <Group />
          <Group hidden />
        </div>
      </div>
    </section>
  );
}
