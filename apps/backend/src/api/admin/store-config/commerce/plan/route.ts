import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ModuleRegistrationName } from '@medusajs/framework/utils';
import { z } from 'zod';

export const CommerceSchema = z.object({
  country_code: z.string().length(2).transform((value) => value.toLowerCase()),
  currency_code: z.string().length(3).transform((value) => value.toLowerCase()),
  locale: z.string().min(2).max(12),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const input = CommerceSchema.parse(req.body);
  const storeService = req.scope.resolve(ModuleRegistrationName.STORE) as any;
  const regionService = req.scope.resolve(ModuleRegistrationName.REGION) as any;
  const [stores, regions] = await Promise.all([storeService.listStores(), regionService.listRegions({}, { relations: ['countries'] })]);
  const store = stores[0];
  const existingCurrency = store?.supported_currencies?.some((entry: any) => entry.currency_code === input.currency_code);
  const existingRegion = regions.find((region: any) => region.countries?.some((country: any) => country.iso_2 === input.country_code));
  return res.status(200).json({
    input,
    operations: [
      ...(existingCurrency ? [] : [{ type: 'add_store_currency', currency_code: input.currency_code }]),
      ...(existingRegion ? [] : [{ type: 'create_region', country_code: input.country_code, currency_code: input.currency_code }]),
      { type: 'save_site_configuration', locale: input.locale },
    ],
    safeguards: ['No regions, currencies or prices will be removed.', 'Existing prices are never converted automatically.'],
  });
}

