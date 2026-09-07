import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { createRegionsWorkflow, updateStoresWorkflow } from '@medusajs/core-flows';
import { ModuleRegistrationName } from '@medusajs/framework/utils';
import { z } from 'zod';
import { STORE_CONFIG_MODULE } from '../../../../../modules/store-config';
import type StoreConfigModuleService from '../../../../../modules/store-config/service';
import { STORE_SETTING_KEYS } from '../../../../../modules/store-config/service';

/**
 * Configuración de comercio de la INSTANCIA: moneda soportada por el Store de Medusa
 * y región del país. No es config por tienda — `provision.ts` crea una región propia
 * para cada tienda; esto toca el Store global.
 *
 * Vivía en site-manager (namespace `commerce`). Al desmantelar esa extensión se mudó
 * acá, a Configuración, que es donde vive el resto de la config de instancia, y pasó
 * a persistir en `store_setting` bajo `commerce_config`.
 */
const ApplySchema = z.object({
  country_code: z.string().length(2).transform((value) => value.toLowerCase()),
  currency_code: z.string().length(3).transform((value) => value.toLowerCase()),
  locale: z.string().min(2).max(12),
  confirmed: z.literal(true),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const input = ApplySchema.parse(req.body);
  const storeService = req.scope.resolve(ModuleRegistrationName.STORE) as any;
  const regionService = req.scope.resolve(ModuleRegistrationName.REGION) as any;
  const [store] = await storeService.listStores({}, { relations: ['supported_currencies'] });
  if (!store) return res.status(409).json({ message: 'Medusa store is not initialized' });
  const supported = (store.supported_currencies ?? []).map((entry: any) => ({
    currency_code: entry.currency_code,
    is_default: entry.is_default,
  }));
  if (!supported.some((entry: any) => entry.currency_code === input.currency_code)) {
    supported.push({ currency_code: input.currency_code, is_default: supported.length === 0 });
    await updateStoresWorkflow(req.scope).run({ input: { selector: { id: store.id }, update: { supported_currencies: supported } } });
  }
  const regions = await regionService.listRegions({}, { relations: ['countries'] });
  const existing = regions.find((region: any) => region.countries?.some((country: any) => country.iso_2 === input.country_code));
  if (!existing) {
    await createRegionsWorkflow(req.scope).run({ input: { regions: [{
      name: input.country_code.toUpperCase(),
      currency_code: input.currency_code,
      countries: [input.country_code],
      payment_providers: ['pp_system_default'],
    }] } });
  }
  const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
  await service.upsertSetting(STORE_SETTING_KEYS.COMMERCE_CONFIG, input);
  return res.status(200).json({ setting: { value: input }, created_region: !existing });
}
