"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertTriangle, BookOpen, Braces, CheckCircle2, CornerDownLeft, Loader2, RefreshCw, Sparkles, UserRound } from "lucide-react"
import { reanalyzeTicket, updateTicket } from "@/app/actions"
import type { KnowledgeSource } from "@/lib/ai/rag"
import { humanize, isPriority, type Priority } from "@/lib/constants"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PriorityBadge, SentimentBadge } from "@/components/badges"
import { useDraft } from "./draft-context"

export type AnalysisView = {
  intent: string
  sentiment: string
  sentimentScore: number
  emotion: string
  priority: string
  category: string
  confidence: number
  requiresHuman: boolean
  reason: string
  summary: string
  suggestedResponse: string
  model: string
  createdAt: string
  sources: KnowledgeSource[]
}

export function AnalysisPanel({ ticketId, ticketPriority, analysis }: { ticketId: number; ticketPriority: string; analysis: AnalysisView | undefined | null }) {
  const { setDraft } = useDraft()
  const [pending, startTransition] = useTransition()
  const [showJson, setShowJson] = useState(false)

  const reanalyze = () =>
    startTransition(async () => {
      const res = await reanalyzeTicket(ticketId)
      if (res.ok) toast.success("Analysis updated")
      else toast.error(res.error)
    })

  if (!analysis) {
    return (
      <section className="rounded-xl border bg-background p-4 text-sm">
        <p className="text-muted-foreground">No AI analysis yet.</p>
        <Button size="sm" className="mt-2" onClick={reanalyze} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Analyze
        </Button>
      </section>
    )
  }

  const flagged = analysis.requiresHuman || analysis.priority === "high" || analysis.priority === "urgent"
  const priorityDiffers = analysis.priority !== ticketPriority && isPriority(analysis.priority)
  const scorePct = Math.round(((analysis.sentimentScore + 1) / 2) * 100)

  return (
    <section className="overflow-hidden rounded-xl border bg-background" aria-label="AI analysis">
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">AI analysis</h2>
        <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
          {analysis.model} · {timeAgo(new Date(analysis.createdAt))}
        </span>
        <Button size="icon-sm" variant="ghost" className="ml-auto" onClick={reanalyze} disabled={pending} aria-label="Re-run analysis" title="Re-run analysis">
          <RefreshCw className={cn(pending && "animate-spin")} />
        </Button>
      </header>

      {flagged && (
        <div className={cn("border-b px-4 py-3 text-sm", analysis.priority === "urgent" || analysis.requiresHuman ? "bg-red-50 text-red-950" : "bg-orange-50 text-orange-950")}>
          <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
            <AlertTriangle className="size-3.5" /> {analysis.priority === "urgent" ? "Urgent" : analysis.priority === "high" ? "High priority" : "Needs attention"}
          </div>
          <p className="mt-1">
            Customer is <strong>{analysis.emotion}</strong>. Reason: {analysis.reason}.
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs">
            <UserRound className="size-3.5" />
            AI recommendation: {analysis.requiresHuman ? <strong>Escalate to a human agent.</strong> : "Safe to answer with the suggested reply."}
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Intent</dt>
          <dd className="font-medium">{humanize(analysis.intent)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Category</dt>
          <dd className="font-medium">{analysis.category}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Sentiment</dt>
          <dd className="mt-0.5 flex items-center gap-1.5">
            <SentimentBadge sentiment={analysis.sentiment} label={humanize(analysis.emotion)} />
          </dd>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gradient-to-r from-red-200 via-slate-200 to-emerald-200" title={`Score ${analysis.sentimentScore}`}>
            <div className="relative h-full" style={{ width: `${scorePct}%` }}>
              <span className="absolute top-1/2 right-0 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground" />
            </div>
          </div>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Suggested priority</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={analysis.priority} />
            {priorityDiffers && (
              <button
                className="text-xs font-medium text-primary hover:underline"
                onClick={() =>
                  startTransition(async () => {
                    const res = await updateTicket(ticketId, { priority: analysis.priority as Priority })
                    if (!res.ok) toast.error(res.error)
                  })
                }
              >
                Apply
              </button>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Confidence</dt>
          <dd className="font-medium tabular-nums">{Math.round(analysis.confidence * 100)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Requires human</dt>
          <dd className={cn("flex items-center gap-1 font-medium", analysis.requiresHuman ? "text-red-600" : "text-emerald-600")}>
            {analysis.requiresHuman ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
            {analysis.requiresHuman ? "Yes" : "No"}
          </dd>
        </div>
      </dl>

      <div className="border-t px-4 py-3 text-sm">
        <div className="text-xs text-muted-foreground">Summary</div>
        <p className="mt-0.5">{analysis.summary}</p>
      </div>

      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Suggested response</span>
          <Button size="xs" variant="outline" onClick={() => setDraft(analysis.suggestedResponse, { aiGenerated: true, sources: analysis.sources })}>
            <CornerDownLeft /> Use this reply
          </Button>
        </div>
        <p className="mt-1.5 max-h-48 overflow-y-auto rounded-md bg-muted/60 p-2.5 text-sm whitespace-pre-wrap">{analysis.suggestedResponse}</p>
      </div>

      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="size-3.5" /> Knowledge base sources (RAG)
        </div>
        {analysis.sources.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No relevant articles found — the AI was told not to invent policy.</p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {analysis.sources.map((s) => (
              <li key={s.documentId}>
                <Link href={`/knowledge/${s.documentId}`} className="group block rounded-md border px-2.5 py-1.5 hover:bg-muted/50">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate font-medium group-hover:underline">{s.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">{s.score.toFixed(2)}</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{s.snippet}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t px-4 py-2">
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowJson((v) => !v)}>
          <Braces className="size-3.5" /> {showJson ? "Hide" : "View"} structured output
        </button>
        {showJson && (
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-950 p-2.5 text-[11px] leading-relaxed text-slate-100">
            {JSON.stringify(
              {
                intent: analysis.intent,
                sentiment: analysis.emotion,
                sentiment_label: analysis.sentiment,
                sentiment_score: analysis.sentimentScore,
                priority: analysis.priority,
                category: analysis.category,
                confidence: analysis.confidence,
                requires_human: analysis.requiresHuman,
                reason: analysis.reason,
                suggested_response: analysis.suggestedResponse,
              },
              null,
              2
            )}
          </pre>
        )}
      </div>
    </section>
  )
}
