"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { AGENT_COOKIE, getCurrentAgent } from "@/lib/session"
import { CATEGORIES, PRIORITIES, STATUSES, type Status } from "@/lib/constants"
import { analyzeTicket, loadConversation } from "@/lib/ai/analyze"
import { answerQuestion, generateReply, rewriteReply, summarizeConversation } from "@/lib/ai/compose"
import { ensureIndexed, indexDocument } from "@/lib/ai/rag"
import type { Tone } from "@/lib/ai/types"

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    console.error(err)
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong" }
  }
}

function revalidateTicket(id: number) {
  revalidatePath(`/tickets/${id}`)
  revalidatePath("/tickets")
  revalidatePath("/")
}

// ── Session ──────────────────────────────────────────────────────────────────

export async function setCurrentAgent(agentId: string) {
  ;(await cookies()).set(AGENT_COOKIE, agentId, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 })
  revalidatePath("/", "layout")
}

// ── Tickets ──────────────────────────────────────────────────────────────────

const createTicketSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().trim().optional(),
  customerEmail: z.string().trim().optional(),
  subject: z.string().trim().min(3, "Subject is too short"),
  message: z.string().trim().min(5, "Message is too short"),
  priority: z.enum([...PRIORITIES, "auto"]),
  assignedAgentId: z.string().optional(),
  channel: z.enum(["email", "chat", "web", "phone"]),
  tags: z.array(z.string()),
})

export async function createTicket(input: z.input<typeof createTicketSchema>): Promise<ActionResult<{ id: number }>> {
  const parsed = createTicketSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const data = parsed.data

  return attempt(async () => {
    let customerId = data.customerId
    if (!customerId) {
      if (!data.customerName || !data.customerEmail || !z.email().safeParse(data.customerEmail).success) {
        throw new Error("Pick an existing customer or enter a name and valid email")
      }
      const customer = await prisma.customer.upsert({
        where: { email: data.customerEmail.toLowerCase() },
        update: {},
        create: { name: data.customerName, email: data.customerEmail.toLowerCase() },
      })
      customerId = customer.id
    }

    const ticket = await prisma.ticket.create({
      data: {
        customerId,
        subject: data.subject,
        channel: data.channel,
        priority: data.priority === "auto" ? "medium" : data.priority,
        assignedAgentId: data.assignedAgentId || null,
        status: data.assignedAgentId ? "in_progress" : "open",
        tags: { connectOrCreate: data.tags.map((name) => ({ where: { name }, create: { name } })) },
        messages: { create: { senderType: "customer", content: data.message } },
      },
    })
    await analyzeTicket(ticket.id, { applyPriority: data.priority === "auto" })
    revalidateTicket(ticket.id)
    return { id: ticket.id }
  })
}

const ticketUpdateSchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  assignedAgentId: z.string().nullable().optional(),
})

/** Moving into or out of "resolved" maintains resolvedAt and the AI-resolution flag. */
async function statusSideEffects(ticketId: number, from: string, to: Status) {
  if (to === "resolved" && from !== "resolved") {
    const replies = await prisma.message.findMany({
      where: { ticketId, senderType: "agent", internal: false },
      select: { aiGenerated: true },
    })
    return { resolvedAt: new Date(), resolvedByAI: replies.length > 0 && replies.every((r) => r.aiGenerated) }
  }
  if (to !== "resolved" && from === "resolved") return { resolvedAt: null, resolvedByAI: false }
  return {}
}

export async function updateTicket(ticketId: number, input: z.input<typeof ticketUpdateSchema>): Promise<ActionResult> {
  const parsed = ticketUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  return attempt(async () => {
    const current = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    const data = parsed.data
    const extra = data.status ? await statusSideEffects(ticketId, current.status, data.status) : {}
    const agent = await getCurrentAgent()
    const changes: string[] = []
    if (data.status && data.status !== current.status) changes.push(`status → ${data.status.replace("_", " ")}`)
    if (data.priority && data.priority !== current.priority) changes.push(`priority → ${data.priority}`)
    if (data.assignedAgentId !== undefined && data.assignedAgentId !== current.assignedAgentId) {
      const assignee = data.assignedAgentId ? await prisma.user.findUnique({ where: { id: data.assignedAgentId } }) : null
      changes.push(assignee ? `assigned to ${assignee.name}` : "unassigned")
    }
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        ...data,
        ...extra,
        // Picking up an open ticket moves it into progress.
        ...(data.assignedAgentId && current.status === "open" && !data.status ? { status: "in_progress" } : {}),
      },
    })
    if (changes.length) {
      await prisma.message.create({
        data: { ticketId, senderType: "system", authorId: agent?.id, content: `${agent?.name ?? "Someone"} changed ${changes.join(", ")}` },
      })
    }
    revalidateTicket(ticketId)
  })
}

