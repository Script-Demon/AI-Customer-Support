import { SENTIMENT_COLOR, SERIES } from "./palette"
import { SENTIMENT_EMOJI } from "@/lib/constants"

/** Horizontal bars with direct labels: one series, so one hue and no legend. */
export function BarList({ title, subtitle, items }: { title: string; subtitle?: string; items: { name: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  const total = items.reduce((s, i) => s + i.count, 0)
  return (
    <section className="rounded-xl border bg-background p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item.name} className="group" title={`${item.name}: ${item.count} (${total ? Math.round((item.count / total) * 100) : 0}%)`}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{item.name}</span>
              <span className="font-medium tabular-nums">
                {item.count} <span className="font-normal text-muted-foreground">· {total ? Math.round((item.count / total) * 100) : 0}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-opacity group-hover:opacity-80"
                style={{ width: `${(item.count / max) * 100}%`, backgroundColor: SERIES[1], minWidth: item.count ? 4 : 0 }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

const ORDER = ["positive", "neutral", "negative"] as const
const LABEL = { positive: "Positive", neutral: "Neutral", negative: "Negative" } as const

/** Part-to-whole sentiment split: one stacked bar plus a labelled legend (labels carry the values). */
export function SentimentSplit({ counts, total, compact = false }: { counts: Record<(typeof ORDER)[number], number>; total: number; compact?: boolean }) {
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={ORDER.map((k) => `${LABEL[k]} ${pct(counts[k])}%`).join(", ")}>
        {ORDER.filter((k) => counts[k] > 0).map((k) => (
          <div key={k} title={`${LABEL[k]}: ${counts[k]} (${pct(counts[k])}%)`} style={{ width: `${(counts[k] / Math.max(total, 1)) * 100}%`, backgroundColor: SENTIMENT_COLOR[k] }} />
        ))}
      </div>
      <ul className={compact ? "mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" : "mt-4 space-y-2 text-sm"}>
        {ORDER.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: SENTIMENT_COLOR[k] }} />
            <span aria-hidden>{SENTIMENT_EMOJI[k]}</span>
            <span>{LABEL[k]}</span>
            <span className="ml-auto pl-2 font-semibold tabular-nums">{pct(counts[k])}%</span>
            {!compact && <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">{counts[k]}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
