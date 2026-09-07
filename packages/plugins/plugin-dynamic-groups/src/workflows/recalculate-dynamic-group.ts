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

type QueryGraph = {
  graph: (input: unknown) => Promise<{ data: any[]; metadata?: { count?: number } }>;
};

const PAGE = 500;
const WRITE_CHUNK = 200;

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const recalculateStep = createStep(
  'recalculate-dynamic-group',
  async (input: { id: string }, { container }) => {
    const service = container.resolve<DynamicGroupsModuleService>(
      DYNAMIC_GROUPS_MODULE,
    );
    const customerService = container.resolve(Modules.CUSTOMER);
    const query = container.resolve<QueryGraph>(ContainerRegistrationKeys.QUERY);

    const group = await service.retrieveDynamicGroup(input.id);
    if (!group?.customer_group_id) {
      throw new Error('El grupo dinámico no tiene un customer_group asociado.');
    }
    const customerGroupId = group.customer_group_id as string;
    const ruleSet: RuleSet = {
      match: (group.match as 'all' | 'any') ?? 'all',
      conditions: (group.conditions as unknown as RuleSet['conditions']) ?? [],
    };
    const now = Date.now();

    // 1) Evaluar TODOS los clientes (paginado) → set deseado.
    const desired = new Set<string>();
    let evaluated = 0;
    for (let offset = 0; ; offset += PAGE) {
      const { data: customers } = await query.graph({
        entity: 'customer',
        fields: [...CUSTOMER_AGGREGATE_FIELDS],
        pagination: { skip: offset, take: PAGE },
      });
      if (!customers.length) break;
      for (const c of customers) {
        evaluated++;
        if (evaluateCustomer(buildCustomerAggregate(c, now), ruleSet, now)) {
          desired.add(c.id as string);
        }
      }
      if (customers.length < PAGE) break;
    }

    // 2) Membresía actual del customer_group nativo.
    const { data: groups } = await query.graph({
      entity: 'customer_group',
      fields: ['id', 'customers.id'],
      filters: { id: customerGroupId },
    });
    const current = new Set<string>(
      (groups[0]?.customers ?? [])
        .map((cu: { id?: string }) => cu?.id)
        .filter(Boolean),
    );

    // 3) Diff.
    const toAdd = [...desired].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !desired.has(id));

    // 4) Aplicar (en chunks).
    for (const ids of chunk(toAdd, WRITE_CHUNK)) {
      await customerService.addCustomerToGroup(
        ids.map((customer_id) => ({ customer_id, customer_group_id: customerGroupId })),
      );
    }
    for (const ids of chunk(toRemove, WRITE_CHUNK)) {
      await customerService.removeCustomerFromGroup(
        ids.map((customer_id) => ({ customer_id, customer_group_id: customerGroupId })),
      );
    }

    // 5) Log + stats.
    const reason = { match: ruleSet.match, conditions: ruleSet.conditions };
    await service.logMembership([
      ...toAdd.map((customer_id) => ({
        dynamic_group_id: group.id as string,
        customer_id,
        action: 'added' as const,
        reason,
      })),
      ...toRemove.map((customer_id) => ({
        dynamic_group_id: group.id as string,
        customer_id,
        action: 'removed' as const,
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

    return new StepResponse(stats);
  },
);

export const recalculateDynamicGroupWorkflow = createWorkflow(
  'recalculate-dynamic-group',
  function (input: { id: string }) {
    return new WorkflowResponse(recalculateStep(input));
  },
);