export async function setTicketTags(ticketId: number, tags: string[]): Promise<ActionResult> {
  const names = [...new Set(tags.map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean))]
  return attempt(async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { tags: { set: [], connectOrCreate: names.map((name) => ({ where: { name }, create: { name } })) } },
    })
    revalidateTicket(ticketId)
  })
}

const replySchema = z.object({
  content: z.string().trim().min(1, "Message is empty"),
  internal: z.boolean(),
  aiGenerated: z.boolean(),
  nextStatus: z.enum(STATUSES).optional(),
})

/** Agent reply or internal note. A public reply moves the ticket to "waiting" (on the customer) unless told otherwise. */
export async function sendReply(ticketId: number, input: z.input<typeof replySchema>): Promise<ActionResult> {
  const parsed = replySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const { content, internal, aiGenerated, nextStatus } = parsed.data
  return attempt(async () => {
    const agent = await getCurrentAgent()
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    await prisma.message.create({
      data: { ticketId, senderType: "agent", authorId: agent?.id, content, internal, aiGenerated: !internal && aiGenerated },
    })
    if (!internal) {
      const status: Status = nextStatus ?? "waiting"
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status,
          firstResponseAt: ticket.firstResponseAt ?? new Date(),
          assignedAgentId: ticket.assignedAgentId ?? agent?.id,
          ...(await statusSideEffects(ticketId, ticket.status, status)),
        },
      })
    }
    revalidateTicket(ticketId)
  })
}

/** Demo helper: posts a message as the customer and re-runs the AI analysis, like an inbound email would. */
export async function simulateCustomerMessage(ticketId: number, content: string): Promise<ActionResult> {
  if (!content.trim()) return { ok: false, error: "Message is empty" }
  return attempt(async () => {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    await prisma.message.create({ data: { ticketId, senderType: "customer", content: content.trim() } })
    if (ticket.status === "waiting" || ticket.status === "resolved") {
      const status: Status = ticket.assignedAgentId ? "in_progress" : "open"
      await prisma.ticket.update({ where: { id: ticketId }, data: { status, ...(await statusSideEffects(ticketId, ticket.status, status)) } })
    }
    await analyzeTicket(ticketId)
    revalidateTicket(ticketId)
  })
}

export async function setSatisfaction(ticketId: number, rating: number): Promise<ActionResult> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Rating must be 1-5" }
  return attempt(async () => {
    await prisma.ticket.update({ where: { id: ticketId }, data: { satisfaction: rating } })
    revalidateTicket(ticketId)
  })
}

// ── AI assistant ─────────────────────────────────────────────────────────────

export async function reanalyzeTicket(ticketId: number): Promise<ActionResult> {
  return attempt(async () => {
    const agent = await getCurrentAgent()
    await analyzeTicket(ticketId, { agentName: agent?.name })
    revalidateTicket(ticketId)
  })
}

export async function aiGenerateReply(ticketId: number) {
  return attempt(async () => {
    const agent = await getCurrentAgent()
    return generateReply(await loadConversation(ticketId, agent?.name))
  })
}

export async function aiRewrite(text: string, tone: Tone) {
  if (!text.trim()) return { ok: false, error: "Write or generate a reply first" } as const
  return attempt(() => rewriteReply(text, tone))
}

export async function aiSummarize(ticketId: number) {
  return attempt(async () => summarizeConversation(await loadConversation(ticketId)))
}

// ── Knowledge base ───────────────────────────────────────────────────────────

const docSchema = z.object({
  title: z.string().trim().min(3, "Title is too short"),
  category: z.string().trim().min(2, "Pick a category"),
  content: z.string().trim().min(20, "Content is too short"),
})

export async function saveKnowledgeDoc(id: string | null, input: z.input<typeof docSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = docSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  return attempt(async () => {
    const doc = id
      ? await prisma.knowledgeDocument.update({ where: { id }, data: parsed.data })
      : await prisma.knowledgeDocument.create({ data: parsed.data })
    await indexDocument(doc.id)
    revalidatePath("/knowledge")
    revalidatePath(`/knowledge/${doc.id}`)
    return { id: doc.id }
  })
}

export async function deleteKnowledgeDoc(id: string) {
  await prisma.knowledgeDocument.delete({ where: { id } })
  revalidatePath("/knowledge")
  redirect("/knowledge")
}

export async function reindexKnowledge(): Promise<ActionResult<{ reindexed: number }>> {
  return attempt(async () => {
    const docs = await prisma.knowledgeDocument.findMany({ select: { id: true } })
    for (const d of docs) await indexDocument(d.id)
    revalidatePath("/knowledge")
    return { reindexed: docs.length }
  })
}

export async function askKnowledgeBase(question: string) {
  if (!question.trim()) return { ok: false, error: "Ask a question" } as const
  return attempt(async () => {
    await ensureIndexed()
    return answerQuestion(question)
  })
}
