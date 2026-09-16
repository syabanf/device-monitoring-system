import * as React from 'react';
import { cn } from '../lib/cn';

export type LimitStatus = 'normal' | 'high' | 'low' | 'unknown';

export interface Limits {
  lower?: number | null;
  upper?: number | null;
}

/** Where a reading sits against the limits an admin set for the sensor. */
export function limitStatus(value: number | null | undefined, limits?: Limits): LimitStatus {
  if (value == null || Number.isNaN(value)) return 'unknown';
  if (limits?.upper != null && value > limits.upper) return 'high';
  if (limits?.lower != null && value < limits.lower) return 'low';
  return 'normal';
}

export const STATUS_LABEL: Record<LimitStatus, string> = {
  normal: 'Normal',
  high: 'Above limit',
  low: 'Below limit',
  unknown: 'No reading',
};

const statusText: Record<LimitStatus, string> = {
  normal: 'text-emerald-600',
  high: 'text-brand-600',
  low: 'text-sky-600',
  unknown: 'text-muted',
};
const statusPill: Record<LimitStatus, string> = {
  normal: 'bg-emerald-50 text-emerald-700',
  high: 'bg-brand-50 text-brand-700',
  low: 'bg-sky-50 text-sky-700',
  unknown: 'bg-surface text-muted',
};
const ZONE = { low: '#0EA5E9', band: '#10B981', high: '#ED1C24', empty: '#E6E5E7' };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};
function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x0, y0] = polar(cx, cy, r, from);
  const [x1, y1] = polar(cx, cy, r, to);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${Math.abs(to - from) > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

const START = 135;
const SWEEP = 270;

/**
 * A dial for one measured point: the scale carries the sensor's own limits, so the coloured
 * band is what the admin configured rather than a fixed range.
 */
export function RadialGauge({
  value, scaleMin, scaleMax, limits, unit, caption, className,
}: {
  value: number | null | undefined;
  scaleMin: number;
  scaleMax: number;
  limits?: Limits;
  unit: string;
  caption?: string;
  className?: string;
}) {
  const status = limitStatus(value, limits);
  const span = scaleMax - scaleMin || 1;
  const angleOf = (v: number) => START + (clamp((v - scaleMin) / span, 0, 1) * SWEEP);
  const lower = limits?.lower != null ? clamp(limits.lower, scaleMin, scaleMax) : scaleMin;
  const upper = limits?.upper != null ? clamp(limits.upper, scaleMin, scaleMax) : scaleMax;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg viewBox="0 0 200 172" className="w-full max-w-[220px]" role="img"
        aria-label={`${caption ?? 'Reading'} ${value == null ? 'unavailable' : `${value} ${unit}`}, ${STATUS_LABEL[status].toLowerCase()}`}>
        <path d={arcPath(100, 100, 76, START, START + SWEEP)} fill="none" stroke={ZONE.empty} strokeWidth={16} strokeLinecap="round" />
        {limits?.lower != null ? <path d={arcPath(100, 100, 76, START, angleOf(lower))} fill="none" stroke={ZONE.low} strokeWidth={16} strokeLinecap="round" /> : null}
        <path d={arcPath(100, 100, 76, angleOf(lower), angleOf(upper))} fill="none" stroke={ZONE.band} strokeWidth={16} />
        {limits?.upper != null ? <path d={arcPath(100, 100, 76, angleOf(upper), START + SWEEP)} fill="none" stroke={ZONE.high} strokeWidth={16} strokeLinecap="round" /> : null}

        {value != null ? (
          <g transform={`rotate(${angleOf(value)} 100 100)`}>
            <line x1={100} y1={100} x2={166} y2={100} stroke="#101112" strokeWidth={4} strokeLinecap="round" />
          </g>
        ) : null}
        <circle cx={100} cy={100} r={8} fill="#101112" />
        <circle cx={100} cy={100} r={3.5} fill="#fff" />

        {limits?.lower != null ? <text x={polar(100, 100, 58, angleOf(lower))[0]} y={polar(100, 100, 58, angleOf(lower))[1]} textAnchor="middle" dominantBaseline="middle" className="fill-muted text-[11px] font-semibold">{limits.lower}</text> : null}
        {limits?.upper != null ? <text x={polar(100, 100, 58, angleOf(upper))[0]} y={polar(100, 100, 58, angleOf(upper))[1]} textAnchor="middle" dominantBaseline="middle" className="fill-muted text-[11px] font-semibold">{limits.upper}</text> : null}
        <text x={100} y={148} textAnchor="middle" className="fill-foreground text-[26px] font-bold tabular-nums">{value == null ? '—' : value.toFixed(1)}</text>
        <text x={100} y={166} textAnchor="middle" className="fill-muted text-[12px] font-medium">{unit}</text>
      </svg>
      <span className={cn('mt-1 rounded-full px-3 py-1 text-xs font-semibold', statusPill[status])}>{STATUS_LABEL[status]}</span>
      {caption ? <p className="mt-1 text-xs text-muted">{caption}</p> : null}
    </div>
  );
}

