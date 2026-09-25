/**
 * Subpath root `@minimalart/mercatto-plugin-storefront-shared`.
 *
 * Los consumers pueden importar todo desde aca o desde subpaths especificos
 * (`./util/money`, `./components/scroll-carousel`, `./ports`, `./provider`).
 * Los subpaths existen para tree-shaking granular; el root es conveniencia.
 */
export * from "./ports/index";
export * from "./provider/index";
export * from "./util/money";
export * from "./util/get-individual-variant";
export * from "./util/is-product-in-stock";
export * from "./util/free-shipping-target";
export * from "./util/cn";
export * from "./util/placeholder-image";
export * from "./stores/recently-viewed.store";
