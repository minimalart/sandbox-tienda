'use client'

/**
 * En qué orden se cotizan las cards del paso 2 del buscador de color.
 *
 * Las cotizaciones se piden de a UNA, en el orden en que se pidieron. Cada una es
 * una llamada al ERP de hasta 6s con caché por (artículo, fórmula), y el endpoint
 * tiene rate limit de 40 por minuto por IP: en paralelo el navegador abriría 6 y
 * todas tardarían lo que la más lenta.
 *
 * Antes las cards cotizaban solas al entrar al viewport (había acá un
 * `useSeenOnce` para eso) y era la causa del 429: un color con 45 productos —el
 * caso normal, no el extremo— se cotizaba entero de scroll, y la pantalla
 * terminaba con "Demasiadas consultas de color" en todas las cards. Ahora cotiza
 * sólo el producto que el cliente elige, así que la cola casi nunca tiene más de
 * un elemento; sigue existiendo para el cliente que clickea tres cards seguidas.
 */

/** Última cotización encolada. La cola es del módulo: la comparten todas las cards. */
let tail: Promise<unknown> = Promise.resolve()

/**
 * Encola una cotización detrás de las que ya estaban. Devuelve la promesa de ESTA
 * tarea, así que quien la encola ve su propio resultado (y su propio error).
 *
 * La cola nunca se corta: `tail` se sigue con los errores ya absorbidos, si no una
 * cotización fallada dejaría a las siguientes esperando un rechazo para siempre.
 */
export function enqueueQuote<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task)
  tail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
