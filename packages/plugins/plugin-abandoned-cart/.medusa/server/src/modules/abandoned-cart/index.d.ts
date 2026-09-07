import AbandonedCartModuleService from './service';
export { ABANDONED_CART_MODULE } from './types';
declare const _default: import("@medusajs/types").ModuleExports<typeof AbandonedCartModuleService> & {
    linkable: {
        readonly abandonedCart: {
            id: {
                serviceName: "abandonedCart";
                field: "abandonedCart";
                linkable: "abandoned_cart_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "abandonedCart";
                field: "abandonedCart";
                linkable: "abandoned_cart_id";
                primaryKey: "id";
            };
        };
        readonly abandonedCartNotification: {
            id: {
                serviceName: "abandonedCart";
                field: "abandonedCartNotification";
                linkable: "abandoned_cart_notification_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "abandonedCart";
                field: "abandonedCartNotification";
                linkable: "abandoned_cart_notification_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
