import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/db"
import type { KnowledgeSource } from "@/lib/ai/rag"
import { timeAgo } from "@/lib/format"
import { PriorityBadge, SentimentBadge, StatusBadge } from "@/components/badges"
import { DraftProvider } from "@/components/tickets/draft-context"
import { Conversation } from "@/components/tickets/conversation"
import { Composer } from "@/components/tickets/composer"
import { AnalysisPanel } from "@/components/tickets/analysis-panel"
import { TicketProperties } from "@/components/tickets/ticket-properties"
import { CustomerCard } from "@/components/tickets/customer-card"
import { SimulateCustomer } from "@/components/tickets/simulate-customer"

async function getTicket(id: number) {
  if (!Number.isInteger(id)) return null
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      customer: { include: { _count: { select: { tickets: true } } } },
      assignedAgent: true,
      tags: { orderBy: { name: "asc" } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: true } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })
}

export async function generateMetadata({ params }: PageProps<"/tickets/[id]">): Promise<Metadata> {
  const ticket = await getTicket(Number((await params).id))
  return { title: ticket ? `#${ticket.id} ${ticket.subject}` : "Ticket not found" }
}

export default async function TicketPage({ params }: PageProps<"/tickets/[id]">) {
  const ticket = await getTicket(Number((await params).id))
  if (!ticket) notFound()

  const [agents, allTags] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ])
  const analysis = ticket.analyses[0]
  const sources: KnowledgeSource[] = analysis ? JSON.parse(analysis.sources) : []

  return (
    <DraftProvider>
      <div className="border-b bg-background px-4 py-3 md:px-6">
        <Link href="/tickets" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Tickets
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="font-normal text-muted-foreground">#{ticket.id}</span> {ticket.subject}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <SentimentBadge sentiment={ticket.sentiment} />
          </div>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {ticket.customer.name} via {ticket.channel} · opened {timeAgo(ticket.createdAt)}
        </p>
      </div>

      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Conversation
            customerName={ticket.customer.name}
            messages={ticket.messages.map((m) => ({
              id: m.id,
              senderType: m.senderType,
              content: m.content,
              internal: m.internal,
              aiGenerated: m.aiGenerated,
              createdAt: m.createdAt.toISOString(),
              authorName: m.author?.name ?? null,
              authorColor: m.author?.avatarColor ?? null,
            }))}
          />
          <Composer ticketId={ticket.id} status={ticket.status} />
        </div>

        <aside className="flex flex-col gap-4">
          <AnalysisPanel
            ticketId={ticket.id}
            ticketPriority={ticket.priority}
            analysis={
              analysis && {
                intent: analysis.intent,
                sentiment: analysis.sentiment,
                sentimentScore: analysis.sentimentScore,
                emotion: analysis.emotion,
                priority: analysis.priority,
                category: analysis.category,
                confidence: analysis.confidence,
                requiresHuman: analysis.requiresHuman,
                reason: analysis.reason,
                summary: analysis.summary,
                suggestedResponse: analysis.suggestedResponse,
                model: analysis.model,
                createdAt: analysis.createdAt.toISOString(),
                sources,
              }
            }
          />
          <TicketProperties
            ticketId={ticket.id}
            status={ticket.status}
            priority={ticket.priority}
            category={ticket.category}
            assignedAgentId={ticket.assignedAgentId}
            tags={ticket.tags.map((t) => t.name)}
            satisfaction={ticket.satisfaction}
            agents={agents}
            allTags={allTags.map((t) => t.name)}
          />
          <CustomerCard
            name={ticket.customer.name}
            email={ticket.customer.email}
            plan={ticket.customer.plan}
            since={ticket.customer.createdAt.toISOString()}
            ticketCount={ticket.customer._count.tickets}
          />
          <SimulateCustomer ticketId={ticket.id} />
        </aside>
      </div>
    </DraftProvider>
  )
}
