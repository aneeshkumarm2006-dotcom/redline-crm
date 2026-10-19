"use client";

import { useRouter } from "next/navigation";
import {
  Bar, BarChart as RechartsBarChart, CartesianGrid, Cell, Line, LineChart as RechartsLineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatValue, themeSeriesColor, type ValueFormat } from "./format";
import { ChartLegend, ChartTable, seriesColor } from "./parts";
import type { CartesianChartProps, ChartDatum, Segment } from "./types";

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };

function flatten(data: ChartDatum[]) {
  return data.map((datum) => ({ label: datum.label, href: datum.href, ...datum.values }));
}

type TooltipEntry = { dataKey?: unknown; name?: unknown; value?: unknown; color?: string; payload?: { fill?: string } };
function TooltipCard({ active, payload, label, format }: { active?: boolean; payload?: readonly TooltipEntry[]; label?: string | number; format?: ValueFormat }) {
  if (!active || !payload?.length) return null;
  return <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
    {label !== undefined && <p className="mb-1.5 font-medium">{label}</p>}
    <ul className="space-y-1">{payload.map((entry) => <li key={String(entry.dataKey ?? entry.name)} className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground"><span aria-hidden className="size-2 rounded-sm" style={{ backgroundColor: String(entry.color ?? entry.payload?.fill ?? "") }} />{String(entry.name ?? "")}</span>
      <span className="font-medium tabular-nums">{formatValue(Number(entry.value ?? 0), format)}</span>
    </li>)}</ul>
  </div>;
}

function useNavigate() {
  const router = useRouter();
  return (payload: unknown) => {
    const href = payload && typeof payload === "object" && "href" in payload ? payload.href : undefined;
    if (typeof href === "string") router.push(href);
  };
}

/** Columns from one baseline: grouped by default, `stacked` for part-to-whole per category. */
export function BarChart({ title, data, series, format, height = 240, stacked = false, layout = "vertical" }: CartesianChartProps & { stacked?: boolean; layout?: "vertical" | "horizontal" }) {
  const navigate = useNavigate();
  const horizontal = layout === "horizontal";
  const clickable = data.some((datum) => datum.href);
  return <figure className="min-w-0">
    <div role="img" aria-label={title} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={flatten(data)} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke="var(--border)" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? <>
            <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatValue(value, format, true)} />
            <YAxis type="category" dataKey="label" tick={axisTick} tickLine={false} axisLine={false} width={96} />
          </> : <>
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} allowDecimals={false} tickFormatter={(value: number) => formatValue(value, format, true)} />
          </>}
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={(props) => <TooltipCard active={props.active} payload={props.payload} label={props.label} format={format} />} />
          {series.map((item, index) => {
            const top = !stacked || index === series.length - 1;
            const radius: [number, number, number, number] = !top ? [0, 0, 0, 0] : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
            return <Bar key={item.key} dataKey={item.key} name={item.label} fill={seriesColor(item, index)} stackId={stacked ? "stack" : undefined}
              maxBarSize={24} radius={radius} stroke="var(--card)" strokeWidth={stacked ? 1 : 0}
              cursor={clickable ? "pointer" : undefined} onClick={(entry) => navigate(entry?.payload)} isAnimationActive={false}>
              {series.length === 1 && data.some((datum) => datum.color) && data.map((datum) => <Cell key={datum.label} fill={datum.color ?? seriesColor(item, index)} />)}
            </Bar>;
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
    <ChartLegend items={series.map((item, index) => ({ key: item.key, label: item.label, color: seriesColor(item, index) }))} />
    <ChartTable title={title} data={data} series={series} format={format} />
  </figure>;
}

/** Change over time: 2px lines with end markers and a crosshair tooltip. */
export function LineChart({ title, data, series, format, height = 240 }: CartesianChartProps) {
  return <figure className="min-w-0">
    <div role="img" aria-label={title} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={flatten(data)} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={(value: number) => formatValue(value, format, true)} />
          <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} content={(props) => <TooltipCard active={props.active} payload={props.payload} label={props.label} format={format} />} />
          {series.map((item, index) => <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={seriesColor(item, index)} strokeWidth={2}
            dot={{ r: 4, fill: seriesColor(item, index), stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
            strokeLinecap="round" strokeLinejoin="round" isAnimationActive={false} />)}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
    <ChartLegend items={series.map((item, index) => ({ key: item.key, label: item.label, color: seriesColor(item, index) }))} />
    <ChartTable title={title} data={data} series={series} format={format} />
  </figure>;
}

/** Part-to-whole for a handful of segments, with the total in the centre and a labelled legend. */
export function DonutChart({ title, segments, format, height = 200, centerLabel }: { title: string; segments: Segment[]; format?: ValueFormat; height?: number; centerLabel?: string }) {
  const navigate = useNavigate();
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const colored = segments.map((segment, index) => ({ ...segment, fill: segment.color ?? themeSeriesColor(index) }));
  return <figure className="min-w-0">
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div role="img" aria-label={title} className="relative w-full max-w-[220px] shrink-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={(props) => <TooltipCard active={props.active} payload={props.payload} format={format} />} />
            <Pie data={colored} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="96%" paddingAngle={segments.length > 1 ? 1.5 : 0}
              stroke="var(--card)" strokeWidth={2} isAnimationActive={false} onClick={(entry) => navigate(entry?.payload)}>
              {colored.map((segment) => <Cell key={segment.key} fill={segment.fill} cursor={segment.href ? "pointer" : undefined} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">{formatValue(total, format, true)}</span>
          {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
        </div>
      </div>
      <ul className="grid w-full gap-1.5 text-sm">
        {colored.map((segment) => <li key={segment.key} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: segment.fill }} /><span className="truncate">{segment.label}</span></span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{formatValue(segment.value, format)}{total > 0 && <span className="ml-2 text-xs">{Math.round((segment.value / total) * 100)}%</span>}</span>
        </li>)}
      </ul>
    </div>
    <ChartTable title={title} data={segments.map((segment) => ({ label: segment.label, values: { value: segment.value } }))} series={[{ key: "value", label: title }]} format={format} />
  </figure>;
}
