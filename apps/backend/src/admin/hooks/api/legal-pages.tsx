import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
/*
  `fetchJson` compartido, NO una copia local: es el que manda `x-site-id`. Sin ese
  header, `siteFromRequest` resuelve `allSites` y la ruta —declarada `scoped`— guarda
  en la fila GLOBAL. En esta pantalla eso significa escribir los términos y
  condiciones de una tienda encima de los de todas las demás.
*/
import { fetchJson } from '../../lib/http';
import { siteScopedKey } from '../../lib/active-site';
import { useActiveSite } from '../use-active-site';
import type { LegalPageSlug } from '../../../modules/store-config/legal/pages';

const LEGAL_PAGES_URL = '/admin/store-config/legal-pages';
const LEGAL_PAGES_KEY = ['legal-pages'] as const;

export interface LegalSection {
  /** Key de React y unidad de reordenado. NO es el ancla: esa sale del nombre. */
  id: string;
  name: string;
  html: string;
}

export interface LegalPageDoc {
  title: string;
  intro: string | null;
  /** "Última actualización": texto libre, con precisión de mes ("Agosto de 2026"). */
  updated_label: string | null;
  /** EN ORDEN — la posición en el array es el orden del documento. */
  sections: LegalSection[];
  seo_description: string | null;
}

export interface LegalPagesResponse {
  /** Siempre las tres, completas: la ruta rellena con el texto por defecto. */
  legal_pages: Record<LegalPageSlug, LegalPageDoc>;
  /**
   * `false` = las SECCIONES de esta página siguen siendo las del texto de ejemplo del
   * boilerplate. Cambiar sólo el título o la bajada no lo apaga.
   */
  customized: Record<LegalPageSlug, boolean>;
}

export type LegalPagesPatch = Partial<
  Record<LegalPageSlug, Partial<LegalPageDoc>>
>;

export function useLegalPages() {
  // El `siteId` va en la key: el header no entra solo y react-query serviría el
  // cache de la tienda anterior. Condición 1 de `SetActiveSiteOptions`.
  const { activeId } = useActiveSite();

  return useQuery({
    queryKey: siteScopedKey(LEGAL_PAGES_KEY, activeId),
    queryFn: () => fetchJson<LegalPagesResponse>(LEGAL_PAGES_URL),
  });
}

export function useUpdateLegalPages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pages: LegalPagesPatch) =>
      fetchJson<LegalPagesResponse>(LEGAL_PAGES_URL, {
        method: 'POST',
        body: JSON.stringify({ pages }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEGAL_PAGES_KEY });
    },
  });
}
