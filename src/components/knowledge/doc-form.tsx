"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Save, Trash2 } from "lucide-react"
import { deleteKnowledgeDoc, saveKnowledgeDoc } from "@/app/actions"
import { KB_CATEGORIES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Doc = { id: string; title: string; category: string; content: string }

export function DocForm({ doc }: { doc?: Doc }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState(doc?.title ?? "")
  const [category, setCategory] = useState(doc?.category ?? KB_CATEGORIES[0])
  const [content, setContent] = useState(doc?.content ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await saveKnowledgeDoc(doc?.id ?? null, { title, category, content })
      if (res.ok) {
        toast.success("Saved and re-embedded")
        if (!doc) router.push(`/knowledge/${res.data.id}`)
      } else toast.error(res.error)
    })
  }

  return (
    <form onSubmit={save} className="grid gap-4 rounded-xl border bg-background p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
        <div className="grid gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="category">Category</Label>
          <NativeSelect id="category" className="w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
            {[...new Set([...KB_CATEGORIES, category])].map((c) => <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="content">Content</Label>
        <Textarea id="content" rows={16} value={content} onChange={(e) => setContent(e.target.value)} required className="font-mono text-[13px] leading-relaxed" />
        <p className="text-xs text-muted-foreground">Separate topics with blank lines — the article is split into chunks on paragraph boundaries before embedding.</p>
      </div>
      <div className="flex items-center gap-2 border-t pt-4">
        {doc &&
          (confirmDelete ? (
            <>
              <span className="text-sm text-destructive">Delete this article?</span>
              <Button type="button" variant="destructive" size="sm" onClick={() => startTransition(() => deleteKnowledgeDoc(doc.id))}>
                Yes, delete
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          ))}
        <Button type="submit" className="ml-auto" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save & embed
        </Button>
      </div>
    </form>
  )
}
