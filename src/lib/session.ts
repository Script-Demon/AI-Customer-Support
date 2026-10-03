import { cookies } from "next/headers"
import { prisma } from "@/lib/db"

export const AGENT_COOKIE = "agentId"

// There is no auth in this demo: the "signed in" agent is picked from the
// sidebar switcher and remembered in a cookie.
export async function getCurrentAgent() {
  const id = (await cookies()).get(AGENT_COOKIE)?.value
  const agent = id ? await prisma.user.findUnique({ where: { id } }) : null
  return agent ?? (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }))
}
