import { PrismaClient } from "@prisma/client"
import { analyzeHeuristic } from "../src/lib/ai/heuristics"
import { indexDocument, searchKnowledge } from "../src/lib/ai/rag"
import type { ConversationContext } from "../src/lib/ai/types"
import { KNOWLEDGE_DOCS } from "./knowledge"

const prisma = new PrismaClient()

// Deterministic randomness so every `npm run db:seed` produces the same dataset.
let seed = 42
function rand() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]
const between = (min: number, max: number) => min + rand() * (max - min)
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const AGENTS = [
  { name: "Sarah Chen", email: "sarah@nimbus.dev", role: "admin", avatarColor: "#6366f1" },
  { name: "Marcus Johnson", email: "marcus@nimbus.dev", role: "agent", avatarColor: "#0ea5e9" },
  { name: "Priya Patel", email: "priya@nimbus.dev", role: "agent", avatarColor: "#10b981" },
  { name: "Diego Alvarez", email: "diego@nimbus.dev", role: "agent", avatarColor: "#f59e0b" },
]

const FIRST = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "Lucas", "Mia", "James", "Amelia", "Benjamin", "Harper", "Elijah", "Evelyn", "Aiden", "Chloe", "Daniel", "Zoe", "Omar", "Fatima", "Kenji", "Aisha", "Mateo", "Leila", "Jonas", "Nadia", "Theo"]
const LAST = ["Wilson", "Garcia", "Brown", "Nguyen", "Kim", "Martinez", "Davis", "Lopez", "Clark", "Lewis", "Walker", "Hall", "Young", "Allen", "Wright", "Scott", "Hughes", "Rossi", "Khan", "Tanaka"]

const PRODUCTS = ["Nimbus Buds Pro", "Nimbus Hub", "Nimbus Cam", "Nimbus Buds Pro case", "Nimbus Cam 2-pack"]

type Template = {
  subject: string
  opener: string
  followUp?: string
  reply: string
  tags?: string[]
}

