import * as React from 'react';
import { Cpu, Pencil, Plus, Trash2 } from 'lucide-react';
import type { DeviceType } from '@monitoring/types';
import { SENSOR_TYPE_LABEL } from '@monitoring/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@monitoring/ui';
import { fmtIdr } from '@monitoring/fixtures';
import { useScoped } from '../../state/app-state';
import { DeviceTypeDialog, emptyDeviceType } from '../../components/master/DeviceTypeDialog';
import { ConfirmDelete } from '../../components/master/ConfirmDelete';

export function DeviceTypesPage() {
  const { devices: installed, deviceTypes, dispatch } = useScoped();
  const [editing, setEditing] = React.useState<DeviceType | null>(null);
  const [removing, setRemoving] = React.useState<DeviceType | null>(null);
  return (
    <div>
      <PageHeader title="Device Types" description="Room Alert models approved for outlet installation" actions={<Button onClick={() => setEditing(emptyDeviceType())}><Plus />Add device type</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        {deviceTypes.map((t) => {
          const count = installed.filter((d) => d.deviceTypeId === t.id).length;
          return (
            <Card key={t.id}>
              <CardHeader className="flex-row items-start gap-4 space-y-0">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white"><Cpu className="size-7" /></div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{t.name}</CardTitle>
                  <p className="text-sm text-muted">{t.vendor} · model {t.model}</p>
                </div>
                <div className="flex items-center gap-1"><Badge variant="brand">{count} installed</Badge><Button variant="ghost" size="icon" className="size-8" aria-label="Edit" onClick={() => setEditing(t)}><Pencil /></Button><Button variant="ghost" size="icon" className="size-8 text-brand-600" aria-label="Delete" disabled={count > 0} title={count ? 'Remove installed devices first' : undefined} onClick={() => setRemoving(t)}><Trash2 /></Button></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted">{t.description}</p>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Ports</p>
                  <div className="flex flex-wrap gap-2">
                    {t.ports.map((p) => <Badge key={p.kind} variant="outline" className="capitalize">{p.count} {p.kind} port{p.count > 1 ? 's' : ''}</Badge>)}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Built-in sensors</p>
                  <div className="flex flex-wrap gap-2">{t.builtInSensors.map((s) => <Badge key={s} variant="info">{SENSOR_TYPE_LABEL[s]}</Badge>)}</div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted">Unit price (excl. VAT)</span>
                  <span className="font-semibold">{fmtIdr(t.priceIdr)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <DeviceTypeDialog deviceType={editing} onClose={() => setEditing(null)} />
      <ConfirmDelete open={!!removing} title={`Delete ${removing?.name}?`} description="The model will no longer be available when registering devices." onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) dispatch({ type: 'deviceTypes/remove', deviceTypeId: removing.id }); setRemoving(null); }} />
    </div>
  );
}
