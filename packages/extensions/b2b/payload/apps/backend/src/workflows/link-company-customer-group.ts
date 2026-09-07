import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import { COMPANY_MODULE } from '../modules/company';
import type CompanyModuleService from '../modules/company/service';

export type LinkCompanyCustomerGroupInput = {
  company_id: string;
  customer_group_id?: string;
};

const linkStep = createStep(
  'link-company-customer-group',
  async (input: LinkCompanyCustomerGroupInput, { container }) => {
    const service = container.resolve<CompanyModuleService>(COMPANY_MODULE);
    const customerService = container.resolve(Modules.CUSTOMER);
    const company = await service.retrieveCompany(input.company_id);
    if (!company) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Empresa no encontrada.');
    }
    let groupId = input.customer_group_id ?? null;
    let createdGroup = false;
    if (!groupId) {
      const created = await customerService.createCustomerGroups([
        { name: `Mayorista: ${company.name}` },
      ]);
      const group = Array.isArray(created) ? created[0] : created;
      if (!group) throw new Error('No se pudo crear el customer group.');
      groupId = group.id;
      createdGroup = true;
    }
    await service.updateCompanies({ id: input.company_id, customer_group_id: groupId });

    const members = await service.getActiveMembers(input.company_id);
    const entries = members
      .map((m) => ({ customer_id: m.customer_id as string, customer_group_id: groupId as string }))
      .filter((e) => e.customer_id);
    if (entries.length) await customerService.addCustomerToGroup(entries);

    return new StepResponse(
      { customer_group_id: groupId },
      {
        companyId: input.company_id,
        previousGroupId: (company.customer_group_id as string | null) ?? null,
        createdGroupId: createdGroup ? groupId : null,
      },
    );
  },
  async (
    undo:
      | { companyId: string; previousGroupId: string | null; createdGroupId: string | null }
      | undefined,
    { container },
  ) => {
    if (!undo) return;
    const service = container.resolve<CompanyModuleService>(COMPANY_MODULE);
    await service.updateCompanies({ id: undo.companyId, customer_group_id: undo.previousGroupId });
    if (undo.createdGroupId) {
      const customerService = container.resolve(Modules.CUSTOMER);
      await customerService.deleteCustomerGroups([undo.createdGroupId]);
    }
  },
);

export const linkCompanyCustomerGroupWorkflow = createWorkflow(
  'link-company-customer-group',
  function (input: LinkCompanyCustomerGroupInput) {
    return new WorkflowResponse(linkStep(input));
  },
);
