import { format } from "date-fns"
import { Crown, Mail } from "lucide-react"
import { initials } from "@/lib/format"

export function CustomerCard(props: { name: string; email: string; plan: string; since: string; ticketCount: number }) {
  return (
    <section className="rounded-xl border bg-background p-4 text-sm" aria-label="Customer">
      <h2 className="mb-3 text-sm font-semibold">Customer</h2>
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{initials(props.name)}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium">
            {props.name}
            {props.plan === "vip" && (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
                <Crown className="size-2.5" /> VIP
              </span>
            )}
          </div>
          <a href={`mailto:${props.email}`} className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:underline">
            <Mail className="size-3" /> {props.email}
          </a>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-muted/60 p-2">
          <dt className="text-muted-foreground">Customer since</dt>
          <dd className="font-medium">{format(new Date(props.since), "MMM yyyy")}</dd>
        </div>
        <div className="rounded-md bg-muted/60 p-2">
          <dt className="text-muted-foreground">Total tickets</dt>
          <dd className="font-medium tabular-nums">{props.ticketCount}</dd>
        </div>
      </dl>
    </section>
  )
}
