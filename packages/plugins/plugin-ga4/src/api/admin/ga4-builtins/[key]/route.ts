import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { GA4_MODULE } from '../../../../modules/ga4';
import Ga4ModuleService from '../../../../modules/ga4/service';
import { BUILTIN_GA4_EVENTS, type Ga4BuiltinKey } from '../../../../modules/ga4/lib/supported-events';

export const UpdateGa4BuiltinSchema = z.object({
  is_active: z.boolean().optional(),
  hidden: z.boolean().optional(),
  ga4_event_name: z.string().min(1, 'ga4_event_name cannot be empty').optional(),
});

type UpdateGa4BuiltinInput = z.infer<typeof UpdateGa4BuiltinSchema>;

export async function POST(
  req: MedusaRequest<UpdateGa4BuiltinInput>,
  res: MedusaResponse
): Promise<void> {
  const key = req.params.key as Ga4BuiltinKey;

  const isValid = BUILTIN_GA4_EVENTS.some((b) => b.builtin_key === key);
  if (!isValid) {
    res.status(404).json({ message: `Unknown built-in event: ${key}` });
    return;
  }

  const input = req.validatedBody as UpdateGa4BuiltinInput;
  const ga4Service: Ga4ModuleService = req.scope.resolve(GA4_MODULE);

  await ga4Service.upsertBuiltinSetting(key, input);

  const builtins = await ga4Service.getBuiltinSettings();
  const builtin = builtins.find((b) => b.builtin_key === key);

  res.status(200).json({ builtin });
}
