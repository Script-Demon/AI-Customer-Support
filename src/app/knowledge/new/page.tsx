import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { DocForm } from "@/components/knowledge/doc-form"

export const metadata: Metadata = { title: "New article" }

export default function NewArticlePage() {
  return (
    <div>
      <PageHeader title="New article" description="Saved articles are chunked and embedded so the AI can retrieve them." />
      <div className="max-w-4xl p-4 md:p-6">
        <DocForm />
      </div>
    </div>
  )
}
