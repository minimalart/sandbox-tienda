"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Popover,
  PopoverButton,
  PopoverPanel,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from "@headlessui/react";
import {
  HeartIcon,
  TagIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { useAddToCartAnimation } from "@lib/context/add-to-cart-animation";
import { useHasActivePromotions } from "@lib/context/promotions-availability";
import { useWishlist } from "@lib/hooks/use-wishlist";
import { useCartStore, selectTotalItems } from "@lib/stores/cart.store";
import { useWishlistDrawerStore } from "@lib/stores/wishlist-drawer.store";
import { useDemoHref, useTenantBrand, useTenantSections, useTenantTheme } from "@lib/site-config/context";
import { getCustomerAvatar } from "@lib/util/customer-avatar";
import { pickContrastText } from "@lib/util/contrast";
import type { HttpTypes } from "@medusajs/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import UserAvatar from "@modules/common/components/user-avatar";
import CategoriesMenu from "@modules/layout/components/categories-menu";
import type { CategoriesMenuNode } from "@modules/layout/components/categories-menu";
import { BarcodeScannerButton } from "@modules/layout/components/barcode-scanner-button";
import HeaderSearchBar from "@modules/layout/components/header-search-bar";
import WishlistDrawer from "@modules/layout/components/wishlist-drawer";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";

type NavigationCategory = {
  id: string;
  name: string;
  featured: {
    name: string;
    href: string;
    imageSrc: string;
    imageAlt: string;
  }[];
  sections: {
    id: string;
    name: string;
    items: { name: string; href: string }[];
  }[][];
};

type Navigation = {
  categories: NavigationCategory[];
  pages: { name: string; href: string; target?: string }[];
};

const navigation: Navigation = {
  categories: [],
  pages: [
    { name: "Inicio", href: "/" },
    { name: "Tienda", href: "/store" },
    { name: "Recetas", href: "/blog" },
    { name: "Catálogo", href: "/catalogo" },
    { name: "Buscá tu color", href: "/colores" },
    { name: "Diseñá tu espacio", href: "/espacios" },
    { name: "Contacto", href: "/contact" },
  ],
};

const desktopNavigationPages: Navigation["pages"] = [
  { name: "Tienda", href: "/store" },
  { name: "Lista de compras", href: "/lista-de-compras" },
  { name: "Recetas", href: "/blog" },
  { name: "Catálogo", href: "/catalogo" },
  { name: "Buscá tu color", href: "/colores" },
  { name: "Diseñá tu espacio", href: "/espacios" },
  { name: "Sucursales", href: "/sucursales" },
  { name: "Contacto", href: "/contact" },
];

// Standalone promo entry — rendered apart from the main links (far right on
// desktop, as a pill with an icon). Lands on the PLP filtered to products with
// an active promotion (?promos=1 → Typesense has_promotion:=true).
const promotionsLink = { name: "Promociones", href: "/store?promos=1" };

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

// Componente para logo dinámico del tenant.
// Cuando el tenant configura `theme.header_background` oscuro (contraste WCAG
// blanco) y tiene cargado `logos.mainNegative`, usamos el negativo — el
// positivo suele venir en tinta oscura y se pierde contra el header custom.
function TenantLogo() {
  const { name, logos } = useTenantBrand();
  const { colors } = useTenantTheme();
  const headerFg = pickContrastText(colors?.headerBackground);
  const useNegative = headerFg === "#ffffff" && !!logos?.mainNegative;
  const src =
    (useNegative ? logos?.mainNegative : logos?.main) ||
    "/logos-mercatto/logocompleto-verde.svg";
  return (
    <>
      <span className="sr-only">{name}</span>
      <img alt={`${name} Logo`} className="h-8 w-auto" src={src} />
    </>
  );
}

type NavClientProps = {
  cartCount: number;
  /** Árbol (2 niveles) para el menú "Categorías". Se arma en el server (Nav). */
  categories?: CategoriesMenuNode[];
  customer: HttpTypes.StoreCustomer | null;
  hasPdfCatalog?: boolean;
  hasTinting?: boolean;
  hasSpaceDesigner?: boolean;
};

const NavClient = ({
  cartCount: initialCartCount,
  categories = [],
  customer,
  hasPdfCatalog = false,
  hasTinting = false,
  hasSpaceDesigner = false,
}: NavClientProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { countryCode } = useParams() as { countryCode: string };
  // Prefija los hrefs con /demo/{slug} dentro de una sesión demo (igual que
  // LocalizedClientLink), para poder comparar el link activo contra el path real.
  const demoHref = useDemoHref();
  const { avatarUrl, initials } = getCustomerAvatar(customer);
  const [open, setOpen] = useState(false);
  const { cartBounce, registerCartIcon, registerWishlistIcon, wishlistBounce } =
    useAddToCartAnimation();
  const [mounted, setMounted] = useState(false);
  const openWishlistDrawer = useWishlistDrawerStore((state) => state.open);
  const { items: wishlistItems } = useWishlist();

  // Section visibility + blog label come from the active tenant (per-demo
  // content config). Absent flags default to visible; only an explicit `false`
  // hides the link. The blog link is relabeled when the demo overrides its name.
  const {
    blogSectionName,
    categoriesMenuLayout,
    isBlogVisible,
    isCategoriesMenuVisible,
    isContactVisible,
    isShoppingListVisible,
    isSucursalesVisible,
    isTintingHidden,
  } = useTenantSections();
  // El menú "Categorías" se puede apagar por demo, y sin categorías no tendría
  // nada que abrir (tienda recién creada o fetch caído): en ese caso no se pinta.
  const showCategoriesMenu = isCategoriesMenuVisible && categories.length > 0;
  const isPageVisible = (href: string) => {
    if (href === "/blog") return isBlogVisible;
    if (href === "/contact") return isContactVisible;
    if (href === "/lista-de-compras") return isShoppingListVisible;
    if (href === "/sucursales") return isSucursalesVisible;
    // El link "Catálogo" sólo aparece si hay un catálogo PDF activo publicado
    // para el canal actual (si no, la página /catalogo no tendría contenido).
    if (href === "/catalogo") return hasPdfCatalog;
    // "Buscá tu color" es OPT-IN, al revés que el resto: sólo aparece donde el
    // tintométrico está prendido y con carta cargada (lo resuelve el layout). El
    // flag del demo sirve para esconderlo, no para prenderlo.
    if (href === "/colores") return hasTinting && !isTintingHidden;
    if (href === "/espacios") return hasSpaceDesigner;
    return true;
  };
  const pageLabel = (page: { name: string; href: string }) =>
    page.href === "/blog" && blogSectionName ? blogSectionName : page.name;
  const mobilePages = navigation.pages.filter((p) => isPageVisible(p.href));
  const desktopPages = desktopNavigationPages.filter((p) =>
    isPageVisible(p.href),
  );

  // "Promociones" es la PLP filtrada (/store?promos=1): comparte pathname con
  // "Tienda", así que el query decide cuál de los dos se marca activo.
  const isPromosView =
    (pathname || "/") === demoHref("/store") &&
    searchParams.get("promos") === "1";
  // Sin promociones activas en el canal, el acceso no se muestra: la PLP
  // filtrada (?promos=1) saldría vacía.
  const showPromotions = useHasActivePromotions();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Zustand cart store
  const cart = useCartStore((state) => state.cart);
  const openCart = useCartStore((state) => state.openCart);
  const liveCartCount = useCartStore(selectTotalItems);

  // Usar el valor inicial del servidor hasta que el cliente se monte
  // Esto evita el error de hidratación
  const cartCount = mounted ? liveCartCount : initialCartCount || 0;

  const hasCartItems = cartCount > 0;
  const hasWishlistItems = wishlistItems.length > 0;
  const cartCountLabel = cartCount > 9 ? "9+" : `${cartCount}`;

  const cartBadge = useMemo(() => {
    if (!hasCartItems) {
      return <span className="sr-only">productos en el carrito, ver bolsa</span>;
    }

    return (
      <span className="-top-1 -right-1 absolute inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[--primary-color] px-1 font-semibold text-[10px] text-white">
        {cartCountLabel}
      </span>
    );
  }, [cartCountLabel, hasCartItems]);

  return (
    <div className="bg-[color:var(--header-bg,#ffffff)]">
      <WishlistDrawer />
      <BarcodeScannerButton countryCode={countryCode} />

      <Dialog className="relative z-40 lg:hidden" onClose={setOpen} open={open}>
        <DialogBackdrop
          className="fixed inset-0 bg-black/25 transition-opacity duration-300 ease-linear data-closed:opacity-0"
          transition
        />
        <div className="fixed inset-0 z-40 flex">
          <DialogPanel
            className="data-closed:-translate-x-full relative flex w-full max-w-xs transform flex-col overflow-y-auto bg-white pb-12 shadow-xl transition duration-300 ease-in-out"
            transition
          >
            <div className="flex px-4 pt-5 pb-2">
              <button
                className="-m-2 relative inline-flex items-center justify-center rounded-md p-2 text-gray-400"
                onClick={() => setOpen(false)}
                type="button"
              >
                <span className="-inset-0.5 absolute" />
                <span className="sr-only">Cerrar menú</span>
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>
            </div>

            <TabGroup className="mt-2">
              <div className="border-gray-200 border-b">
                <TabList className="-mb-px flex space-x-8 px-4">
                  {navigation.categories.map((category) => (
                    <Tab
                      className="flex-1 whitespace-nowrap border-transparent border-b-2 px-1 py-4 font-medium text-base text-gray-900 data-selected:border-[--primary-color] data-selected:text-[--primary-color]"
                      key={category.name}
                    >
                      {category.name}
                    </Tab>
                  ))}
                </TabList>
              </div>
              <TabPanels as={Fragment}>
                {navigation.categories.map((category) => (
                  <TabPanel
                    className="space-y-10 px-4 pt-10 pb-8"
                    key={category.name}
                  >
                    <div className="space-y-4">
                      {category.featured.map((item, itemIdx) => (
                        <div
                          className="group relative overflow-hidden rounded-md bg-gray-100"
                          key={itemIdx}
                        >
                          <img
                            alt={item.imageAlt}
                            className="aspect-square w-full object-cover group-hover:opacity-75"
                            src={item.imageSrc}
                          />
                          <div className="absolute inset-0 flex flex-col justify-end">
                            <div className="bg-white/60 p-4 text-base sm:text-sm">
                              <Link
                                className="font-medium text-gray-900"
                                href={item.href}
                              >
                                <span
                                  aria-hidden="true"
                                  className="absolute inset-0"
                                />
                                {item.name}
                              </Link>
                              <p
                                aria-hidden="true"
                                className="mt-0.5 text-gray-700 sm:mt-1"
                              >
                                Comprá ahora
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {category.sections.map((column, columnIdx) => (
                      <div className="space-y-10" key={columnIdx}>
                        {column.map((section) => (
                          <div key={section.name}>
                            <p
                              className="font-medium text-gray-900"
                              id={`${category.id}-${section.id}-heading-mobile`}
                            >
                              {section.name}
                            </p>
                            <ul
                              aria-labelledby={`${category.id}-${section.id}-heading-mobile`}
                              className="mt-6 flex flex-col space-y-6"
                              role="list"
                            >
                              {section.items.map((item) => (
                                <li className="flow-root" key={item.name}>
                                  <Link
                                    className="-m-2 block p-2 text-gray-500"
                                    href={item.href}
                                  >
                                    {item.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ))}
                  </TabPanel>
                ))}
              </TabPanels>
            </TabGroup>

            <div className="space-y-6 border-gray-200 border-t px-4 py-6">
              {mobilePages.map((page) => (
                <div className="flow-root" key={page.name}>
                  <LocalizedClientLink
                    className="-m-2 block p-2 font-medium text-gray-900"
                    href={page.href}
                    target={page.target}
                  >
                    {pageLabel(page)}
                  </LocalizedClientLink>
                </div>
              ))}
              {showPromotions && (
                <div className="flow-root">
                  <LocalizedClientLink
                    className="-m-2 flex items-center gap-2 p-2 font-medium text-[var(--promo-button-bg,var(--primary-color))]"
                    href={promotionsLink.href}
                  >
                    <TagIcon className="h-5 w-5" />
                    {promotionsLink.name}
                  </LocalizedClientLink>
                </div>
              )}
            </div>

            <div className="border-gray-200 border-t px-4 py-6">
              <LocalizedClientLink
                className="-m-2 flex items-center p-2"
                href="/account"
              >
                {customer ? (
                  <UserAvatar
                    alt={`Foto de ${customer.first_name ?? "perfil"}`}
                    avatarUrl={avatarUrl}
                    className="text-[11px]"
                    initials={initials}
                    size={20}
                  />
                ) : (
                  <UserIcon className="size-5 text-gray-500" />
                )}
                <span className="ml-3 block font-medium text-base text-gray-900">
                  Mi cuenta
                </span>
              </LocalizedClientLink>
              <LocalizedClientLink
                className="-m-2 mt-4 flex items-center p-2"
                href="/cart"
              >
                <ShoppingCart className="size-5 text-gray-500" />
                <span className="ml-3 block font-medium text-base text-gray-900">
                  Carrito
                </span>
              </LocalizedClientLink>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Los tokens `--header-fg`/`--header-fg-muted`/`--header-border` solo se
          inyectan cuando el operador configuró `headerBackground` (ver
          `theme/inject-theme.ts`); sin config, los fallbacks preservan el look
          default (gray-400/gray-500/#374151/gray-100). */}
      <header className="hidden bg-[color:var(--header-bg,rgba(255,255,255,0.95))] backdrop-blur supports-[backdrop-filter]:bg-[color:var(--header-bg,rgba(255,255,255,0.8))] lg:block">
        {/* Row 1: Logo + Search + Icons */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 w-full items-center justify-between gap-6">
            {/* Logo */}
            <LocalizedClientLink className="flex-shrink-0" href="/">
              <TenantLogo />
            </LocalizedClientLink>

            {/* Search bar + quick suggestions */}
            {/* El árbol va al buscador para que un atajo "Explorar:" que nombra una
                categoría navegue al filtro y no a una búsqueda de texto
                (DESDEELSUR-61, BUG-11). */}
            <HeaderSearchBar categories={categories} />

            {/* Action icons */}
            <div className="flex flex-shrink-0 items-center gap-1">
              {/* Cart */}
              <button
                className="group relative flex items-center p-2 text-[color:var(--header-fg-muted,#9ca3af)] transition-colors duration-200 hover:text-[color:var(--header-fg,#4b5563)]"
                data-testid="nav-cart-link"
                onClick={openCart}
                ref={(el) => registerCartIcon(el)}
                type="button"
              >
                <ShoppingCart
                  aria-hidden="true"
                  className={`size-5 shrink-0 transition-transform group-hover:text-[color:var(--header-fg,#4b5563)] ${cartBounce ? "animate-bounce" : ""}`}
                  style={
                    cartBounce
                      ? { animation: "bounce 0.3s ease-in-out" }
                      : undefined
                  }
                />
                {cartBadge}
                <span className="sr-only">productos en el carrito, ver bolsa</span>
              </button>

              <button
                className="group relative flex items-center justify-center rounded-full p-2 text-[color:var(--header-fg-muted,#9ca3af)] transition-colors duration-200 hover:text-[--primary-color]"
                data-testid="nav-wishlist-link"
                onClick={openWishlistDrawer}
                ref={(el) => registerWishlistIcon(el)}
                type="button"
              >
                {hasWishlistItems ? (
                  <HeartIconSolid
                    aria-hidden="true"
                    className={`size-5 text-rose-500 transition-transform duration-200 ${
                      wishlistBounce ? "animate-bounce" : ""
                    }`}
                  />
                ) : (
                  <HeartIcon
                    aria-hidden="true"
                    className={`size-5 transition-colors duration-200 group-hover:text-[--primary-color] ${
                      wishlistBounce ? "animate-bounce text-rose-500" : ""
                    }`}
                  />
                )}
                <span className="sr-only">Favoritos</span>
              </button>

              {/* Account */}
              <LocalizedClientLink
                className="group flex items-center gap-1.5 rounded-full py-1 pl-2 pr-3 text-[color:var(--header-fg-muted,#6b7280)] transition-colors duration-200 hover:text-[--accent-color]"
                href="/account"
              >
                {customer ? (
                  <UserAvatar
                    alt={`Foto de ${customer.first_name ?? "perfil"}`}
                    avatarUrl={avatarUrl}
                    className="text-[11px]"
                    initials={initials}
                    size={20}
                  />
                ) : (
                  <UserIcon
                    aria-hidden="true"
                    className="size-5 text-[color:var(--header-fg-muted,#9ca3af)] transition-colors duration-200 group-hover:text-[--primary-color]"
                  />
                )}
                <span
                  className="whitespace-nowrap text-[13px] font-normal text-[color:var(--header-fg,#374151)] transition-colors duration-200 group-hover:text-[--accent-color] antialiased"
                  data-testid="account-link-label"
                  style={{ fontFamily: "var(--font-roboto), Roboto, sans-serif" }}
                >
                  {customer
                    ? (customer.first_name ?? customer.email ?? "Mi cuenta")
                    : "Ingresar"}
                </span>
              </LocalizedClientLink>
            </div>
          </div>
        </div>

        {/* Row 2: Navigation links */}
        <div className="border-t border-[color:var(--header-border,#f3f4f6)]">
          <nav
            aria-label="Top"
            className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
          >
            <div className="flex h-10 items-center space-x-8">
              {navigation.categories.map((category) => (
                <Popover className="relative flex" key={category.name}>
                  <div className="relative flex">
                    <PopoverButton className="group relative flex items-center justify-center font-medium text-[color:var(--header-fg,#374151)] text-sm transition-colors duration-200 ease-out hover:text-[color:var(--header-fg,#1f2937)] data-open:text-[--primary-color]">
                      {category.name}
                      <span
                        aria-hidden="true"
                        className="-bottom-px absolute inset-x-0 z-30 h-0.5 transition duration-200 ease-out group-data-open:bg-[--primary-color]"
                      />
                    </PopoverButton>
                  </div>
                  <PopoverPanel
                    className="absolute inset-x-0 top-full z-20 w-full bg-white text-gray-500 text-sm transition data-closed:opacity-0 data-enter:duration-200 data-leave:duration-150 data-enter:ease-out data-leave:ease-in"
                    transition
                  >
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 top-1/2 bg-white shadow-sm"
                    />
                    <div className="relative bg-white">
                      <div className="mx-auto max-w-7xl px-8">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-10 py-16">
                          <div className="grid grid-cols-2 grid-rows-1 gap-8 text-sm">
                            {category.featured.map((item, itemIdx) => (
                              <div
                                className={classNames(
                                  itemIdx === 0 ? "col-span-2" : "",
                                  "group relative overflow-hidden rounded-md bg-gray-100",
                                )}
                                key={item.name}
                              >
                                <img
                                  alt={item.imageAlt}
                                  className={classNames(
                                    itemIdx === 0
                                      ? "aspect-2/1"
                                      : "aspect-square",
                                    "w-full object-cover group-hover:opacity-75",
                                  )}
                                  src={item.imageSrc}
                                />
                                <div className="absolute inset-0 flex flex-col justify-end">
                                  <div className="bg-white/60 p-4 text-sm">
                                    <Link
                                      className="font-medium text-gray-900"
                                      href={item.href}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className="absolute inset-0"
                                      />
                                      {item.name}
                                    </Link>
                                    <p
                                      aria-hidden="true"
                                      className="mt-0.5 text-gray-700 sm:mt-1"
                                    >
                                      Comprá ahora
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-x-8 gap-y-10 text-gray-500 text-sm">
                            {category.sections.map((column, columnIdx) => (
                              <div className="space-y-10" key={columnIdx}>
                                {column.map((section) => (
                                  <div key={section.name}>
                                    <p
                                      className="font-medium text-gray-900"
                                      id={`${category.id}-${section.id}-heading`}
                                    >
                                      {section.name}
                                    </p>
                                    <ul
                                      aria-labelledby={`${category.id}-${section.id}-heading`}
                                      className="mt-4 space-y-4"
                                      role="list"
                                    >
                                      {section.items.map((item) => (
                                        <li className="flex" key={item.name}>
                                          <Link
                                            className="hover:text-gray-800"
                                            href={item.href}
                                          >
                                            {item.name}
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </PopoverPanel>
                </Popover>
              ))}
              {/* "Categorías" abre el menú del árbol de categorías y va primero,
                  antes de "Tienda". Visibilidad y variante visual (hamburguesa
                  o botón) son config del demo. */}
              {showCategoriesMenu && (
                <CategoriesMenu
                  categories={categories}
                  variant={categoriesMenuLayout}
                />
              )}
              {desktopPages.map((page) => {
                const currentPath = pathname || "/";
                // En demos el path real lleva el prefijo /demo/{slug}; comparamos
                // contra el href ya prefijado, así el link activo se marca (antes
                // nunca matcheaba en /demo/* y solo se veía el color en hover).
                const target = demoHref(page.href);
                const isActive =
                  !(page.href === "/store" && isPromosView) &&
                  (currentPath === target ||
                    (page.href !== "/" && currentPath.startsWith(target + "/")));

                return (
                  <LocalizedClientLink
                    aria-current={isActive ? "page" : undefined}
                    className={classNames(
                      // self-stretch + relative: la barra inferior (after) se
                      // ancla al borde de la fila de navegación, no al texto.
                      "relative flex items-center self-stretch text-[14px] leading-5 whitespace-nowrap transition-all duration-200 ease-in-out antialiased",
                      "after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition-colors after:duration-200 after:content-['']",
                      isActive
                        ? "text-[--primary-color] font-semibold after:bg-[--primary-color]"
                        : "text-[color:var(--header-fg,#374151)] font-normal hover:text-[--accent-color] after:bg-transparent hover:after:bg-[color:var(--header-fg-muted,#d1d5db)]",
                    )}
                    href={page.href}
                    key={page.name}
                    target={page.target}
                    style={{ fontFamily: "var(--font-roboto), Roboto, sans-serif" }}
                  >
                    {pageLabel(page)}
                  </LocalizedClientLink>
                );
              })}

              {/* Growing spacer pushes Promociones to the far right. (ml-auto
                  doesn't work here: the parent's space-x-8 sets margin-left on
                  each child and overrides it.) */}
              <div aria-hidden="true" className="grow" />
              {/* Promociones — set apart on the far right, as a pill with icon */}
              {showPromotions && (
                <LocalizedClientLink
                  aria-current={isPromosView ? "page" : undefined}
                  className={classNames(
                    // Color configurable por tienda (`theme.colors.promoButton`);
                    // sin configurar cae al primario, como siempre.
                    "inline-flex items-center gap-1.5 rounded-lg bg-[var(--promo-button-bg,var(--primary-color))] px-3.5 py-1.5 text-[13px] text-[var(--promo-button-fg,#fff)] leading-5 whitespace-nowrap transition-all duration-200 ease-in-out hover:opacity-90",
                    // El pill ya es sólido en el color de marca, así que el activo
                    // no se puede marcar con color: va un halo alrededor.
                    isPromosView
                      ? "font-semibold ring-2 ring-[var(--promo-button-bg,var(--primary-color))] ring-offset-2 ring-offset-white"
                      : "font-medium",
                  )}
                  href={promotionsLink.href}
                  style={{ fontFamily: "var(--font-roboto), Roboto, sans-serif" }}
                >
                  <TagIcon className="h-4 w-4" />
                  {promotionsLink.name}
                </LocalizedClientLink>
              )}
            </div>
          </nav>
        </div>
      </header>
    </div>
  );
};

export default NavClient;
