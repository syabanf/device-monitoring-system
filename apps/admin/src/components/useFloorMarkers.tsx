import * as React from 'react';
import { Router } from 'lucide-react';
import type { FloorMarker } from '@monitoring/ui';
import { deviceHealth, isSolved, unitName } from '@monitoring/fixtures';
import { useScoped } from '../state/app-state';
import { SensorIcon } from './badges';

/** Builds floor-plan markers (devices + sensors) for one outlet from session state. */
export function useFloorMarkers(outletId: string | null | undefined): FloorMarker[] {
  const { devicesByOutlet, sensorsByDevice, alerts } = useScoped();
  return React.useMemo(() => {
    if (!outletId) return [];
    const devices = devicesByOutlet.get(outletId) ?? [];
    const openBySensor = new Map<string, number>();
    for (const a of alerts) if (a.outletId === outletId && !isSolved(a)) openBySensor.set(a.sensorId, (openBySensor.get(a.sensorId) ?? 0) + 1);
    const out: FloorMarker[] = [];
    for (const d of devices) {
      const h = deviceHealth(d);
      out.push({ id: d.id, x: d.floor.x, y: d.floor.y, kind: 'device', label: unitName(d.model), sublabel: `${d.serial} · ${d.status}`, status: d.status === 'offline' ? 'offline' : h.status === 'critical' ? 'fault' : 'normal', icon: <Router /> });
      for (const s of sensorsByDevice.get(d.id) ?? []) {
        const open = openBySensor.get(s.id) ?? 0;
        out.push({ id: s.id, x: s.floor.x, y: s.floor.y, kind: 'sensor', label: s.name, sublabel: `${s.portKind} port ${s.portIndex}`, status: d.status === 'offline' ? 'offline' : open ? 'alarm' : 'normal', icon: <SensorIcon type={s.type} />, badge: open || undefined });
      }
    }
    return out;
  }, [outletId, devicesByOutlet, sensorsByDevice, alerts]);
}
