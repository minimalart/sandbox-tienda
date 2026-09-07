// Hook de instrumentación del servidor (Next.js). Carga la config de Sentry
// según el runtime y reporta errores de RSC / route handlers vía onRequestError.
// Las configs internas no hacen nada si NEXT_PUBLIC_SENTRY_DSN no está seteado.
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Captura errores lanzados durante el renderizado en servidor (nested RSC, etc.).
export const onRequestError = Sentry.captureRequestError
