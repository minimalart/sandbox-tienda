import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { EMAIL_TEMPLATE_MODULE } from '../modules/email-template';
import type EmailTemplateModuleService from '../modules/email-template/service';
import type { UpdateEmailTemplateInput } from '../modules/email-template/types';

export type UpdateEmailTemplateWorkflowInput = UpdateEmailTemplateInput & {
  id: string;
};

const updateEmailTemplateStep = createStep(
  'update-email-template',
  async (input: UpdateEmailTemplateWorkflowInput, { container }) => {
    const service: EmailTemplateModuleService = container.resolve(
      EMAIL_TEMPLATE_MODULE,
    );

    const { id, key, status, ...rest } = input;

    const data: Record<string, unknown> = { id, ...rest };
    if (key !== undefined) {
      /**
       * La clave es única POR TIENDA, así que antes de preguntar si está tomada hay que
       * saber de qué tienda va a ser la fila: la que trae este update si lo trae, y si
       * no la que la fila ya tiene.
       *
       * El `retrieve` corre sólo cuando la clave cambia. Comparar contra las globales
       * cuando la fila es de una tienda es lo que hacía nacer `<clave>-2`: guardada,
       * publicada, y nunca usada porque no es la clave que se emite.
       */
      const siteId =
        rest.site_id !== undefined
          ? (rest.site_id ?? null)
          : ((((await service.retrieveEmailTemplate(id)) as { site_id?: string | null })
              .site_id) ?? null);
      data.key = await service.ensureUniqueKey(key, id, siteId);
    }
    if (status !== undefined) {
      data.status = status;
      // Keep published_at consistent with the new status.
      data.published_at = status === 'published' ? new Date() : null;
    }

    const updated = await (service as any).updateEmailTemplates(data);
    return new StepResponse(Array.isArray(updated) ? updated[0] : updated);
  },
);

export const updateEmailTemplateWorkflow = createWorkflow(
  'update-email-template',
  (input: UpdateEmailTemplateWorkflowInput) => {
    const email_template = updateEmailTemplateStep(input);
    return new WorkflowResponse(email_template);
  },
);
