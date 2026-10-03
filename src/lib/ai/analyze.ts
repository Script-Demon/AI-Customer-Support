import { prisma } from "@/lib/db"
import { CATEGORIES, INTENTS, INTENT_CATEGORY, PRIORITIES, PRIORITY_RANK, SENTIMENTS, isPriority } from "@/lib/constants"
import { CHAT_MODEL, completeJSON, getOpenAI } from "./client"
import { analyzeHeuristic } from "./heuristics"
import { formatSourcesForPrompt, searchKnowledge } from "./rag"
import { EMOTIONS, type AnalysisResult, type ConversationContext } from "./types"

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "intent", "sentiment", "sentiment_score", "emotion", "priority", "category",
    "confidence", "requires_human", "reason", "summary", "suggested_response",
  ],
  properties: {
    intent: { type: "string", enum: [...INTENTS] },
    sentiment: { type: "string", enum: [...SENTIMENTS] },
    sentiment_score: { type: "number", description: "-1 very negative to 1 very positive" },
    emotion: { type: "string", enum: [...EMOTIONS] },
    priority: { type: "string", enum: [...PRIORITIES] },
    category: { type: "string", enum: [...CATEGORIES] },
    confidence: { type: "number", description: "0-1 confidence in the intent classification" },
    requires_human: { type: "boolean" },
    reason: { type: "string", description: "One short line explaining the priority, e.g. 'Delayed shipment, customer waiting 10 days'" },
    summary: { type: "string", description: "One or two sentence summary of the conversation" },
    suggested_response: { type: "string", description: "Reply to the customer, grounded only in the knowledge base" },
  },
} as const

type RawAnalysis = {
  intent: AnalysisResult["intent"]
  sentiment: AnalysisResult["sentiment"]
  sentiment_score: number
  emotion: AnalysisResult["emotion"]
  priority: AnalysisResult["priority"]
  category: AnalysisResult["category"]
  confidence: number
  requires_human: boolean
  reason: string
  summary: string
  suggested_response: string
}

const SYSTEM_PROMPT = `You are the triage assistant for a customer support team.
Analyse the conversation and return the structured analysis.

Rules:
- Base intent, sentiment and emotion on the customer's most recent messages.
- Priority: "urgent" for legal threats, chargebacks, security/fraud or very angry customers; "high" for frustrated customers with order, billing or access problems or long waits; "low" for feedback and simple questions; otherwise "medium".
- requires_human is true when the case needs judgement, an exception to policy, account changes, or the customer is angry. It is false when the knowledge base fully answers the question.
- suggested_response: a ready-to-send reply addressed to the customer by first name and signed by the agent. Use ONLY facts from the knowledge base excerpts; if they don't cover the question, say you'll look into it rather than inventing policy. Apply the policy to the customer's situation (e.g. compare elapsed days with a return window). Plain text, no markdown, under 140 words.`

export function renderConversation(ctx: ConversationContext) {
  const lines = ctx.messages.map((m) => {
    const who = m.senderType === "customer" ? `Customer (${ctx.customerName})` : m.internal ? "Internal note" : `Agent${m.authorName ? ` (${m.authorName})` : ""}`
    return `${who}: ${m.content}`
  })
  return `Subject: ${ctx.subject}\n\n${lines.join("\n\n")}`
}

export function retrievalQuery(ctx: ConversationContext) {
  const recent = ctx.messages.filter((m) => m.senderType === "customer").slice(-2).map((m) => m.content)
  return [ctx.subject, ...recent].join("\n")
}

/** Runs the AI analysis for a conversation: retrieve KB context, then classify + draft. */
export async function analyzeConversation(ctx: ConversationContext): Promise<AnalysisResult> {
  const sources = await searchKnowledge(retrievalQuery(ctx))
  if (!getOpenAI()) return analyzeHeuristic(ctx, sources)
  try {
    const raw = await completeJSON<RawAnalysis>({
      name: "ticket_analysis",
      schema: ANALYSIS_SCHEMA,
      system: SYSTEM_PROMPT,
      user: `Agent name: ${ctx.agentName ?? "Customer Support"}\n\nKnowledge base excerpts:\n${formatSourcesForPrompt(sources)}\n\nConversation:\n${renderConversation(ctx)}`,
    })
    return {
      intent: raw.intent,
      sentiment: raw.sentiment,
      sentimentScore: clamp(raw.sentiment_score, -1, 1),
      emotion: raw.emotion,
      priority: raw.priority,
      category: raw.category ?? INTENT_CATEGORY[raw.intent],
      confidence: clamp(raw.confidence, 0, 1),
      requiresHuman: raw.requires_human,
      reason: raw.reason,
      summary: raw.summary,
      suggestedResponse: raw.suggested_response,
      sources,
      model: CHAT_MODEL,
    }
  } catch (err) {
    console.error("[ai] analysis failed, using heuristic fallback:", err)
    return analyzeHeuristic(ctx, sources)
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0))
}

export async function loadConversation(ticketId: number, agentName?: string): Promise<ConversationContext> {
  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: {
      customer: true,
      assignedAgent: true,
      messages: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  })
  return {
    subject: ticket.subject,
    customerName: ticket.customer.name,
    agentName: agentName ?? ticket.assignedAgent?.name,
    messages: ticket.messages.map((m) => ({
      senderType: m.senderType,
      content: m.content,
      internal: m.internal,
      authorName: m.author?.name,
    })),
  }
}

/**
 * Analyses a ticket and stores the result. The ticket's sentiment and category are
 * refreshed; priority is applied when `applyPriority` is set (new tickets) or when the
 * AI escalates above the current priority. Agents can still override it afterwards.
 */
export async function analyzeTicket(ticketId: number, opts: { applyPriority?: boolean; agentName?: string } = {}) {
  const ctx = await loadConversation(ticketId, opts.agentName)
  const result = await analyzeConversation(ctx)
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { priority: true } })
  const current = isPriority(ticket.priority) ? ticket.priority : "medium"
  const escalate = PRIORITY_RANK[result.priority] > PRIORITY_RANK[current]

  await prisma.$transaction([
    prisma.aIAnalysis.create({
      data: {
        ticketId,
        intent: result.intent,
        sentiment: result.sentiment,
        sentimentScore: result.sentimentScore,
        emotion: result.emotion,
        priority: result.priority,
        category: result.category,
        confidence: result.confidence,
        requiresHuman: result.requiresHuman,
        reason: result.reason,
        summary: result.summary,
        suggestedResponse: result.suggestedResponse,
        sources: JSON.stringify(result.sources),
        model: result.model,
      },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        sentiment: result.sentiment,
        category: result.category,
        ...(opts.applyPriority || escalate ? { priority: result.priority } : {}),
      },
    }),
  ])
  return result
}
