import type { HttpTypes } from "@medusajs/types";
import React from "react";
type Props = {
    cart: HttpTypes.StoreCart;
    onCartUpdate?: (cart?: HttpTypes.StoreCart | null) => Promise<HttpTypes.StoreCart | null>;
};
declare const LoyaltyRewardsCheckout: React.FC<Props>;
export default LoyaltyRewardsCheckout;
