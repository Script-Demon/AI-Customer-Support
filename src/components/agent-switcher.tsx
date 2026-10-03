"use client"

import { useTransition } from "react"
import { setCurrentAgent } from "@/app/actions"
import { AgentAvatar } from "./badges"

type Agent = { id: string; name: string; role: string; avatarColor: string }

export function AgentSwitcher({ agents, currentId }: { agents: Agent[]; currentId: string }) {
  const [pending, startTransition] = useTransition()
  const current = agents.find((a) => a.id === currentId) ?? agents[0]
  return (
    <label className="flex items-center gap-2 rounded-lg border bg-background p-2" aria-busy={pending}>
      <AgentAvatar name={current.name} color={current.avatarColor} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted-foreground">Signed in as</div>
        <select
          aria-label="Switch agent"
          className="w-full truncate bg-transparent text-sm font-medium outline-none"
          value={currentId}
          disabled={pending}
          onChange={(e) => startTransition(() => setCurrentAgent(e.target.value))}
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.role === "admin" ? " (admin)" : ""}
            </option>
          ))}
        </select>
      </div>
    </label>
  )
}
