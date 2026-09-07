/**
 * Limitador de concurrencia mínimo (sin dependencias). Reemplaza a p-limit para
 * no introducir una dep ESM-only que rompe el CJS transpilado del backend
 * (ver memoria: "Dep ESM en el backend va con import() oculto"). Procesa `items`
 * con hasta `limit` tareas en paralelo, preservando el orden de resultados.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const size = Math.max(1, Math.min(limit, items.length || 1));

  async function run(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i] as T, i);
    }
  }

  await Promise.all(Array.from({ length: size }, () => run()));
  return results;
}

/** fetch con timeout por request (patrón withTimeout del sitemap del storefront). */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