// {p} product, {d} days, {o} order number
const TEMPLATES: Template[] = [
  { subject: "Where is my order?", opener: "Hi, I ordered the {p} {d} days ago and still haven't received it. The tracking hasn't updated in days. Can you tell me what's happening?", followUp: "It's been almost two weeks now, this is really frustrating. I needed it for a trip.", reply: "I'm sorry about the wait. I've opened an investigation with the carrier, and since the order is past our 10 business day window I've shipped a free replacement with Express shipping.", tags: ["shipping-delay"] },
  { subject: "Package marked delivered but not here", opener: "Tracking says my {p} was delivered yesterday but there's nothing at my door. Order #{o}.", followUp: "Checked with neighbours and the mailroom, still nothing.", reply: "Thanks for checking with your neighbours. It's been over 48 hours, so I've opened a lost-package claim and a replacement is on its way.", tags: ["shipping-delay"] },
  { subject: "Shipping to Canada?", opener: "Do you ship the {p} to Canada and how long does international shipping take?", reply: "Yes, we ship to Canada. International orders take 7-14 business days and may be subject to import duties." },
  { subject: "Express shipping cost", opener: "How much is express shipping and how long will it take to arrive?", reply: "Express shipping costs $14.95 and arrives in 1-2 business days after dispatch. Standard shipping is free on orders over $50." },
  { subject: "Return request", opener: "Hi, can I return my {p}? I bought it {d} days ago and it's not really what I expected.", reply: "Of course! You're within the 30-day return window. I've emailed you a prepaid return label; a $6.95 return fee applies for change-of-mind returns.", tags: ["refund"] },
  { subject: "Wrong size ear tips / exchange", opener: "The ear tips that came with my {p} don't fit well. Can I exchange for a different color too?", reply: "Exchanges are free within 30 days of delivery. I've set up the exchange and you'll receive a label shortly." },
  { subject: "Refund still not received", opener: "I returned my {p} two weeks ago and I still haven't seen my refund. Order #{o}. What's going on?", followUp: "Still nothing on my card. Really disappointed with how long this is taking.", reply: "Your return was approved and the refund was issued to your original card. Banks usually take 5-7 business days to post it.", tags: ["refund"] },
  { subject: "Charged twice for my order", opener: "I was charged twice for order #{o}! Please refund the duplicate charge ASAP.", reply: "I checked our billing system: one of those is a pending authorization that will disappear automatically within 3-5 business days. You were only charged once.", tags: ["billing"] },
  { subject: "Cancel Nimbus Plus", opener: "Please cancel my Nimbus Plus subscription. I don't use the camera anymore.", reply: "I've cancelled your Nimbus Plus subscription. You keep access until the end of your current billing period." },
  { subject: "Can't log in to my account", opener: "I can't log in, it says my account is locked. I need to check my order status.", reply: "Your account was locked after several failed sign-in attempts. I've verified your identity and unlocked it, and sent a password reset link." },
  { subject: "Lost my 2FA phone", opener: "I lost my phone and now I can't get past two-factor authentication. How do I get back in?", reply: "I've verified your identity and started the 2FA reset. It takes up to 24 hours; you'll get an email once it's done." },
  { subject: "Buds won't pair", opener: "My {p} won't pair with my phone anymore. Only the left earbud connects. I've tried restarting.", followUp: "Tried the reset, still only the left one works.", reply: "Please reset the buds: place them in the case, close it for 10 seconds, then hold the case button for 15 seconds until it flashes amber three times, and pair again.", tags: ["bug"] },
  { subject: "Battery drains overnight", opener: "The battery on my {p} drains overnight even in the case. Is this a known issue?", reply: "Yes, this was a standby battery bug fixed in firmware 2.4.1. Please update in the Nimbus app under Settings > Firmware.", tags: ["bug"] },
  { subject: "Hub won't connect to Wi-Fi", opener: "Setting up the Nimbus Hub but it keeps failing at the Wi-Fi step. Error code 14.", reply: "The Hub needs a 2.4 GHz network for setup. Please switch your phone to the 2.4 GHz band, move the Hub near the router and try again.", tags: ["bug"] },
  { subject: "Camera keeps going offline", opener: "My Nimbus Cam goes offline every night and the light is solid red. Not working at all now.", reply: "A solid red light means the camera lost its Wi-Fi credentials. Please re-add it in the app; if it happens again we'll replace it under warranty.", tags: ["bug", "warranty"] },
  { subject: "Is it waterproof?", opener: "Are the {p} waterproof? I want to use them for running in the rain.", reply: "They're IPX4 rated: sweat and splash resistant, so running in light rain is fine, but they're not waterproof for swimming." },
  { subject: "Compatible with Android?", opener: "Is the {p} compatible with Android 11? Does the app support EQ?", reply: "Yes, the Nimbus app supports Android 10 and later and includes EQ settings and firmware updates." },
  { subject: "Warranty claim", opener: "My {p} stopped charging after 5 months. Is this covered by warranty?", reply: "That's covered by the 1-year limited warranty. Please send your order number and a short video of the issue and we'll ship a replacement.", tags: ["warranty"] },
  { subject: "Terrible experience", opener: "This is the worst customer experience I've had. My order #{o} arrived damaged, nobody answered my last email, and I've been waiting {d} days. Unacceptable.", followUp: "If this isn't fixed today I'm filing a chargeback with my bank.", reply: "I'm truly sorry. I've escalated your case to our team lead, shipped a replacement with Express shipping, and refunded your shipping costs.", tags: ["escalated"] },
  { subject: "Love the new buds!", opener: "Just wanted to say I love my {p}, the noise cancellation is amazing. Thanks!", reply: "Thank you so much for the kind words! I've shared your message with the team." },
  { subject: "Feature request: Cam schedules", opener: "Great product! Suggestion: it would be awesome if the Nimbus Cam could turn off alerts on a schedule.", reply: "Thanks for the suggestion! I've passed it on to our product team.", tags: ["feature-request"] },
  { subject: "Promo code not working", opener: "My promo code SPRING20 isn't working at checkout. Can you help?", reply: "Promo codes exclude clearance items and are case-sensitive. The items in your cart are on clearance, so the code can't apply." },
  { subject: "Change my order", opener: "I just placed order #{o} 20 minutes ago, can I change the color of the {p}?", reply: "Since it's within 1 hour of ordering, I've updated the color on your order." },
]

