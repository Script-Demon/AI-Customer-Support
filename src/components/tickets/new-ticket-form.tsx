"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Sparkles } from "lucide-react"
import { createTicket } from "@/app/actions"
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type TicketInput = Parameters<typeof createTicket>[0]

type Props = {
  customers: { id: string; name: string; email: string }[]
  agents: { id: string; name: string }[]
  tags: string[]
}

const EXAMPLES = [
  { subject: "Order still not received", message: "I ordered this product 10 days ago and still haven't received it. Can you tell me what's happening?" },
  { subject: "Return after 25 days?", message: "Can I return my order after 25 days? It doesn't fit as I hoped." },
  { subject: "Cam offline every night", message: "My Nimbus Cam keeps going offline every night and the light is solid red. Really annoying, I rely on it for security." },
]

export function NewTicketForm({ customers, agents, tags }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [priority, setPriority] = useState("auto")
  const [channel, setChannel] = useState("email")
  const [assignedAgentId, setAssignedAgentId] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createTicket({
        customerId: customerId === "new" ? undefined : customerId,
        customerName,
        customerEmail,
        subject,
        message,
        priority: priority as TicketInput["priority"],
        channel: channel as TicketInput["channel"],
        assignedAgentId: assignedAgentId || undefined,
        tags: selectedTags,
      })
      if (res.ok) {
        toast.success(`Ticket #${res.data.id} created and analyzed`)
        router.push(`/tickets/${res.data.id}`)
      } else toast.error(res.error)
    })
  }

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-5 rounded-xl border bg-background p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="customer">Customer</Label>
          <NativeSelect id="customer" className="w-full" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <NativeSelectOption value="new">+ New customer…</NativeSelectOption>
            {customers.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name} ({c.email})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {customerId === "new" && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="cname">Name</Label>
              <Input id="cname" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cemail">Email</Label>
              <Input id="cemail" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
            </div>
          </>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} />
      </div>
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="message">Customer message</Label>
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                type="button"
                key={ex.subject}
                className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                onClick={() => {
                  setSubject(ex.subject)
                  setMessage(ex.message)
                }}
              >
                {ex.subject}
              </button>
            ))}
          </div>
        </div>
        <Textarea id="message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} required minLength={5} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="priority">Priority</Label>
          <NativeSelect id="priority" className="w-full" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <NativeSelectOption value="auto">✨ Let AI decide</NativeSelectOption>
            {PRIORITIES.map((p) => <NativeSelectOption key={p} value={p}>{PRIORITY_LABEL[p]}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="channel">Channel</Label>
          <NativeSelect id="channel" className="w-full" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {["email", "chat", "web", "phone"].map((c) => <NativeSelectOption key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="assignee">Assign to</Label>
          <NativeSelect id="assignee" className="w-full" value={assignedAgentId} onChange={(e) => setAssignedAgentId(e.target.value)}>
            <NativeSelectOption value="">Unassigned</NativeSelectOption>
            {agents.map((a) => <NativeSelectOption key={a.id} value={a.id}>{a.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Tags</legend>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const on = selectedTags.includes(t)
            return (
              <button
                type="button"
                key={t}
                aria-pressed={on}
                onClick={() => setSelectedTags((s) => (on ? s.filter((x) => x !== t) : [...s, t]))}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              >
                #{t}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {pending ? "Analyzing…" : "Create & analyze"}
        </Button>
      </div>
    </form>
  )
}
