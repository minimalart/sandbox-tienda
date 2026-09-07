import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../modules/corporate';
import type CorporateModuleService from '../modules/corporate/service';

export type LinkCorporateCustomerGroupInput = {
  corporate_id: string;
  /** Si se pasa, vincula ese group existente; si no, crea uno nuevo. */
  customer_group_id?: string;
};

// 1) Crea o referencia el customer_group nativo y lo asocia a la empresa.
const linkGroupStep = createStep(
  'link-corporate-customer-group',
  async (input: LinkCorporateCustomerGroupInput, { container }) => {
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
    const customerService = container.resolve(Modules.CUSTOMER);

    const corporate = await service.retrieveCorporate(input.corporate_id);
    if (!corporate) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Empresa no encontrada.');
    }

    let groupId = input.customer_group_id ?? null;
    let createdGroup = false;
    if (!groupId) {
      const created = await customerService.createCustomerGroups([
        { name: `Empresa: ${corporate.name}` },
      ]);
      const group = Array.isArray(created) ? created[0] : created;
      if (!group) throw new Error('No se pudo crear el customer group.');
      groupId = group.id;
      createdGroup = true;
    }

    await service.updateCorporates({
      id: input.corporate_id,
      customer_group_id: groupId,
    });

    // Agrega los miembros activos al grupo.
    const members = await service.listCorporateMembers({
      corporate_id: input.corporate_id,
      status: 'active',
    });
    const entries = members
      .map((m) => ({ customer_id: m.customer_id as string, customer_group_id: groupId as string }))
      .filter((e) => e.customer_id);
    if (entries.length) {
      await customerService.addCustomerToGroup(entries);
    }

    return new StepResponse(
      { customer_group_id: groupId },
      {
        corporateId: input.corporate_id,
        previousGroupId: (corporate.customer_group_id as string | null) ?? null,
        createdGroupId: createdGroup ? groupId : null,
      },
    );
  },
  async (
    undo:
      | { corporateId: string; previousGroupId: string | null; createdGroupId: string | null }
      | undefined,
    { container },
  ) => {
    if (!undo) return;
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
    await service.updateCorporates({
      id: undo.corporateId,
      customer_group_id: undo.previousGroupId,
    });
    if (undo.createdGroupId) {
      const customerService = container.resolve(Modules.CUSTOMER);
      await customerService.deleteCustomerGroups([undo.createdGroupId]);
    }
  },
);

export const linkCorporateCustomerGroupWorkflow = createWorkflow(
  'link-corporate-customer-group',
  function (input: LinkCorporateCustomerGroupInput) {
    return new WorkflowResponse(linkGroupStep(input));
  },
);
