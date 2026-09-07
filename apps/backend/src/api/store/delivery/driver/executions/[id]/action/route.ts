import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import driverDeliveryActionWorkflow from '../../../../../../../workflows/driver-delivery-action';
import { resolveDriverFromAuth } from '../../../resolve-driver';
import type { StoreDriverActionType } from '../../../validators';

// POST /store/delivery/driver/executions/:id/action — el repartidor ejecuta una
// acción (pickup | in_transit | delivered | failed_attempt) sobre una ejecución
// asignada. Resuelve el driver desde el user autenticado y corre el workflow
// driver-delivery-action, que valida ownership (la ejecución debe estar asignada
// a este driver) y transiciona el estado (proyectando a Medusa en los hitos).
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const id = req.params.id as string;
  const body = req.validatedBody as StoreDriverActionType;

  // Ownership de primer nivel: resolvemos el driver del user. El workflow valida
  // además que ESTA ejecución esté asignada a ese driver.
  const driver = await resolveDriverFromAuth(req);
  const driverId = String(driver.id);

  const { result } = await driverDeliveryActionWorkflow(req.scope).run({
    input: {
      execution_id: id,
      action: body.action,
      driver_id: driverId,
      location: body.location,
      note: body.note,
      proof: body.proof,
    },
  });

  res.status(200).json({ action: result });
}
