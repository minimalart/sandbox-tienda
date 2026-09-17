import { MedusaService } from '@medusajs/framework/utils';
import { Bundle, BundleItem } from './models';

/**
 * BundleModuleService — CRUD del Bundle y sus items. Deliberadamente sin
 * lógica de precios, variants, cart o scoping por Store: eso vive en Medusa
 * o en el link `bundle_demo_store`. Este servicio expone `MedusaService`
 * autogenerado (list/retrieve/create/update/delete por entidad) más helpers
 * puntuales que se agreguen en F1.
 */
class BundleModuleService extends MedusaService({
  Bundle,
  BundleItem,
}) {}

export default BundleModuleService;
