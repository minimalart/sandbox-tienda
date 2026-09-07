import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
  type MiddlewareRoute,
} from '@medusajs/framework/http';
import { z } from 'zod';
import {
  StoreDriverActionSchema,
  StoreDriverUploadSchema,
} from './driver/validators';

/**
 * Tracking unificado: endpoint PÚBLICO (igual que el legacy
 * /store/andreani/tracking). El tracking_number ya es un secreto suficiente; no
 * exigimos sesión de customer para que el storefront pueda mostrar el timeline
 * en la página de seguimiento sin login.
 *
 * No hay query params funcionales; declaramos un schema vacío solo para enganchar
 * validateAndTransformQuery y mantener la convención de los demás endpoints store.
 * La validación del param :tracking_number se hace en la route (mismo regex que
 * el validator, para conservar el shape de error 400 del endpoint legacy).
 */
export const storeDeliveryMiddlewares: MiddlewareRoute[] = [
  {
    method: ['GET'],
    matcher: '/store/delivery/tracking/:tracking_number',
    middlewares: [validateAndTransformQuery(z.object({}), {})],
  },
  // --- PWA flota propia: rutas del repartidor ---
  //
  // DECISIÓN DE AUTH: el repartidor se autentica con su admin User de Medusa
  // (authenticate('user', ...)). El repo NO tiene un actor type propio para
  // drivers; el patrón más cercano y soportado es reusar el User module (mismo
  // que usa el panel admin), vinculado al Driver vía el link driver-user. Por eso
  // estas rutas viven bajo /store/* (no requieren rol de admin) pero exigen un
  // token/sesión de 'user'. La resolución driver↔user y la validación de
  // ownership se hacen en resolve-driver.ts + el workflow.
  // TODO(M3+): si se quiere un actor type 'driver' dedicado (auth provider
  // propio para la PWA), migrar acá a authenticate('driver', ...) y registrar el
  // provider. Por ahora 'user' es la opción más cercana al repo.
  {
    method: ['GET'],
    matcher: '/store/delivery/driver/me/stops',
    middlewares: [authenticate('user', ['bearer', 'session'])],
  },
  {
    method: ['POST'],
    matcher: '/store/delivery/driver/executions/:id/action',
    middlewares: [
      authenticate('user', ['bearer', 'session']),
      validateAndTransformBody(StoreDriverActionSchema),
    ],
  },
  // --- Upload de evidencia de entrega (M5) ---
  {
    method: ['POST'],
    matcher: '/store/delivery/driver/uploads',
    middlewares: [
      authenticate('user', ['bearer', 'session']),
      validateAndTransformBody(StoreDriverUploadSchema),
    ],
  },
];
