import WishlistModuleService from './service';
export declare const WISHLIST_MODULE = "wishlist";
declare const _default: import("@medusajs/types").ModuleExports<typeof WishlistModuleService> & {
    linkable: {
        readonly wishlist: {
            id: {
                serviceName: "wishlist";
                field: "wishlist";
                linkable: "wishlist_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "wishlist";
                field: "wishlist";
                linkable: "wishlist_id";
                primaryKey: "id";
            };
        };
        readonly wishlistItem: {
            id: {
                serviceName: "wishlist";
                field: "wishlistItem";
                linkable: "wishlist_item_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "wishlist";
                field: "wishlistItem";
                linkable: "wishlist_item_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
