import Link from "next/link"
import type { Metadata } from "next"
import { FileText, Plus } from "lucide-react"
import { prisma } from "@/lib/db"
import { KB_CATEGORIES } from "@/lib/constants"
import { activeEmbeddingModel } from "@/lib/ai/embeddings"
import { timeAgo } from "@/lib/format"
import { buttonVariants } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { AskKnowledgeBase } from "@/components/knowledge/ask-kb"
import { ReindexButton } from "@/components/knowledge/reindex-button"

export const metadata: Metadata = { title: "Knowledge base" }

export default async function KnowledgePage() {
  const docs = await prisma.knowledgeDocument.findMany({
    orderBy: { title: "asc" },
    include: { chunks: { select: { embeddingModel: true } } },
  })
  const model = activeEmbeddingModel()
  const stale = docs.filter((d) => d.chunks.some((c) => c.embeddingModel !== model)).length
  const categories = [...new Set([...KB_CATEGORIES, ...docs.map((d) => d.category)])].filter((c) => docs.some((d) => d.category === c))

  return (
    <div>
      <PageHeader title="Knowledge base" description="Articles the AI retrieves (RAG) before it analyzes tickets or drafts replies.">
        <ReindexButton />
        <Link href="/knowledge/new" className={buttonVariants()}>
          <Plus /> New article
        </Link>
      </PageHeader>

      <div className="space-y-6 p-4 md:p-6">
        <AskKnowledgeBase />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground tabular-nums">{docs.length}</strong> articles
          </span>
          <span>
            <strong className="text-foreground tabular-nums">{docs.reduce((s, d) => s + d.chunks.length, 0)}</strong> embedded chunks
          </span>
          <span>
            Embedding model: <code className="rounded bg-muted px-1">{model}</code>
          </span>
          {stale > 0 && <span className="text-amber-700">{stale} article(s) embedded with another model — re-indexed automatically on next search.</span>}
        </div>

        {categories.map((category) => (
          <section key={category}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{category}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {docs
                .filter((d) => d.category === category)
                .map((d) => (
                  <Link key={d.id} href={`/knowledge/${d.id}`} className="group rounded-xl border bg-background p-4 transition-colors hover:border-primary/40">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <h3 className="font-medium group-hover:underline">{d.title}</h3>
                        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{d.content}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {d.chunks.length} chunk{d.chunks.length === 1 ? "" : "s"} · updated {timeAgo(d.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
