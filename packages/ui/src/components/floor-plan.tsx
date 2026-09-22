import * as React from 'react';
import { cn } from '../lib/cn';
import { BRAND } from '../lib/brand';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

export type FloorMarkerStatus = 'normal' | 'alarm' | 'offline' | 'fault' | 'muted';
export interface FloorMarker {
  id: string;
  x: number; // percent
  y: number; // percent
  kind: 'device' | 'sensor';
  label: string;
  sublabel?: string;
  status: FloorMarkerStatus;
  icon: React.ReactNode;
  badge?: number;
}

const ZONES = [
  { id: 'gudang', x: 3, y: 3, w: 60, h: 17, label: 'AREA GUDANG' },
  { id: 'wc', x: 78, y: 3, w: 19, h: 11, label: 'KM/WC' },
  { id: 'cooler', x: 3, y: 24, w: 19, h: 54, label: 'AREA COOLER', vertical: true },
  { id: 'kasir', x: 70, y: 70, w: 27, h: 20, label: 'AREA KASIR' },
  { id: 'sales', x: 26, y: 24, w: 40, h: 44, label: 'AREA SALES', ghost: true },
  { id: 'teras', x: 3, y: 92, w: 94, h: 6, label: 'TERAS DALAM', ghost: true },
] as const;
const RACKS = [30, 38, 46, 54, 62];

const statusCls: Record<FloorMarkerStatus, string> = {
  normal: 'bg-ink text-white ring-white',
  alarm: 'bg-brand-600 text-white ring-white animate-pulse motion-reduce:animate-none',
  offline: 'bg-silver text-white ring-white',
  fault: 'bg-amber-400 text-ink ring-white',
  muted: 'bg-white text-muted ring-border',
};

export function FloorPlan({ markers, selectedId, onSelect, className, compact, title }: { markers: FloorMarker[]; selectedId?: string | null; onSelect?: (id: string) => void; className?: string; compact?: boolean; title?: string }) {
  return (
    <div className={cn('relative w-full overflow-hidden rounded-[22px] bg-surface-2', className)} style={{ aspectRatio: '100 / 118' }} role="group" aria-label={`${title ?? 'Floor plan'}. Use Tab to move between installed devices and sensors.`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <pattern id="fp-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#e6e5e7" strokeWidth="0.25" /></pattern>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="url(#fp-grid)" />
        {/* outer wall */}
        <rect x="1.5" y="1.5" width="97" height="97" rx="1.5" fill="none" stroke={BRAND.ink} strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
        {ZONES.map((z) => (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="1" fill={'ghost' in z && z.ghost ? 'transparent' : '#ffffff'} stroke={'ghost' in z && z.ghost ? '#c0c0c0' : '#8b8b8b'} strokeWidth="0.45" strokeDasharray={'ghost' in z && z.ghost ? '1.5 1' : undefined} />
            <text x={z.x + z.w / 2} y={z.y + ('vertical' in z && z.vertical ? z.h / 2 : 3.6)} fontSize={compact ? 2.6 : 2.4} fontWeight="700" fill="#8b8b8b" textAnchor="middle" fontFamily="DM Sans, sans-serif" letterSpacing="0.2" transform={'vertical' in z && z.vertical ? `rotate(-90 ${z.x + z.w / 2} ${z.y + z.h / 2})` : undefined}>{z.label}</text>
          </g>
        ))}
        {RACKS.map((x) => (
          <g key={x}>
            <rect x={x} y="27" width="3.2" height="36" rx="0.6" fill="#f1f0f1" stroke="#8b8b8b" strokeWidth="0.35" />
            <text x={x + 1.6} y="46.5" fontSize="1.6" fill="#8b8b8b" textAnchor="middle" fontFamily="DM Sans, sans-serif" transform={`rotate(-90 ${x + 1.6} 46.5)`}>RAK</text>
          </g>
        ))}
        {/* doors */}
        <path d="M44 91.5 h12" stroke={BRAND.ink} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <path d="M44 91.5 a12 12 0 0 1 12 -12" fill="none" stroke="#83B3EE" strokeWidth="0.35" strokeDasharray="1 0.8" />
        <path d="M64 8.5 h8" stroke={BRAND.ink} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <path d="M36 20 h8" stroke={BRAND.ink} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <text x="50" y="96.6" fontSize="2.2" fill="#8b8b8b" textAnchor="middle" fontFamily="DM Sans, sans-serif">FOLDING DOOR · TERAS LUAR</text>
        {/* counter */}
        <rect x="73" y="74" width="21" height="4" rx="0.8" fill="#f1f0f1" stroke="#8b8b8b" strokeWidth="0.35" />
        <text x="83.5" y="76.8" fontSize="1.7" fill="#8b8b8b" textAnchor="middle" fontFamily="DM Sans, sans-serif">KASIR</text>
      </svg>
      {title && !compact ? <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted shadow-card backdrop-blur">{title}</div> : null}
      {markers.map((m) => {
        const selected = selectedId === m.id;
        const size = m.kind === 'device' ? (compact ? 'size-9' : 'size-11') : compact ? 'size-7' : 'size-9';
        const btn = (
          <button
            type="button"
            onClick={onSelect ? () => onSelect(m.id) : undefined}
            aria-label={`${m.label}${m.sublabel ? `, ${m.sublabel}` : ''}, status ${m.status}`}
            className={cn(
              'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-2 shadow-float transition-transform hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-600 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none [&_svg]:size-[45%]',
              m.kind === 'device' && 'rounded-2xl',
              size,
              statusCls[m.status],
              selected && 'scale-125 ring-4 ring-brand-300 z-10',
            )}
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
          >
            {m.icon}
            {m.badge ? <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-brand-600 shadow-card">{m.badge}</span> : null}
          </button>
        );
        return (
          <Tooltip key={m.id}>
            <TooltipTrigger asChild>{btn}</TooltipTrigger>
            <TooltipContent side="top"><span className="font-semibold">{m.label}</span>{m.sublabel ? <span className="block text-[10px] opacity-80">{m.sublabel}</span> : null}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function FloorLegend({ className }: { className?: string }) {
  const items: [FloorMarkerStatus, string][] = [['normal', 'Normal'], ['alarm', 'Alert open'], ['fault', 'Sensor fault'], ['offline', 'Offline']];
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted', className)}>
      {items.map(([s, l]) => <li key={s} className="flex items-center gap-1.5"><span className={cn('size-2.5 rounded-full', statusCls[s].split(' ')[0])} />{l}</li>)}
      <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-ink" />Room Alert unit</li>
    </ul>
  );
}
