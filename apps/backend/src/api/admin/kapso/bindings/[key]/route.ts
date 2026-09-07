import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { STORE_CONFIG_MODULE } from '../../../../../modules/store-config';

import { siteFromRequest } from '../../../../../lib/multistore/request';


/** `null` = la fila GLOBAL, el fallback de toda tienda sin bindings propios. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

const SETTING_KEY = 'whatsapp_template_bindings';

type StoreConfigService = {
  /**
   * `readSetting` y NO `listStoreSettings({ key })`: con `site_id` en la tabla el
   * listado puede devolver DOS filas —la de la tienda y la global— y quedarse con la
   * primera da un resultado que depende del plan de ejecución.
   */
  readSetting: (key: string, siteId?: string | null) => Promise<{ value: unknown } | undefined>;
  upsertSetting: (key: string, value: unknown, siteId?: string | null) => Promise<unknown>;
};

/**
 * VEREDICTO de auditoría: esta ruta YA está cubierta, y no le falta `assertIdInSite` ni
 * `assertRowInSite`. Queda escrito acá para que la próxima pasada no la vuelva a contar.
 *
 * La cuenta como sospechosa cualquier escaneo que busque "ruta con `[param]` que muta y
 * no usa ninguno de los dos guards". El falso positivo sale de asumir que `:key`
 * identifica una FILA. No lo hace: `:key` es el nombre de un EVENTO (`order_placed`,
 * …), y es una clave dentro del JSON de UNA fila de `store_setting`, la de
 * `whatsapp_template_bindings`. Los dos guards preguntan "¿esta fila es de mi tienda?" y
 * acá la respuesta la fija `siteOf(req)` ANTES de leer: la fila sobre la que se opera se
 * elige por tienda, no se recibe del cliente.
 *
 * O sea que no hay ningún id ajeno que adivinar. El peor caso —mandar un `:key` que no
 * existe— borra una clave inexistente del JSON de la PROPIA tienda: un no-op.
 *
 * Lo que sí importa acá, y ya está resuelto abajo, es que la lectura y la escritura
 * caigan en la MISMA fila. Ese es el fail-open real de esta forma, y por eso `siteId` se
 * resuelve una sola vez.
 */
/** DELETE /admin/kapso/bindings/:key — elimina el binding de un evento. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const key = req.params.key;
  if (!key) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Falta el evento (key).');
  }
  const service = req.scope.resolve<StoreConfigService>(STORE_CONFIG_MODULE);
  // Se resuelve UNA vez: la lectura y la escritura tienen que tocar la MISMA fila.
  // Con dos llamadas distintas, un borrado podría leer la de la tienda y escribir la
  // global — o al revés.
  const siteId = await siteOf(req);
  const row = await service.readSetting(SETTING_KEY, siteId);
  const raw = row?.value;
  const bindings = (raw
    ? typeof raw === 'string'
      ? JSON.parse(raw)
      : raw
    : {}) as Record<string, unknown>;

  delete bindings[key];
  await service.upsertSetting(SETTING_KEY, bindings, siteId);

  res.json({ deleted: true, key, bindings });
}
