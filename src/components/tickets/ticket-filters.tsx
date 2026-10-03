"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/constants"

export function TicketFilters({ agents, tags }: { agents: { id: string; name: string }[]; tags: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(params.get("q") ?? "")

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  // Debounce the free-text search.
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return
    const id = setTimeout(() => update("q", q.trim()), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const hasFilters = ["q", "priority", "assignee", "sentiment", "tag"].some((k) => params.get(k))

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject, customer, message, #id" className="bg-background pl-8" aria-label="Search tickets" />
      </div>
      <NativeSelect aria-label="Priority" value={params.get("priority") ?? ""} onChange={(e) => update("priority", e.target.value)} className="bg-background">
        <NativeSelectOption value="">All priorities</NativeSelectOption>
        {PRIORITIES.map((p) => <NativeSelectOption key={p} value={p}>{PRIORITY_LABEL[p]}</NativeSelectOption>)}
      </NativeSelect>
      <NativeSelect aria-label="Assignee" value={params.get("assignee") ?? ""} onChange={(e) => update("assignee", e.target.value)} className="bg-background">
        <NativeSelectOption value="">Any assignee</NativeSelectOption>
        <NativeSelectOption value="me">Assigned to me</NativeSelectOption>
        <NativeSelectOption value="unassigned">Unassigned</NativeSelectOption>
        {agents.map((a) => <NativeSelectOption key={a.id} value={a.id}>{a.name}</NativeSelectOption>)}
      </NativeSelect>
      <NativeSelect aria-label="Sentiment" value={params.get("sentiment") ?? ""} onChange={(e) => update("sentiment", e.target.value)} className="bg-background">
        <NativeSelectOption value="">Any sentiment</NativeSelectOption>
        <NativeSelectOption value="positive">😊 Positive</NativeSelectOption>
        <NativeSelectOption value="neutral">😐 Neutral</NativeSelectOption>
        <NativeSelectOption value="negative">😠 Negative</NativeSelectOption>
      </NativeSelect>
      <NativeSelect aria-label="Tag" value={params.get("tag") ?? ""} onChange={(e) => update("tag", e.target.value)} className="bg-background">
        <NativeSelectOption value="">Any tag</NativeSelectOption>
        {tags.map((t) => <NativeSelectOption key={t} value={t}>#{t}</NativeSelectOption>)}
      </NativeSelect>
      <NativeSelect aria-label="Sort" value={params.get("sort") ?? "updated"} onChange={(e) => update("sort", e.target.value === "updated" ? "" : e.target.value)} className="bg-background">
        <NativeSelectOption value="updated">Recently updated</NativeSelectOption>
        <NativeSelectOption value="created">Newest</NativeSelectOption>
        <NativeSelectOption value="priority">Highest priority</NativeSelectOption>
      </NativeSelect>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("")
            const status = params.get("status")
            startTransition(() => router.replace(status ? `${pathname}?status=${status}` : pathname, { scroll: false }))
          }}
        >
          <X /> Clear
        </Button>
      )}
    </div>
  )
}
