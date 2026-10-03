import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/page-header"
import { NewTicketForm } from "@/components/tickets/new-ticket-form"

export const metadata: Metadata = { title: "New ticket" }

export default async function NewTicketPage() {
  const [customers, agents, tags] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ])
  return (
    <div>
      <PageHeader title="New ticket" description="Log a conversation on behalf of a customer. The AI triages it as soon as it's created." />
      <div className="p-4 md:p-6">
        <NewTicketForm customers={customers} agents={agents} tags={tags.map((t) => t.name)} />
      </div>
    </div>
  )
}
