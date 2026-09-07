import { getAppSettingsSyncReader } from '@minimalart/mercatto-plugin-runtime';
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { PAYMENT_BENEFITS_MODULE } from '../../../../../modules/payment-benefits';
import type PaymentBenefitsModuleService from '../../../../../modules/payment-benefits/service';
import { getProvider } from '../../../../../modules/payment-benefits/providers';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { UNKNOWN_SITE_ERROR_CODE } from '../../../../../lib/multistore/types';

/**
 * POR QUÉ ACÁ NO VA `assertIdInSite` NI `assertRowInSite`, y qué se puso en su lugar.
 *
 * `:provider` NO es una PK: es un código de adapter que vive en CÓDIGO —`getProvider`
 * lo busca en el objeto `PROVIDERS` de `modules/payment-benefits/providers/index.ts`,
 * que hoy tiene dos claves fijas, `mercadopago` y `manual`—. No hay fila que chequear,
 * así que un guard por id acá sería un guard sobre la tabla equivocada: aparecería en
 * el diff, la revisión lo daría por cerrado y el agujero seguiría abierto. Es el mismo
 * caso que `admin/ga4-builtins/[key]`.
 *
 * El agujero real está más abajo y ya está documentado, en la franja de
 * `admin/routes/payment-benefits/settings/page.tsx`: esta corrida usa las credenciales
 * de la INSTANCIA (`process.env.MERCADOPAGO_ACCESS_TOKEN`) y escribe el catálogo
 * GLOBAL, porque `upsertCatalogMethod` resuelve la fila por `(provider_code,
 * external_id)` SIN `site_id` y la crea sin él —el modelo tiene la columna y hasta dos
 * índices únicos parciales para distinguir global de propia, pero el upsert no la
 * usa—. Lo mismo `upsertSyncedBenefit`, que crea el beneficio con
 * `sales_channel_ids: []`, o sea visible en todas. Cerrarlo de verdad es que el sync
 * tome las credenciales por tienda (`site_credential` ya existe) y que esos dos upserts
 * reciban el `site_id`: ninguna de las dos cosas se arregla en esta ruta.
 *
 * Lo que SÍ se puede aplicar acá es el eje sobre QUIÉN dispara una escritura que es de
 * todos. Con una tienda secundaria activa, este botón le pisa a las demás el catálogo
 * que leen —con la cuenta de MP de la instancia, que no es la suya— y encima lo hace
 * debajo de un badge que dice "esto es de tu tienda". Fail-closed: se permite desde la
 * vista de instancia y desde la principal, que es de quien es la fila global por
 * historia (mismo argumento que `inherit-global-for-main` en `scope.ts`).
 */
async function assertMayRunInstanceSync(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<boolean> {
  const resolution = await siteFromRequest(req);

  // Un id de tienda stale rompe, no degrada: mismo criterio y mismo código que
  // `lib/multistore/scope.ts:86` y que `app-settings`, para que el admin sepa limpiar
  // la tienda que tiene persistida y volver a elegir.
  if (resolution.status === 'unknownSite') {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${UNKNOWN_SITE_ERROR_CODE}: la tienda solicitada no existe o fue eliminada.`
    );
  }

  // `singleSite`, `allSites` y `registryAbsent` pasan: no hay otra tienda a la que
  // pisarle nada, o quien pide está mirando la instancia entera y sabe qué toca.
  if (resolution.status !== 'site' || resolution.site.is_main) return true;

  // 403 y no 404, al revés que los guards por id: acá no hay existencia que ocultar
  // —los códigos de proveedor están en el código, no en la base—, y un 404 diría
  // "no existe" sobre algo que sí existe. Lo que corresponde decir es POR QUÉ no.
  res.status(403).json({
    message:
      'La sincronización de proveedores es de la instancia: usa las credenciales de ' +
      'entorno y escribe el catálogo global que leen todas las tiendas. Ejecutala desde ' +
      'la tienda principal o sin tienda activa.',
  });
  return false;
}

/** Dispara la sincronización de un proveedor (PRD §13: POST /sync/provider/{id}). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  if (!(await assertMayRunInstanceSync(req, res))) return;

  const code = req.params.provider as string;
  const provider = getProvider(code);
  if (!provider) {
    res.status(404).json({ message: `Proveedor desconocido: ${code}` });
    return;
  }
  if (!provider.supportsSync) {
    res.status(400).json({ message: `El proveedor ${code} no soporta sincronización.` });
    return;
  }

  const service = req.scope.resolve<PaymentBenefitsModuleService>(PAYMENT_BENEFITS_MODULE);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  const result = await provider.sync({
    service,
    accessToken:
      (getAppSettingsSyncReader()?.('extension:mercadopago', 'MERCADOPAGO_ACCESS_TOKEN') as
        | string
        | undefined) || process.env.MERCADOPAGO_ACCESS_TOKEN,
    logger,
  });

  res.status(result.status === 'ok' ? 200 : 502).json({ result });
}
