import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ModuleRegistrationName } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../../../../lib/multistore/request';

/**
 * GET /admin/store-config/commerce/context — contra qué región, moneda y canales de
 * venta opera la tienda seleccionada. SÓLO LECTURA.
 *
 * ─── POR QUÉ ESTA RUTA EXISTE ────────────────────────────────────────────────
 *
 * La pestaña "Comercio" configura el Store y las Regions de Medusa, que son GLOBALES:
 * un país pertenece a UNA sola región (`modules/demo-store/provision.ts:183-189`), así
 * que no hay ni puede haber una región por tienda. Por eso `commerce/apply` toca el
 * Store global y la pestaña se declara `instance` en `admin/lib/site-scope.ts`.
 *
 * Pero "esta pantalla no filtra" no es lo mismo que "esta pantalla no tiene nada que
 * decir sobre tu tienda". El operador que abre Comercio con la tienda Norte elegida
 * necesita saber que Norte cotiza en la región AR/ARS y vende por el canal X — si no,
 * la única lectura posible del cartel de instancia es "esto no me incumbe", y sí le
 * incumbe: lo que se aplique acá le cambia la moneda.
 *
 * El eje real del aislamiento es el SALES CHANNEL, no la región
 * (`admin/multistore/manifest` lo publica como `axis`). Por eso los canales se
 * devuelven con nombre y no sólo con id.
 */

type CommerceContext = {
  /** `null` = no hay tienda elegida: se describe el default del Store. */
  site: { id: string; name: string; is_main: boolean } | null;
  region: { id: string; name: string; currency_code: string; countries: string[] } | null;
  channels: { id: string; name: string }[];
};

const regionOf = async (container: any, regionId: string | null) => {
  if (!regionId) return null;
  const regionService: any = container.resolve(ModuleRegistrationName.REGION);
  // `relations: ['countries']` explícito: sin pedirla, `iso_2` no viene. Mismo motivo
  // que documenta `modules/demo-store/main-store.ts:87`.
  const [region] = await regionService.listRegions(
    { id: regionId },
    { take: 1, relations: ['countries'] },
  );
  if (!region) return null;
  return {
    id: region.id as string,
    name: (region.name ?? region.id) as string,
    currency_code: (region.currency_code ?? '') as string,
    countries: ((region.countries ?? []) as { iso_2?: string }[])
      .map((country) => country.iso_2)
      .filter(Boolean) as string[],
  };
};

const channelsOf = async (container: any, ids: string[]) => {
  if (ids.length === 0) return [];
  const channelService: any = container.resolve(ModuleRegistrationName.SALES_CHANNEL);
  const channels = await channelService.listSalesChannels({ id: ids });
  return ((channels ?? []) as { id: string; name?: string }[]).map((channel) => ({
    id: channel.id,
    name: channel.name ?? channel.id,
  }));
};

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const resolution = await siteFromRequest(req);
    const container = req.scope;

    if (resolution.status === 'site') {
      const { site } = resolution;
      const [region, channels] = await Promise.all([
        regionOf(container, site.region_id),
        channelsOf(container, site.channel_ids),
      ]);
      const body: CommerceContext = {
        site: { id: site.id, name: site.name, is_main: site.is_main },
        region,
        channels,
      };
      return res.status(200).json(body);
    }

    // Sin tienda elegida se describe el default del Store, que es lo que la pestaña
    // edita. Se lee con el servicio de módulo y no con `query.graph({ fields })` por
    // la razón de `main-store.ts:70-77`: un campo mal escrito ahí vuelve `undefined`
    // en silencio y no se distingue de un store que de verdad no lo tiene.
    const storeService: any = container.resolve(ModuleRegistrationName.STORE);
    const [store] = await storeService.listStores({}, { take: 1 });
    const [region, channels] = await Promise.all([
      regionOf(container, store?.default_region_id ?? null),
      channelsOf(container, [store?.default_sales_channel_id].filter(Boolean) as string[]),
    ]);
    const body: CommerceContext = { site: null, region, channels };
    return res.status(200).json(body);
  } catch (error) {
    console.error('[Admin Commerce] Error leyendo el contexto de comercio:', error);
    return res.status(500).json({ message: 'Error leyendo el contexto de comercio' });
  }
}
