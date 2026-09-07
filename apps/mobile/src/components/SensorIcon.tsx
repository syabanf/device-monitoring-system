import type { SensorType } from '@monitoring/types';
import { Activity, DoorOpen, Siren, Thermometer, Zap } from 'lucide-react';
export function SensorIcon({ type, className = 'size-4' }: { type: SensorType; className?: string }) {
  switch (type) {
    case 'DOOR': return <DoorOpen className={className} />;
    case 'MOTION': return <Activity className={className} />;
    case 'POWER': return <Zap className={className} />;
    case 'PANIC_BUTTON': return <Siren className={className} />;
    default: return <Thermometer className={className} />;
  }
}
