import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules } from '@medusajs/framework/utils';
import { DYNAMIC_GROUPS_MODULE } from '../modules/dynamic-groups';
import type DynamicGroupsModuleService from '../modules/dynamic-groups/service';
import type { Condition } from '../modules/dynamic-groups/types';

export type CreateDynamicGroupInput = {
  name: string;
  handle?: string;
  description?: string | null;
  match?: 'all' | 'any';
  conditions: Condition[];
  update_mode?: 'realtime' | 'manual';
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
  /**
   * La tienda dueña del grupo. Tiene que estar en el tipo Y enumerarse en el step:
   * el paso arma el objeto campo por campo, así que un `site_id` que sólo viaje en
   * el input se descarta EN SILENCIO — el grupo nace global y el listado filtrado
   * ya no lo encuentra donde se creó.
   */
  site_id?: string | null;
};

const slugify = (s: string): string => {
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
const createNativeGroupStep = createStep(
  'create-native-customer-group',
  async (input: CreateDynamicGroupInput, { container }) => {
    const customerService = container.resolve(Modules.CUSTOMER);
    const created = await customerService.createCustomerGroups([
      { name: input.name },
    ]);
    const group = Array.isArray(created) ? created[0] : created;
    if (!group) throw new Error('No se pudo crear el customer group.');
    return new StepResponse(group, group.id);
  },
  async (groupId: string | undefined, { container }) => {
    if (!groupId) return;
    const customerService = container.resolve(Modules.CUSTOMER);
    await customerService.deleteCustomerGroups([groupId]);
  },
);

// 2) Crear el registro de grupo dinámico apuntando al customer_group.
const createRecordStep = createStep(
  'create-dynamic-group-record',
  async (
    data: { input: CreateDynamicGroupInput; customerGroupId: string },
    { container },
  ) => {
    const service = container.resolve<DynamicGroupsModuleService>(
      DYNAMIC_GROUPS_MODULE,
    );
    const { input, customerGroupId } = data;
    const created = await service.createDynamicGroups({
      name: input.name,
      handle: input.handle?.trim() || slugify(input.name),
      description: input.description ?? null,
      customer_group_id: customerGroupId,
      match: input.match ?? 'all',
      conditions: (input.conditions ?? []) as unknown as Record<string, unknown>,
      update_mode: input.update_mode ?? 'realtime',
      is_active: input.is_active ?? true,
      metadata: input.metadata ?? null,
      site_id: input.site_id ?? null,
    });
    const record = Array.isArray(created) ? created[0] : created;
    if (!record) throw new Error('No se pudo crear el grupo dinámico.');
    return new StepResponse(record, record.id);
  },
  async (recordId: string | undefined, { container }) => {
    if (!recordId) return;
    const service = container.resolve<DynamicGroupsModuleService>(
      DYNAMIC_GROUPS_MODULE,
    );
    await service.deleteDynamicGroups([recordId]);
  },
);

export const createDynamicGroupWorkflow = createWorkflow(
  'create-dynamic-group',
  function (input: CreateDynamicGroupInput) {
    const group = createNativeGroupStep(input);
    const record = createRecordStep({ input, customerGroupId: group.id });
    return new WorkflowResponse(record);
  },
);
