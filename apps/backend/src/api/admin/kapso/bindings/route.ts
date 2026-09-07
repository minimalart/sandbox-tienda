import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import type { SaveBindingInput } from './validators';

import { siteFromRequest } from '../../../../lib/multistore/request';


/** `null` = la fila GLOBAL, el fallback de toda tienda sin bindings propios. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

const SETTING_KEY = 'whatsapp_template_bindings';

type Binding = {
  template_name: string;
  language: string;
  params: string[];
  status: 'draft' | 'published';
};

type BindingsMap = Record<string, Binding>;

type StoreConfigService = {
  /**
   * `readSetting` y NO `listStoreSettings({ key })`: con `site_id` en la tabla el
   * listado puede devolver DOS filas —la de la tienda y la global— y quedarse con la
   * primera da un resultado que depende del plan de ejecución.
   */
  readSetting: (key: string, siteId?: string | null) => Promise<{ value: unknown } | undefined>;
  upsertSetting: (key: string, value: unknown, siteId?: string | null) => Promise<unknown>;
};

async function readBindings(
  service: StoreConfigService,
  siteId: string | null,
): Promise<BindingsMap> {
  // `readSetting` y no `listStoreSettings`: con `site_id` en la tabla el listado
  // puede devolver dos filas y quedarse con la primera es indefinido.
  const row = await service.readSetting(SETTING_KEY, siteId);
  const raw = row?.value;
  if (!raw) return {};
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return (parsed && typeof parsed === 'object' ? parsed : {}) as BindingsMap;
}

/** GET /admin/kapso/bindings — devuelve el mapa completo { [eventKey]: Binding }. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<StoreConfigService>(STORE_CONFIG_MODULE);
  const bindings = await readBindings(service, await siteOf(req));
  res.json({ bindings });
}

/**
 * POST /admin/kapso/bindings — crea o actualiza el binding de un evento (merge
 * sobre el mapa existente). Devuelve el mapa actualizado.
 */
export async function POST(
  req: MedusaRequest<SaveBindingInput>,
  res: MedusaResponse,
): Promise<void> {
  const service = req.scope.resolve<StoreConfigService>(STORE_CONFIG_MODULE);
  const { key, template_name, language, params, status } = req.validatedBody;

  const bindings = await readBindings(service, await siteOf(req));
  bindings[key] = { template_name, language, params, status };
  await service.upsertSetting(SETTING_KEY, bindings, await siteOf(req));

  res.status(201).json({ bindings });
}
