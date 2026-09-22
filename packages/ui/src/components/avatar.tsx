import { cn } from '../lib/cn';
import { BRAND } from '../lib/brand';

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}
export function Avatar({ name, color = BRAND.ink, size = 'md', className }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sz = { sm: 'size-7 text-[10px]', md: 'size-9 text-xs', lg: 'size-12 text-sm', xl: 'size-20 text-2xl' }[size];
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', sz, className)} style={{ backgroundColor: color }} aria-label={name}>
      {initials(name)}
    </span>
  );
}
