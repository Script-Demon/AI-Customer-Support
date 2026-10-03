import { describe, expect, it } from "vitest"
import { KNOWLEDGE_DOCS } from "../prisma/knowledge"
import { cosine, localEmbed } from "@/lib/ai/embeddings"
import {
  analyzeHeuristic,
  mentionedWaitDays,
  policyWindowCheck,
  rewriteHeuristic,
  scoreSentiment,
  sentimentLabel,
} from "@/lib/ai/heuristics"
import { chunkDocument, type KnowledgeSource } from "@/lib/ai/rag"

const returnPolicy = KNOWLEDGE_DOCS.find((d) => d.title === "Return Policy")!
const asSource = (doc: (typeof KNOWLEDGE_DOCS)[number]): KnowledgeSource => ({
  documentId: doc.title,
  title: doc.title,
  category: doc.category,
  snippet: doc.content,
  score: 1,
})

describe("offline ticket analysis", () => {
  it("flags a delayed order as high-priority order tracking", () => {
    const result = analyzeHeuristic(
      {
        subject: "Order not received",
        customerName: "Emma Wilson",
        messages: [
          {
            senderType: "customer",
            content: "I ordered this product 10 days ago and still haven't received it. Can you tell me what's happening?",
          },
        ],
      },
      []
    )
    expect(result.intent).toBe("order_tracking")
    expect(result.sentiment).toBe("negative")
    expect(result.emotion).toBe("frustrated")
    expect(result.priority).toBe("high")
    expect(result.requiresHuman).toBe(false)
    expect(result.reason).toMatch(/Delayed shipment/)
    expect(result.suggestedResponse).toMatch(/^Hi Emma,/)
  })

  it("escalates chargeback threats to urgent and requires a human", () => {
    const result = analyzeHeuristic(
      {
        subject: "Charged twice",
        customerName: "Omar Khan",
        messages: [{ senderType: "customer", content: "Charged twice AGAIN! If this isn't fixed today I'm filing a chargeback." }],
      },
      []
    )
    expect(result.intent).toBe("billing")
    expect(result.priority).toBe("urgent")
    expect(result.requiresHuman).toBe(true)
  })

  it("uses the latest customer message for sentiment", () => {
    const result = analyzeHeuristic(
      {
        subject: "Buds won't pair",
        customerName: "Liam",
        messages: [
          { senderType: "customer", content: "My earbuds won't pair, this is frustrating." },
          { senderType: "agent", content: "Please reset them." },
          { senderType: "customer", content: "Thanks, that worked! Great help." },
        ],
      },
      []
    )
    expect(result.sentiment).toBe("positive")
  })
})

describe("sentiment scoring", () => {
  it("handles negation", () => {
    expect(sentimentLabel(scoreSentiment("This is not good at all"))).toBe("negative")
    expect(sentimentLabel(scoreSentiment("Thank you, this is great!"))).toBe("positive")
  })
})

describe("wait and policy-window detection", () => {
  it("distinguishes waits from policy questions", () => {
    expect(mentionedWaitDays("I ordered it 10 days ago")).toBe(10)
    expect(mentionedWaitDays("been waiting two weeks")).toBe(14)
    expect(mentionedWaitDays("Can I return my order after 25 days?")).toBe(0)
  })

  it("applies the 30-day return window", () => {
    const source = asSource(returnPolicy)
    expect(policyWindowCheck("Can I return my order after 25 days?", source)).toMatch(/still within our 30-day return window/)
    expect(policyWindowCheck("Can I return it after 45 days?", source)).toMatch(/outside our 30-day return window/)
  })
})

describe("retrieval", () => {
  it("chunks documents with the title as context", () => {
    const chunks = chunkDocument("Shipping Policy", KNOWLEDGE_DOCS[2].content, 300)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) expect(chunk.startsWith("Shipping Policy\n\n")).toBe(true)
  })

  it("ranks the relevant article first with the local embedder", () => {
    const rank = (query: string) => {
      const q = localEmbed(query)
      return KNOWLEDGE_DOCS.map((d) => ({ title: d.title, score: cosine(q, localEmbed(`${d.title}\n${d.content}`)) })).sort(
        (a, b) => b.score - a.score
      )[0].title
    }
    expect(rank("Can I return my order after 25 days?")).toBe("Return Policy")
    expect(rank("my package still hasn't been delivered, tracking not updating")).toBe("Shipping Policy")
    expect(rank("I forgot my password and my account is locked")).toBe("Account Help")
  })
})

describe("tone rewriting", () => {
  it("makes replies more professional or friendlier", () => {
    expect(rewriteHeuristic("Hey Sam, sorry! I can't do that.", "professional")).toBe("Dear Sam, I apologize. I cannot do that.")
    const friendly = "Hi Kenji,\n\nThanks so much for reaching out.\n\nYou're within the window and I'll send a label.\n\nAlways happy to help!\n\nCheers,\nAva"
    expect(rewriteHeuristic(friendly, "professional")).toBe(
      "Dear Kenji,\n\nThank you for reaching out.\n\nYou are within the window and I will send a label.\n\nKind regards,\nAva"
    )
    expect(rewriteHeuristic("Hello Sam,\n\nI am happy to help.\n\nBest regards,\nAva", "friendly")).toContain("Cheers,")
  })
})
