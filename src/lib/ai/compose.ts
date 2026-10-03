import { completeText, getOpenAI } from "./client"
import { renderConversation, retrievalQuery } from "./analyze"
import {
  answerHeuristic,
  detectIntent,
  draftReplyHeuristic,
  rewriteHeuristic,
  scoreSentiment,
  sentimentLabel,
  summarizeHeuristic,
} from "./heuristics"
import { formatSourcesForPrompt, searchKnowledge, type KnowledgeSource } from "./rag"
import type { ConversationContext, Tone } from "./types"

export type Draft = { text: string; sources: KnowledgeSource[]; model: string }

async function withFallback<T>(online: () => Promise<T>, offline: () => T): Promise<T> {
  if (!getOpenAI()) return offline()
  try {
    return await online()
  } catch (err) {
    console.error("[ai] request failed, using heuristic fallback:", err)
    return offline()
  }
}

/** Drafts a reply for the agent to review. Retrieves KB context first (RAG). */
export async function generateReply(ctx: ConversationContext): Promise<Draft> {
  const sources = await searchKnowledge(retrievalQuery(ctx))
  return withFallback(
    async () => ({
      text: await completeText(
        `You are ${ctx.agentName ?? "a support agent"} writing a reply to a customer. The agent will review it before sending.
Use ONLY facts from the knowledge base excerpts and the conversation; never invent policies, dates, or order details. If the excerpts don't answer the question, say you're looking into it.
Apply policies to the customer's specifics (e.g. compare elapsed days with a 30-day window). Be empathetic if the customer is upset.
Address the customer by first name, sign with the agent's name. Plain text, no markdown, under 160 words.`,
        `Knowledge base excerpts:\n${formatSourcesForPrompt(sources)}\n\nConversation:\n${renderConversation(ctx)}\n\nWrite the next agent reply.`
      ),
      sources,
      model: "openai",
    }),
    () => {
      const customerText = ctx.messages.filter((m) => m.senderType === "customer").slice(-2).map((m) => m.content).join("\n")
      const { intent } = detectIntent(`${ctx.subject}\n${customerText}`)
      const sentiment = sentimentLabel(scoreSentiment(customerText))
      return { text: draftReplyHeuristic(ctx, intent, sentiment, sources), sources, model: "heuristic" }
    }
  )
}

export async function rewriteReply(text: string, tone: Tone): Promise<string> {
  const instruction =
    tone === "professional"
      ? "Rewrite this customer support reply to be more professional and polished: clear, courteous, no slang, no emojis, no exclamation marks."
      : "Rewrite this customer support reply to be warmer and friendlier: conversational, empathetic, upbeat, but still concise."
  return withFallback(
    () =>
      completeText(
        `${instruction} Keep every fact, commitment, name and number exactly as given. Keep the greeting and sign-off. Return only the rewritten reply in plain text.`,
        text,
        0.5
      ),
    () => rewriteHeuristic(text, tone)
  )
}

export async function summarizeConversation(ctx: ConversationContext): Promise<string> {
  return withFallback(
    () =>
      completeText(
        "Summarize this support conversation for an agent taking over the ticket. Return 3-5 short bullet points starting with '• ': the issue, what has been tried or promised, the customer's mood, and the next action needed. Plain text.",
        renderConversation(ctx),
        0.2
      ),
    () => summarizeHeuristic(ctx)
  )
}

/** Knowledge-base Q&A: retrieval + grounded answer, shown on the Knowledge page. */
export async function answerQuestion(question: string): Promise<{ answer: string; sources: KnowledgeSource[] }> {
  const sources = await searchKnowledge(question)
  const answer = await withFallback(
    () =>
      completeText(
        "Answer the customer's question using ONLY the knowledge base excerpts. Apply the policy to their situation. If the excerpts don't contain the answer, say so. Cite sources like [1]. Plain text, under 120 words.",
        `Knowledge base excerpts:\n${formatSourcesForPrompt(sources)}\n\nQuestion: ${question}`,
        0.2
      ),
    () => answerHeuristic(question, sources)
  )
  return { answer, sources }
}
