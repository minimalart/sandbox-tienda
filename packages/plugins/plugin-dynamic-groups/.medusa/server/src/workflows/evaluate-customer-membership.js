"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateCustomerMembershipWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const utils_1 = require("@medusajs/framework/utils");
const dynamic_groups_1 = require("../modules/dynamic-groups");
const rules_1 = require("../modules/dynamic-groups/rules");
/**
 * Evaluación INCREMENTAL: dado un cliente, lo evalúa contra todos los grupos
 * dinámicos activos y lo agrega/quita de cada customer_group nativo según
 * corresponda. Disparado por subscribers (order.placed, customer.*).
 */
const evaluateStep = (0, workflows_sdk_1.createStep)('evaluate-customer-membership', async (input, { container }) => {
    if (!input.customer_id)
        return new workflows_sdk_1.StepResponse({ changes: 0 });
    const service = container.resolve(dynamic_groups_1.DYNAMIC_GROUPS_MODULE);
    const customerService = container.resolve(utils_1.Modules.CUSTOMER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: customers } = await query.graph({
        entity: 'customer',
        fields: [...rules_1.CUSTOMER_AGGREGATE_FIELDS, 'groups.id'],
        filters: { id: input.customer_id },
    });
    const customer = customers[0];
    if (!customer)
        return new workflows_sdk_1.StepResponse({ changes: 0 });
    const now = Date.now();
    const agg = (0, rules_1.buildCustomerAggregate)(customer, now);
    const currentGroupIds = new Set((customer.groups ?? []).map((g) => g?.id).filter(Boolean));
    const groups = await service.listDynamicGroups({ is_active: true });
    let changes = 0;
    for (const g of groups) {
        const customerGroupId = g.customer_group_id;
        if (!customerGroupId)
            continue;
        const ruleSet = {
            match: g.match ?? 'all',
            conditions: g.conditions ?? [],
        };
        const shouldBe = (0, rules_1.evaluateCustomer)(agg, ruleSet, now);
        const isIn = currentGroupIds.has(customerGroupId);
        if (shouldBe && !isIn) {
            await customerService.addCustomerToGroup({
                customer_id: input.customer_id,
                customer_group_id: customerGroupId,
            });
            await service.logMembership([
                {
                    dynamic_group_id: g.id,
                    customer_id: input.customer_id,
                    action: 'added',
                    reason: { match: ruleSet.match, conditions: ruleSet.conditions },
                },
            ]);
            changes++;
        }
        else if (!shouldBe && isIn) {
            await customerService.removeCustomerFromGroup({
                customer_id: input.customer_id,
                customer_group_id: customerGroupId,
            });
            await service.logMembership([
                {
                    dynamic_group_id: g.id,
                    customer_id: input.customer_id,
                    action: 'removed',
                    reason: { trigger: 'no longer matches' },
                },
            ]);
            changes++;
        }
    }
    return new workflows_sdk_1.StepResponse({ changes });
});
exports.evaluateCustomerMembershipWorkflow = (0, workflows_sdk_1.createWorkflow)('evaluate-customer-membership', function (input) {
    return new workflows_sdk_1.WorkflowResponse(evaluateStep(input));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZhbHVhdGUtY3VzdG9tZXItbWVtYmVyc2hpcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvZXZhbHVhdGUtY3VzdG9tZXItbWVtYmVyc2hpcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFLMkM7QUFDM0MscURBQStFO0FBQy9FLDhEQUFrRTtBQUVsRSwyREFJeUM7QUFLekM7Ozs7R0FJRztBQUNILE1BQU0sWUFBWSxHQUFHLElBQUEsMEJBQVUsRUFDN0IsOEJBQThCLEVBQzlCLEtBQUssRUFBRSxLQUE4QixFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUN0RCxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVc7UUFBRSxPQUFPLElBQUksNEJBQVksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRWhFLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQy9CLHNDQUFxQixDQUN0QixDQUFDO0lBQ0YsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxlQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDNUQsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBYSxpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUU3RSxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztRQUM1QyxNQUFNLEVBQUUsVUFBVTtRQUNsQixNQUFNLEVBQUUsQ0FBQyxHQUFHLGlDQUF5QixFQUFFLFdBQVcsQ0FBQztRQUNuRCxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLFdBQVcsRUFBRTtLQUNuQyxDQUFDLENBQUM7SUFDSCxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUIsSUFBSSxDQUFDLFFBQVE7UUFBRSxPQUFPLElBQUksNEJB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