import BrandModuleService from './service';
export declare const BRAND_MODULE = "brand";
declare const _default: import("@medusajs/types").ModuleExports<typeof BrandModuleService> & {
    linkable: {
        readonly brand: {
            id: {
                serviceName: "brand";
                field: "brand";
                linkable: "brand_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "brand";
                field: "brand";
                linkable: "brand_id";
                primaryKey: "id";
            };
        };
        readonly brandImage: {
            id: {
                serviceName: "brand";
                field: "brandImage";
                linkable: "brand_image_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "brand";
                field: "brandImage";
                linkable: "brand_image_id";
                primaryKey: "id";
            };
        };
        readonly productProductBrandBrand: {
            id: {
                serviceName: "brand";
                field: "productProductBrandBrand";
                linkable: "product_product_brand_brand_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "brand";
                field: "productProductBrandBrand";
                linkable: "product_product_brand_brand_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
