import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { MedusaError } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import {
  BRANCH_COVERAGE_SITE_SCOPE,
  STORE_LOCATION_SITE_SCOPE,
} from '../../../../../../modules/store-location/site-scope';
import { STORE_LOCATION_MODULE } from '../../../../../../modules/store-location';
import type StoreLocationModuleService from '../../../../../../modules/store-location/service';
import { PostAdminUpdateCoverage } from '../../../validators';

/**
 * Los DOS ids, y no sólo el del padre.
 *
 * La ruta hermana `coverage/route.ts` guarda únicamente `:id` y se explica: "guardarlo
 * alcanza, esta ruta no es alcanzable por otra vía". Es cierto ALLÁ —el GET lista por
 * `store_location_id` y el POST crea con el `:id` del path—, y es falso ACÁ: el service
 * resuelve por `:coverageId` e IGNORA el `:id`. O sea que el padre del path es
 * decorativo: con una sucursal propia en `:id` y una cobertura ajena en `:coverageId`,
 * el guard del padre pasa y la escritura cruzada entra igual.
 *
 * Por eso van los dos. El del padre porque es el que dicta el ancestro y mantiene el
 * 404 coherente con la pantalla; el de la cobertura porque es el id que de verdad elige
 * la fila que se muta. `assertIdInSite` y no `assertRowInSite` para la cobertura porque
 * `via_parent` es una de las dos formas en las que el de fila hace `return` sin
 * chequear: la tienda no está en `branch_coverage`, está en `store_location`.
 */
async function assertCoverageInSite(req: MedusaRequest): Promise<void> {
  const resolution = await siteFromRequest(req);
  await assertIdInSite(req.scope, resolution, STORE_LOCATION_SITE_SCOPE, req.params.id as string);
  await assertIdInSite(req.scope, resolution, BRANCH_COVERAGE_SITE_SCOPE, req.params.coverageId as string);

  /*
    Los dos guards de arriba cubren la TIENDA; esto cubre la PERTENENCIA, y son ejes
    distintos. Con DOS sucursales de la MISMA tienda, el `:coverageId` de la sucursal
    A pasa los dos guards bajo el `:id` de la sucursal B: ambas filas son de mi
    tienda, así que ningún chequeo de tienda las puede separar.

    La objeción ya estaba escrita en este repo, en
    `brands/[brand_id]/images/[image_id]`, donde se evaluó y se descartó el mismo
    descriptor `via_parent` con estas palabras: "no cubre igual, porque seguiría
    aceptando una imagen de otra marca propia bajo un `brand_id` que no es el suyo".
    Es literalmente este caso, con otra tabla.

    404 y no 403, igual que los guards: un 403 confirmaría que esa cobertura existe.
  */
  const service = req.scope.resolve<StoreLocationModuleService>(STORE_LOCATION_MODULE);
  const coverage = await service
    .retrieveBranchCoverage(req.params.coverageId as string)
    .catch(() => null);

  if (!coverage || (coverage as { store_location_id?: string }).store_location_id !== req.params.id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');
  }
}

/**
 * POST /admin/store-locations/:id/coverage/:coverageId — partial update.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Fuera del `try`, que traduce todo a 400: adentro, el 404 del guard se serviría como
  // "Error updating coverage" y volvería a distinguir el id que existe del que no.
  await assertCoverageInSite(req);

  try {
    const validated = PostAdminUpdateCoverage.parse(req.body);
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);

    const { polygon, ...rest } = validated;
    const coverage = await service.updateBranchCoverages({
      id: req.params.coverageId as string,
      ...rest,
      ...(polygon !== undefined
        ? { polygon: polygon as unknown as Record<string, unknown> }
        : {}),
    });

    return res.status(200).json({ coverage });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error updating coverage';
    console.error('[Admin StoreLocations] Error updating coverage:', message);
    return res.status(400).json({ message });
  }
}

/**
 * DELETE /admin/store-locations/:id/coverage/:coverageId — soft delete.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  // El guard va en TODOS los verbos, no sólo en el primero. Y acá el efecto es el peor
  // del recurso: borrar el polígono de otra tienda deja su zona de entrega sin cubrir,
  // así que el checkout empieza a rechazar direcciones que ayer aceptaba.
  await assertCoverageInSite(req);

  try {
    const service: StoreLocationModuleService = req.scope.resolve(STORE_LOCATION_MODULE);
    const coverageId = req.params.coverageId as string;
    await service.softDeleteBranchCoverages(coverageId);
    return res.status(200).json({ id: coverageId, object: 'branch_coverage', deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error deleting coverage';
    console.error('[Admin StoreLocations] Error deleting coverage:', message);
    return res.status(400).json({ message });
  }
}
