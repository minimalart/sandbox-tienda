export const DIRECTORY_PAGE_SIZE = 20;
export function directoryPage<T extends { name: string }>(
  sites: T[],
  offset: number,
  query: string
) {
  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase();
  const term = normalize(query.trim());
  const matches = term ? sites.filter((site) => normalize(site.name).includes(term)) : sites;
  const start = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  const page = matches.slice(start, start + DIRECTORY_PAGE_SIZE);
  return {
    sites: page,
    count: matches.length,
    next_offset: start + page.length < matches.length ? start + page.length : null,
  };
}
