import {
  getActiveShopByLooks,
  type ShopByLookPlacement,
} from "@lib/data/shop-by-look";
import ShopByLookCard from "./shop-by-look-card";

/**
 * Renderiza los looks activos cuyo `placement` coincide con el slot pedido.
 * Devuelve null si no hay looks aplicables (el home sigue funcionando).
 */
export default async function ShopByLookSlot({
  slot,
  countryCode,
  titleClassName,
  sectionTitle,
  sectionSubtitle,
}: {
  slot: ShopByLookPlacement;
  countryCode: string;
  /** Clase del título del look, para matchear el heading de cada template. */
  titleClassName?: string;
  /**
   * Encabezado opcional de la sección (viene del bloque del editor de home).
   * Vacío = no se renderiza; cada look ya trae su propio título.
   */
  sectionTitle?: string;
  sectionSubtitle?: string;
}) {
  const looks = await getActiveShopByLooks(countryCode);
  const forSlot = looks.filter((look) => look.placement === slot);

  if (forSlot.length === 0) {
    return null;
  }

  return (
    <section className="content-container flex flex-col gap-y-12 py-12">
      {sectionTitle || sectionSubtitle ? (
        <div className="text-center">
          {sectionTitle ? (
            <p className="home-section-heading">{sectionTitle}</p>
          ) : null}
          {sectionSubtitle ? (
            <p className="mt-1 text-sm font-normal text-gray-500 sm:text-base">
              {sectionSubtitle}
            </p>
          ) : null}
        </div>
      ) : null}
      {forSlot.map((look) => (
        <ShopByLookCard
          key={look.id}
          look={look}
          countryCode={countryCode}
          titleClassName={titleClassName}
        />
      ))}
    </section>
  );
}
