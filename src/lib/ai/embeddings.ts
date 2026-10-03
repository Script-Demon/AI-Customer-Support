import { EMBEDDING_MODEL, getOpenAI } from "./client"

export const LOCAL_EMBEDDING_MODEL = "local-hash-512"
const DIMS = 512

const STOPWORDS = new Set(
  "a an and are as at be been but by can could did do does for from had has have how i if in into is it its me my of on or our so that the their them then there these they this to too us was we were what when where which while who why will with would you your yours".split(
    " "
  )
)

// Folds common support vocabulary together so the offline embedder still matches
// "parcel hasn't arrived" with "shipping & delivery".
const SYNONYMS: Record<string, string> = {
  deliver: "ship", delivery: "ship", delivered: "ship", shipment: "ship", shipping: "ship", shipped: "ship",
  arrive: "ship", arrived: "ship", parcel: "packag", package: "packag", courier: "carrier",
  refund: "refund", refunded: "refund", reimburs: "refund",
  return: "return", returned: "return", returning: "return", exchange: "return",
  login: "sign", signin: "sign", password: "password", "2fa": "twofactor",
  charged: "charg", charge: "charg", invoice: "bill", billing: "bill", payment: "pay", paid: "pay",
  broken: "defect", damaged: "defect", faulty: "defect", defective: "defect",
  cancel: "cancel", cancelled: "cancel", canceled: "cancel", subscription: "subscript",
}

export function stem(word: string) {
  if (SYNONYMS[word]) return SYNONYMS[word]
  let w = word
  for (const suffix of ["ing", "edly", "ed", "ies", "es", "s", "ly"]) {
    if (w.length > suffix.length + 3 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length)
      break
    }
  }
  return SYNONYMS[w] ?? w
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem)
}

function fnv1a(str: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Deterministic feature-hashing embedding (unigrams + bigrams), L2-normalised. */
export function localEmbed(text: string): number[] {
  const vec = new Array<number>(DIMS).fill(0)
  const tokens = tokenize(text)
  const features = [...tokens, ...tokens.slice(1).map((t, i) => `${tokens[i]}_${t}`)]
  for (const f of features) {
    const h = fnv1a(f)
    const weight = f.includes("_") ? 0.5 : 1
    vec[h % DIMS] += (h & 0x80000000 ? -1 : 1) * weight
  }
  return normalize(vec)
}

function normalize(vec: number[]) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

export function activeEmbeddingModel() {
  return getOpenAI() ? EMBEDDING_MODEL : LOCAL_EMBEDDING_MODEL
}

/** Embeds texts with OpenAI when configured, otherwise with the local hashing embedder. */
export async function embed(texts: string[]): Promise<{ vectors: number[][]; model: string }> {
  const openai = getOpenAI()
  if (!openai || texts.length === 0) {
    return { vectors: texts.map(localEmbed), model: LOCAL_EMBEDDING_MODEL }
  }
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: texts })
  return { vectors: res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding), model: EMBEDDING_MODEL }
}
