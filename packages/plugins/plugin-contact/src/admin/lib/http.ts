import { siteHeader } from './active-site';

/**
 * El `fetch` compartido del backoffice.
 *
 * Existe porque hay **22 copias casi idénticas** de este helper repartidas por
 * `hooks/api/` (`banners.tsx:69`, `blog.tsx:90`, `delivery.tsx:113`, …). Esos
 * archivos no pasan por el SDK, así que sin consolidarlos el header de tienda
 * llegaría a la mitad del admin y no a la otra — y el operador no tendría forma de
 * notar cuál es cuál.
 *
 * La firma es EXACTAMENTE la de las copias que reemplaza, para que migrar cada hook
 * sea borrar el helper local y agregar un import, sin tocar un solo call site.
 *
 * Diferencias respecto de las copias, ambas deliberadas:
 *  - `credentials: 'include'` siempre. Dos de las 22 lo traían y el resto no; es
 *    correcto en todas y su ausencia rompe las que sí lo necesitan.
 *  - el header de la tienda activa. Sin tienda elegida no se manda nada, así que
 *    esto es un no-op hasta que exista el selector.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...siteHeader(),
      // Los headers del caller ganan: alguno manda `Content-Type` propio para subir
      // archivos, y pisarlo desde acá rompería esos uploads.
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    // Se conserva la semántica de las 22 copias: el mensaje del cuerpo si lo hay,
    // el statusText si no. Perderla cambiaría los toasts de medio admin.
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

/**
 * Headers de tienda sueltos, para las llamadas que NO son JSON (uploads, blobs,
 * descargas de CSV/PDF) y por eso no pueden usar `fetchJson`.
 */
export const siteHeaders = siteHeader;
