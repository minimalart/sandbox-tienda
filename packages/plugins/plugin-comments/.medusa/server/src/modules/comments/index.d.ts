import CommentsModuleService from './service';
export declare const COMMENTS_MODULE = "comments";
declare const _default: import("@medusajs/types").ModuleExports<typeof CommentsModuleService> & {
    linkable: {
        readonly comment: {
            id: {
                serviceName: "comments";
                field: "comment";
                linkable: "comment_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "comments";
                field: "comment";
                linkable: "comment_id";
                primaryKey: "id";
            };
        };
        readonly commentSettings: {
            id: {
                serviceName: "comments";
                field: "commentSettings";
                linkable: "comment_settings_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "comments";
                field: "commentSettings";
                linkable: "comment_settings_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
