// Config de Sentry para el runtime Edge (middleware y rutas con runtime = 'edge').
// Se importa desde instrumentation.ts. Si no hay DSN, init() no hace nada.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
// Kill-switch: NEXT_PUBLIC_SENTRY_ENABLED=false apaga el envío en local/develop.
const enabled = process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'false'

if (dsn && enabled) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    sendDefaultPii: false,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0,
  })
}
