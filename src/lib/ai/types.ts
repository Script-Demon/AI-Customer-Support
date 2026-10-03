import type { Category, Intent, Priority, Sentiment } from "@/lib/constants"
import type { KnowledgeSource } from "./rag"

export type ConversationMessage = {
  senderType: string // customer | agent | system
  content: string
  internal?: boolean
  authorName?: string | null
}

export type ConversationContext = {
  subject: string
  customerName: string
  agentName?: string
  messages: ConversationMessage[]
}

export const EMOTIONS = ["frustrated", "angry", "anxious", "confused", "satisfied", "calm"] as const
export type Emotion = (typeof EMOTIONS)[number]

export type AnalysisResult = {
  intent: Intent
  sentiment: Sentiment
  sentimentScore: number
  emotion: Emotion
  priority: Priority
  category: Category
  confidence: number
  requiresHuman: boolean
  reason: string
  summary: string
  suggestedResponse: string
  sources: KnowledgeSource[]
  model: string
}

export type Tone = "professional" | "friendly"
