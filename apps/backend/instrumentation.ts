import * as Sentry from '@sentry/node';
import { startMemoryMonitor } from './src/lib/heap-snapshot';

/**
 * Medusa importa este archivo del root del backend y ejecuta `register()` al
 * arrancar (ver @medusajs/medusa/commands/start). Lo usamos para inicializar
 * Sentry de forma OPCIONAL: si `SENTRY_DSN` no está seteado, no se inicializa
 * nada y el servidor arranca igual. Mismo patrón que Vimeo/Stripe en
 * medusa-config.ts — la integración se activa por entorno y nunca rompe el build.
 *
 * Captura básica: excepciones no atrapadas y promesas rechazadas (integraciones
 * por defecto de @sentry/node). No envía PII por defecto.
 */
export function register() {
  // El MCP (ruta /mcp) y el Asistente IA llaman la Admin API leyendo
  // `MEDUSA_BASE_URL`. Para no duplicar config, si no está seteada usamos
  // `BACKEND_URL` (la URL pública del backend, ya configurada para Vimeo).
  if (!process.env.MEDUSA_BASE_URL && process.env.BACKEND_URL) {
    process.env.MEDUSA_BASE_URL = process.env.BACKEND_URL;
  }

  // Memory diagnostics (no-op unless MEMORY_MONITOR=true). Started here because
  // register() runs once at boot, before the HTTP server. Temporary — remove
  // once the OOM leak is found.
  startMemoryMonitor();

  const dsn = process.env.SENTRY_DSN;
  // Kill-switch explícito: en local/develop seteá SENTRY_ENABLED=false para no
  // enviar nada aunque el DSN esté presente. Default: activo si hay DSN.
  const enabled = process.env.SENTRY_ENABLED !== 'false';

  // Sin DSN o desactivado -> Sentry off. El backend arranca normal.
  if (!dsn || !enabled) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE,
    // No mandar datos personales (IP, cookies, headers, body) salvo opt-in explícito.
    sendDefaultPii: false,
    // Performance tracing apagado por defecto (0). Subir por entorno si se necesita.
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0,
  });
}
