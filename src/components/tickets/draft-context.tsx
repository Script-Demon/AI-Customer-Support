"use client"

import { createContext, useContext, useState } from "react"
import type { KnowledgeSource } from "@/lib/ai/rag"

type DraftState = {
  draft: string
  aiGenerated: boolean
  sources: KnowledgeSource[]
  setDraft: (text: string, opts?: { aiGenerated?: boolean; sources?: KnowledgeSource[] }) => void
}

const DraftContext = createContext<DraftState | null>(null)

/** Shares the reply draft between the composer and the AI analysis panel ("Use this reply"). */
export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setText] = useState("")
  const [aiGenerated, setAiGenerated] = useState(false)
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const setDraft: DraftState["setDraft"] = (text, opts = {}) => {
    setText(text)
    if (opts.aiGenerated !== undefined) setAiGenerated(opts.aiGenerated)
    if (opts.sources !== undefined) setSources(opts.sources)
  }
  return <DraftContext.Provider value={{ draft, aiGenerated, sources, setDraft }}>{children}</DraftContext.Provider>
}

export function useDraft() {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error("useDraft must be used inside DraftProvider")
  return ctx
}
