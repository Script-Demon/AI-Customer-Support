"use client"

import { useState } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"
import { AXIS, SERIES } from "./palette"

type Point = { label: string; created: number; resolved: number; aiRate: number | null }
type SeriesDef = { key: keyof Point; name: string; color: string; format?: (v: number) => string }

function ChartTooltip({ active, payload, label, series }: TooltipContentProps<number, string> & { series: SeriesDef[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as Point
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <div className="mb-1 text-muted-foreground">{label}</div>
      {series.map((s) => {
        const v = point[s.key] as number | null
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="font-semibold tabular-nums">{v == null ? "—" : s.format ? s.format(v) : v}</span>
            <span className="text-muted-foreground">{s.name}</span>
          </div>
        )
      })}
    </div>
  )
}

function Legend({ series }: { series: SeriesDef[] }) {
  if (series.length < 2) return null
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  )
}

function ChartCard({ title, subtitle, data, series, yDomain, yFormat }: { title: string; subtitle?: string; data: Point[]; series: SeriesDef[]; yDomain?: [number, number]; yFormat?: (v: number) => string }) {
  const [table, setTable] = useState(false)
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Legend series={series} />
          <button className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setTable((t) => !t)}>
            {table ? "Chart" : "Table"}
          </button>
        </div>
      </div>
      {table ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background text-left text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Period</th>
                {series.map((s) => <th key={s.key} className="py-1 text-right font-medium">{s.name}</th>)}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {data.map((d) => (
                <tr key={d.label} className="border-t">
                  <td className="py-1">{d.label}</td>
                  {series.map((s) => {
                    const v = d[s.key] as number | null
                    return <td key={s.key} className="py-1 text-right">{v == null ? "—" : s.format ? s.format(v) : v}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={AXIS.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS.tick }} tickLine={false} axisLine={{ stroke: AXIS.grid }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: AXIS.tick }} tickLine={false} axisLine={false} allowDecimals={false} domain={yDomain} tickFormatter={yFormat} width={44} />
              <Tooltip cursor={{ stroke: AXIS.tick, strokeWidth: 1 }} content={(props) => <ChartTooltip {...(props as TooltipContentProps<number, string>)} series={series} />} />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

export function TicketsOverTimeChart({ data, weekly }: { data: Point[]; weekly: boolean }) {
  return (
    <ChartCard
      title="Tickets over time"
      subtitle={`New vs resolved, per ${weekly ? "week" : "day"}`}
      data={data}
      series={[
        { key: "created", name: "Created", color: SERIES[1] },
        { key: "resolved", name: "Resolved", color: SERIES[2] },
      ]}
    />
  )
}

export function AiResolutionChart({ data, weekly }: { data: Point[]; weekly: boolean }) {
  const pct = (v: number) => `${v}%`
  return (
    <ChartCard
      title="AI resolution rate"
      subtitle={`Share of resolved tickets answered entirely with AI-drafted replies${weekly ? ", per week" : " (trailing 7 days)"}`}
      data={data}
      series={[{ key: "aiRate", name: "AI resolution rate", color: SERIES[1], format: pct }]}
      yDomain={[0, 100]}
      yFormat={pct}
    />
  )
}
