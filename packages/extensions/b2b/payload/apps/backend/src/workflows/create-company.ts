import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import { COMPANY_MODULE } from '../modules/company';
import type CompanyModuleService from '../modules/company/service';

export type CreateCompanyInput = {
  name: string;
  slug?: string;
  legal_name?: string | null;
  tax_id?: string | null;
  owner_customer_id: string;
  sales_channel_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `empresa-${Date.now()}`;

const createCompanyRecordStep = createStep(
  'create-company-record',
  async (input: CreateCompanyInput, { container }) => {
    const service = container.resolve<CompanyModuleService>(COMPANY_MODULE);
    const created = await service.createCompanies({
      name: input.name,
      slug: input.slug?.trim() || slugify(input.name),
      legal_name: input.legal_name ?? null,
      tax_id: input.tax_id ?? null,
      status: 'active',
      sales_channel_id: input.sales_channel_id ?? null,
      metadata: input.metadata ?? null,
    });
    const record = Array.isArray(created) ? created[0] : created;
    if (!record) throw new Error('No se pudo crear la empresa.');
    return new StepResponse(record, record.id);
  },
  async (recordId: string | undefined, { container }) => {
    if (!recordId) return;
    const service = container.resolve<CompanyModuleService>(COMPANY_MODULE);
    await service.deleteCompanies([recordId]);
  },
);

const createOwnerMemberStep = createStep(
  'create-company-owner-member',
  async (data: { companyId: string; ownerCustomerId: string }, { container }) => {
    const service = container.resolve<CompanyModuleService>(COMPANY_MODULE);
    const existing = await service.getMembershipByCustomer(data.ownerCustomerId);
    if (existing) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'El cliente ya pertenece a una empresa.',
      );
    }
    const created = await service.createCompanyMembers({
      company_id: data.companyId,
      customer_id: data.ownerCustomerId,
      role: 'owner',
      status: 'active',
      joined_at: new Date(),
    });
    const member = Array.isArray(created) ? created[0] : created;
    if (!member) throw new Error('No se pudo crear la membresía owner.');
    return new StepResponse(member, member.id);
  },
  async (memberId: string | undefined, { container }) => {
    if (!memberId) return;
    const service = container.resolve<CompanyModuleService>(COMPANY_MODULE);
    await service.deleteCompanyMembers([memberId]);
  },
);

const emitCreatedStep = createStep(
  'emit-company-created',
  async (data: { companyId: string }, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS);
    await eventBus.emit({ name: 'company.created', data: { id: data.companyId } });
    return new StepResponse(void 0);
  },
);

export const createCompanyWorkflow = createWorkflow(
  'create-company',
  function (input: CreateCompanyInput) {
    const company = createCompanyRecordStep(input);
    createOwnerMemberStep({
      companyId: company.id,
      ownerCustomerId: input.owner_customer_id,
    });
    emitCreatedStep({ companyId: company.id });
    return new WorkflowResponse(company);
  },
);
