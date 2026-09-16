import * as React from 'react';
import { useSearchParams } from 'react-router';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard } from '@monitoring/ui';
import { Clock, Percent, Radio, TrendingUp } from 'lucide-react';
import { alertsPerDay, avgResponseByOutlet, avgResponseSec, humanizeShort, inPeriod, openVsSolved, responseRate, toWallClockDate, type Period } from '@monitoring/fixtures';
import { outletById } from '../../state/lookups';
import { useScoped } from '../../state/app-state';
import { useReadingSeries } from '../../state/readings';

const PERIODS: { value: Period; label: string }[] = [{ value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }, { value: 'all', label: 'All time' }];
const tooltipStyle = { borderRadius: 16, border: '1px solid #e6e5e7', boxShadow: '0 12px 40px -12px rgb(16 17 18 / 0.25)', fontSize: 12 };

export function AnalysisPage() {
  const { alerts, outlets, sensorsByOutlet } = useScoped();
  const [params, setParams] = useSearchParams();
  const period = (PERIODS.some((p) => p.value === params.get('period')) ? params.get('period') : '30d') as Period;
  const update = (patch: Record<string, string | null>) => { const next = new URLSearchParams(params); for (const [key, value] of Object.entries(patch)) value == null ? next.delete(key) : next.set(key, value); setParams(next, { replace: true }); };
  const list = React.useMemo(() => alerts.filter((a) => inPeriod(a, period)), [alerts, period]);
  const stats = openVsSolved(list);
  const avg = avgResponseSec(list);
  const rate = responseRate(list);
  const perDay = React.useMemo(() => alertsPerDay(list, 14), [list]);
  const byOutlet = React.useMemo(() => avgResponseByOutlet(list).sort((a, b) => a.avgSec - b.avgSec).slice(0, 10).map((s) => ({ ...s, name: outletById.get(s.outletId)?.name.replace('Indomaret ', '') ?? s.outletId, min: Math.round(s.avgSec / 60) })), [list]);

  const tempSensors = React.useMemo(() => outlets.flatMap((o) => (sensorsByOutlet.get(o.id) ?? []).filter((s) => s.type === 'TEMPERATURE_HUMIDITY')), [outlets]);
  const sensorId = tempSensors.some((sensor) => sensor.id === params.get('sensor')) ? params.get('sensor')! : tempSensors[0]?.id ?? '';
  const window = React.useMemo(() => ({ from: new Date(Date.now() - 7 * 86_400_000).toISOString(), to: new Date().toISOString() }), []);
  const { readings } = useReadingSeries(sensorId ? { sensorId, bucket: 'hour', ...window } : null);
  const trend = React.useMemo(() => readings.map((r) => ({ t: format(toWallClockDate(r.at), 'dd MMM HH:mm'), temp: r.temperatureC, hum: r.humidityPct })), [readings]);

  const donut = [{ name: 'Solved', value: stats.solved, color: '#ED1C24' }, { name: 'Open', value: stats.open, color: '#101112' }];

  return (
    <div className="space-y-4">
      <PageHeader title="Analysis" description="Alert volume, employee response performance and environment trends" actions={
        <Select value={period} onValueChange={(v) => update({ period: v === '30d' ? null : v })}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>
      } />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Alerts" value={stats.total} hint={`${stats.open} open · ${stats.solved} solved`} icon={<Radio />} />
        <StatCard label="Avg response time" value={avg == null ? '—' : humanizeShort(avg)} hint="employee KPI" icon={<Clock />} tone="success" />
        <StatCard label="Response rate" value={rate == null ? '—' : `${Math.round(rate * 100)}%`} hint="alerts with a field response" icon={<Percent />} tone="warning" />
        <StatCard label="Busiest day" value={perDay.reduce((m, d) => (d.total > m.total ? d : m), perDay[0]!).label} hint={`${Math.max(...perDay.map((d) => d.total))} alerts`} icon={<TrendingUp />} tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle>Alerts per day</CardTitle><p className="text-sm text-muted">Last 14 days by category</p></CardHeader>
          <CardContent className="h-72" role="img" aria-label={`Alerts per day for the last 14 days. ${stats.total} alerts in the selected period.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perDay} barCategoryGap={8}>
                <CartesianGrid vertical={false} stroke="#e6e5e7" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} width={28} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f0f1' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="COMFORT" name="Shopping Comfort" stackId="a" fill="#83B3EE" radius={[0, 0, 6, 6]} />
                <Bar dataKey="SECURITY" name="Outlet Security" stackId="a" fill="#ED1C24" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Open vs solved</CardTitle></CardHeader>
          <CardContent className="relative h-72" role="img" aria-label={`${stats.open} open alerts and ${stats.solved} solved alerts.`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="value" innerRadius={72} outerRadius={100} paddingAngle={3} cornerRadius={6} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>{donut.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6"><p className="text-3xl font-bold">{stats.total}</p><p className="text-xs text-muted">alerts</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Fastest responding outlets</CardTitle><p className="text-sm text-muted">Average minutes from trigger to field response</p></CardHeader>
          <CardContent className="h-80" role="img" aria-label={`Average response time by outlet. ${byOutlet.length} outlets shown.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byOutlet} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="#e6e5e7" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} unit="m" />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={11} width={110} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f0f1' }} formatter={(v: number) => [`${v} min`, 'Avg response']} />
                <Bar dataKey="min" fill="#101112" radius={[0, 8, 8, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle>Temperature & humidity trend</CardTitle><p className="text-sm text-muted">Hourly readings, last 7 days</p></div>
            <Select value={sensorId} onValueChange={(v) => update({ sensor: v === tempSensors[0]?.id ? null : v })}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>{tempSensors.map((s) => <SelectItem key={s.id} value={s.id}>{outletById.get(s.outletId)?.name} · {s.name}</SelectItem>)}</SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-80" role="img" aria-label={`Temperature and humidity trend for ${tempSensors.find((sensor) => sensor.id === sensorId)?.name ?? 'the selected sensor'}. ${trend.length} readings shown.`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid vertical={false} stroke="#e6e5e7" />
                <XAxis dataKey="t" tickLine={false} axisLine={false} fontSize={11} interval={23} />
                <YAxis yAxisId="t" tickLine={false} axisLine={false} fontSize={11} width={32} domain={[16, 36]} unit="°" />
                <YAxis yAxisId="h" orientation="right" tickLine={false} axisLine={false} fontSize={11} width={32} domain={[20, 90]} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine yAxisId="t" y={28} stroke="#ED1C24" strokeDasharray="4 4" label={{ value: 'max 28°C', fontSize: 10, fill: '#ED1C24', position: 'insideTopRight' }} />
                <ReferenceLine yAxisId="h" y={60} stroke="#83B3EE" strokeDasharray="4 4" />
                <Line yAxisId="t" type="monotone" dataKey="temp" name="Temperature °C" stroke="#ED1C24" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line yAxisId="h" type="monotone" dataKey="hum" name="Humidity %RH" stroke="#83B3EE" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
