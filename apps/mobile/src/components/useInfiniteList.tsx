import * as React from 'react';
import { Loader2 } from 'lucide-react';

/** Reveals `pageSize` more items each time the sentinel scrolls into view. */
export function useInfiniteList<T>(items: T[], pageSize = 10) {
  const [count, setCount] = React.useState(pageSize);
  React.useEffect(() => setCount(pageSize), [items, pageSize]);
  const visible = items.slice(0, count);
  const hasMore = count < items.length;
  const loadMore = React.useCallback(() => setCount((c) => Math.min(items.length, c + pageSize)), [items.length, pageSize]);
  return { visible, hasMore, loadMore, remaining: items.length - visible.length };
}

export function LoadMore({ hasMore, onLoad, remaining }: { hasMore: boolean; onLoad: () => void; remaining: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!hasMore || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setBusy(true);
        const t = setTimeout(() => { onLoad(); setBusy(false); }, 350); // small delay so the spinner reads as "loading"
        return () => clearTimeout(t);
      }
      return undefined;
    }, { rootMargin: '120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onLoad]);
  if (!hasMore) return null;
  return (
    <div ref={ref} className="flex items-center justify-center gap-2 py-4 text-xs text-muted">
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {busy ? 'Loading more…' : `${remaining} more`}
      {!busy ? <button type="button" onClick={onLoad} className="ml-1 font-semibold text-brand-600">Load</button> : null}
    </div>
  );
}
