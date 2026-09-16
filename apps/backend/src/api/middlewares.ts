import { defineMiddlewares } from '@medusajs/medusa';
import {
  errorHandler,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import type { MiddlewareRoute } from '@medusajs/framework/http';
import * as Sentry from '@sentry/node';
import { extensionMiddlewares } from './extension-middlewares';
import { storeAuthMiddlewares } from './store/auth/middlewares';
import { productExportMiddlewares } from './product-export-middlewares';
import { multistoreMiddlewares } from './multistore-middlewares';
import { apiKeyRbacMiddlewares } from './api-key-rbac-middlewares';
import { setPricingChannel } from './store/utils/set-pricing-channel';

// Handler de errores por defecto de Medusa. Lo envolvemos para reportar a Sentry
// y luego delegamos en él para conservar el formato de respuesta estándar.
// Patrón oficial: https://docs.medusajs.com/resources/integrations/guides/sentry
const defaultErrorHandler = errorHandler();

// Errores ESPERABLES del cliente (4xx): validación, no encontrado, auth, pago
// rechazado. No son bugs — reportarlos solo ensucia Sentry y gasta cuota (free
// tier). Solo reportamos lo inesperado (5xx, DB, estado inválido) y lo no tipado.
const CLIENT_ERROR_TYPES = new Set<string>([
  MedusaError.Types.DUPLICATE_ERROR,
  MedusaError.Types.INVALID_ARGUMENT,
  MedusaError.Types.INVALID_DATA,
  MedusaError.Types.UNAUTHORIZED,
  MedusaError.Types.FORBIDDEN,
  MedusaError.Types.NOT_FOUND,
  MedusaError.Types.NOT_ALLOWED,
  MedusaError.Types.CONFLICT,
  MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
  MedusaError.Types.PAYMENT_REQUIRES_MORE_ERROR,
]);

function shouldReport(error: unknown): boolean {
  if (MedusaError.isMedusaError(error)) {
    return !CLIENT_ERROR_TYPES.has(error.type);
  }
  // Errores no tipados / inesperados -> siempre reportar.
  return true;
}

// Memory diagnostics (no-op unless MEMORY_MONITOR=true): logs one line per
// request with duration + heap delta so we can correlate heap growth with a
// specific endpoint. Hooks res 'finish' so it measures the real response.
// Temporary — remove once the OOM leak is found.
const MB = 1024 * 1024;
const memoryRequestLogger = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void => {
  if (process.env.MEMORY_MONITOR !== 'true') {
    return next();
  }
  const start = Date.now();
  const startHeap = process.memoryUsage().heapUsed;
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const heap = process.memoryUsage();
    const deltaMb = Math.round((heap.heapUsed - startHeap) / MB);
    const heapMb = Math.round(heap.heapUsed / MB);
    const line = `[mem-req] ${req.method} ${req.path} ${res.statusCode} ${durationMs}ms Δheap=${deltaMb}MB heapUsed=${heapMb}MB`;
    try {
      req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER).info(line);
    } catch {
      console.warn(line);
    }
  });
  return next();
};

// Matchers for store endpoints where we need to inject sales_channel_id into
// pricingContext. These run after Medusa's core setPricingContext middleware
// which sets region_id / currency_code. Fail-open: if channel cannot be
// resolved the base price is used as fallback. Related ticket: EDUCABOT-9
const pricingChannelMiddlewares: MiddlewareRoute[] = [
  { matcher: '/store/products', method: 'GET', middlewares: [setPricingChannel()] },
  { matcher: '/store/products/:id', method: 'GET', middlewares: [setPricingChannel()] },
  { matcher: '/store/carts/:id/line-items', method: 'POST', middlewares: [setPricingChannel()] },
  { matcher: '/store/carts/:id/line-items/:line_id', method: ['POST', 'DELETE'], middlewares: [setPricingChannel()] },
  { matcher: '/store/carts/:id', method: 'POST', middlewares: [setPricingChannel()] },
];

export default defineMiddlewares({
  routes: [
    { matcher: '/*', middlewares: [memoryRequestLogger] },
    ...apiKeyRbacMiddlewares,
    ...multistoreMiddlewares,
    ...productExportMiddlewares,
    ...extensionMiddlewares,
    ...storeAuthMiddlewares,
    ...pricingChannelMiddlewares,
  ],
  // Captura de errores HTTP en Sentry, acotada a 5xx para no inundar la cuota.
  // Sentry.isInitialized() es false sin DSN o con SENTRY_ENABLED=false -> no-op.
  errorHandler: (
    error: MedusaError | Error,
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    if (Sentry.isInitialized() && shouldReport(error)) {
      Sentry.captureException(error);
    }
    return defaultErrorHandler(error, req, res, next);
  },
});
