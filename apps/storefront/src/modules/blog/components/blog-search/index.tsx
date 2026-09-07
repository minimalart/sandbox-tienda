'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 400;

/** Debounced search input that pushes ?q= to the blog home. */
const BlogSearch = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const onChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(value.trim() ? `/blog?q=${encodeURIComponent(value.trim())}` : '/blog', {
        scroll: false,
      });
    }, DEBOUNCE_MS);
  };

  return (
    <input
      type="search"
      value={query}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Buscar artículos…"
      className="w-full rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-[--primary-color] focus:ring-1 focus:ring-[--primary-color]"
    />
  );
};

export default BlogSearch;
