"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"
import { reindexKnowledge } from "@/app/actions"
import { Button } from "@/components/ui/button"

export function ReindexButton() {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await reindexKnowledge()
          if (res.ok) toast.success(`Re-embedded ${res.data.reindexed} articles`)
          else toast.error(res.error)
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} /> Re-index
    </Button>
  )
}
