import { MedusaService } from '@medusajs/framework/utils';
import { AndreaniBox } from './models';

/**
 * Servicio del módulo andreani-data. Expone el CRUD autogenerado de
 * AndreaniBox: listAndreaniBoxes / retrieveAndreaniBox / createAndreaniBoxes /
 * updateAndreaniBoxes / deleteAndreaniBoxes.
 */
class AndreaniDataModuleService extends MedusaService({
  AndreaniBox,
}) {}

export default AndreaniDataModuleService;