/** A column for one measured point, with the configured band drawn on the track. */
export function LevelBar({
  value, scaleMin, scaleMax, limits, unit, caption, className,
}: {
  value: number | null | undefined;
  scaleMin: number;
  scaleMax: number;
  limits?: Limits;
  unit: string;
  caption?: string;
  className?: string;
}) {
  const status = limitStatus(value, limits);
  const span = scaleMax - scaleMin || 1;
  const pct = (v: number) => clamp((v - scaleMin) / span, 0, 1) * 100;
  const lower = limits?.lower ?? scaleMin;
  const upper = limits?.upper ?? scaleMax;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="flex items-end gap-2">
        <div className="flex h-36 flex-col justify-between py-0.5 text-[10px] font-semibold text-muted">
          <span>{scaleMax}</span>
          <span>{scaleMin}</span>
        </div>
        <div className="relative h-36 w-7 overflow-hidden rounded-full bg-surface-2"
          role="img" aria-label={`${caption ?? 'Reading'} ${value == null ? 'unavailable' : `${value} ${unit}`}, ${STATUS_LABEL[status].toLowerCase()}`}>
          <div className="absolute inset-x-0 bg-emerald-500/25" style={{ bottom: `${pct(lower)}%`, height: `${Math.max(2, pct(upper) - pct(lower))}%` }} />
          {value != null ? (
            <>
              <div className={cn('absolute inset-x-0 bottom-0 rounded-b-full', status === 'high' ? 'bg-brand-600' : status === 'low' ? 'bg-sky-500' : 'bg-emerald-500')} style={{ height: `${pct(value)}%` }} />
              <div className="absolute inset-x-0 h-0.5 bg-ink" style={{ bottom: `calc(${pct(value)}% - 1px)` }} />
            </>
          ) : null}
        </div>
        <div className="flex h-36 flex-col justify-between py-0.5 text-[10px] font-semibold text-muted">
          <span>{limits?.upper != null ? `${limits.upper} max` : ''}</span>
          <span>{limits?.lower != null ? `${limits.lower} min` : ''}</span>
        </div>
      </div>
      <p className="mt-2 text-lg font-bold tabular-nums">{value == null ? '—' : `${value.toFixed(1)} ${unit}`}</p>
      <span className={cn('mt-1 rounded-full px-3 py-1 text-xs font-semibold', statusPill[status])}>{STATUS_LABEL[status]}</span>
      {caption ? <p className="mt-1 text-xs text-muted">{caption}</p> : null}
    </div>
  );
}

/** A dial for a sensor that reports a state rather than a number: door, motion, power, panic. */
export function StateDial({ label, alarm, caption, className }: { label: string; alarm: boolean; caption?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className={cn('flex size-28 items-center justify-center rounded-full text-sm font-bold text-white ring-8',
        alarm ? 'bg-brand-600 ring-brand-50' : 'bg-emerald-500 ring-emerald-50')}
        role="img" aria-label={`${caption ?? 'Sensor'} ${label}`}>
        {label}
      </div>
      {caption ? <p className="mt-3 text-xs text-muted">{caption}</p> : null}
    </div>
  );
}

/** One installed point: its dials, its limits and the status they add up to. */
export function SensorPointCard({
  name, kindLabel, temperature, humidity, state, footer, className,
}: {
  name: string;
  kindLabel?: string;
  temperature?: { value: number | null | undefined; limits?: Limits };
  humidity?: { value: number | null | undefined; limits?: Limits };
  state?: { label: string; alarm: boolean };
  footer?: React.ReactNode;
  className?: string;
}) {
  const statuses: LimitStatus[] = [];
  if (temperature) statuses.push(limitStatus(temperature.value, temperature.limits));
  if (humidity) statuses.push(limitStatus(humidity.value, humidity.limits));
  if (state) statuses.push(state.alarm ? 'high' : 'normal');
  const status = statuses.find((s) => s === 'high') ?? statuses.find((s) => s === 'low') ?? statuses[0] ?? 'unknown';

  return (
    <GaugePanel title={name} subtitle={kindLabel} status={status} footer={footer} className={className}>
      <div className="flex w-full flex-wrap items-end justify-center gap-5">
        {temperature ? <RadialGauge value={temperature.value} {...temperatureScale(temperature.limits)} limits={temperature.limits} unit="°C" caption="Temperature" /> : null}
        {humidity ? <LevelBar value={humidity.value} scaleMin={0} scaleMax={100} limits={humidity.limits} unit="%RH" caption="Humidity" /> : null}
        {state ? <StateDial label={state.label} alarm={state.alarm} caption={kindLabel} /> : null}
      </div>
    </GaugePanel>
  );
}

// The dial shows the band with room to breathe on both sides, so a reading that leaves the band
// still lands on the scale.
function temperatureScale(limits?: Limits): { scaleMin: number; scaleMax: number } {
  const lower = limits?.lower ?? 0;
  const upper = limits?.upper ?? 40;
  return { scaleMin: Math.floor(lower - 10), scaleMax: Math.ceil(upper + 10) };
}

/** The frame the three dials share: a titled card with the point's name and a footer slot. */
function GaugePanel({
  title, subtitle, status, footer, children, className,
}: {
  title: string;
  subtitle?: string;
  status?: LimitStatus;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-[22px] bg-white p-4 shadow-card', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
        </div>
        {status ? <span className={cn('shrink-0 text-xs font-semibold', statusText[status])}>{STATUS_LABEL[status]}</span> : null}
      </div>
      <div className="mt-3 flex justify-center">{children}</div>
      {footer ? <div className="mt-3 border-t border-border pt-3 text-xs text-muted">{footer}</div> : null}
    </div>
  );
}
