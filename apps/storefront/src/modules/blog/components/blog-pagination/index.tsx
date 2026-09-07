import LocalizedClientLink from '@modules/common/components/localized-client-link';
import { clx } from '@medusajs/ui';

type Props = {
  /** 1-based current page. */
  page: number;
  totalPages: number;
  /** Base path without query, e.g. "/blog" or "/blog/categoria/dulce". */
  basePath: string;
  /** Extra query params to preserve (e.g. { q: "torta" }). */
  params?: Record<string, string | undefined>;
};

/** Builds a compact page list with ellipses: 1 … 4 5 6 … 12. */
function pageItems(page: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items: (number | '…')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) items.push('…');
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < total - 1) items.push('…');
  items.push(total);
  return items;
}

const ChevronLeft = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
    <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
    <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BlogPagination = ({ page, totalPages, basePath, params }: Props) => {
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const qs = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });
    if (p > 1) qs.set('page', String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const items = pageItems(page, totalPages);
  const baseCell =
    'flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors';

  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginación">
      {page > 1 ? (
        <LocalizedClientLink
          href={hrefFor(page - 1)}
          className={clx(baseCell, 'border border-gray-200 text-gray-600 hover:bg-gray-50')}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </LocalizedClientLink>
      ) : null}

      {items.map((it, i) =>
        it === '…' ? (
          <span key={`e${i}`} className="px-1 text-gray-400">
            …
          </span>
        ) : (
          <LocalizedClientLink
            key={it}
            href={hrefFor(it)}
            aria-current={it === page ? 'page' : undefined}
            className={clx(
              baseCell,
              it === page
                ? 'bg-[--primary-color] text-white'
                : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
            )}
          >
            {it}
          </LocalizedClientLink>
        ),
      )}

      {page < totalPages ? (
        <LocalizedClientLink
          href={hrefFor(page + 1)}
          className={clx(baseCell, 'border border-gray-200 text-gray-600 hover:bg-gray-50')}
          aria-label="Página siguiente"
        >
          <ChevronRight />
        </LocalizedClientLink>
      ) : null}
    </nav>
  );
};

export default BlogPagination;