const FEATURED: { subject: string; opener: string; customer: string; hoursAgo: number; tags?: string[] }[] = [
  { subject: "Order still not received", opener: "I ordered this product 10 days ago and still haven't received it. Can you tell me what's happening?", customer: "Emma Wilson", hoursAgo: 0.5, tags: ["shipping-delay"] },
  { subject: "Return after 25 days?", opener: "Can I return my order after 25 days? The Nimbus Buds Pro just aren't comfortable for me.", customer: "Kenji Tanaka", hoursAgo: 1.2 },
  { subject: "Charged twice AGAIN", opener: "This is the THIRD time I've been charged twice for my Nimbus Plus subscription. Unacceptable! If this isn't fixed today I'm filing a chargeback.", customer: "Omar Khan", hoursAgo: 2.5, tags: ["billing", "escalated"] },
  { subject: "Account hacked?", opener: "I just got an email about an order I didn't place. I think my account has been hacked. Please help immediately.", customer: "Nadia Rossi", hoursAgo: 4 },
]

function fill(text: string) {
  return text
    .replace(/\{p\}/g, pick(PRODUCTS))
    .replace(/\{d\}/g, String(Math.floor(between(6, 16))))
    .replace(/\{o\}/g, String(Math.floor(between(40000, 49999))))
}

function signed(reply: string, customer: string, agent: string) {
  return `Hi ${customer.split(" ")[0]},\n\n${reply}\n\nBest regards,\n${agent}`
}

async function main() {
  console.log("Clearing data…")
  await prisma.aIAnalysis.deleteMany()
  await prisma.message.deleteMany()
  await prisma.ticket.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.user.deleteMany()
  await prisma.knowledgeChunk.deleteMany()
  await prisma.knowledgeDocument.deleteMany()
  // Restart ticket numbering at #1 (SQLite keeps AUTOINCREMENT counters in sqlite_sequence).
  await prisma.$executeRawUnsafe(`DELETE FROM sqlite_sequence WHERE name = 'Ticket'`).catch(() => {})

  console.log("Knowledge base…")
  for (const doc of KNOWLEDGE_DOCS) {
    const created = await prisma.knowledgeDocument.create({ data: doc })
    await indexDocument(created.id)
  }

  const agents = await Promise.all(AGENTS.map((data) => prisma.user.create({ data })))
  const tagNames = ["vip", "shipping-delay", "bug", "refund", "billing", "escalated", "feature-request", "warranty"]
  await prisma.tag.createMany({ data: tagNames.map((name) => ({ name })) })

  const customerNames = new Set<string>(FEATURED.map((f) => f.customer))
  while (customerNames.size < 40) customerNames.add(`${pick(FIRST)} ${pick(LAST)}`)
  const customers = await Promise.all(
    [...customerNames].map((name, i) =>
      prisma.customer.create({
        data: {
          name,
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          plan: i % 7 === 0 ? "vip" : "standard",
          createdAt: new Date(Date.now() - between(60, 400) * DAY),
        },
      })
    )
  )
  const customerByName = new Map(customers.map((c) => [c.name, c]))

  console.log("Tickets…")
  const now = Date.now()
  const TOTAL = 90
  const HORIZON_DAYS = 45
  for (let i = 0; i < TOTAL; i++) {
    // Skew volume toward recent days.
    const ageDays = HORIZON_DAYS * Math.pow(rand(), 1.3)
    const createdAt = new Date(now - ageDays * DAY - between(0, 6) * HOUR)
    const template = pick(TEMPLATES)
    const customer = pick(customers)
    const agent = pick(agents)
    const recent = ageDays < 2

    // Older tickets are mostly resolved; AI-drafted replies get more common over time.
    const status = recent
      ? pick(["open", "open", "in_progress", "waiting"] as const)
      : ageDays < 5
        ? pick(["in_progress", "waiting", "resolved", "resolved"] as const)
        : rand() < 0.93 ? "resolved" : "waiting"
    const aiShare = 0.25 + 0.5 * (1 - ageDays / HORIZON_DAYS)
    const replyIsAI = rand() < aiShare

    const opener = fill(template.opener)
    const messages: { senderType: string; content: string; createdAt: Date; authorId?: string; aiGenerated?: boolean; internal?: boolean }[] = [
      { senderType: "customer", content: opener, createdAt },
    ]
    let cursor = createdAt.getTime()
    const hasFollowUp = template.followUp && rand() < 0.6
    if (hasFollowUp && status !== "open") {
      cursor += between(2, 20) * HOUR
      messages.push({ senderType: "customer", content: template.followUp!, createdAt: new Date(cursor) })
    }

    let firstResponseAt: Date | null = null
    let resolvedAt: Date | null = null
    const assigned = status !== "open" || rand() < 0.4
    if (status !== "open") {
      cursor = Math.max(cursor, createdAt.getTime()) + between(8, replyIsAI ? 90 : 420) * MIN
      firstResponseAt = new Date(cursor)
      if (rand() < 0.25) {
        messages.push({ senderType: "agent", internal: true, authorId: agent.id, createdAt: new Date(cursor - 2 * MIN), content: pick(["Checked order history — first contact about this.", "Customer is VIP, prioritise.", "Looks like the known firmware issue, linking to bug tracker.", "Verified identity via last order number."]) })
      }
      messages.push({ senderType: "agent", authorId: agent.id, aiGenerated: replyIsAI, createdAt: firstResponseAt, content: signed(template.reply, customer.name, agent.name) })
    }
    if (status === "resolved") {
      cursor += between(1, 30) * HOUR
      if (rand() < 0.7) messages.push({ senderType: "customer", createdAt: new Date(cursor), content: pick(["Thanks, that worked!", "Great, thank you for the quick help.", "Perfect, appreciate it.", "Ok thanks."]) })
      resolvedAt = new Date(cursor + between(5, 120) * MIN)
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject: template.subject,
        customerId: customer.id,
        assignedAgentId: assigned ? agent.id : null,
        status,
        channel: pick(["email", "email", "chat", "web"]),
        createdAt,
        firstResponseAt,
        resolvedAt,
        resolvedByAI: status === "resolved" && replyIsAI,
        satisfaction: status === "resolved" && rand() < 0.75 ? (replyIsAI ? pick([4, 5, 5, 4, 3]) : pick([5, 4, 3, 5, 2, 4])) : null,
        tags: { connect: [...(template.tags ?? []), ...(customer.plan === "vip" ? ["vip"] : [])].map((name) => ({ name })) },
        messages: { create: messages },
      },
    })
    const lastActivity = resolvedAt ?? messages[messages.length - 1].createdAt
    await saveAnalysis(ticket.id, template.subject, customer.name, agent.name, messages, createdAt, lastActivity)
  }

  for (const f of FEATURED) {
    const createdAt = new Date(now - f.hoursAgo * HOUR)
    const customer = customerByName.get(f.customer)!
    const ticket = await prisma.ticket.create({
      data: {
        subject: f.subject,
        customerId: customer.id,
        status: "open",
        createdAt,
        tags: { connect: (f.tags ?? []).map((name) => ({ name })) },
        messages: { create: [{ senderType: "customer", content: f.opener, createdAt }] },
      },
    })
    await saveAnalysis(ticket.id, f.subject, customer.name, undefined, [{ senderType: "customer", content: f.opener }], createdAt, createdAt)
  }

  const count = await prisma.ticket.count()
  console.log(`Seeded ${agents.length} agents, ${customers.length} customers, ${count} tickets, ${KNOWLEDGE_DOCS.length} knowledge docs.`)
}

