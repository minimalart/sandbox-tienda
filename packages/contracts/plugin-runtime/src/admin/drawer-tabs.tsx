import type { HTMLAttributes } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeftMini, ChevronRightMini } from '@medusajs/icons';

export function DrawerTabs<T extends string>({
  tab,
  setTab,
  tabs,
  previousLabel = 'Previous tabs',
  nextLabel = 'Next tabs',
}: {
  tab: T;
  setTab: (tab: T) => void;
  tabs: readonly { id: T; label: string }[];
  previousLabel?: string;
  nextLabel?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    sync();
    const onResize = () => sync();
    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(sync);
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const nudge = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });

  return (
    <div className="relative mb-4 border-ui-border-base border-b">
      {canLeft ? (
        <button
          type="button"
          aria-label={previousLabel}
          onClick={() => nudge(-1)}
          className="absolute inset-y-0 left-0 z-10 flex items-center bg-gradient-to-r from-ui-bg-base via-ui-bg-base to-transparent pr-6 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
        >
          <ChevronLeftMini />
        </button>
      ) : null}
      <div
        ref={ref}
        onScroll={sync}
        className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tDef) => (
          <button
            key={tDef.id}
            aria-pressed={tab === tDef.id}
            type="button"
            onClick={(e) => {
              setTab(tDef.id);
              e.currentTarget.scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest',
              });
            }}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm ${
              tab === tDef.id
                ? 'border-ui-fg-base border-b-2 font-medium text-ui-fg-base'
                : 'text-ui-fg-subtle'
            }`}
          >
            {tDef.label}
          </button>
        ))}
      </div>
      {canRight ? (
        <button
          type="button"
          aria-label={nextLabel}
          onClick={() => nudge(1)}
          className="absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-l from-ui-bg-base via-ui-bg-base to-transparent pl-6 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
        >
          <ChevronRightMini />
        </button>
      ) : null}
    </div>
  );
}

/** Inactive panels unmount unless the form explicitly needs to retain its state. */
export function DrawerTabPanel({ tab, value, forceMount = false, ...props }: HTMLAttributes<HTMLDivElement> & { tab: string; value: string; forceMount?: boolean }) {
  return tab === value || forceMount ? <div {...props} hidden={tab !== value} /> : null;
}
