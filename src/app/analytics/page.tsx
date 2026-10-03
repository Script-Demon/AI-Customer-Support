import Link from "next/link"
import type { Metadata } from "next"
import { getAnalytics } from "@/lib/analytics"
import { formatDuration, pct } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { StatTile, makeDelta } from "@/components/charts/stat-tile"
import { AiResolutionChart, TicketsOverTimeChart } from "@/components/charts/time-charts"
import { BarList, SentimentSplit } from "@/components/charts/bar-list"

export const metadata: Metadata = { title: "Analytics" }

const RANGES = [7, 30, 90] as const

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const raw = Number((await searchParams).days)
  const days = RANGES.includes(raw as (typeof RANGES)[number]) ? raw : 30
  const a = await getAnalytics(days)
  const s = a.summary
  const p = a.previous
  const pts = (d: number) => `${Math.round(d * 100)} pts`

  return (
    <div>
      <PageHeader title="Analytics" description={`Support performance for tickets opened in the last ${days} days, compared with the ${days} days before.`}>
        <div className="flex rounded-lg border bg-background p-0.5" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/analytics?days=${r}`}
              className={cn("rounded-md px-2.5 py-1 text-sm", r === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              aria-current={r === days ? "page" : undefined}
            >
              {r}d
            </Link>
          ))}
        </div>
      </PageHeader>

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Total tickets" value={String(s.total)} delta={makeDelta(s.total, p.total, { higherIsBetter: null, format: (d) => String(d) })} hint="vs prev. period" />
          <StatTile label="Resolution rate" value={s.resolutionRate == null ? "—" : pct(s.resolutionRate)} delta={makeDelta(s.resolutionRate, p.resolutionRate, { higherIsBetter: true, format: pts })} />
          <StatTile label="Avg first response" value={formatDuration(s.avgFirstResponseMs)} delta={makeDelta(s.avgFirstResponseMs, p.avgFirstResponseMs, { higherIsBetter: false, format: (d) => formatDuration(d) })} />
          <StatTile label="Avg resolution time" value={formatDuration(s.avgResolutionMs)} delta={makeDelta(s.avgResolutionMs, p.avgResolutionMs, { higherIsBetter: false, format: (d) => formatDuration(d) })} />
          <StatTile
            label="Customer satisfaction"
            value={s.csat == null ? "—" : `${s.csat.toFixed(1)} / 5`}
            hint={s.csatPositive == null ? undefined : `${pct(s.csatPositive)} rated 4–5`}
            delta={makeDelta(s.csat, p.csat, { higherIsBetter: true, format: (d) => d.toFixed(1) })}
          />
          <StatTile label="AI resolution rate" value={s.aiResolutionRate == null ? "—" : pct(s.aiResolutionRate)} delta={makeDelta(s.aiResolutionRate, p.aiResolutionRate, { higherIsBetter: true, format: pts })} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <TicketsOverTimeChart data={a.overTime} weekly={a.weekly} />
          <AiResolutionChart data={a.overTime} weekly={a.weekly} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <BarList title="Tickets by category" subtitle="Assigned by AI triage" items={a.byCategory} />
          <BarList title="Tickets by priority" items={a.byPriority} />
          <section className="rounded-xl border bg-background p-4">
            <h2 className="text-sm font-semibold">Customer sentiment</h2>
            <p className="mb-3 text-xs text-muted-foreground">Latest detected sentiment per ticket</p>
            <SentimentSplit counts={a.sentiment.counts} total={a.sentiment.total} />
          </section>
        </div>
      </div>
    </div>
  )
}
