const MAX_TERMS = 20;

export function parseShoppingList(raw: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const part of raw.split(/[\n,;]+/)) {
    const term = part.trim().replace(/\s+/g, " ");
    if (!term) {
      continue;
    }

    const key = term.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    terms.push(term);
    if (terms.length >= MAX_TERMS) {
      break;
    }
  }

  return terms;
}

export function buildShoppingListHref(terms: string[]): string {
  const normalizedTerms = parseShoppingList(terms.join(","));
  if (normalizedTerms.length === 0) {
    return "/lista-de-compras";
  }

  return `/lista-de-compras?items=${encodeURIComponent(
    normalizedTerms.join(",")
  )}`;
}
