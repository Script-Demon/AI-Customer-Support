import OpenAI from "openai"

let client: OpenAI | null | undefined

/** Returns an OpenAI client, or null when no API key is configured (offline mode). */
export function getOpenAI(): OpenAI | null {
  if (client !== undefined) return client
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  client = apiKey ? new OpenAI({ apiKey }) : null
  return client
}

export const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"
export const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"

export function aiMode() {
  return getOpenAI()
    ? ({ provider: "openai", model: CHAT_MODEL } as const)
    : ({ provider: "offline", model: "heuristic" } as const)
}

/**
 * Chat completion that must return JSON matching `schema` (OpenAI Structured Outputs).
 * Throws if the model refuses or returns something unparsable; callers fall back to heuristics.
 */
export async function completeJSON<T>(opts: {
  system: string
  user: string
  name: string
  schema: Record<string, unknown>
  temperature?: number
}): Promise<T> {
  const openai = getOpenAI()
  if (!openai) throw new Error("OpenAI is not configured")
  const res = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: opts.temperature ?? 0.2,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: opts.name, strict: true, schema: opts.schema },
    },
  })
  const msg = res.choices[0]?.message
  if (!msg?.content) throw new Error(msg?.refusal || "Empty model response")
  return JSON.parse(msg.content) as T
}

export async function completeText(system: string, user: string, temperature = 0.4): Promise<string> {
  const openai = getOpenAI()
  if (!openai) throw new Error("OpenAI is not configured")
  const res = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  })
  const text = res.choices[0]?.message?.content?.trim()
  if (!text) throw new Error("Empty model response")
  return text
}
