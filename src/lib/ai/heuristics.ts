/**
 * Offline fallbacks for every AI feature. They run when no OPENAI_API_KEY is set
 * (and when an API call fails), so the dashboard is fully usable without a key.
 * Pure functions: no database access, easy to unit test.
 */
import { INTENT_CATEGORY, type Intent, type Priority, type Sentiment } from "@/lib/constants"
import type { KnowledgeSource } from "./rag"
import type { AnalysisResult, ConversationContext, ConversationMessage, Emotion, Tone } from "./types"
import { tokenize } from "./embeddings"

export const HEURISTIC_MODEL = "heuristic-v1"

const INTENT_PATTERNS: [Intent, RegExp[]][] = [
  ["order_tracking", [/where('?s| is) my (order|package|parcel)/, /\btrack(ing)?\b/, /(haven'?t|have not|never|still not|not yet) (received|arrived|got|gotten)/, /(hasn'?t|has not|didn'?t|did not) (arrive|come|ship)/, /\bdelay(ed)?\b/, /\b(ordered|order(ed)? it)\b.*\b\d+\s*(days?|weeks?) ago/]],
  ["shipping_info", [/shipping (cost|time|option|rate)s?/, /\b(ship|deliver) to\b/, /\binternational\b/, /how long (does|will) (it|shipping|delivery)/, /\bexpress\b/]],
  ["return_request", [/\breturn(ing|ed)?\b/, /\bexchange\b/, /send (it|this|them) back/, /\bwrong size\b/]],
  ["refund_request", [/\brefund(ed)?\b/, /money back/, /\breimburse/]],
  ["billing", [/\b(over)?charged?\b/, /\binvoice\b/, /\bbill(ing|ed)?\b/, /\bpayment\b/, /\b(credit )?card\b/, /\breceipt\b/, /\bdouble\b.*\bcharge/]],
  ["cancellation", [/\bcancel(l?ation|l?ed)?\b/, /\bunsubscribe\b/, /close my account/]],
  ["account_access", [/\blog ?in\b/, /\bsign ?in\b/, /\bpassword\b/, /\blocked( out)?\b/, /\b2fa\b|two[- ]factor/, /can'?t access/, /\b(hacked|compromised)\b/]],
  ["technical_issue", [/\berror\b/, /\bcrash(es|ing)?\b/, /\bbug\b/, /(not|isn'?t|stopped) working/, /doesn'?t work/, /won'?t (turn on|connect|sync|charge|pair)/, /\b(sync|pair|connect)(ing)? (issue|problem)/, /\bfirmware\b/, /\bbattery\b/, /\boffline\b/, /\b(keeps?|kept) (disconnecting|dropping|restarting|crashing)/, /\bsolid red\b|\bblinking\b/]],
  ["product_question", [/\b(waterproof|water resistant)\b/, /\bcompatible\b/, /\bspecs?\b/, /which (model|version|size)/, /difference between/, /how do (i|you) use/, /\bwarranty\b/, /does (it|the \w+) (come|support|work)/]],
  ["complaint", [/\b(terrible|worst|unacceptable|ridiculous|awful|horrible|disgusting)\b/, /\bcomplain(t)?\b/, /\bvery disappointed\b/]],
  ["feedback", [/\b(love|loving|amazing|awesome|fantastic)\b/, /\bfeature request\b/, /\bsuggestion\b/, /\bjust wanted to say\b/]],
]

const POSITIVE = new Set("thank thanks great love awesome amazing excellent happy pleased glad perfect fantastic wonderful appreciate helpful quick fast good nice resolved works worked".split(" "))
const NEGATIVE = new Set("angry upset frustrated frustrating annoyed annoying disappointed terrible awful horrible worst bad poor useless unacceptable ridiculous broken damaged wrong late delayed still never again problem issue fail failed failing error refund scam waste cancel complaint missing lost stolen hacked charged twice confused confusing".split(" "))
const INTENSIFIERS = new Set("very really extremely so totally completely absolutely".split(" "))
const NEGATIONS = new Set("not no never dont don't cant can't wont won't isnt isn't didnt didn't".split(" "))

/** Lexicon sentiment in [-1, 1], with negation, intensifiers, "!!!" and SHOUTING. */
export function scoreSentiment(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z'\s]/g, " ").split(/\s+/).filter(Boolean)
  let score = 0
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    let v = POSITIVE.has(w) ? 1 : NEGATIVE.has(w) ? -1 : 0
    if (!v) continue
    const prev = words.slice(Math.max(0, i - 3), i)
    if (prev.some((p) => NEGATIONS.has(p))) v *= -0.7
    if (INTENSIFIERS.has(words[i - 1])) v *= 1.5
    score += v
  }
  const exclamations = (text.match(/!/g) ?? []).length
  const shouting = (text.match(/\b[A-Z]{4,}\b/g) ?? []).length
  if (score < 0) score -= Math.min(exclamations, 3) * 0.3 + shouting * 0.5
  else if (score > 0) score += Math.min(exclamations, 3) * 0.2
  return Math.max(-1, Math.min(1, score / 4))
}

export function sentimentLabel(score: number): Sentiment {
  return score <= -0.15 ? "negative" : score >= 0.2 ? "positive" : "neutral"
}

const NUMBER_WORDS: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
const DURATION = String.raw`(\d+|a|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|week|month)s?`

function toDays(n: string, unit: string) {
  return (Number(n) || NUMBER_WORDS[n] || 0) * (unit === "week" ? 7 : unit === "month" ? 30 : 1)
}

/**
 * Longest wait the customer complains about: "10 days ago", "waiting two weeks",
 * "been almost a month". A bare duration ("return after 25 days") is not a wait.
 */
export function mentionedWaitDays(text: string): number {
  const lower = text.toLowerCase()
  const patterns = [
    new RegExp(String.raw`\b${DURATION}\s+ago\b`, "g"),
    new RegExp(String.raw`\b(?:waiting|waited|been|for)\s+(?:over\s+|almost\s+|nearly\s+|more than\s+)?${DURATION}`, "g"),
  ]
  let max = 0
  for (const re of patterns) for (const m of lower.matchAll(re)) max = Math.max(max, toDays(m[1], m[2]))
  return max
}

/** Days elapsed that the customer mentions, used to check policy windows ("after 25 days", "bought it 12 days ago"). */
export function mentionedElapsedDays(text: string): number | null {
  const m = text.toLowerCase().match(new RegExp(String.raw`\b${DURATION}`))
  return m ? toDays(m[1], m[2]) : null
}

/**
 * Offline stand-in for the LLM applying a policy: compares the days the customer
 * mentions with a "within N days" window in the retrieved article.
 */
export function policyWindowCheck(question: string, source: KnowledgeSource | undefined): string | null {
  if (!source) return null
  const elapsed = mentionedElapsedDays(question)
  const window = source.snippet.match(/within (\d+) days/i)
  if (elapsed == null || !window) return null
  const limit = Number(window[1])
  const what = /return|refund|exchange/i.test(question) ? "return window" : "policy window"
  return elapsed <= limit
    ? `Good news: at ${elapsed} days you're still within our ${limit}-day ${what}.`
    : `Unfortunately, at ${elapsed} days this is outside our ${limit}-day ${what}.`
}

export function detectIntent(text: string): { intent: Intent; confidence: number } {
  const lower = text.toLowerCase()
  const scores = INTENT_PATTERNS.map(([intent, patterns]) => ({
    intent,
    score: patterns.reduce((s, p) => s + (p.test(lower) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score)
  const [top, second] = scores
  if (top.score === 0) return { intent: "general_inquiry", confidence: 0.45 }
  const margin = top.score - (second?.score ?? 0)
  return { intent: top.intent, confidence: Math.min(0.95, 0.6 + 0.1 * top.score + 0.08 * margin) }
}

function detectEmotion(text: string, score: number, waitDays: number): Emotion {
  const lower = text.toLowerCase()
  if (score <= -0.6 || /\b(furious|angry|outraged|unacceptable|ridiculous)\b/.test(lower) || /\b[A-Z]{4,}\b/.test(text)) return "angry"
  if (score < -0.15 && (waitDays >= 5 || /\b(still|again|already)\b/.test(lower))) return "frustrated"
  if (/\b(worried|concerned|nervous|urgent|asap)\b/.test(lower)) return "anxious"
  if (/\b(confused|don'?t understand|not sure|unclear)\b/.test(lower)) return "confused"
  if (score < -0.15) return "frustrated"
  if (score >= 0.2) return "satisfied"
  return "calm"
}

const INTENT_REASON: Record<Intent, string> = {
  order_tracking: "Delayed shipment",
  shipping_info: "Shipping question",
  return_request: "Return request",
  refund_request: "Refund request",
  billing: "Billing problem",
  cancellation: "Cancellation request",
  account_access: "Account access problem",
  technical_issue: "Product not working",
  product_question: "Product question",
  complaint: "Service complaint",
  feedback: "Customer feedback",
  general_inquiry: "General question",
}

function lastCustomerText(messages: ConversationMessage[]) {
  const customer = messages.filter((m) => m.senderType === "customer")
  return customer.slice(-2).map((m) => m.content).join("\n")
}

function firstName(name: string) {
  return name.split(/\s+/)[0] || "there"
}

const INTERNAL_GUIDANCE = /\b(agents?|(the|a) customer|customers|escalate|never ask)\b/i

/** Picks the KB sentences that overlap most with the customer's question. */
export function bestSentences(source: KnowledgeSource | undefined, question: string, n = 2): string[] {
  if (!source) return []
  const q = new Set(tokenize(question))
  const sentences = source.snippet
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/^[-*•]\s*/, "").replace(/^[A-Z][\w &/-]{2,40}:\s+/, "").trim())
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    // Skip agent-facing guidance and FAQ questions; only quote customer-facing facts.
    .filter((s) => s.length > 25 && !s.endsWith(":") && !s.endsWith("?") && !INTERNAL_GUIDANCE.test(s))
  return sentences
    .map((s, i) => ({ s, i, score: new Set(tokenize(s).filter((t) => q.has(t))).size }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)
}

const NEXT_STEP: Record<Intent, string> = {
  order_tracking: "I've checked on your order and escalated it with our carrier. I'll send you the latest tracking update within 24 hours, and if the parcel can't be located we'll ship a replacement at no cost.",
  shipping_info: "Let me know your delivery address and I'll confirm the fastest option available to you.",
  return_request: "Reply with your order number and I'll email you a prepaid return label right away.",
  refund_request: "I've started reviewing your refund. Once approved, it is issued to your original payment method within 5–7 business days.",
  billing: "I'm reviewing the charges on your account now and will correct anything that isn't right.",
  cancellation: "I can take care of the cancellation for you — just confirm and I'll process it today.",
  account_access: "For your security, I've sent a password reset link to the email on file. If you don't see it within 10 minutes, please check your spam folder.",
  technical_issue: "Could you try the steps above and let me know the result? If the issue persists, send me your device model and firmware version and I'll escalate it to our technical team.",
  product_question: "Let me know if you have any other questions — I'm happy to help you pick the right option.",
  complaint: "I've escalated your case to our team lead so we can make this right.",
  feedback: "I've shared your message with the team — feedback like this genuinely shapes what we build next.",
  general_inquiry: "Let me know if there's anything else I can help with.",
}

const OPENER: Record<Sentiment, string> = {
  negative: "I'm really sorry for the trouble, and I understand how frustrating this is.",
  neutral: "Thanks for reaching out.",
  positive: "Thank you so much for your message!",
}

export function draftReplyHeuristic(ctx: ConversationContext, intent: Intent, sentiment: Sentiment, sources: KnowledgeSource[]) {
  const question = lastCustomerText(ctx.messages) || ctx.subject
  const facts = bestSentences(sources[0], question)
  const verdict = policyWindowCheck(question, sources[0])
  const parts = [`Hi ${firstName(ctx.customerName)},`, OPENER[sentiment]]
  if (verdict || facts.length) parts.push([verdict, ...facts].filter(Boolean).join(" "))
  parts.push(NEXT_STEP[intent])
  parts.push(`Best regards,\n${ctx.agentName ?? "Customer Support"}`)
  return parts.join("\n\n")
}

export function analyzeHeuristic(ctx: ConversationContext, sources: KnowledgeSource[]): AnalysisResult {
  const customer = ctx.messages.filter((m) => m.senderType === "customer").map((m) => m.content)
  const text = customer.slice(-2).join("\n") || ctx.subject
  const fullText = `${ctx.subject}\n${customer.join("\n")}`
  const { intent, confidence } = detectIntent(fullText)
  // The customer's mood *now* matters most, so weight the latest message.
  const latest = scoreSentiment(customer[customer.length - 1] ?? ctx.subject)
  const sentimentScore = customer.length > 1 ? 0.75 * latest + 0.25 * scoreSentiment(customer[customer.length - 2]) : latest
  const sentiment = sentimentLabel(sentimentScore)
  const waitDays = mentionedWaitDays(text)
  const emotion = detectEmotion(text, sentimentScore, waitDays)
  const lower = fullText.toLowerCase()

  const legalOrSecurity = /\b(lawyer|legal|sue|chargeback|dispute|bbb|hacked|compromised|fraud|stolen)\b/.test(lower)
  const urgentWords = /\b(urgent|asap|immediately|right now|emergency)\b/.test(lower)

  let priority: Priority = "medium"
  if (legalOrSecurity || (sentimentScore <= -0.6 && urgentWords)) priority = "urgent"
  else if (
    urgentWords ||
    emotion === "angry" ||
    (sentiment === "negative" && ["order_tracking", "billing", "refund_request", "account_access", "complaint"].includes(intent)) ||
    waitDays >= 7
  )
    priority = "high"
  else if (["feedback", "product_question", "shipping_info"].includes(intent) && sentiment !== "negative") priority = "low"

  const requiresHuman =
    legalOrSecurity || priority === "urgent" || intent === "complaint" || emotion === "angry" || sentimentScore <= -0.6 || confidence < 0.5

  const reasonParts = [INTENT_REASON[intent]]
  if (waitDays) reasonParts.push(`waiting ${waitDays} day${waitDays === 1 ? "" : "s"}`)
  if (legalOrSecurity) reasonParts.push("mentions legal/security risk")
  else if (sentiment === "negative") reasonParts.push(`${emotion} tone`)

  const firstCustomer = ctx.messages.find((m) => m.senderType === "customer")?.content ?? ctx.subject
  const firstSentence = firstCustomer.split(/(?<=[.!?])\s+/)[0].slice(0, 180)
  const summary = `${ctx.customerName} — ${INTENT_REASON[intent].toLowerCase()}. ${firstSentence}`

  return {
    intent,
    sentiment,
    sentimentScore: Number(sentimentScore.toFixed(2)),
    emotion,
    priority,
    category: INTENT_CATEGORY[intent],
    confidence: Number(confidence.toFixed(2)),
    requiresHuman,
    reason: reasonParts.join(", ").replace(/^./, (c) => c.toUpperCase()),
    summary,
    suggestedResponse: draftReplyHeuristic(ctx, intent, sentiment, sources),
    sources,
    model: HEURISTIC_MODEL,
  }
}

const TONE_RULES: Record<Tone, [RegExp, string][]> = {
  professional: [
    [/^(Hey|Hi|Hello)( there)?\s+([A-Z][\w-]*),/gm, "Dear $3,"],
    [/^(Hey|Hi) there,/gm, "Hello,"],
    [/\bThanks so much\b/g, "Thank you"],
    [/\bthanks\b/gi, "Thank you"],
    [/^Always happy to help[.!]?\n\n/gm, ""],
    [/\bI'm so sorry\b/g, "I sincerely apologize"],
    [/\bsorry\b/gi, "I apologize"],
    [/\bASAP\b/g, "as soon as possible"],
    [/\bcan't\b/gi, "cannot"],
    [/\bwon't\b/gi, "will not"],
    [/\b(do|does|is|are|has|have|did)n't\b/gi, "$1 not"],
    [/\bI'm\b/g, "I am"],
    [/\b(I|you|we|they)'ll\b/gi, "$1 will"],
    [/\b(you|we|they)'re\b/gi, "$1 are"],
    [/\b(it|that)'s\b/gi, "$1 is"],
    [/\bI've\b/g, "I have"],
    [/\bJust let me know\b/g, "Please let me know"],
    [/\bget back to you\b/gi, "follow up with you"],
    [/!+/g, "."],
    [/\s*[😊🙂😀👍🎉]+/gu, ""],
    [/^(Cheers|Thanks|Best),?$/gm, "Kind regards,"],
  ],
  friendly: [
    [/^Hello\b/gm, "Hi"],
    [/^Dear\b/gm, "Hi"],
    [/^Thank you for reaching out\b/gm, "Thanks so much for reaching out"],
    [/\bThank you\b/g, "Thanks so much"],
    [/\bI apologize\b/gi, "I'm so sorry"],
    [/\bcannot\b/gi, "can't"],
    [/\bdo not\b/gi, "don't"],
    [/\bI am\b/g, "I'm"],
    [/\bwe are\b/gi, "we're"],
    [/\bPlease let me know\b/g, "Just let me know"],
    [/^(Best regards|Kind regards|Sincerely),/gm, "Cheers,"],
  ],
}

export function rewriteHeuristic(text: string, tone: Tone) {
  let out = text
  for (const [pattern, replacement] of TONE_RULES[tone]) out = out.replace(pattern, replacement)
  if (tone === "friendly" && !/happy to help/i.test(out)) {
    out = out.replace(/\n\n(Cheers|Best regards|Kind regards),/, "\n\nAlways happy to help!\n\n$1,")
  }
  if (tone === "professional" && !/^(Hello|Dear)\b/.test(out.trim())) out = `Hello,\n\n${out}`
  return out
}

export function summarizeHeuristic(ctx: ConversationContext) {
  const visible = ctx.messages.filter((m) => !m.internal)
  const customerMsgs = visible.filter((m) => m.senderType === "customer")
  const agentMsgs = visible.filter((m) => m.senderType === "agent")
  const { intent } = detectIntent(`${ctx.subject}\n${customerMsgs.map((m) => m.content).join("\n")}`)
  const score = scoreSentiment(customerMsgs.slice(-1)[0]?.content ?? "")
  const last = visible[visible.length - 1]
  const lines = [
    `• Issue: ${INTENT_REASON[intent]} — "${(customerMsgs[0]?.content ?? ctx.subject).split(/(?<=[.!?])\s+/)[0].slice(0, 160)}"`,
    `• Messages: ${customerMsgs.length} from customer, ${agentMsgs.length} from agents`,
    `• Current mood: ${sentimentLabel(score)}`,
    last
      ? `• Latest: ${last.senderType === "customer" ? "customer is awaiting a reply" : "agent replied, waiting on customer"}`
      : "• Latest: no messages yet",
  ]
  return lines.join("\n")
}

export function answerHeuristic(question: string, sources: KnowledgeSource[]) {
  if (sources.length === 0) return "I couldn't find anything in the knowledge base about that. A human agent should follow up."
  const facts = bestSentences(sources[0], question, 3)
  const verdict = policyWindowCheck(question, sources[0])
  return `${[verdict, ...facts].filter(Boolean).join(" ")}\n\n(Source: ${sources[0].title})`
}
