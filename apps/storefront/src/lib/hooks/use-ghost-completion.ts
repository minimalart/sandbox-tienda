import { COMPANY_LINKS, type NavigationLink } from "@lib/data/navigation-links";
import { autocompleteFromBrowser } from "@lib/typesense/search-browser";
import { AUTOCOMPLETE_DEBOUNCE_MS } from "@lib/typesense/core/timing";
import { useEffect, useMemo, useRef, useState } from "react";

const MIN_QUERY_LENGTH = 2;
// Un link sólo le gana a un producto si lo tipeado alcanza para que la intención
// sea clara. Sin este piso, "re" matcheaba algún link y tapaba PERMANENTEMENTE la
// sugerencia de producto por más que se siguiera tipeando.
const MIN_LINK_PREFIX_TO_WIN = 3;
const DIACRITIC_REGEX = /[̀-ͯ]/g;

export type GhostCompletion = {
  /**
   * Lo que aceptaría el usuario con Tab o flecha derecha: un título de producto
   * cuyo prefijo literal es lo tipeado, o el nombre de un link de navegación.
   */
  suggestion: string | null;
  ghostSuffix: string;
  matchedLink: NavigationLink | null;
};

const EMPTY: GhostCompletion = {
  suggestion: null,
  ghostSuffix: "",
  matchedLink: null,
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(DIACRITIC_REGEX, "").toLowerCase().trim();

/**
 * Sufijo a pintar en gris detrás de lo tipeado.
 *
 * Camina el string CRUDO hasta que su prefijo normalizado alcanza el largo
 * normalizado del query, en vez de cortar en `query.length`. Los dos largos
 * divergen cuando hay acentos combinatorios (una "ó" en NFD son dos code units y
 * uno normalizado), y ahí un corte por índice crudo se desfasa y deja marcas
 * diacríticas colgando en el ghost.
 */
const computeGhostSuffix = (suggestion: string, query: string): string => {
  const targetLength = normalize(query).length;
  if (normalize(suggestion).length <= targetLength) {
    return "";
  }
  let cut = 0;
  while (
    cut < suggestion.length &&
    normalize(suggestion.slice(0, cut)).length < targetLength
  ) {
    cut++;
  }
  return suggestion.slice(cut);
};

type LinkMatch = {
  link: NavigationLink;
  isPrefix: boolean;
  matchedLength: number;
};

const findLinkMatch = (query: string): LinkMatch | null => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return null;
  }
  // 1) Prefer matches that start at the beginning of the name
  for (const link of COMPANY_LINKS) {
    const normalizedName = normalize(link.name);
    if (
      normalizedName.length >= normalizedQuery.length &&
      normalizedName.startsWith(normalizedQuery)
    ) {
      return { link, isPrefix: true, matchedLength: normalizedQuery.length };
    }
  }
  // 2) Fallback: match any whitespace-separated word inside the name
  for (const link of COMPANY_LINKS) {
    const words = normalize(link.name).split(/\s+/);
    if (
      words.some(
        (w) => w.length >= normalizedQuery.length && w.startsWith(normalizedQuery),
      )
    ) {
      return { link, isPrefix: false, matchedLength: normalizedQuery.length };
    }
  }
  return null;
};

export const useGhostCompletion = (query: string): GhostCompletion => {
  const [productSuggestion, setProductSuggestion] = useState<string | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const trimmed = query.trimStart();
  const linkMatch = useMemo(() => findLinkMatch(trimmed), [trimmed]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setProductSuggestion(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      requestIdRef.current += 1;
      const currentId = requestIdRef.current;
      // Consulta directa a Typesense — sin pasar por el proxy
      autocompleteFromBrowser(trimmed, 10)
        .then((products) => {
          // Race-safe: ignorar respuestas obsoletas
          if (currentId !== requestIdRef.current) {
            return;
          }
          const normalizedQuery = normalize(trimmed);
          // Prefijo LITERAL, a propósito. El ghost se pinta detrás del caret, así
          // que sólo es honesto si lo tipeado empieza el título: aflojarlo para
          // tolerar typos mostraría "remraera" para "remra" + "Remera".
          const match = products.find((p) =>
            normalize(p.title).startsWith(normalizedQuery),
          );
          setProductSuggestion(match?.title ?? null);
        })
        .catch(() => {
          if (currentId === requestIdRef.current) {
            setProductSuggestion(null);
          }
        });
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [trimmed]);

  return useMemo<GhostCompletion>(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return EMPTY;
    }

    const linkWins =
      linkMatch !== null &&
      linkMatch.isPrefix &&
      linkMatch.matchedLength >= MIN_LINK_PREFIX_TO_WIN;

    if (linkWins && linkMatch) {
      return {
        suggestion: linkMatch.link.name,
        ghostSuffix: computeGhostSuffix(linkMatch.link.name, trimmed),
        matchedLink: linkMatch.link,
      };
    }

    if (productSuggestion) {
      return {
        suggestion: productSuggestion,
        ghostSuffix: computeGhostSuffix(productSuggestion, trimmed),
        matchedLink: null,
      };
    }

    // Sin producto: recién acá vale un link que no llegó a ganar por sí solo.
    if (linkMatch) {
      return {
        suggestion: linkMatch.link.name,
        ghostSuffix: linkMatch.isPrefix
          ? computeGhostSuffix(linkMatch.link.name, trimmed)
          : "",
        matchedLink: linkMatch.link,
      };
    }

    return EMPTY;
  }, [trimmed, linkMatch, productSuggestion]);
};
