import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  label: string
  value: string
  hint?: string
  /** Change vs previous period, already formatted (e.g. "+4 pts"). */
  delta?: { text: string; direction: "up" | "down" | "flat"; good: boolean | null } | null
}

export function StatTile({ label, value, hint, delta }: Props) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        {delta && delta.direction !== "flat" && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", delta.good == null ? "text-muted-foreground" : delta.good ? "text-emerald-700" : "text-red-700")}>
            {delta.direction === "up" ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {delta.text}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  )
}

/** Builds a delta between two values; `higherIsBetter` decides the colour (null = neutral, e.g. volume). */
export function makeDelta(current: number | null, previous: number | null, opts: { higherIsBetter: boolean | null; format: (diff: number) => string }) {
  if (current == null || previous == null) return null
  const diff = current - previous
  if (Math.abs(diff) < 1e-9) return { text: "no change", direction: "flat" as const, good: null }
  const direction = diff > 0 ? ("up" as const) : ("down" as const)
  return { text: opts.format(Math.abs(diff)), direction, good: opts.higherIsBetter == null ? null : (diff > 0) === opts.higherIsBetter }
}
