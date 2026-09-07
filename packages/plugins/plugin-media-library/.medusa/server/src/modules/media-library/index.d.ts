import MediaLibraryModuleService from './service';
export { MEDIA_LIBRARY_MODULE } from './types';
declare const _default: import("@medusajs/types").ModuleExports<typeof MediaLibraryModuleService> & {
    linkable: {
        readonly mediaAsset: {
            id: {
                serviceName: "media_library";
                field: "mediaAsset";
                linkable: "media_asset_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "media_library";
                field: "mediaAsset";
                linkable: "media_asset_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
