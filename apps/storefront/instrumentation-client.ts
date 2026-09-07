// Config de Sentry para el browser (Next 15.3+ usa instrumentation-client.ts).
// Si no hay DSN, init() no hace nada y el cliente funciona normal.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
// Kill-switch: NEXT_PUBLIC_SENTRY_ENABLED=false apaga el envío en local/develop.
const enabled = process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'false'

if (dsn && enabled) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    // No enviar datos personales por defecto.
    sendDefaultPii: false,
    // Session Replay NO se habilita: captura el DOM y puede filtrar datos del usuario.
    tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
      ? Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)
      : 0,
  })
}

// Instrumenta las navegaciones del App Router para Sentry.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
