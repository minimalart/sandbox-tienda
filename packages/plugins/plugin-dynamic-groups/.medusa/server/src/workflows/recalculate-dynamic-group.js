"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recalculateDynamicGroupWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const utils_1 = require("@medusajs/framework/utils");
const dynamic_groups_1 = require("../modules/dynamic-groups");
const rules_1 = require("../modules/dynamic-groups/rules");
const PAGE = 500;
const WRITE_CHUNK = 200;
const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
    return out;
};
const recalculateStep = (0, workflows_sdk_1.createStep)('recalculate-dynamic-group', async (input, { container }) => {
    const service = container.resolve(dynamic_groups_1.DYNAMIC_GROUPS_MODULE);
    const customerService = container.resolve(utils_1.Modules.CUSTOMER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const group = await service.retrieveDynamicGroup(input.id);
    if (!group?.customer_group_id) {
        throw new Error('El grupo dinámico no tiene un customer_group asociado.');
    }
    const customerGroupId = group.customer_group_id;
    const ruleSet = {
        match: group.match ?? 'all',
        conditions: group.conditions ?? [],
    };
    const now = Date.now();
    // 1) Evaluar TODOS los clientes (paginado) → set deseado.
    const desired = new Set();
    let evaluated = 0;
    for (let offset = 0;; offset += PAGE) {
        const { data: customers } = await query.graph({
            entity: 'customer',
            fields: [...rules_1.CUSTOMER_AGGREGATE_FIELDS],
            pagination: { skip: offset, take: PAGE },
        });
        if (!customers.length)
            break;
        for (const c of customers) {
            evaluated++;
            if ((0, rules_1.evaluateCustomer)((0, rules_1.buildCustomerAggregate)(c, now), ruleSet, now)) {
                desired.add(c.id);
            }
        }
        if (customers.length < PAGE)
            break;
    }
    // 2) Membresía actual del customer_group nativo.
    const { data: groups } = await query.graph({
        entity: 'customer_group',
        fields: ['id', 'customers.id'],
        filters: { id: customerGroupId },
    });
    const current = new Set((groups[0]?.customers ?? [])
        .map((cu) => cu?.id)
        .filter(Boolean));
    // 3) Diff.
    const toAdd = [...desired].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !desired.has(id));
    // 4) Aplicar (en chunks).
    for (const ids of chunk(toAdd, WRITE_CHUNK)) {
        await customerService.addCustomerToGroup(ids.map((customer_id) => ({ customer_id, customer_group_id: customerGroupId })));
    }
    for (const ids of chunk(toRemove, WRITE_CHUNK)) {
        await customerService.removeCustomerFromGroup(ids.map((customer_id) => ({ customer_id, customer_group_id: customerGroupId })));
    }
    // 5) Log + stats.
    const reason = { match: ruleSet.match, conditions: ruleSet.conditions };
    await service.logMembership([
        ...toAdd.map((customer_id) => ({
            dynamic_group_id: group.id,
            customer_id,
            action: 'added',
            reason,
        })),
        ...toRemove.map((customer_id) => ({
            dynamic_group_id: group.id,
            customer_id,
            action: 'removed',
            reason: { trigger: 'no longer matches' },
        })),
    ]);
    const stats = {
        evaluated,
        members: desired.size,
        added: toAdd.length,
        removed: toRemove.length,
        at: new Date(now).toISOString(),
    };
    await service.updateDynamicGroups({
        id: group.id,
        last_run_at: new Date(now),
        last_run_stats: stats,
    });
    return new workflows_sdk_1.StepResponse(stats);
});
exports.recalculateDynamicGroupWorkflow = (0, workflows_sdk_1.createWorkflow)('recalculate-dynamic-group', function (input) {
    return new workflows_sdk_1.WorkflowResponse(recalculateStep(input));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjYWxjdWxhdGUtZHluYW1pYy1ncm91cC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvcmVjYWxjdWxhdGUtZHluYW1pYy1ncm91cC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFLMkM7QUFDM0MscURBQStFO0FBQy9FLDhEQUFrRTtBQUVsRSwyREFJeUM7QUFPekMsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDO0FBQ2pCLE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQztBQUV4QixNQUFNLEtBQUssR0FBRyxDQUFJLEdBQVEsRUFBRSxJQUFZLEVBQVMsRUFBRTtJQUNqRCxNQUFNLEdBQUcsR0FBVSxFQUFFLENBQUM7SUFDdEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLElBQUk7UUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzVFLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQyxDQUFDO0FBRUYsTUFBTSxlQUFlLEdBQUcsSUFBQSwwQkFBVSxFQUNoQywyQkFBMkIsRUFDM0IsS0FBSyxFQUFFLEtBQXFCLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFO0lBQzdDLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQy9CLHNDQUFxQixDQUN0QixDQUFDO0lBQ0YsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxlQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDNUQsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBYSxpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUU3RSxNQUFNLEtBQUssR0FBRyxNQUFNLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxLQUFL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