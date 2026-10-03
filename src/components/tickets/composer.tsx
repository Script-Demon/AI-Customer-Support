"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { BookOpen, Briefcase, FileText, Loader2, Lock, Send, Smile, Sparkles, X } from "lucide-react"
import { aiGenerateReply, aiRewrite, aiSummarize, sendReply } from "@/app/actions"
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useDraft } from "./draft-context"

type Busy = null | "generate" | "professional" | "friendly" | "summary" | "send"

export function Composer({ ticketId, status }: { ticketId: number; status: string }) {
  const { draft, aiGenerated, sources, setDraft } = useDraft()
  const [mode, setMode] = useState<"reply" | "note">("reply")
  const [note, setNote] = useState("")
  const [summary, setSummary] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [nextStatus, setNextStatus] = useState<Status>(status === "resolved" ? "resolved" : "waiting")

  const text = mode === "reply" ? draft : note
  const setText = (value: string) => (mode === "reply" ? setDraft(value) : setNote(value))

  async function run<T>(kind: Exclude<Busy, null>, fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, onOk: (data: T) => void) {
    setBusy(kind)
    try {
      const res = await fn()
      if (res.ok) onOk(res.data)
      else toast.error(res.error)
    } finally {
      setBusy(null)
    }
  }

  const generate = () =>
    run("generate", () => aiGenerateReply(ticketId), (d) => {
      setMode("reply")
      setDraft(d.text, { aiGenerated: true, sources: d.sources })
    })

  const rewrite = (tone: "professional" | "friendly") =>
    run(tone, () => aiRewrite(draft, tone), (d) => setDraft(d, { aiGenerated: true }))

  const summarize = () => run("summary", () => aiSummarize(ticketId), (d) => setSummary(d))

  const send = () =>
    run(
      "send",
      () => sendReply(ticketId, { content: text, internal: mode === "note", aiGenerated: mode === "reply" && aiGenerated, nextStatus: mode === "reply" ? nextStatus : undefined }),
      () => {
        toast.success(mode === "note" ? "Internal note added" : `Reply sent · ticket ${STATUS_LABEL[nextStatus].toLowerCase()}`)
        if (mode === "reply") setDraft("", { aiGenerated: false, sources: [] })
        else setNote("")
      }
    )

  const disabled = busy !== null

  return (
    <section className="rounded-xl border bg-background" aria-label="Reply composer">
      <div className="flex items-center gap-1 border-b px-2 pt-2">
        {(["reply", "note"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm",
              mode === m ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "reply" ? <Send className="size-3.5" /> : <Lock className="size-3.5" />}
            {m === "reply" ? "Reply to customer" : "Internal note"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 border-b bg-muted/30 px-3 py-2">
        <Button size="sm" onClick={generate} disabled={disabled}>
          {busy === "generate" ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate Reply
        </Button>
        <Button size="sm" variant="outline" onClick={() => rewrite("professional")} disabled={disabled || !draft.trim()}>
          {busy === "professional" ? <Loader2 className="animate-spin" /> : <Briefcase />} Make More Professional
        </Button>
        <Button size="sm" variant="outline" onClick={() => rewrite("friendly")} disabled={disabled || !draft.trim()}>
          {busy === "friendly" ? <Loader2 className="animate-spin" /> : <Smile />} Make Friendlier
        </Button>
        <Button size="sm" variant="outline" onClick={summarize} disabled={disabled}>
          {busy === "summary" ? <Loader2 className="animate-spin" /> : <FileText />} Summarize Conversation
        </Button>
      </div>

      {summary && (
        <div className="mx-3 mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
            <FileText className="size-3.5" /> Conversation summary
            <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setSummary(null)} aria-label="Dismiss summary">
              <X className="size-3.5" />
            </button>
          </div>
          <p className="whitespace-pre-wrap">{summary}</p>
          <button
            className="mt-2 text-xs font-medium text-primary hover:underline"
            onClick={() => {
              setMode("note")
              setNote(summary)
            }}
          >
            Save as internal note
          </button>
        </div>
      )}

      <div className="p-3">
        {mode === "reply" && aiGenerated && draft && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
              <Sparkles className="size-3" /> AI draft — review before sending
            </span>
            {sources.length > 0 && (
              <>
                <BookOpen className="ml-1 size-3" /> Grounded in:
                {sources.slice(0, 3).map((s) => (
                  <Link key={s.documentId} href={`/knowledge/${s.documentId}`} className="underline-offset-2 hover:underline" title={s.snippet.slice(0, 200)}>
                    {s.title}
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim() && !disabled) send()
          }}
          rows={mode === "reply" ? 8 : 4}
          placeholder={mode === "reply" ? "Write a reply, or click Generate Reply to draft one from the knowledge base…" : "Notes are only visible to your team…"}
          className={cn("max-h-96 resize-y", mode === "reply" ? "min-h-40" : "min-h-24", mode === "note" && "bg-amber-50/60")}
        />
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-xs text-muted-foreground">Ctrl + Enter to send</span>
          {mode === "reply" && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Then set status
              <NativeSelect size="sm" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as Status)} aria-label="Status after sending">
                {STATUSES.map((s) => <NativeSelectOption key={s} value={s}>{STATUS_LABEL[s]}</NativeSelectOption>)}
              </NativeSelect>
            </label>
          )}
          <Button onClick={send} disabled={disabled || !text.trim()} variant={mode === "note" ? "secondary" : "default"}>
            {busy === "send" ? <Loader2 className="animate-spin" /> : mode === "reply" ? <Send /> : <Lock />}
            {mode === "reply" ? "Send reply" : "Add note"}
          </Button>
        </div>
      </div>
    </section>
  )
}
