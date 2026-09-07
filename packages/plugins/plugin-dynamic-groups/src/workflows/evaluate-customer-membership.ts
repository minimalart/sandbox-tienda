import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { DYNAMIC_GROUPS_MODULE } from '../modules/dynamic-groups';
import type DynamicGroupsModuleService from '../modules/dynamic-groups/service';
import {
  buildCustomerAggregate,
  CUSTOMER_AGGREGATE_FIELDS,
  evaluateCustomer,
} from '../modules/dynamic-groups/rules';
import type { RuleSet } from '../modules/dynamic-groups/types';

type QueryGraph = { graph: (input: unknown) => Promise<{ data: any[] }> };

/**
 * Evaluación INCREMENTAL: dado un cliente, lo evalúa contra todos los grupos
 * dinámicos activos y lo agrega/quita de cada customer_group nativo según
 * corresponda. Disparado por subscribers (order.placed, customer.*).
 */
const evaluateStep = createStep(
  'evaluate-customer-membership',
  async (input: { customer_id: string }, { container }) => {
    if (!input.customer_id) return new StepResponse({ changes: 0 });

    const service = container.resolve<DynamicGroupsModuleService>(
      DYNAMIC_GROUPS_MODULE,
    );
    const customerService = container.resolve(Modules.CUSTOMER);
    const query = container.resolve<QueryGraph>(ContainerRegistrationKeys.QUERY);

    const { data: customers } = await query.graph({
      entity: 'customer',
      fields: [...CUSTOMER_AGGREGATE_FIELDS, 'groups.id'],
      filters: { id: input.customer_id },
    });
    const customer = customers[0];
    if (!customer) return new StepResponse({ changes: 0 });

    const now = Date.now();
    const agg = buildCustomerAggregate(customer, now);
    const currentGroupIds = new Set<string>(
      (customer.groups ?? []).map((g: { id?: string }) => g?.id).filter(Boolean),
    );

    const groups = await service.listDynamicGroups({ is_active: true });

    let changes = 0;
    for (const g of groups) {
      const customerGroupId = g.customer_group_id as string | null;
      if (!customerGroupId) continue;

      const ruleSet: RuleSet = {
        match: (g.match as 'all' | 'any') ?? 'all',
        conditions: (g.conditions as unknown as RuleSet['conditions']) ?? [],
      };
      const shouldBe = evaluateCustomer(agg, ruleSet, now);
      const isIn = currentGroupIds.has(customerGroupId);

      if (shouldBe && !isIn) {
        await customerService.addCustomerToGroup({
          customer_id: input.customer_id,
          customer_group_id: customerGroupId,
        });
        await service.logMembership([
          {
            dynamic_group_id: g.id as string,
            customer_id: input.customer_id,
            action: 'added',
            reason: { match: ruleSet.match, conditions: ruleSet.conditions },
          },
        ]);
        changes++;
      } else if (!shouldBe && isIn) {
        await customerService.removeCustomerFromGroup({
          customer_id: input.customer_id,
          customer_group_id: customerGroupId,
        });
        await service.logMembership([
          {
            dynamic_group_id: g.id as string,
            customer_id: input.customer_id,
            action: 'removed',
            reason: { trigger: 'no longer matches' },
          },
        ]);
        changes++;
      }
    }

    return new StepResponse({ changes });
  },
);

export const evaluateCustomerMembershipWorkflow = createWorkflow(
  'evaluate-customer-membership',
  function (input: { customer_id: string }) {
    return new WorkflowResponse(evaluateStep(input));
  },
);
