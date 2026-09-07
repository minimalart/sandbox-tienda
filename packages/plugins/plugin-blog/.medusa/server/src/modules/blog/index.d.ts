import BlogModuleService from './service';
export declare const BLOG_MODULE = "blog";
declare const _default: import("@medusajs/types").ModuleExports<typeof BlogModuleService> & {
    linkable: {
        readonly blogPost: {
            id: {
                serviceName: "blog";
                field: "blogPost";
                linkable: "blog_post_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "blog";
                field: "blogPost";
                linkable: "blog_post_id";
                primaryKey: "id";
            };
        };
        readonly blogCategory: {
            id: {
                serviceName: "blog";
                field: "blogCategory";
                linkable: "blog_category_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "blog";
                field: "blogCategory";
                linkable: "blog_category_id";
                primaryKey: "id";
            };
        };
        readonly blogPostProduct: {
            id: {
                serviceName: "blog";
                field: "blogPostProduct";
                linkable: "blog_post_product_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "blog";
                field: "blogPostProduct";
                linkable: "blog_post_product_id";
                primaryKey: "id";
            };
        };
        readonly blogSettings: {
            id: {
                serviceName: "blog";
                field: "blogSettings";
                linkable: "blog_settings_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "blog";
                field: "blogSettings";
                linkable: "blog_settings_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
