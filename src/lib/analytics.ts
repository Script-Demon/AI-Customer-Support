import { addDays, format, startOfDay, startOfWeek } from "date-fns"
import { prisma } from "@/lib/db"
import { CATEGORIES, PRIORITIES, PRIORITY_LABEL } from "@/lib/constants"

type TicketRow = {
  createdAt: Date
  firstResponseAt: Date | null
  resolvedAt: Date | null
  status: string
  priority: string
  category: string | null
  sentiment: string | null
  satisfaction: number | null
  resolvedByAI: boolean
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const ratio = (n: number, d: number) => (d ? n / d : null)

export function summarize(tickets: TicketRow[]) {
  const resolved = tickets.filter((t) => t.status === "resolved" && t.resolvedAt)
  const rated = tickets.filter((t) => t.satisfaction != null)
  return {
    total: tickets.length,
    resolutionRate: ratio(resolved.length, tickets.length),
    avgFirstResponseMs: mean(tickets.filter((t) => t.firstResponseAt).map((t) => t.firstResponseAt!.getTime() - t.createdAt.getTime())),
    avgResolutionMs: mean(resolved.map((t) => t.resolvedAt!.getTime() - t.createdAt.getTime())),
    csat: mean(rated.map((t) => t.satisfaction!)),
    csatPositive: ratio(rated.filter((t) => t.satisfaction! >= 4).length, rated.length),
    aiResolutionRate: ratio(resolved.filter((t) => t.resolvedByAI).length, resolved.length),
  }
}

export type Summary = ReturnType<typeof summarize>

export function sentimentBreakdown(tickets: { sentiment: string | null }[]) {
  const counts = { positive: 0, neutral: 0, negative: 0 }
  for (const t of tickets) if (t.sentiment && t.sentiment in counts) counts[t.sentiment as keyof typeof counts]++
  const total = counts.positive + counts.neutral + counts.negative
  return { counts, total }
}

const SELECT = {
  createdAt: true,
  firstResponseAt: true,
  resolvedAt: true,
  status: true,
  priority: true,
  category: true,
  sentiment: true,
  satisfaction: true,
  resolvedByAI: true,
} as const

export async function getAnalytics(days: number) {
  const now = new Date()
  const from = startOfDay(addDays(now, -(days - 1)))
  const prevFrom = addDays(from, -days)

  const [current, previous] = await Promise.all([
    prisma.ticket.findMany({ where: { createdAt: { gte: from } }, select: SELECT }),
    prisma.ticket.findMany({ where: { createdAt: { gte: prevFrom, lt: from } }, select: SELECT }),
  ])
  // Resolutions are counted on the day they happen, even for tickets opened earlier.
  const resolvedInRange = await prisma.ticket.findMany({
    where: { resolvedAt: { gte: from } },
    select: { resolvedAt: true, resolvedByAI: true },
  })

  // Daily buckets up to 31 days, weekly beyond that.
  const weekly = days > 31
  const bucketOf = (d: Date) => (weekly ? startOfWeek(d, { weekStartsOn: 1 }) : startOfDay(d)).getTime()
  const buckets = new Map<number, { created: number; resolved: number; aiResolved: number }>()
  for (let d = weekly ? startOfWeek(from, { weekStartsOn: 1 }) : from; d <= now; d = addDays(d, weekly ? 7 : 1)) {
    buckets.set(d.getTime(), { created: 0, resolved: 0, aiResolved: 0 })
  }
  for (const t of current) buckets.get(bucketOf(t.createdAt))!.created++
  for (const t of resolvedInRange) {
    const b = buckets.get(bucketOf(t.resolvedAt!))
    if (!b) continue
    b.resolved++
    if (t.resolvedByAI) b.aiResolved++
  }
  // A single day has too few resolutions for a stable rate, so daily views use a trailing 7-day window.
  const entries = [...buckets.entries()]
  const window = weekly ? 1 : 7
  const overTime = entries.map(([ts, b], i) => {
    const span = entries.slice(Math.max(0, i - window + 1), i + 1).map(([, x]) => x)
    const resolved = span.reduce((s, x) => s + x.resolved, 0)
    const ai = span.reduce((s, x) => s + x.aiResolved, 0)
    return {
      label: format(new Date(ts), weekly ? "MMM d" : days <= 7 ? "EEE" : "MMM d"),
      created: b.created,
      resolved: b.resolved,
      aiRate: resolved ? Math.round((ai / resolved) * 100) : null,
    }
  })

  const byCategory = CATEGORIES.map((c) => ({ name: c, count: current.filter((t) => t.category === c).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
  const byPriority = PRIORITIES.map((p) => ({ name: PRIORITY_LABEL[p], count: current.filter((t) => t.priority === p).length }))

  return {
    days,
    weekly,
    summary: summarize(current),
    previous: summarize(previous),
    overTime,
    byCategory,
    byPriority,
    sentiment: sentimentBreakdown(current),
  }
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>
