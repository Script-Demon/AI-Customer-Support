"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Star, X } from "lucide-react"
import { setSatisfaction, setTicketTags, updateTicket } from "@/app/actions"
import { CATEGORIES, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, type Category, type Priority, type Status } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  ticketId: number
  status: string
  priority: string
  category: string | null
  assignedAgentId: string | null
  tags: string[]
  satisfaction: number | null
  agents: { id: string; name: string }[]
  allTags: string[]
}

export function TicketProperties(props: Props) {
  const { ticketId } = props
  const [pending, startTransition] = useTransition()
  const [tagInput, setTagInput] = useState("")

  const save = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) toast.error(res.error ?? "Update failed")
    })

  const addTag = () => {
    const tag = tagInput.trim()
    if (!tag) return
    setTagInput("")
    save(() => setTicketTags(ticketId, [...props.tags, tag]))
  }

  return (
    <section className="rounded-xl border bg-background p-4" aria-busy={pending} aria-label="Ticket properties">
      <h2 className="mb-3 text-sm font-semibold">Properties</h2>
      <div className="grid grid-cols-[88px_1fr] items-center gap-x-3 gap-y-2.5 text-sm">
        <label htmlFor="prop-status" className="text-muted-foreground">Status</label>
        <NativeSelect id="prop-status" className="w-full" value={props.status} onChange={(e) => save(() => updateTicket(ticketId, { status: e.target.value as Status }))}>
          {STATUSES.map((s) => <NativeSelectOption key={s} value={s}>{STATUS_LABEL[s]}</NativeSelectOption>)}
        </NativeSelect>

        <label htmlFor="prop-priority" className="text-muted-foreground">Priority</label>
        <NativeSelect id="prop-priority" className="w-full" value={props.priority} onChange={(e) => save(() => updateTicket(ticketId, { priority: e.target.value as Priority }))}>
          {PRIORITIES.map((p) => <NativeSelectOption key={p} value={p}>{PRIORITY_LABEL[p]}</NativeSelectOption>)}
        </NativeSelect>

        <label htmlFor="prop-assignee" className="text-muted-foreground">Assignee</label>
        <NativeSelect
          id="prop-assignee"
          className="w-full"
          value={props.assignedAgentId ?? ""}
          onChange={(e) => save(() => updateTicket(ticketId, { assignedAgentId: e.target.value || null }))}
        >
          <NativeSelectOption value="">Unassigned</NativeSelectOption>
          {props.agents.map((a) => <NativeSelectOption key={a.id} value={a.id}>{a.name}</NativeSelectOption>)}
        </NativeSelect>

        <label htmlFor="prop-category" className="text-muted-foreground">Category</label>
        <NativeSelect
          id="prop-category"
          className="w-full"
          value={props.category ?? ""}
          onChange={(e) => e.target.value && save(() => updateTicket(ticketId, { category: e.target.value as Category }))}
        >
          {!props.category && <NativeSelectOption value="">—</NativeSelectOption>}
          {CATEGORIES.map((c) => <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}
        </NativeSelect>

        <span className="self-start pt-1 text-muted-foreground">Tags</span>
        <div>
          <div className="flex flex-wrap gap-1">
            {props.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-muted py-0.5 pr-1 pl-2 text-xs">
                #{t}
                <button
                  aria-label={`Remove tag ${t}`}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={() => save(() => setTicketTags(ticketId, props.tags.filter((x) => x !== t)))}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <Input
            list="tag-options"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addTag()
              }
            }}
            onBlur={addTag}
            placeholder="Add tag…"
            className="mt-1.5 h-7 text-xs"
            aria-label="Add tag"
          />
          <datalist id="tag-options">
            {props.allTags.filter((t) => !props.tags.includes(t)).map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>

        {props.status === "resolved" && (
          <>
            <span className="text-muted-foreground">CSAT</span>
            <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Customer satisfaction">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={props.satisfaction === n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => save(() => setSatisfaction(ticketId, n))}
                  className="p-0.5"
                >
                  <Star className={cn("size-4", props.satisfaction && n <= props.satisfaction ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
                </button>
              ))}
              {!props.satisfaction && <span className="ml-1 text-xs text-muted-foreground">not rated</span>}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
