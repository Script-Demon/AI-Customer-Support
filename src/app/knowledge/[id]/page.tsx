import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/db"
import { DocForm } from "@/components/knowledge/doc-form"

async function getDoc(id: string) {
  return prisma.knowledgeDocument.findUnique({
    where: { id },
    include: { chunks: { orderBy: { position: "asc" }, select: { id: true, position: true, content: true, embeddingModel: true, embedding: true } } },
  })
}

export async function generateMetadata({ params }: PageProps<"/knowledge/[id]">): Promise<Metadata> {
  const doc = await getDoc((await params).id)
  return { title: doc?.title ?? "Article not found" }
}

export default async function ArticlePage({ params }: PageProps<"/knowledge/[id]">) {
  const doc = await getDoc((await params).id)
  if (!doc) notFound()

  return (
    <div>
      <div className="border-b bg-background px-4 py-3 md:px-6">
        <Link href="/knowledge" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Knowledge base
        </Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">{doc.title}</h1>
        <p className="text-xs text-muted-foreground">{doc.category}</p>
      </div>
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <DocForm doc={{ id: doc.id, title: doc.title, category: doc.category, content: doc.content }} />
        <aside className="rounded-xl border bg-background p-4">
          <h2 className="text-sm font-semibold">Embedded chunks</h2>
          <p className="text-xs text-muted-foreground">What the vector search actually matches against.</p>
          <ol className="mt-3 space-y-2">
            {doc.chunks.map((c) => {
              const dims = (JSON.parse(c.embedding) as number[]).length
              return (
                <li key={c.id} className="rounded-lg border p-2.5 text-xs">
                  <div className="mb-1 flex justify-between text-muted-foreground">
                    <span className="font-medium text-foreground">Chunk {c.position + 1}</span>
                    <span>
                      {c.embeddingModel} · {dims}d
                    </span>
                  </div>
                  <p className="line-clamp-6 whitespace-pre-wrap text-muted-foreground">{c.content.slice(doc.title.length).trim()}</p>
                </li>
              )
            })}
          </ol>
        </aside>
      </div>
    </div>
  )
}
