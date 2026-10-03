import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"
import {
  PRIORITY_LABEL,
  SENTIMENT_EMOJI,
  STATUS_LABEL,
  isPriority,
  isStatus,
  type Sentiment,
} from "@/lib/constants"

const pill = "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset"

const STATUS_STYLE = {
  open: "bg-sky-50 text-sky-700 ring-sky-600/20",
  in_progress: "bg-violet-50 text-violet-700 ring-violet-600/20",
  waiting: "bg-amber-50 text-amber-800 ring-amber-600/20",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
} as const

export function StatusBadge({ status }: { status: string }) {
  if (!isStatus(status)) return null
  return <span className={cn(pill, STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>
}

const PRIORITY_STYLE = {
  low: "bg-slate-50 text-slate-600 ring-slate-500/20",
  medium: "bg-blue-50 text-blue-700 ring-blue-600/20",
  high: "bg-orange-50 text-orange-700 ring-orange-600/25",
  urgent: "bg-red-50 text-red-700 ring-red-600/25",
} as const

const PRIORITY_DOT = { low: "bg-slate-400", medium: "bg-blue-500", high: "bg-orange-500", urgent: "bg-red-600" } as const

export function PriorityBadge({ priority }: { priority: string }) {
  if (!isPriority(priority)) return null
  return (
    <span className={cn(pill, PRIORITY_STYLE[priority])}>
      <span className={cn("size-1.5 rounded-full", PRIORITY_DOT[priority])} />
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

const SENTIMENT_STYLE: Record<Sentiment, string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  neutral: "bg-slate-50 text-slate-600 ring-slate-500/20",
  negative: "bg-red-50 text-red-700 ring-red-600/20",
}

export function SentimentBadge({ sentiment, label }: { sentiment: string | null; label?: string }) {
  if (sentiment !== "positive" && sentiment !== "neutral" && sentiment !== "negative") return null
  return (
    <span className={cn(pill, SENTIMENT_STYLE[sentiment])}>
      <span aria-hidden>{SENTIMENT_EMOJI[sentiment]}</span>
      {label ?? sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
    </span>
  )
}

export function TagPill({ name }: { name: string }) {
  return <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">#{name}</span>
}

export function AgentAvatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" }) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs"
      )}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </span>
  )
}
