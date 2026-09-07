'use client';

import { useParams, useRouter } from 'next/navigation';

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
    <path
      d="M12.5 4.5 7 10l5.5 5.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Back button for the article detail page. Uses browser history when available
 * and falls back to the blog index so it never lands on a dead page.
 */
const BackButton = ({ fallbackHref = '/blog' }: { fallbackHref?: string }) => {
  const router = useRouter();
  const { countryCode } = useParams() as { countryCode?: string };

  const handleClick = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(countryCode ? `/${countryCode}${fallbackHref}` : fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-[--primary-color]"
    >
      <ArrowLeftIcon />
      Volver atrás
    </button>
  );
};

export default BackButton;
