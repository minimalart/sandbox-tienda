"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDynamicGroupWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const utils_1 = require("@medusajs/framework/utils");
const dynamic_groups_1 = require("../modules/dynamic-groups");
const slugify = (s) => {
    const base = s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // quita acentos
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return base || `grupo-${Date.now()}`;
};
// 1) Crear el customer_group NATIVO que el grupo dinámico administra.
const createNativeGroupStep = (0, workflows_sdk_1.createStep)('create-native-customer-group', async (input, { container }) => {
    const customerService = container.resolve(utils_1.Modules.CUSTOMER);
    const created = await customerService.createCustomerGroups([
        { name: input.name },
    ]);
    const group = Array.isArray(created) ? created[0] : created;
    if (!group)
        throw new Error('No se pudo crear el customer group.');
    return new workflows_sdk_1.StepResponse(group, group.id);
}, async (groupId, { container }) => {
    if (!groupId)
        return;
    const customerService = container.resolve(utils_1.Modules.CUSTOMER);
    await customerService.deleteCustomerGroups([groupId]);
});
// 2) Crear el registro de grupo dinámico apuntando al customer_group.
const createRecordStep = (0, workflows_sdk_1.createStep)('create-dynamic-group-record', async (data, { container }) => {
    const service = container.resolve(dynamic_groups_1.DYNAMIC_GROUPS_MODULE);
    const { input, customerGroupId } = data;
    const created = await service.createDynamicGroups({
        name: input.name,
        handle: input.handle?.trim() || slugify(input.name),
        description: input.description ?? null,
        customer_group_id: customerGroupId,
        match: input.match ?? 'all',
        conditions: (input.conditions ?? []),
        update_mode: input.update_mode ?? 'realtime',
        is_active: input.is_active ?? true,
        metadata: input.metadata ?? null,
        site_id: input.site_id ?? null,
    });
    const record = Array.isArray(created) ? created[0] : created;
    if (!record)
        throw new Error('No se pudo crear el grupo dinámico.');
    return new workflows_sdk_1.StepResponse(record, record.id);
}, async (recordId, { container }) => {
    if (!recordId)
        return;
    const service = container.resolve(dynamic_groups_1.DYNAMIC_GROUPS_MODULE);
    await service.deleteDynamicGroups([recordId]);
});
exports.createDynamicGroupWorkflow = (0, workflows_sdk_1.createWorkflow)('create-dynamic-group', function (input) {
    const group = createNativeGroupStep(input);
    const record = createRecordStep({ input, customerGroupId: group.id });
    return new workflows_sdk_1.WorkflowResponse(record);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWR5bmFtaWMtZ3JvdXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvd29ya2Zsb3dzL2NyZWF0ZS1keW5hbWljLWdyb3VwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFFQUsyQztBQUMzQyxxREFBb0Q7QUFDcEQsOERBQWtFO0FBc0JsRSxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQVMsRUFBVSxFQUFFO0lBQ3BDLE1BQU0sSUFBSSxHQUFHLENBQUM7U0FDWCxXQUFXLEVBQUU7U0FDYixTQUFTLENBQUMsS0FBSyxDQUFDO1NBQ2hCLE9BQU8sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUMsZ0JBQWdCO1NBQ3RDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsR0FBRyxDQUFDO1NBQzNCLE9BQU8sQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO1NBQ3ZCLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDaEIsT0FBTyxJQUFJLElBQUksU0FBUyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztBQUN2QyxDQUFDLENBQUM7QUFFRixzRUFBc0U7QUFDdEUsTUFBTSxxQkFBcUIsR0FBRyxJQUFBLDBCQUFVLEVBQ3RDLDhCQUE4QixFQUM5QixLQUFLLEVBQUUsS0FBOEIsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDdEQsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxlQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDNUQsTUFBTSxPQUFPLEdBQUcsTUFBTSxlQUFlLENBQUMsb0JBQW9CLENBQUM7UUFDekQsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRTtLQUNyQixDQUFDLENBQUM7SUFDSCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztJQUM1RCxJQUFJLENBQUMsS0FBSztRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQztJQUNuRSxPQUFPLElBQUksNEJBQVksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzNDLENBQUMsRUFDRCxLQUFLLEVBQUUsT0FBMkIsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDbkQsSUFBSSxDQUFDLE9BQU87UUFBRSxPQUFPO0lBQ3JCLE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsZUFBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzVELE1BQU0sZUFBZSxDQUFDLG9CQUFvQixDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUN4RCxDQUFDLENBQ0YsQ0FBQztBQUVGLHNFQUFzRTtBQUN0RSxNQUFNLGdCQUFnQixHQUFHLElBQUEsMEJBQVUsRUFDakMsNkJBQTZCLEVBQzdCLEtBQUssRUFDSCxJQUFpRSxFQUNqRSxFQUFFLFNBQVMsRUFBRSxFQUNiLEVBQUU7SUFDRixNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxDQUMvQixzQ0FBcUIsQ0FDdEIsQ0FBQztJQUNGLE1BQU0sRUFBRSxLQUFLLEVBQUUsZUFBZSxFQUFFLEdBQUcsSUFBSSxDQUFDO0lBQ3hDLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLG1CQUFtQixDQUFDO1FBQ2hELElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTtRQUNoQixNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztRQUNuRCxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVcsSUFBSSxJQUFJO1FBQ3RDLGlCQUFpQixFQUFFLGVBQWU7UUFDbEMsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLLElBQUksS0FBSztRQUMzQixVQUFVLEVBQUUsQ0FBQyxLQUFLLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBdUM7UUFDMUUsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXLElBQUksVUFBVTtRQUM1QyxTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVMsSUFBSSxJQUFJO1FBQ2xDLFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUSxJQUFJLElBQUk7UUFDaEMsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPLElBQUksSUFBSTtLQUMvQixDQUFDLENBQUM7SUFDSCxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztJQUM3RCxJQUFJLENBQUMsTUFBTTtRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQztJQUNwRSxPQUFPLElBQUksNEJBQVksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzdDLENBQUMsRUFDRCxLQUFLLEVBQUUsUUFBNEIsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDcEQsSUFBSSxDQUFDLFFBQVE7UUFBRSxPQUFPO0lBQ3RCLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQy9CLHNDQUFxQixDQUN0QixDQUFDO0lBQ0YsTUFBTSxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ2hELENBQUMsQ0FDRixDQUFDO0FBRVcsUUFBQSwwQkFBMEIsR0FBRyxJQUFBLDhCQUFjLEVBQ3RELHNCQUFzQixFQUN0QixVQUFVLEtBQThCO0lBQ3RDLE1BQU0sS0FBSyxHQUFHLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzNDLE1BQU0sTUFBTSxHQUFHLGdCQUFnQixDQUFDLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN0RSxPQUFPLElBQUksZ0NBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDdEMsQ0FBQyxDQUNGLENBQUMifQ==