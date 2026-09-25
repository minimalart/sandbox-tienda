'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Measures content (not viewport height) so a block can shrink as well as grow. */
export default function PreviewBridge({ token, origin, children }: {
  token: string; origin: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let last = -1;
    const report = () => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height === last) return;
      last = height;
      window.top?.postMessage({ type: 'mercatto:preview-size', token, height }, origin);
    };
    const observer = new ResizeObserver(report);
    observer.observe(element);
    document.fonts.ready.then(report);
    report();
    return () => observer.disconnect();
  }, [token, origin]);
  return <div ref={ref} style={{ display: 'flow-root' }} onClickCapture={event => {
    // Allow native FAQ disclosures; all commerce/navigation stays inert.
    const target = event.target as HTMLElement;
    if (!target.closest('summary')) { event.preventDefault(); event.stopPropagation(); }
  }} onFocusCapture={event => {
    if (!(event.target as HTMLElement).closest('summary')) {
      event.stopPropagation(); (event.target as HTMLElement).blur();
    }
  }} onKeyDownCapture={event => {
    if ((event.key === 'Enter' || event.key === ' ') && !(event.target as HTMLElement).closest('summary')) {
      event.preventDefault(); event.stopPropagation();
    }
  }} onSubmitCapture={event => { event.preventDefault(); event.stopPropagation(); }}>
    {children}
  </div>;
}
