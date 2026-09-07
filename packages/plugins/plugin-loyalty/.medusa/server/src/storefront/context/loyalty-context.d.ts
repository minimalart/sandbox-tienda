import type { ReactNode } from 'react';
/**
 * Loyalty context injected once at the storefront root by the template.
 *
 * The plugin's components stay decoupled from the template's own state
 * management: the template creates its cart store (Zustand, Jotai, whatever)
 * and passes it in via this Provider. The plugin uses whatever hook the
 * template hands over. Templates that don't use a cart store can skip the
 * `cartStore` prop entirely — the redeem-at-checkout component tolerates its
 * absence and stops trying to sync the cart client-side.
 *
 * Typing is intentionally structural (`unknown`-ish): the plugin does NOT
 * import the template's cart-store types, so the injected hook is opaque here
 * and typed at the call site of the template.
 */
export type CartStoreSelector<T> = (state: T) => unknown;
export type CartStoreHook = <T = unknown>(selector: CartStoreSelector<T>) => unknown;
export type LoyaltyContextValue = {
    /**
     * Optional. When present, checkout redeem flow calls
     * `useCartStore((s) => s.setCart)` after applying a reward to refresh the
     * local cart state. Absent → the component skips that step and relies on the
     * next page navigation to refresh.
     */
    useCartStore?: CartStoreHook;
};
export type LoyaltyProviderProps = LoyaltyContextValue & {
    children: ReactNode;
};
export declare function LoyaltyProvider({ children, ...value }: LoyaltyProviderProps): import("react").JSX.Element;
export declare function useLoyaltyContext(): LoyaltyContextValue;