// Seed analyses use the offline analyzer so seeding never spends API credits.
async function saveAnalysis(
  ticketId: number,
  subject: string,
  customerName: string,
  agentName: string | undefined,
  messages: { senderType: string; content: string; internal?: boolean }[],
  createdAt: Date,
  updatedAt: Date
) {
  const ctx: ConversationContext = { subject, customerName, agentName, messages }
  const opener = messages.find((m) => m.senderType === "customer")?.content ?? ""
  const sources = await searchKnowledge(`${subject}\n${opener}`)
  const a = analyzeHeuristic(ctx, sources)
  await prisma.aIAnalysis.create({
    data: {
      ticketId,
      intent: a.intent,
      sentiment: a.sentiment,
      sentimentScore: a.sentimentScore,
      emotion: a.emotion,
      priority: a.priority,
      category: a.category,
      confidence: a.confidence,
      requiresHuman: a.requiresHuman,
      reason: a.reason,
      summary: a.summary,
      suggestedResponse: a.suggestedResponse,
      sources: JSON.stringify(a.sources),
      model: a.model,
      createdAt: new Date(createdAt.getTime() + 5000),
    },
  })
  await prisma.ticket.update({
    where: { id: ticketId },
    // Explicit updatedAt keeps "last activity" realistic instead of "seeded just now".
    data: { sentiment: a.sentiment, category: a.category, priority: a.priority, updatedAt },
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
