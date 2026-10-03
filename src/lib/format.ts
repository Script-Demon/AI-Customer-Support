import { formatDistanceToNowStrict } from "date-fns"

export function timeAgo(date: Date) {
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

export function formatDuration(ms: number | null) {
  if (ms == null || Number.isNaN(ms)) return "—"
  const minutes = ms / 60_000
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = minutes / 60
  if (hours < 48) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`
}
