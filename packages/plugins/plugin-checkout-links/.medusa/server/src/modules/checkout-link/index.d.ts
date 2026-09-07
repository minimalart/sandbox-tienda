import CheckoutLinkModuleService from './service';
export declare const CHECKOUT_LINK_MODULE = "checkout_link";
declare const _default: import("@medusajs/types").ModuleExports<typeof CheckoutLinkModuleService> & {
    linkable: {
        readonly checkoutLink: {
            id: {
                serviceName: "checkout_link";
                field: "checkoutLink";
                linkable: "checkout_link_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "checkout_link";
                field: "checkoutLink";
                linkable: "checkout_link_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
