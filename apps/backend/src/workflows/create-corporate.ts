import type { IEventBusModuleService } from '@medusajs/framework/types';
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../modules/corporate';
import type CorporateModuleService from '../modules/corporate/service';
import type { CorporateActivationMode } from '../modules/corporate/types';

export type CreateCorporateInput = {
  name: string;
  slug?: string;
  legal_name?: string | null;
  tax_id?: string | null;
  email_domain?: string | null;
  /** Customer dueño (owner) de la empresa. */
  owner_customer_id: string;
  /** Define el status inicial: 'automatic' → active, 'manual' → pending. */
  activation_mode?: CorporateActivationMode;
  metadata?: Record<string, unknown> | null;
};

const slugify = (s: string): string => {
  const base = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || `empresa-${Date.now()}`;
};

// 1) Crea el registro Corporate.
const createCorporateRecordStep = createStep(
  'create-corporate-record',
  async (input: CreateCorporateInput, { container }) => {
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
    const status = input.activation_mode === 'automatic' ? 'active' : 'pending';
    const created = await service.createCorporates({
      name: input.name,
      slug: input.slug?.trim() || slugify(input.name),
      legal_name: input.legal_name ?? null,
      tax_id: input.tax_id ?? null,
      email_domain: input.email_domain ?? null,
      status,
      customer_group_id: null,
      metadata: input.metadata ?? null,
    });
    const record = Array.isArray(created) ? created[0] : created;
    if (!record) throw new Error('No se pudo crear la empresa.');
    return new StepResponse(record, record.id);
  },
  async (recordId: string | undefined, { container }) => {
    if (!recordId) return;
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
    await service.deleteCorporates([recordId]);
  },
);

// 2) Crea la membership Owner (active). Enforce: una sola membership activa por customer.
const createOwnerMemberStep = createStep(
  'create-corporate-owner-member',
  async (
    data: { corporateId: string; ownerCustomerId: string },
    { container },
  ) => {
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
    const existing = await service.getActiveMembershipByCustomer(
      data.ownerCustomerId,
    );
    if (existing) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'El cliente ya pertenece a una empresa.',
      );
    }
    const created = await service.createCorporateMembers({
      corporate_id: data.corporateId,
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
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
    await service.deleteCorporateMembers([memberId]);
  },
);

// 3) Emite eventos corporate.created (+ activated si quedó active).
const emitCreatedEventsStep = createStep(
  'emit-corporate-created-events',
  async (
    data: { corporateId: string; status: string },
    { container },
  ) => {
    const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS);
    await eventBus.emit({
      name: 'corporate.created',
      data: { id: data.corporateId },
    });
    if (data.status === 'active') {
      await eventBus.emit({
        name: 'corporate.activated',
        data: { id: data.corporateId },
      });
    }
    return new StepResponse(void 0);
  },
);

export const createCorporateWorkflow = createWorkflow(
  'create-corporate',
  function (input: CreateCorporateInput) {
    const corporate = createCorporateRecordStep(input);
    createOwnerMemberStep({
      corporateId: corporate.id,
      ownerCustomerId: input.owner_customer_id,
    });
    emitCreatedEventsStep({ corporateId: corporate.id, status: corporate.status });
    return new WorkflowResponse(corporate);
  },
);
