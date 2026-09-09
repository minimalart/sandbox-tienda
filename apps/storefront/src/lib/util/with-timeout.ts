/**
 * Convierte una promesa colgada en un rechazo acotado.
 *
 * Vivía como función local en `app/sitemap.ts`. Se saca acá porque ahora la necesitan
 * dos consumidores —el sitemap y el fetch de productos para SEO— y porque tener UN
 * dueño evita que se arreglen por separado: el `unref()` de abajo no es cosmético y es
 * exactamente el detalle que se pierde al re-escribirla en el segundo lugar.
 *
 * El mensaje incluye `label` porque el único lugar donde este error se ve es un log de
 * Vercel: sin saber QUÉ se colgó, un timeout no dice nada.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`[${label}] timed out after ${ms}ms`)),
          ms
        );
        // No mantener vivo el proceso por este timer.
        (timer as { unref?: () => void }).unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
