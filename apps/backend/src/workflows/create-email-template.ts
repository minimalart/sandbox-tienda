import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { EMAIL_TEMPLATE_MODULE } from '../modules/email-template';
import type EmailTemplateModuleService from '../modules/email-template/service';
import type { CreateEmailTemplateInput } from '../modules/email-template/types';

const createEmailTemplateStep = createStep(
  'create-email-template',
  async (input: CreateEmailTemplateInput, { container }) => {
    const service: EmailTemplateModuleService = container.resolve(
      EMAIL_TEMPLATE_MODULE,
    );

    const baseKey = input.key || service.generateKey(input.name);
    // La unicidad de la clave es POR TIENDA: si no se le pasa la tienda, la plantilla
    // de la tienda B choca con la global y nace como `<clave>-2`, que no es la clave
    // que emite `createNotifications` — queda publicada y no se usa nunca.
    const siteId = input.site_id ?? null;
    const key = await service.ensureUniqueKey(baseKey, undefined, siteId);
    const willPublish = input.status === 'published';

    const created = await (service as any).createEmailTemplates({
      key,
      name: input.name,
      description: input.description ?? null,
      subject: input.subject,
      html: input.html,
      status: input.status || 'draft',
      locale: input.locale ?? null,
      variables: input.variables ?? null,
      sample_data: input.sample_data ?? null,
      metadata: input.metadata ?? null,
      created_by: input.created_by ?? null,
      updated_by: input.created_by ?? null,
      site_id: siteId,
      published_at: willPublish ? new Date() : null,
    });

    return new StepResponse(created, created.id as string);
  },
  async (id, { container }) => {
    if (!id) {
      return;
    }
    const service: EmailTemplateModuleService = container.resolve(
      EMAIL_TEMPLATE_MODULE,
    );
    await (service as any).deleteEmailTemplates(id);
  },
);

export const createEmailTemplateWorkflow = createWorkflow(
  'create-email-template',
  (input: CreateEmailTemplateInput) => {
    const email_template = createEmailTemplateStep(input);
    return new WorkflowResponse(email_template);
  },
);
