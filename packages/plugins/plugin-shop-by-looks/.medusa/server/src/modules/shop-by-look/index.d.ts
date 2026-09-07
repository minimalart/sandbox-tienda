import ShopByLookModuleService from './service';
export declare const SHOP_BY_LOOK_MODULE = "shop_by_look";
declare const _default: import("@medusajs/types").ModuleExports<typeof ShopByLookModuleService> & {
    linkable: {
        readonly shopByLook: {
            id: {
                serviceName: "shop_by_look";
                field: "shopByLook";
                linkable: "shop_by_look_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "shop_by_look";
                field: "shopByLook";
                linkable: "shop_by_look_id";
                primaryKey: "id";
            };
        };
        readonly shopByLookProduct: {
            id: {
                serviceName: "shop_by_look";
                field: "shopByLookProduct";
                linkable: "shop_by_look_product_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "shop_by_look";
                field: "shopByLookProduct";
                linkable: "shop_by_look_product_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
