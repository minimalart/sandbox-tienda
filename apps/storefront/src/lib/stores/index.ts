/**
 * Zustand Stores - Estado global de la aplicación
 *
 * Stores disponibles:
 * - useCartStore: Estado del carrito de compras
 * - useLocationStore: Stock locations de Medusa (sin geolocalización)
 * - useProductsStore: Productos, filtros y paginación
 * - useUIStore: Estados de UI (modales, menús)
 *
 * Uso:
 * ```tsx
 * import { useCartStore, useLocationStore } from "@lib/stores";
 *
 * function Component() {
 *   const { cart, openCart } = useCartStore();
 *   const { locations, selectedLocation } = useLocationStore();
 *   // ...
 * }
 * ```
 */

export { useCartStore } from "./cart.store";
export { useLocationStore, type Location } from "./location.store";
export { useProductsStore } from "./products.store";
export { useUIStore } from "./ui.store";
export { StoreProvider } from "./store-provider";
