import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchJson } from '../lib/http';

/**
 * En qué instalación estamos, resuelto en RUNTIME desde el propio backend.
 *
 * ── Por qué no sale del build ────────────────────────────────────────────────────
 *
 * Misma razón que `use-storefront-base.ts`, y conviene repetirla porque acá el fallo
 * sería peor: el bundle del admin se compila como template y el Dockerfile de
 * despliegue no recibe build args `VITE_*`, así que cualquier `import.meta.env` llega
 * vacía en producción y el código cae al literal del template — o sea el logo y el
 * nombre de OTRA marca en el admin del cliente. Un link roto se reporta; un logo
 * ajeno que se ve bien, no.
 *
 * ── Por qué esta ruta y no la que ya consume el storefront ───────────────────────
 *
 * La marca es la misma que sirve `/store/sites/main/config`, pero Medusa exige
 * publishable key en TODO `/store` y el login todavía no tiene ninguna. Ver el
 * comentario largo de `src/api/instance-branding/route.ts`.
 *
 * `color` e `initial` vienen RESUELTOS del servidor a propósito: son los mismos que
 * usa el favicon generado, y resolverlos acá también sería la segunda implementación.
 */
export type InstanceBranding = {
  name: string | null;
  logo: string | null;
  icon: string | null;
  favicon: string | null;
  /** Siempre presente: el servidor aplica el fallback. */
  color: string;
  /** La inicial del nombre, ya en mayúscula. */
  initial: string;
};

export const INSTANCE_BRANDING_QUERY_KEY = ['instance-branding'] as const;

export function useInstanceBranding(): InstanceBranding | undefined {
  const { data } = useQuery({
    queryKey: INSTANCE_BRANDING_QUERY_KEY,
    queryFn: () => fetchJson<InstanceBranding>('/instance-branding'),
    // Marca editable desde el admin, pero no en el medio de una sesión: alcanza con
    // releerla al montar. El `Cache-Control: max-age=60` de la ruta hace el resto.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return data;
}

/**
 * Pone el favicon de la instalación en la pestaña del admin.
 *
 * De fábrica no hay ninguno: `admin-bundler` escribe
 * `<link rel="icon" href="data:," data-placeholder-favicon />`, y ese `data:,` PISA
 * al `/favicon.ico` implícito. O sea que diez Medusa abiertos son diez pestañas en
 * blanco idénticas. Alcanza con reapuntar ese `<link>`.
 *
 * Apunta a `/favicon.ico` y NO al asset directo aunque el hook ya tenga la URL: la
 * prioridad (favicon explícito -> isotipo -> generado) la decide esa ruta, que es
 * también la que consume el conector MCP. Resolverla acá sería la segunda copia.
 *
 * Toca el DOM directo en vez de renderizar un `<Helmet>`: el shell ya monta uno
 * (`hooks/use-document-title.tsx`) y meter una segunda instancia de
 * `react-helmet-async` desde una extensión pide sumarla al `dedupe` de
 * `medusa-config.ts` — el mismo trámite que ya costó react-query e i18next. El
 * `<link>` no lo maneja Helmet, así que asignarle el `href` no compite con nadie.
 */
export function useInstanceFavicon(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    // Sin `type`: `/favicon.ico` puede redirigir a un png, un webp o un svg según lo
    // que haya cargado la marca, y declarar un tipo que no es hace que no cargue.
    link.removeAttribute('type');
    link.href = '/favicon.ico';
  }, []);
}

/**
 * Prefija el título de la pestaña con el nombre de la instalación:
 * `"Zeus · Pedidos - Medusa"`.
 *
 * PREFIJO Y NO SUFIJO porque con muchas pestañas abiertas el navegador recorta por el
 * final, y el dato que distingue tiene que sobrevivir al recorte. El resto del título
 * se deja intacto — no se le saca el " - Medusa".
 *
 * ── Por qué un MutationObserver ──────────────────────────────────────────────────
 *
 * El título lo maneja el shell con react-helmet-async
 * (`hooks/use-document-title.tsx`), que lo REESCRIBE en cada navegación a partir del
 * `handle` de la ruta. Escribirlo una vez al montar dura hasta el primer click. Y no
 * hay forma de ganarle desde una extensión sin montar un segundo Helmet, que exige
 * sumar `react-helmet-async` al `dedupe` de `medusa-config.ts` (el trámite que ya
 * costó react-query e i18next, y que si sale mal deja el admin con dos instancias).
 * El observer es más chico y no toca la config del build.
 *
 * No entra en bucle: al reescribir el título el observer se dispara de nuevo, pero ya
 * empieza con el prefijo y la función no hace nada.
 *
 * Límite conocido y asumido: si el nombre de la instalación CAMBIARA con la pestaña
 * abierta, quedaría el prefijo viejo adentro del nuevo. No pasa — es el nombre del
 * Store, y cambiarlo es un acto deliberado que además recarga el admin.
 */
export function useInstanceTitle(name: string | null | undefined): void {
  useEffect(() => {
    const prefix = (name ?? '').trim();
    if (!prefix || typeof document === 'undefined') return;

    const marker = `${prefix} · `;
    const apply = () => {
      if (!document.title.startsWith(marker)) {
        document.title = `${marker}${document.title}`;
      }
    };

    apply();

    /**
     * Se observa `document.head` entero y no el `<title>`: Helmet no siempre muta el
     * nodo de texto, a veces REEMPLAZA el elemento — y un observer atado al elemento
     * viejo se queda mirando un nodo huérfano. El callback es una comparación de
     * strings, así que el head completo sale gratis.
     */
    const observer = new MutationObserver(apply);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [name]);
}
