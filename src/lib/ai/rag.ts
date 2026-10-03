import { prisma } from "@/lib/db"
import { activeEmbeddingModel, cosine, embed } from "./embeddings"

export type KnowledgeSource = {
  documentId: string
  title: string
  category: string
  snippet: string
  score: number
}

/** Splits a document into ~`maxChars` chunks on paragraph boundaries, keeping the title as context. */
export function chunkDocument(title: string, content: string, maxChars = 700): string[] {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const chunks: string[] = []
  let current = ""
  for (const para of paragraphs) {
    if (current && current.length + para.length + 2 > maxChars) {
      chunks.push(current)
      current = ""
    }
    current = current ? `${current}\n\n${para}` : para
  }
  if (current) chunks.push(current)
  return chunks.map((c) => `${title}\n\n${c}`)
}

export async function indexDocument(documentId: string) {
  const doc = await prisma.knowledgeDocument.findUniqueOrThrow({ where: { id: documentId } })
  const texts = chunkDocument(doc.title, doc.content)
  const { vectors, model } = await embed(texts)
  await prisma.$transaction([
    prisma.knowledgeChunk.deleteMany({ where: { documentId } }),
    prisma.knowledgeChunk.createMany({
      data: texts.map((content, position) => ({
        documentId,
        position,
        content,
        embedding: JSON.stringify(vectors[position]),
        embeddingModel: model,
      })),
    }),
  ])
}

/** Re-embeds every document whose chunks were produced by a different embedding model. */
export async function ensureIndexed() {
  const model = activeEmbeddingModel()
  const docs = await prisma.knowledgeDocument.findMany({
    select: { id: true, chunks: { select: { embeddingModel: true } } },
  })
  const stale = docs.filter((d) => d.chunks.length === 0 || d.chunks.some((c) => c.embeddingModel !== model))
  for (const d of stale) await indexDocument(d.id)
  return stale.length
}

/**
 * Vector search over the knowledge base. Chunks are scored by cosine similarity in
 * application code (fine for a few hundred chunks; use pgvector beyond that).
 */
export async function searchKnowledge(query: string, k = 4, minScore = 0.15): Promise<KnowledgeSource[]> {
  if (!query.trim()) return []
  await ensureIndexed()
  const [{ vectors, model }, chunks] = await Promise.all([
    embed([query]),
    prisma.knowledgeChunk.findMany({ include: { document: { select: { title: true, category: true } } } }),
  ])
  const q = vectors[0]
  const best = new Map<string, KnowledgeSource>()
  for (const chunk of chunks) {
    if (chunk.embeddingModel !== model) continue
    const score = cosine(q, JSON.parse(chunk.embedding) as number[])
    if (score < minScore) continue
    const prev = best.get(chunk.documentId)
    // Keep only the best-matching chunk per document so sources stay diverse.
    if (!prev || prev.score < score) {
      best.set(chunk.documentId, {
        documentId: chunk.documentId,
        title: chunk.document.title,
        category: chunk.document.category,
        snippet: chunk.content.slice(chunk.document.title.length).trim(),
        score,
      })
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, k)
}

export function formatSourcesForPrompt(sources: KnowledgeSource[]) {
  if (sources.length === 0) return "No relevant knowledge base articles were found."
  return sources.map((s, i) => `[${i + 1}] ${s.title} (${s.category})\n${s.snippet}`).join("\n\n---\n\n")
}
