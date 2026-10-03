import { Bot, Cpu } from "lucide-react"
import { prisma } from "@/lib/db"
import { getCurrentAgent } from "@/lib/session"
import { aiMode } from "@/lib/ai/client"
import { AgentSwitcher } from "./agent-switcher"
import { NavLinks } from "./nav-links"

export async function AppSidebar() {
  const [agents, current, openCount] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    getCurrentAgent(),
    prisma.ticket.count({ where: { status: { in: ["open", "in_progress"] } } }),
  ])
  const mode = aiMode()

  return (
    <aside className="sticky top-0 z-30 flex shrink-0 flex-col gap-3 border-b bg-sidebar p-3 md:h-screen md:w-60 md:border-r md:border-b-0 md:p-4">
      <div className="flex items-center gap-2 px-1">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bot className="size-4.5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Nimbus Support</div>
          <div className="text-xs text-muted-foreground">AI-assisted desk</div>
        </div>
      </div>

      <NavLinks openCount={openCount} />

      <div className="mt-auto hidden flex-col gap-3 md:flex">
        <div className="rounded-lg border bg-background p-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <Cpu className="size-3.5" />
            AI engine
            <span className={`ml-auto size-2 rounded-full ${mode.provider === "openai" ? "bg-emerald-500" : "bg-amber-500"}`} />
          </div>
          <p className="mt-1 text-muted-foreground">
            {mode.provider === "openai" ? `OpenAI · ${mode.model}` : "Offline mode: heuristics + local embeddings. Set OPENAI_API_KEY to use an LLM."}
          </p>
        </div>
        {current && <AgentSwitcher agents={agents} currentId={current.id} />}
      </div>
    </aside>
  )
}
