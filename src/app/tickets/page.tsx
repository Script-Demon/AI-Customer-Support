import Link from "next/link"
import type { Metadata } from "next"
import { Plus, Sparkles } from "lucide-react"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getCurrentAgent } from "@/lib/session"
import { PRIORITY_RANK, STATUSES, STATUS_LABEL, isPriority, isStatus } from "@/lib/constants"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { AgentAvatar, PriorityBadge, SentimentBadge, StatusBadge, TagPill } from "@/components/badges"
import { TicketFilters } from "@/components/tickets/ticket-filters"

export const metadata: Metadata = { title: "Tickets" }

type Search = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const sp: Search = await searchParams
  const q = one(sp.q).trim()
  const status = one(sp.status)
  const priority = one(sp.priority)
  const assignee = one(sp.assignee)
  const sentiment = one(sp.sentiment)
  const tag = one(sp.tag)
  const sort = one(sp.sort) || "updated"

  const me = await getCurrentAgent()
  const where: Prisma.TicketWhereInput = {
    ...(isPriority(priority) && { priority }),
    ...(["positive", "neutral", "negative"].includes(sentiment) && { sentiment }),
    ...(tag && { tags: { some: { name: tag } } }),
    ...(assignee === "unassigned" ? { assignedAgentId: null } : assignee === "me" ? { assignedAgentId: me?.id } : assignee ? { assignedAgentId: assignee } : {}),
    ...(q && {
      OR: [
        ...(/^#?\d+$/.test(q) ? [{ id: Number(q.replace("#", "")) }] : []),
        { subject: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { email: { contains: q } } },
        { messages: { some: { content: { contains: q } } } },
      ],
    }),
  }

  const [tickets, statusCounts, agents, tags] = await Promise.all([
    prisma.ticket.findMany({
      where: { ...where, ...(isStatus(status) && { status }) },
      include: {
        customer: true,
        assignedAgent: true,
        tags: true,
        messages: { where: { internal: false, senderType: { not: "system" } }, orderBy: { createdAt: "desc" }, take: 1 },
        analyses: { orderBy: { createdAt: "desc" }, take: 1, select: { requiresHuman: true, reason: true } },
      },
      orderBy: sort === "created" ? { createdAt: "desc" } : { updatedAt: "desc" },
      take: 200,
    }),
    prisma.ticket.groupBy({ by: ["status"], where, _count: true }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ])

  if (sort === "priority") {
    tickets.sort((a, b) => (isPriority(b.priority) ? PRIORITY_RANK[b.priority] : 0) - (isPriority(a.priority) ? PRIORITY_RANK[a.priority] : 0))
  }

  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]))
  const total = statusCounts.reduce((s, c) => s + c._count, 0)
  const tabHref = (s: string) => {
    const params = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (k !== "status" && one(v) ? [[k, one(v)]] : [])))
    if (s) params.set("status", s)
    const qs = params.toString()
    return `/tickets${qs ? `?${qs}` : ""}`
  }

  return (
    <div>
      <PageHeader title="Tickets" description="Every customer conversation, with AI triage.">
        <Link href="/tickets/new" className={buttonVariants()}>
          <Plus /> New ticket
        </Link>
      </PageHeader>

      <div className="space-y-3 p-4 md:p-6">
        <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Status">
          {[["", "All", total] as const, ...STATUSES.map((s) => [s, STATUS_LABEL[s], counts[s] ?? 0] as const)].map(([value, label, count]) => (
            <Link
              key={value}
              href={tabHref(value)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
                status === value ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{count}</span>
            </Link>
          ))}
        </nav>

        <TicketFilters agents={agents} tags={tags.map((t) => t.name)} />

        <div className="overflow-hidden rounded-xl border bg-background">
          {tickets.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No tickets match these filters.</div>
          ) : (
            <ul className="divide-y">
              {tickets.map((t) => {
                const last = t.messages[0]
                const flagged = t.analyses[0]?.requiresHuman && t.status !== "resolved"
                return (
                  <li key={t.id}>
                    <Link href={`/tickets/${t.id}`} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/50 md:flex-row md:items-center md:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground tabular-nums">#{t.id}</span>
                          <span className="truncate font-medium">{t.subject}</span>
                          {flagged && (
                            <span title={t.analyses[0]?.reason} className="inline-flex items-center gap-0.5 text-[11px] font-medium text-red-600">
                              <Sparkles className="size-3" /> Needs human
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-sm text-muted-foreground">
                          <span className="text-foreground/80">{t.customer.name}</span>
                          {last && <> · {last.senderType === "agent" ? "You: " : ""}{last.content.replace(/\s+/g, " ").slice(0, 120)}</>}
                        </div>
                        {t.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {t.tags.map((tag) => <TagPill key={tag.id} name={tag.name} />)}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5 md:w-[340px] md:justify-end">
                        <SentimentBadge sentiment={t.sentiment} />
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                        {t.assignedAgent ? (
                          <AgentAvatar name={t.assignedAgent.name} color={t.assignedAgent.avatarColor} size="sm" />
                        ) : (
                          <span className="inline-flex size-6 items-center justify-center rounded-full border border-dashed text-[10px] text-muted-foreground" title="Unassigned">?</span>
                        )}
                        <span className="w-20 text-right text-xs text-muted-foreground">{timeAgo(t.updatedAt)}</span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
