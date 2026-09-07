import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import {
  getActiveSiteId,
  getActiveSiteSnapshot,
  setActiveSite,
  subscribeActiveSite,
} from '../lib/active-site';
import { fetchJson } from '../lib/http';

/**
 * La tienda activa, cruzada contra la lista real.
 *
 * Las tiendas se leen de `GET /admin/multistore/manifest` y NO del hook
 * `hooks/api/demo-stores`, aunque ese exista y sea más directo: ese hook pertenece a
 * la extensión de tiendas, y `project-composer` se la saca a los proyectos de
 * cliente que no la eligen. Un import a un archivo que el composer borra deja el
 * admin sin compilar — y el modo de falla es `next build` rojo en el repo del
 * cliente, no acá.
 *
 * El manifest es CORE (`src/api/admin/multistore/`), así que existe siempre. Cuando
 * no hay módulo de tiendas responde `enabled: false` con `sites: []`, y la barra
 * simplemente no se monta.
 */

export type ActiveSiteEntry = {
  id: string;
  slug: string;
  name: string;
  is_main: boolean;
  channel_ids: string[];
};

type Manifest = {
  enabled: boolean;
  sites: ActiveSiteEntry[];
  routes?: Record<string, { state: string; reason?: string }>;
};

export const MULTISTORE_MANIFEST_QUERY_KEY = ['multistore', 'manifest'] as const;

export function useActiveSite() {
  const activeId = useSyncExternalStore(
    subscribeActiveSite,
    getActiveSiteId,
    () => null, // Primer render del bundle: todavía sin tienda.
  );

  const { data, isPending } = useQuery({
    queryKey: MULTISTORE_MANIFEST_QUERY_KEY,
    queryFn: () => fetchJson<Manifest>('/admin/multistore/manifest'),
    // El registro de tiendas cambia rarísimo y esto lo pide cada pantalla.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const sites = data?.sites ?? [];
  const activeSite = activeId ? sites.find((site) => site.id === activeId) ?? null : null;

  /**
   * La tienda persistida ya no existe: la borraron desde otra pestaña, o el operador
   * cambió de instancia. Hay que decirlo, porque el backend responde 400 en toda ruta
   * ya migrada y el admin se vuelve inusable sin explicación.
   */
  const staleSelection = Boolean(activeId) && !isPending && sites.length > 0 && !activeSite;

  return {
    activeId,
    activeSite,
    /** Para pintar el nombre antes de que resuelva el manifest, sin flash de "…". */
    snapshot: getActiveSiteSnapshot(),
    sites,
    isPending,
    enabled: Boolean(data?.enabled),
    staleSelection,
    setActiveSite,
  };
}
