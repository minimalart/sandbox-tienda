import type { NavCategoryNode } from "@lib/data/nav-categories";
import type { HttpTypes } from "@medusajs/types";
import NavClient from "./nav-client";

type NavProps = {
  cart?: HttpTypes.StoreCart | null;
  /**
   * Árbol (2 niveles) para el menú "Categorías". Lo resuelve el layout con
   * `getNavCategories()`, en paralelo con el resto de los datos del chrome.
   */
  categories?: NavCategoryNode[];
  customer?: HttpTypes.StoreCustomer | null;
  hasPdfCatalog?: boolean;
  /** Tintometría habilitada: muestra el link "Buscá tu color". */
  hasTinting?: boolean;
  hasSpaceDesigner?: boolean;
};

const Nav = ({ cart, categories, customer, hasPdfCatalog, hasTinting, hasSpaceDesigner }: NavProps) => {
  const cartCount =
    cart?.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) ?? 0;

  return (
    <NavClient
      cartCount={cartCount}
      categories={categories ?? []}
      customer={customer ?? null}
      hasPdfCatalog={!!hasPdfCatalog}
      hasTinting={!!hasTinting}
      hasSpaceDesigner={!!hasSpaceDesigner}
    />
  );
};

export default Nav;
