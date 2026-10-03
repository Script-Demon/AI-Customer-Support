"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { FlaskConical, Loader2 } from "lucide-react"
import { simulateCustomerMessage } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const PRESETS = [
  "It's been another week and still nothing. This is ridiculous!",
  "Thanks so much, that fixed it! Really appreciate the quick help.",
  "I'm not sure I understand — do I need to send the item back first?",
]

/** Demo-only: lets you play the customer to watch sentiment and priority update live. */
export function SimulateCustomer({ ticketId }: { ticketId: number }) {
  const [text, setText] = useState("")
  const [pending, startTransition] = useTransition()

  const submit = (content: string) =>
    startTransition(async () => {
      const res = await simulateCustomerMessage(ticketId, content)
      if (res.ok) {
        setText("")
        toast.success("Customer message received · AI re-analyzed the ticket")
      } else toast.error(res.error)
    })

  return (
    <section className="rounded-xl border border-dashed bg-background/60 p-4 text-sm" aria-label="Simulate customer reply">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <FlaskConical className="size-4 text-muted-foreground" /> Simulate customer reply
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Demo tool: post as the customer to see the AI re-triage the ticket.</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button key={p} disabled={pending} onClick={() => setText(p)} className="rounded-full border px-2 py-0.5 text-left text-[11px] text-muted-foreground hover:bg-muted">
            {p.length > 38 ? `${p.slice(0, 38)}…` : p}
          </button>
        ))}
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="mt-2" placeholder="Type a message as the customer…" />
      <Button size="sm" variant="secondary" className="mt-2" disabled={pending || !text.trim()} onClick={() => submit(text)}>
        {pending && <Loader2 className="animate-spin" />} Send as customer
      </Button>
    </section>
  )
}
