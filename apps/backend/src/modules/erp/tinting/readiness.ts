import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type ErpModuleService from '../service';
import type { TintingBaseRow } from '../service';
import { countSellableBases, type SellableBasesGraph } from './sellable-bases';

/**
 * El readiness del tintométrico COMPLETO: los conteos de data maestra más la
 * única pregunta que faltaba, "¿alguna de esas bases se puede comprar?".
 *
 * `getTintingReadiness` vive en el service y cuenta filas; no puede resolver
 * esto solo porque los productos son de otro módulo. Por eso la parte que
 * necesita el contenedor se arma acá y las rutas llaman a esta función en vez
 * de al service directamente: si alguna vuelve al service, vuelve a publicar un
 * `ready: true` que no significa nada.
 */

export type TintingReadinessCounts = {
  colors: number;
  bases: number;
  bases_confirmed: number;
  formulas: number;
  ready: boolean;
};

export type TintingReadiness = TintingReadinessCounts & {
  /** Bases confirmadas que tienen una variante de un producto publicado. */
  bases_sellable: number;
};

/**
 * `ready` exige AHORA que haya al menos una base vendible.
 *
 * Antes alcanzaba con colores + fórmulas + una base confirmada, y esas tres
 * cosas se cargan por import: una instalación podía tener la data maestra
 * entera y ni un solo producto entonable en la tienda. Es el estado en el que
 * estuvo desdeelsur —117 bases confirmadas, 0 artículos en Medusa— informando
 * que estaba listo mientras las dos entradas al tintométrico devolvían vacío.
 */
export async function resolveTintingReadiness(
  container: MedusaContainer,
  service: ErpModuleService
): Promise<TintingReadiness> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  // `bind` y no `query.graph` suelto: pasarlo desnudo le saca el `this` y la
  // consulta explota recién en runtime.
  const graph = query.graph.bind(query) as unknown as SellableBasesGraph;

  const counts = (await service.getTintingReadiness()) as TintingReadinessCounts;

  const confirmed = (await service.listErpTintingBases(
    { active: true, confirmed: true },
    { take: null }
  )) as unknown as TintingBaseRow[];

  const basesSellable = await countSellableBases(
    graph,
    confirmed.map((base) => base.article_code)
  );

  return {
    ...counts,
    bases_sellable: basesSellable,
    ready: counts.ready && basesSellable > 0,
  };
}
