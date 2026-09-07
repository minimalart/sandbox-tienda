import DynamicGroupsModuleService from './service';
export { DYNAMIC_GROUPS_MODULE } from './types';
declare const _default: import("@medusajs/types").ModuleExports<typeof DynamicGroupsModuleService> & {
    linkable: {
        readonly dynamicGroup: {
            id: {
                serviceName: "dynamic_groups";
                field: "dynamicGroup";
                linkable: "dynamic_group_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "dynamic_groups";
                field: "dynamicGroup";
                linkable: "dynamic_group_id";
                primaryKey: "id";
            };
        };
        readonly dynamicGroupMembershipLog: {
            id: {
                serviceName: "dynamic_groups";
                field: "dynamicGroupMembershipLog";
                linkable: "dynamic_group_membership_log_id";
                primaryKey: "id";
            };
            toJSON: () => {
                serviceName: "dynamic_groups";
                field: "dynamicGroupMembershipLog";
                linkable: "dynamic_group_membership_log_id";
                primaryKey: "id";
            };
        };
    };
};
export default _default;
