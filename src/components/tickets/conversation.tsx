"use client"

import { useEffect, useRef } from "react"
import { format } from "date-fns"
import { Lock, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"

type Message = {
  id: string
  senderType: string
  content: string
  internal: boolean
  aiGenerated: boolean
  createdAt: string
  authorName: string | null
  authorColor: string | null
}

export function Conversation({ customerName, messages }: { customerName: string; messages: Message[] }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" })
  }, [messages.length])

  return (
    <section aria-label="Conversation" className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto rounded-xl border bg-background p-4">
      {messages.map((m) => {
        const time = format(new Date(m.createdAt), "MMM d, HH:mm")
        if (m.senderType === "system") {
          return (
            <div key={m.id} className="text-center text-[11px] text-muted-foreground">
              {m.content} · <time suppressHydrationWarning>{time}</time>
            </div>
          )
        }
        if (m.internal) {
          return (
            <div key={m.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <Lock className="size-3" /> Internal note · {m.authorName ?? "Agent"} · <time suppressHydrationWarning>{time}</time>
              </div>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          )
        }
        const isCustomer = m.senderType === "customer"
        const name = isCustomer ? customerName : m.authorName ?? "Agent"
        return (
          <div key={m.id} className={cn("flex gap-2.5", !isCustomer && "flex-row-reverse")}>
            <span
              className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", isCustomer ? "bg-muted text-muted-foreground" : "text-white")}
              style={!isCustomer ? { backgroundColor: m.authorColor ?? "#6366f1" } : undefined}
            >
              {initials(name)}
            </span>
            <div className={cn("max-w-[85%] min-w-0", !isCustomer && "items-end text-right")}>
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground" style={{ justifyContent: isCustomer ? "flex-start" : "flex-end" }}>
                <span className="font-medium text-foreground">{name}</span>
                {m.aiGenerated && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">
                    <Sparkles className="size-2.5" /> AI-assisted
                  </span>
                )}
                <time suppressHydrationWarning>{time}</time>
              </div>
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-left text-sm whitespace-pre-wrap",
                  isCustomer ? "rounded-tl-sm bg-muted" : "rounded-tr-sm bg-primary text-primary-foreground"
                )}
              >
                {m.content}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </section>
  )
}
