"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowRight, Loader2, Search, Sparkles } from "lucide-react"
import { askKnowledgeBase } from "@/app/actions"
import type { KnowledgeSource } from "@/lib/ai/rag"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const SAMPLES = ["Can I return my order after 25 days?", "My package hasn't arrived after 2 weeks", "How do I reset my earbuds?", "Was I charged twice?"]

/** RAG playground: shows the retrieval step and the grounded answer side by side. */
export function AskKnowledgeBase() {
  const [question, setQuestion] = useState("")
  const [asked, setAsked] = useState("")
  const [result, setResult] = useState<{ answer: string; sources: KnowledgeSource[] } | null>(null)
  const [pending, startTransition] = useTransition()

  const ask = (q: string) => {
    setQuestion(q)
    startTransition(async () => {
      const res = await askKnowledgeBase(q)
      if (res.ok) {
        setResult(res.data)
        setAsked(q)
      } else toast.error(res.error)
    })
  }

  return (
    <section className="rounded-xl border bg-background p-4" aria-label="Ask the knowledge base">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="size-4 text-primary" /> Ask the knowledge base
      </h2>
      <p className="text-xs text-muted-foreground">Type a customer question to see what gets retrieved and how the AI answers from it.</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (question.trim()) ask(question.trim())
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Can I return my order after 25 days?" className="pl-8" aria-label="Question" />
        </div>
        <Button type="submit" disabled={pending || !question.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />} Ask
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1">
        {SAMPLES.map((s) => (
          <button key={s} disabled={pending} onClick={() => ask(s)} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
            {s}
          </button>
        ))}
      </div>

      {result && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2" aria-live="polite">
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">1 · Retrieved context</h3>
            {result.sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing relevant found.</p>
            ) : (
              <ol className="space-y-2">
                {result.sources.map((s, i) => (
                  <li key={s.documentId} className="rounded-lg border p-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex size-5 items-center justify-center rounded bg-muted text-[11px] font-medium">{i + 1}</span>
                      <Link href={`/knowledge/${s.documentId}`} className="font-medium hover:underline">
                        {s.title}
                      </Link>
                      <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(4, s.score * 100))}%` }} />
                        </span>
                        {s.score.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{s.snippet}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">2 · Grounded answer</h3>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="mb-2 text-xs text-muted-foreground">“{asked}”</p>
              <p className="whitespace-pre-wrap">{result.answer}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
