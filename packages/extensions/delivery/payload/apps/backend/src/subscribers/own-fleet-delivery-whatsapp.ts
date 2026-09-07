import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import { sendWhatsappOrderNotification } from '../lib/whatsapp/send-order-notification';

/**
 * WhatsApp "en camino" de FLOTA PROPIA. Escucha
 * `delivery.own_fleet_out_for_delivery` ({ order_id, driver_id, vehicle_id }),
 * que emite `transition-delivery-execution` cuando una ejecución own_fleet sale
 * a reparto por primera vez.
 *
 * Resuelve el driver (nombre + teléfono) y el vehículo (tipo, mapeado a etiqueta
 * en español) vía el service del módulo delivery, y manda el template
 * `order-delivery`. Best-effort: si falta driver/vehicle, igual envía con lo que
 * haya (los campos undefined los descarta el builder del template). Cualquier
 * fallo se loguea y nunca se propaga.
 */

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  motorcycle: 'moto',
  van: 'camioneta',
  truck: 'camión',
  car: 'auto',
};

export default async function handleOwnFleetDeliveryWhatsapp({
  event,
  container,
}: SubscriberArgs<{ order_id?: string; driver_id?: string; vehicle_id?: string }>) {
  const orderId = event.data?.order_id;
  const driverId = event.data?.driver_id ?? undefined;
  const vehicleId = event.data?.vehicle_id ?? undefined;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  let driverName: string | undefined;
  let driverPhone: string | undefined;
  if (driverId) {
    try {
      const driver = (await service.retrieveDriver(driverId)) as {
        name?: string | null;
        phone?: string | null;
      };
      driverName = driver?.name ?? undefined;
      driverPhone = driver?.phone ?? undefined;
    } catch (error) {
      logger.warn(
        `[Own-fleet WhatsApp] No se pudo resolver el driver ${driverId} (orden ${orderId}): ${(error as Error).message}`,
      );
    }
  }

  let vehicleType: string | undefined;
  if (vehicleId) {
    try {
      const vehicle = (await service.retrieveVehicle(vehicleId)) as {
        type?: string | null;
      };
      const rawType = vehicle?.type ?? undefined;
      vehicleType = rawType ? VEHICLE_TYPE_LABELS[rawType] ?? rawType : undefined;
    } catch (error) {
      logger.warn(
        `[Own-fleet WhatsApp] No se pudo resolver el vehículo ${vehicleId} (orden ${orderId}): ${(error as Error).message}`,
      );
    }
  }

  await sendWhatsappOrderNotification(container, {
    orderId,
    template: 'order-delivery',
    extraData: {
      driver_name: driverName,
      driver_phone: driverPhone,
      vehicle_type: vehicleType,
    },
  });
}

export const config: SubscriberConfig = {
  event: 'delivery.own_fleet_out_for_delivery',
};
