import Link from "next/link"
import { addDays } from "date-fns"
import { AlertTriangle, ArrowRight, Sparkles, UserRound } from "lucide-react"
import { prisma } from "@/lib/db"
import { getCurrentAgent } from "@/lib/session"
import { PRIORITY_RANK, isPriority } from "@/lib/constants"
import { sentimentBreakdown } from "@/lib/analytics"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { StatTile } from "@/components/charts/stat-tile"
import { SentimentSplit } from "@/components/charts/bar-list"
import { PriorityBadge, SentimentBadge, StatusBadge } from "@/components/badges"

const rank = (p: string) => (isPriority(p) ? PRIORITY_RANK[p] : 0)

export default async function DashboardPage() {
  const me = await getCurrentAgent()
  const unresolved = { status: { not: "resolved" } }
  const [active, recent, myQueue] = await Promise.all([
    prisma.ticket.findMany({
      where: unresolved,
      include: { customer: true, analyses: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.ticket.findMany({ where: { createdAt: { gte: addDays(new Date(), -30) } }, select: { sentiment: true } }),
    prisma.ticket.findMany({
      where: { ...unresolved, assignedAgentId: me?.id },
      include: { customer: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ])

  const flagged = active
    .filter((t) => t.analyses[0] && (t.analyses[0].requiresHuman || rank(t.priority) >= 2))
    .sort((a, b) => rank(b.priority) - rank(a.priority) || b.createdAt.getTime() - a.createdAt.getTime())
  const sentiment = sentimentBreakdown(recent)
  const count = (pred: (t: (typeof active)[number]) => boolean) => active.filter(pred).length

  return (
    <div>
      <PageHeader title={`Welcome back${me ? `, ${me.name.split(" ")[0]}` : ""}`} description="Here's what needs your attention today." />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Open tickets" value={String(count((t) => t.status === "open" || t.status === "in_progress"))} hint="open + in progress" />
          <StatTile label="Unassigned" value={String(count((t) => !t.assignedAgentId))} hint="waiting for an owner" />
          <StatTile label="High & urgent" value={String(count((t) => rank(t.priority) >= 2))} hint="unresolved" />
          <StatTile label="Waiting on customer" value={String(count((t) => t.status === "waiting"))} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-xl border bg-background">
            <header className="flex items-center gap-2 border-b px-4 py-3">
              <AlertTriangle className="size-4 text-red-600" />
              <h2 className="text-sm font-semibold">Flagged by AI</h2>
              <span className="text-xs text-muted-foreground">{flagged.length} conversations need a human or are high priority</span>
            </header>
            {flagged.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nothing flagged. Nice work.</p>
            ) : (
              <ul className="divide-y">
                {flagged.slice(0, 8).map((t) => {
                  const a = t.analyses[0]
                  const severe = t.priority === "urgent" || a.requiresHuman
                  return (
                    <li key={t.id}>
                      <Link href={`/tickets/${t.id}`} className="flex gap-3 px-4 py-3 hover:bg-muted/50">
                        <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", severe ? "bg-red-600" : "bg-orange-500")} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={cn("text-[11px] font-bold tracking-wide uppercase", severe ? "text-red-700" : "text-orange-700")}>
                              {t.priority === "urgent" ? "Urgent" : "High priority"}
                            </span>
                            <span className="truncate text-sm font-medium">
                              #{t.id} {t.subject}
                            </span>
                            <span className="text-xs text-muted-foreground">· {t.customer.name} · {timeAgo(t.createdAt)}</span>
                          </div>
                          <p className="mt-1 text-sm">
                            Customer is <strong>{a.emotion}</strong>. <span className="text-muted-foreground">Reason:</span> {a.reason}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            {a.requiresHuman ? <UserRound className="size-3.5" /> : <Sparkles className="size-3.5" />}
                            AI recommendation: {a.requiresHuman ? "Escalate to human agent" : "Reply with the AI-suggested response"}
                          </p>
                        </div>
                        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                          <PriorityBadge priority={t.priority} />
                          <SentimentBadge sentiment={t.sentiment} />
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-4">
            <section className="rounded-xl border bg-background p-4">
              <h2 className="text-sm font-semibold">Customer sentiment</h2>
              <p className="mb-3 text-xs text-muted-foreground">Tickets opened in the last 30 days</p>
              <SentimentSplit counts={sentiment.counts} total={sentiment.total} />
            </section>

            <section className="rounded-xl border bg-background">
              <header className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold">My queue</h2>
                <Link href="/tickets?assignee=me" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  View all <ArrowRight className="size-3" />
                </Link>
              </header>
              {myQueue.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No open tickets assigned to you.</p>
              ) : (
                <ul className="divide-y">
                  {myQueue.map((t) => (
                    <li key={t.id}>
                      <Link href={`/tickets/${t.id}`} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/50">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{t.subject}</div>
                          <div className="truncate text-xs text-muted-foreground">{t.customer.name}</div>
                        </div>
                        <StatusBadge status={t.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
